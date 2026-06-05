export const WEATHER_PRIORITY = ['weather-hurricane', 'weather-blizzard', 'weather-storm', 'weather-rain', 'weather-snow'];

export const WEATHER_PROFILES = {
  'weather-rain': { kind: 'weather', rate: 24, vy: 320, vx: -20, color: 'rgba(120,180,255,0.45)', size: 8 },
  'weather-storm': {
    kind: 'weather',
    screenFill: true,
    rate: 72,
    vy: 450,
    vx: -48,
    color: 'rgba(132,190,255,0.68)',
    size: 12,
    gustRate: 10,
    gustVx: -240,
    gustVy: -18,
    gustColor: 'rgba(210,220,235,0.18)',
    gustLength: 34,
    fogColor: 'rgba(120,130,145,0.18)',
    fogAlpha: 0.18
  },
  'weather-hurricane': {
    kind: 'weather',
    screenFill: true,
    rate: 96,
    vy: 540,
    vx: -86,
    color: 'rgba(150,205,255,0.78)',
    size: 14,
    gustRate: 18,
    gustVx: -340,
    gustVy: -28,
    gustColor: 'rgba(205,215,228,0.24)',
    gustLength: 46,
    fogColor: 'rgba(102,112,125,0.24)',
    fogAlpha: 0.24
  },
  'weather-snow': { kind: 'weather', rate: 16, vy: 48, vx: -8, color: 'rgba(255,255,255,0.75)', size: 4, swayAmplitude: 16, swaySpeed: 2 },
  'weather-blizzard': {
    kind: 'weather',
    screenFill: true,
    rate: 92,
    vy: 128,
    vx: -72,
    color: 'rgba(255,255,255,0.92)',
    size: 6,
    swayAmplitude: 30,
    swaySpeed: 5,
    gustRate: 20,
    gustVx: -300,
    gustVy: -20,
    gustColor: 'rgba(255,255,255,0.3)',
    gustLength: 42,
    fogColor: 'rgba(245,248,255,0.2)',
    fogAlpha: 0.2
  }
};

export const WEATHER_FOG_PROFILES = {
  'weather-storm': { color: 'rgba(120,130,145,0.24)', alpha: 0.24 },
  'weather-hurricane': { color: 'rgba(102,112,125,0.32)', alpha: 0.32 },
  'weather-blizzard': { color: 'rgba(245,248,255,0.26)', alpha: 0.26 }
};

export const CUTSCENE_WEATHER_EFFECTS = [
  { id: 'rain', weather: 'weather-rain', label: 'Rain' },
  { id: 'storm', weather: 'weather-storm', label: 'Storm' },
  { id: 'hurricane', weather: 'weather-hurricane', label: 'Hurricane' },
  { id: 'snow', weather: 'weather-snow', label: 'Snow' },
  { id: 'blizzard', weather: 'weather-blizzard', label: 'Blizzard' }
];

export const cutsceneEffectToWeather = (effectType = 'rain') => (
  CUTSCENE_WEATHER_EFFECTS.find((entry) => entry.id === effectType)?.weather || 'weather-rain'
);

const WINDY_WEATHER = new Set(['weather-storm', 'weather-hurricane', 'weather-blizzard']);

const clamp01 = (value) => Math.max(0, Math.min(1, value));
const safeNumber = (value, fallback = 0) => (Number.isFinite(Number(value)) ? Number(value) : fallback);

export function createWeatherRuntimeState() {
  return {
    time: 0,
    particles: [],
    lightning: { timer: 0, flash: 0, x: 0, roomIndex: null },
    wind: { value: 0, target: 0, timer: 0 }
  };
}

export function resetWeatherRuntimeState(state = createWeatherRuntimeState()) {
  state.time = 0;
  state.particles = [];
  state.lightning = { timer: 0, flash: 0, x: 0, roomIndex: null };
  state.wind = { value: 0, target: 0, timer: 0 };
  return state;
}

function normalizeBounds(bounds = {}) {
  const left = safeNumber(bounds.left, safeNumber(bounds.x, 0));
  const top = safeNumber(bounds.top, safeNumber(bounds.y, 0));
  const right = safeNumber(bounds.right, left + safeNumber(bounds.w, safeNumber(bounds.width, 0)));
  const bottom = safeNumber(bounds.bottom, top + safeNumber(bounds.h, safeNumber(bounds.height, 0)));
  return {
    left,
    top,
    right,
    bottom,
    width: Math.max(1, right - left),
    height: Math.max(1, bottom - top)
  };
}

export function emitWeatherParticle(particles, x, y, vx, vy, life, style, rng = Math.random, maxParticles = 900) {
  particles.push({
    x,
    y,
    vx,
    vy,
    life,
    maxLife: life,
    style,
    size: style.size || 4,
    sway: rng() * Math.PI * 2,
    angle: Number(style.angle || 0),
    spin: Number(style.spin || 0),
    frameOffset: Number(style.frameOffset || 0)
  });
  if (particles.length > maxParticles) {
    particles.splice(0, particles.length - maxParticles);
  }
}

export function updateWeatherParticleMotion(particles, dt, windValue = 0) {
  particles.forEach((particle) => {
    particle.life -= dt;
    particle.x += particle.vx * dt;
    particle.y += particle.vy * dt;
    particle.angle += particle.spin * dt;
    if (particle.style.kind === 'weather') {
      particle.x += windValue * dt;
    }
    if (particle.style.gravity) {
      particle.vy += 900 * Math.max(0, Number(particle.style.gravityScale ?? 1)) * dt;
    }
    if (particle.style.swayAmplitude) {
      particle.sway += dt * (particle.style.swaySpeed || 3);
      particle.x += Math.sin(particle.sway) * particle.style.swayAmplitude * dt;
    }
  });
  return particles.filter((particle) => particle.life > 0);
}

export function updateWeatherSystem({
  state,
  particles = state?.particles,
  weatherType = '',
  bounds = null,
  dt = 0,
  intensity = 1,
  windBias = 0,
  scale = 1,
  maxParticles = 900,
  rng = Math.random,
  applyMotion = true,
  onLightningStrike = null
} = {}) {
  if (!state) return null;
  const safeDt = Math.max(0, Math.min(0.25, safeNumber(dt, 0)));
  state.time = safeNumber(state.time, 0) + safeDt;
  if (!state.lightning) state.lightning = { timer: 0, flash: 0, x: 0, roomIndex: null };
  if (!state.wind) state.wind = { value: 0, target: 0, timer: 0 };
  if (!Array.isArray(particles)) particles = [];

  state.lightning.flash = Math.max(0, state.lightning.flash - safeDt * 2.6);
  if (WINDY_WEATHER.has(weatherType)) {
    state.wind.timer -= safeDt;
    if (state.wind.timer <= 0) {
      const gustSpread = weatherType === 'weather-hurricane' ? 180 : weatherType === 'weather-blizzard' ? 140 : 110;
      state.wind.target = (rng() * 2 - 1) * gustSpread + windBias;
      state.wind.timer = 0.28 + rng() * 0.5;
    }
    state.wind.value += (state.wind.target - state.wind.value) * Math.min(1, safeDt * 2.4);
  } else {
    state.wind.target = windBias;
    state.wind.value += (windBias - state.wind.value) * Math.min(1, safeDt * 2.8);
    state.wind.timer = 0;
  }

  if (applyMotion) {
    const nextParticles = updateWeatherParticleMotion(particles, safeDt, state.wind.value);
    particles.length = 0;
    particles.push(...nextParticles);
  }

  const profile = WEATHER_PROFILES[weatherType];
  if (!bounds || !profile || safeDt <= 0) return profile || null;

  const safeBounds = normalizeBounds(bounds);
  const safeScale = Math.max(0.05, safeNumber(scale, 1));
  const safeIntensity = Math.max(0.1, Math.min(4, safeNumber(intensity, 1)));
  const precipitationWind = (profile.vx + state.wind.value + windBias) * safeScale;
  const precipitationOverscan = profile.screenFill ? Math.max(64 * safeScale, Math.abs(precipitationWind) * 0.45) : 0;
  const style = {
    ...profile,
    weatherType,
    color: profile.color,
    size: Math.max(1, profile.size * safeScale),
    vy: profile.vy * safeScale,
    vx: profile.vx * safeScale,
    swayAmplitude: profile.swayAmplitude ? profile.swayAmplitude * safeScale : profile.swayAmplitude
  };
  const count = Math.max(1, Math.ceil(safeDt * profile.rate * safeIntensity));
  for (let i = 0; i < count; i += 1) {
    const spawnX = profile.screenFill
      ? safeBounds.left - precipitationOverscan + rng() * (safeBounds.width + precipitationOverscan * 2)
      : safeBounds.left + rng() * safeBounds.width;
    const spawnY = profile.screenFill
      ? safeBounds.top - 16 * safeScale + rng() * (safeBounds.height + 32 * safeScale)
      : safeBounds.top - 8 * safeScale;
    emitWeatherParticle(
      particles,
      spawnX,
      spawnY,
      precipitationWind + (rng() - 0.5) * 22 * safeScale,
      profile.vy * safeScale * (0.8 + rng() * 0.4),
      Math.max(0.5, (safeBounds.height + precipitationOverscan) / Math.max(1, profile.vy * safeScale)),
      style,
      rng,
      maxParticles
    );
  }
  if (profile.gustRate) {
    const gustCount = Math.max(1, Math.ceil(safeDt * profile.gustRate * safeIntensity));
    for (let i = 0; i < gustCount; i += 1) {
      emitWeatherParticle(
        particles,
        safeBounds.left + rng() * safeBounds.width,
        safeBounds.top + rng() * safeBounds.height,
        profile.gustVx * safeScale * (0.75 + rng() * 0.45),
        (profile.gustVy + (rng() - 0.5) * 26) * safeScale,
        0.28 + rng() * 0.2,
        {
          kind: 'gust',
          weatherType,
          color: profile.gustColor,
          size: Math.max(2, profile.gustLength * safeScale),
          fogColor: profile.fogColor,
          fogAlpha: profile.fogAlpha
        },
        rng,
        maxParticles
      );
    }
  }

  const filtered = particles.filter((particle) => {
    if (particle.style.weatherType === weatherType || particle.style === profile) {
      return particle.y <= safeBounds.bottom + 24 * safeScale
        && particle.x >= safeBounds.left - 64 * safeScale
        && particle.x <= safeBounds.right + 64 * safeScale
        && particle.life > 0;
    }
    return true;
  });
  particles.length = 0;
  particles.push(...filtered);

  if (weatherType === 'weather-hurricane') {
    state.lightning.timer -= safeDt;
    if (state.lightning.timer <= 0) {
      state.lightning.timer = 1.8 + rng() * 2.4;
      state.lightning.flash = 1;
      state.lightning.x = safeBounds.left + rng() * safeBounds.width;
      onLightningStrike?.(state.lightning.x, safeBounds);
    }
  }
  return profile;
}

export function drawWeatherParticles(ctx, particles, {
  weatherType = '',
  lightning = null,
  fogPhase = 0,
  bounds = null
} = {}) {
  if (!ctx) return;
  const safeBounds = bounds || { x: 0, y: 0, w: 0, h: 0 };
  ctx.save();
  const fogProfile = WEATHER_FOG_PROFILES[weatherType];
  if (fogProfile && safeBounds.w > 0 && safeBounds.h > 0) {
    ctx.globalAlpha = fogProfile.alpha * (0.8 + Math.sin(fogPhase * 0.7) * 0.08);
    ctx.fillStyle = fogProfile.color;
    ctx.fillRect(safeBounds.x, safeBounds.y, safeBounds.w, safeBounds.h);
  }
  (particles || []).forEach((particle) => {
    const alpha = clamp01(particle.life / Math.max(0.0001, particle.maxLife));
    ctx.globalAlpha = alpha;
    ctx.fillStyle = particle.style.color;
    if (particle.style.frames?.length) {
      const elapsed = Math.max(0, particle.maxLife - particle.life);
      const frameDuration = Math.max(16, Number(particle.style.frameDuration || 120));
      const frameIndex = Math.floor(((elapsed * 1000) / frameDuration + particle.frameOffset * particle.style.frames.length)) % particle.style.frames.length;
      const frame = particle.style.frames[frameIndex];
      const scale = Math.max(0.05, particle.size / Math.max(1, Math.max(frame.width, frame.height)));
      ctx.save();
      ctx.translate(particle.x, particle.y);
      ctx.rotate(particle.angle || 0);
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(frame, -frame.width * scale / 2, -frame.height * scale / 2, frame.width * scale, frame.height * scale);
      ctx.restore();
    } else if (particle.style.kind === 'gust') {
      ctx.strokeStyle = particle.style.color;
      ctx.lineWidth = Math.max(2, particle.size * 0.08);
      ctx.beginPath();
      ctx.moveTo(particle.x + particle.size * 0.5, particle.y - particle.size * 0.08);
      ctx.lineTo(particle.x - particle.size * 0.5, particle.y + particle.size * 0.08);
      ctx.stroke();
    } else if (particle.style.vy > 200) {
      ctx.fillRect(particle.x - 1, particle.y - particle.size, 2, particle.size + 2);
    } else {
      ctx.beginPath();
      ctx.arc(particle.x, particle.y, Math.max(1.5, particle.size * 0.5), 0, Math.PI * 2);
      ctx.fill();
    }
  });
  if (lightning?.flash > 0 && safeBounds.w > 0 && safeBounds.h > 0) {
    const x = Number.isFinite(lightning.x) ? lightning.x : safeBounds.x + safeBounds.w * 0.5;
    ctx.globalAlpha = lightning.flash * 0.2;
    ctx.fillStyle = '#dff6ff';
    ctx.fillRect(safeBounds.x, safeBounds.y, safeBounds.w, safeBounds.h);
    ctx.globalAlpha = lightning.flash * 0.95;
    ctx.strokeStyle = 'rgba(255,255,255,0.95)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(x, safeBounds.y);
    ctx.lineTo(x - 12, safeBounds.y + safeBounds.h * 0.25);
    ctx.lineTo(x + 6, safeBounds.y + safeBounds.h * 0.45);
    ctx.lineTo(x - 10, safeBounds.y + safeBounds.h * 0.7);
    ctx.lineTo(x + 12, safeBounds.y + safeBounds.h * 0.92);
    ctx.stroke();
  }
  ctx.restore();
}
