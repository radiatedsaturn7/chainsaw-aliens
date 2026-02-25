import { clamp } from '../../editor/input/random.js';

export function getSharedMobileZoomSliderLayout({
  width,
  height,
  joystickCenterX = null,
  joystickRadius = 0,
  controlMargin = 18,
  sliderHeight = 10,
  minimumSliderWidth = 140,
  joystickGap = 24,
  rightPaddingFloor = 132,
  rightPaddingRatio = 0.2,
  hitPaddingY = 14
}) {
  let sliderX = controlMargin;
  if (Number.isFinite(joystickCenterX) && joystickRadius > 0) {
    sliderX = joystickCenterX + joystickRadius + joystickGap;
  }

  let sliderWidth;
  if (Number.isFinite(joystickCenterX) && joystickRadius > 0) {
    const sliderRightPadding = Math.max(controlMargin + rightPaddingFloor, width * rightPaddingRatio);
    sliderWidth = width - sliderX - sliderRightPadding;
  } else {
    sliderWidth = width - controlMargin * 2;
  }

  const sliderY = height - controlMargin - sliderHeight;
  if (sliderWidth < minimumSliderWidth) {
    sliderX = controlMargin;
    sliderWidth = Math.max(minimumSliderWidth, width - controlMargin * 2 - rightPaddingFloor);
  }

  const railBounds = {
    x: sliderX,
    y: sliderY,
    w: Math.max(0, sliderWidth),
    h: sliderHeight
  };
  const hitBounds = {
    x: railBounds.x,
    y: railBounds.y - hitPaddingY,
    w: railBounds.w,
    h: railBounds.h + hitPaddingY * 2
  };

  return { railBounds, hitBounds };
}

export function drawSharedMobileZoomSlider(ctx, bounds, ratio, options = {}) {
  if (!ctx || !bounds || bounds.w <= 0 || bounds.h <= 0) return;
  const {
    knobColor = 'rgba(0,200,255,0.95)',
    railColor = 'rgba(0,0,0,0.58)',
    railStroke = 'rgba(255,255,255,0.44)',
    knobStroke = 'rgba(0,0,0,0.75)',
    alpha = 0.92
  } = options;
  const t = clamp(ratio, 0, 1);
  const centerY = bounds.y + bounds.h / 2;
  const knobX = bounds.x + t * bounds.w;
  const knobRadius = Math.max(5, bounds.h * 0.75);

  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = railColor;
  ctx.fillRect(bounds.x, bounds.y, bounds.w, bounds.h);
  ctx.strokeStyle = railStroke;
  ctx.strokeRect(bounds.x, bounds.y, bounds.w, bounds.h);
  ctx.fillStyle = knobColor;
  ctx.beginPath();
  ctx.arc(knobX, centerY, knobRadius, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = knobStroke;
  ctx.stroke();
  ctx.restore();
}
