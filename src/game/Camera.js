export default class Camera {
  constructor(width, height) {
    this.width = width;
    this.height = height;
    this.x = 0;
    this.y = 0;
  }

  follow(target, dt) {
    const desiredX = target.x - this.width / 2;
    const desiredY = target.y - this.height / 2;
    this.x += (desiredX - this.x) * Math.min(1, dt * 5);
    this.y += (desiredY - this.y) * Math.min(1, dt * 5);
  }
}
