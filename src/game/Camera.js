export default class Camera {
  constructor(width, height) {
    this.width = width;
    this.height = height;
    this.x = 0;
    this.y = 0;
  }

  follow(target, dt, bounds = null) {
    const desiredX = target.x - this.width / 2;
    const desiredY = target.y - this.height / 2;
    const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
    const targetX = bounds ? clamp(desiredX, bounds.minX, bounds.maxX) : desiredX;
    const targetY = bounds ? clamp(desiredY, bounds.minY, bounds.maxY) : desiredY;
    this.x += (targetX - this.x) * Math.min(1, dt * 5);
    this.y += (targetY - this.y) * Math.min(1, dt * 5);
  }
}
