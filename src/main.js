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
