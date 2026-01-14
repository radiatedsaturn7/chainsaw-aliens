import Game from './game/Game.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

const game = new Game(canvas, ctx);

function resize() {
  const scale = Math.min(window.innerWidth / canvas.width, window.innerHeight / canvas.height);
  canvas.style.transform = `scale(${scale})`;
}

window.addEventListener('resize', resize);
resize();

let last = performance.now();
function loop(now) {
  const dt = Math.min((now - last) / 1000, 0.033);
  last = now;
  game.update(dt);
  game.draw();
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
