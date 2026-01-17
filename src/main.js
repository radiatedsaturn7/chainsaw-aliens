import Game from './game/Game.js';

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
  const showControls = Boolean(isMobile);
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

window.addEventListener('resize', resize);
document.addEventListener('fullscreenchange', () => {
  fullscreenPending = false;
  updateFullscreenButtons();
});
resize();

canvas.addEventListener('click', (event) => {
  const { x, y } = getCanvasPosition(event);
  if (game.handleClick) {
    game.handleClick(x, y);
  }
});

canvas.addEventListener('mousedown', (event) => {
  const { x, y } = getCanvasPosition(event);
  if (game.handlePointerDown) {
    game.handlePointerDown({ x, y, button: event.button, buttons: event.buttons });
  }
});

canvas.addEventListener('mousemove', (event) => {
  const { x, y } = getCanvasPosition(event);
  if (game.handlePointerMove) {
    game.handlePointerMove({ x, y, buttons: event.buttons });
  }
});

window.addEventListener('mouseup', (event) => {
  const { x, y } = getCanvasPosition(event);
  if (game.handlePointerUp) {
    game.handlePointerUp({ x, y, button: event.button });
  }
});

canvas.addEventListener('wheel', (event) => {
  event.preventDefault();
  const { x, y } = getCanvasPosition(event);
  if (game.handleWheel) {
    game.handleWheel({ x, y, deltaY: event.deltaY });
  }
}, { passive: false });

let gestureActive = false;
const activeTouches = new Map();

canvas.addEventListener('touchstart', (event) => {
  if (game.state === 'editor' && event.touches.length >= 2) {
    event.preventDefault();
    const gesture = getTouchGesture(event.touches);
    gestureActive = true;
    if (game.handleGestureStart) {
      game.handleGestureStart(gesture);
    }
    return;
  }
  event.preventDefault();
  Array.from(event.changedTouches).forEach((touch) => {
    const position = getCanvasPosition(touch);
    activeTouches.set(touch.identifier, position);
    if (game.handlePointerDown) {
      game.handlePointerDown({
        ...position,
        button: 0,
        buttons: 1,
        id: touch.identifier,
        touchCount: event.touches.length
      });
    }
  });
}, { passive: false });

canvas.addEventListener('touchmove', (event) => {
  if (gestureActive && event.touches.length >= 2) {
    event.preventDefault();
    const gesture = getTouchGesture(event.touches);
    if (game.handleGestureMove) {
      game.handleGestureMove(gesture);
    }
    return;
  }
  event.preventDefault();
  Array.from(event.changedTouches).forEach((touch) => {
    const position = getCanvasPosition(touch);
    activeTouches.set(touch.identifier, position);
    if (game.handlePointerMove) {
      game.handlePointerMove({ ...position, buttons: 1, id: touch.identifier, touchCount: event.touches.length });
    }
  });
}, { passive: false });

const endGesture = () => {
  if (!gestureActive) return;
  gestureActive = false;
  if (game.handleGestureEnd) {
    game.handleGestureEnd();
  }
};

canvas.addEventListener('touchend', (event) => {
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
});

canvas.addEventListener('touchcancel', (event) => {
  endGesture();
  Array.from(event.changedTouches).forEach((touch) => {
    const position = activeTouches.get(touch.identifier) || getCanvasPosition(touch);
    if (position && game.handlePointerUp) {
      game.handlePointerUp({ ...position, button: 0, id: touch.identifier, touchCount: event.touches.length });
    }
    activeTouches.delete(touch.identifier);
  });
});

canvas.addEventListener('contextmenu', (event) => {
  event.preventDefault();
});

if (enterFullscreenButton) {
  enterFullscreenButton.addEventListener('click', () => {
    requestFullscreen();
  });
}

if (exitFullscreenButton) {
  exitFullscreenButton.addEventListener('click', () => {
    exitFullscreen();
  });
}

let last = performance.now();
function loop(now) {
  const dt = Math.min((now - last) / 1000, 0.033);
  last = now;
  game.update(dt);
  game.draw();
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
