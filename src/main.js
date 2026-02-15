import Game from './game/Game.js';
import { addDOMListener, createDisposer } from './input/disposables.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const enterFullscreenButton = document.getElementById('enter-fullscreen');
const exitFullscreenButton = document.getElementById('exit-fullscreen');
const hint = document.querySelector('.hint');

const game = new Game(canvas, ctx);
window.__game = game;
window.__gameReady = true;
let isMobile = false;
let fullscreenPending = false;
const hideFullscreenControlsForTesting = new URLSearchParams(window.location.search).has('hideFullscreenForTesting');

const listenerDisposer = createDisposer();

function detectMobile() {
  const uaMobile = navigator.userAgentData?.mobile;
  if (typeof uaMobile === 'boolean') {
    return uaMobile;
  }
  const ua = navigator.userAgent || '';
  const uaHint = /Mobi|Android|iPhone|iPad|iPod|Mobile/i.test(ua);
  const coarsePointer = window.matchMedia('(pointer: coarse)').matches;
  const noHover = window.matchMedia('(hover: none)').matches;
  const smallScreen = window.matchMedia('(max-width: 900px)').matches;
  return uaHint || (coarsePointer && noHover && smallScreen);
}

function requestFullscreen() {
  if (!isMobile || document.fullscreenElement) return;
  const root = document.documentElement;
  if (root.requestFullscreen) {
    root.requestFullscreen().catch(() => {
      fullscreenPending = false;
      updateFullscreenButtons();
    });
  }
  fullscreenPending = true;
  updateFullscreenButtons();
}

function exitFullscreen() {
  if (!document.fullscreenElement) return;
  if (document.exitFullscreen) {
    document.exitFullscreen().catch(() => {});
  }
  fullscreenPending = false;
  updateFullscreenButtons();
}

function updateFullscreenButtons() {
  const showControls = Boolean(isMobile) && !hideFullscreenControlsForTesting;
  const isFullscreen = Boolean(document.fullscreenElement);
  if (enterFullscreenButton) {
    enterFullscreenButton.classList.toggle('is-hidden', !showControls || isFullscreen || fullscreenPending);
  }
  if (exitFullscreenButton) {
    exitFullscreenButton.classList.toggle('is-hidden', !showControls || !isFullscreen);
  }
}

function getCanvasPosition(event) {
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  return {
    x: (event.clientX - rect.left) * scaleX,
    y: (event.clientY - rect.top) * scaleY
  };
}

function resize() {
  const scale = Math.min(window.innerWidth / canvas.width, window.innerHeight / canvas.height);
  canvas.style.transform = `scale(${scale})`;
  if (game.setViewport) {
    isMobile = detectMobile();
    document.body.classList.toggle('mobile', isMobile);
    if (hint) {
      hint.textContent = isMobile ? 'Tap to continue' : 'Press SPACE for dialog / confirm';
    }
    game.setViewport({
      width: window.innerWidth,
      height: window.innerHeight,
      scale,
      isMobile
    });
  }
  updateFullscreenButtons();
}

function getTouchGesture(touches) {
  const [first, second] = touches;
  const firstPos = getCanvasPosition(first);
  const secondPos = getCanvasPosition(second);
  const centerX = (firstPos.x + secondPos.x) / 2;
  const centerY = (firstPos.y + secondPos.y) / 2;
  const dx = firstPos.x - secondPos.x;
  const dy = firstPos.y - secondPos.y;
  return {
    x: centerX,
    y: centerY,
    distance: Math.hypot(dx, dy)
  };
}

let gestureActive = false;
const activeTouches = new Map();

function resetTouchSession(reason = 'unknown') {
  if (gestureActive && game.handleGestureEnd) {
    game.handleGestureEnd();
  }
  gestureActive = false;
  activeTouches.forEach((position, id) => {
    if (position && game.handlePointerUp) {
      game.handlePointerUp({ ...position, button: 0, id, reason });
    }
  });
  activeTouches.clear();
}

function bindInputListeners() {
  listenerDisposer.add(addDOMListener(window, 'resize', resize));
  listenerDisposer.add(addDOMListener(document, 'fullscreenchange', () => {
    fullscreenPending = false;
    updateFullscreenButtons();
  }));

  listenerDisposer.add(addDOMListener(canvas, 'click', (event) => {
    const { x, y } = getCanvasPosition(event);
    game.handleClick?.(x, y);
  }));

  listenerDisposer.add(addDOMListener(canvas, 'mousedown', (event) => {
    const { x, y } = getCanvasPosition(event);
    game.handlePointerDown?.({ x, y, button: event.button, buttons: event.buttons });
  }));

  listenerDisposer.add(addDOMListener(canvas, 'mousemove', (event) => {
    const { x, y } = getCanvasPosition(event);
    game.handlePointerMove?.({ x, y, buttons: event.buttons });
  }));

  listenerDisposer.add(addDOMListener(window, 'mouseup', (event) => {
    const { x, y } = getCanvasPosition(event);
    game.handlePointerUp?.({ x, y, button: event.button });
  }));

  listenerDisposer.add(addDOMListener(canvas, 'wheel', (event) => {
    event.preventDefault();
    const { x, y } = getCanvasPosition(event);
    game.handleWheel?.({ x, y, deltaY: event.deltaY });
  }, { passive: false }));

  listenerDisposer.add(addDOMListener(canvas, 'touchstart', (event) => {
    const gesturesAllowed = !(game.state === 'midi-editor' && game.midiComposer?.recordModeActive);
    const shouldStartGesture = () => {
      if (!game.handleGestureStart) return false;
      if (typeof game.shouldHandleGestureStart !== 'function') return true;
      const touches = Array.from(event.touches).map((touch) => ({
        id: touch.identifier,
        ...getCanvasPosition(touch)
      }));
      return game.shouldHandleGestureStart({ touches });
    };
    if (['editor', 'pixel-editor', 'midi-editor'].includes(game.state)
      && event.touches.length >= 2
      && gesturesAllowed
      && shouldStartGesture()) {
      event.preventDefault();
      const gesture = getTouchGesture(event.touches);
      gestureActive = true;
      game.handleGestureStart?.(gesture);
      return;
    }
    event.preventDefault();
    Array.from(event.changedTouches).forEach((touch) => {
      const position = getCanvasPosition(touch);
      activeTouches.set(touch.identifier, position);
      game.handlePointerDown?.({
        ...position,
        button: 0,
        buttons: 1,
        id: touch.identifier,
        touchCount: event.touches.length
      });
    });
  }, { passive: false }));

  listenerDisposer.add(addDOMListener(canvas, 'touchmove', (event) => {
    if (game.state === 'midi-editor' && game.midiComposer?.recordModeActive) {
      gestureActive = false;
    }
    if (gestureActive && event.touches.length >= 2) {
      event.preventDefault();
      const gesture = getTouchGesture(event.touches);
      game.handleGestureMove?.(gesture);
      return;
    }
    event.preventDefault();
    Array.from(event.changedTouches).forEach((touch) => {
      const position = getCanvasPosition(touch);
      activeTouches.set(touch.identifier, position);
      game.handlePointerMove?.({ ...position, buttons: 1, id: touch.identifier, touchCount: event.touches.length });
    });
  }, { passive: false }));

  const endGesture = () => {
    if (!gestureActive) return;
    gestureActive = false;
    game.handleGestureEnd?.();
  };

  listenerDisposer.add(addDOMListener(canvas, 'touchend', (event) => {
    if (gestureActive && event.touches.length < 2) {
      endGesture();
    }
    Array.from(event.changedTouches).forEach((touch) => {
      const position = activeTouches.get(touch.identifier) || getCanvasPosition(touch);
      if (position && game.handlePointerUp) {
        game.handlePointerUp({ ...position, button: 0, id: touch.identifier, touchCount: event.touches.length });
      }
      activeTouches.delete(touch.identifier);
    });
  }));

  listenerDisposer.add(addDOMListener(canvas, 'touchcancel', (event) => {
    endGesture();
    Array.from(event.changedTouches).forEach((touch) => {
      const position = activeTouches.get(touch.identifier) || getCanvasPosition(touch);
      if (position && game.handlePointerUp) {
        game.handlePointerUp({ ...position, button: 0, id: touch.identifier, touchCount: event.touches.length });
      }
      activeTouches.delete(touch.identifier);
    });
  }));

  listenerDisposer.add(addDOMListener(canvas, 'contextmenu', (event) => {
    event.preventDefault();
  }));

  if (enterFullscreenButton) {
    listenerDisposer.add(addDOMListener(enterFullscreenButton, 'click', () => {
      requestFullscreen();
    }));
  }

  if (exitFullscreenButton) {
    listenerDisposer.add(addDOMListener(exitFullscreenButton, 'click', () => {
      exitFullscreen();
    }));
  }
}

bindInputListeners();
resize();

let last = performance.now();
let lastState = game.state;
function loop(now) {
  if (game.state !== lastState) {
    resetTouchSession(`state:${lastState}->${game.state}`);
    lastState = game.state;
    updateFullscreenButtons();
  }
  const dt = Math.min((now - last) / 1000, 0.033);
  last = now;
  game.update(dt);
  game.draw();
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
