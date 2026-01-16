import Game from './game/Game.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

const game = new Game(canvas, ctx);
window.__game = game;
window.__gameReady = true;

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
    const isMobile = window.matchMedia('(pointer: coarse)').matches || window.innerWidth < 900;
    game.setViewport({
      width: window.innerWidth,
      height: window.innerHeight,
      scale,
      isMobile
    });
  }
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
let activeTouchId = null;
let lastTouchPosition = null;

function getTouchById(touches, id) {
  for (let i = 0; i < touches.length; i += 1) {
    if (touches[i].identifier === id) return touches[i];
  }
  return null;
}

canvas.addEventListener('touchstart', (event) => {
  if (event.touches.length >= 2) {
    if (activeTouchId !== null && game.handlePointerUp) {
      game.handlePointerUp({ ...lastTouchPosition, button: 0, id: activeTouchId });
      activeTouchId = null;
      lastTouchPosition = null;
    }
    event.preventDefault();
    const gesture = getTouchGesture(event.touches);
    gestureActive = true;
    if (game.handleGestureStart) {
      game.handleGestureStart(gesture);
    }
    return;
  }
  if (event.touches.length === 1) {
    const touch = event.touches[0];
    activeTouchId = touch.identifier;
    lastTouchPosition = getCanvasPosition(touch);
    event.preventDefault();
    if (game.handlePointerDown) {
      game.handlePointerDown({ ...lastTouchPosition, button: 0, buttons: 1, id: activeTouchId });
    }
  }
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
  if (activeTouchId !== null && event.touches.length === 1) {
    const touch = getTouchById(event.touches, activeTouchId);
    if (!touch) return;
    lastTouchPosition = getCanvasPosition(touch);
    event.preventDefault();
    if (game.handlePointerMove) {
      game.handlePointerMove({ ...lastTouchPosition, buttons: 1, id: activeTouchId });
    }
  }
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
  if (activeTouchId !== null) {
    const touch = getTouchById(event.changedTouches, activeTouchId);
    const position = touch ? getCanvasPosition(touch) : lastTouchPosition;
    if (position && game.handlePointerUp) {
      game.handlePointerUp({ ...position, button: 0, id: activeTouchId });
    }
    activeTouchId = null;
    lastTouchPosition = null;
  }
});

canvas.addEventListener('touchcancel', (event) => {
  endGesture();
  if (activeTouchId !== null) {
    const touch = getTouchById(event.changedTouches, activeTouchId);
    const position = touch ? getCanvasPosition(touch) : lastTouchPosition;
    if (position && game.handlePointerUp) {
      game.handlePointerUp({ ...position, button: 0, id: activeTouchId });
    }
    activeTouchId = null;
    lastTouchPosition = null;
  }
});

canvas.addEventListener('contextmenu', (event) => {
  event.preventDefault();
});

let last = performance.now();
function loop(now) {
  const dt = Math.min((now - last) / 1000, 0.033);
  last = now;
  game.update(dt);
  game.draw();
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
