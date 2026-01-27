const DIRECTION_MAP = [
  { id: 1, angle: 270 },
  { id: 2, angle: 315 },
  { id: 3, angle: 0 },
  { id: 4, angle: 45 },
  { id: 5, angle: 90 },
  { id: 6, angle: 135 },
  { id: 7, angle: 180 },
  { id: 8, angle: 225 }
];

const mapDirection = (x, y) => {
  const angle = (Math.atan2(y, x) * 180) / Math.PI;
  const normalized = (angle + 360) % 360;
  const entry = DIRECTION_MAP.reduce((closest, candidate) => {
    const diff = Math.min(
      Math.abs(candidate.angle - normalized),
      360 - Math.abs(candidate.angle - normalized)
    );
    return diff < closest.diff ? { diff, id: candidate.id } : closest;
  }, { diff: Infinity, id: 1 });
  return entry.id;
};

const buildKeyboardVector = (input) => {
  const up = input.isDown('up');
  const down = input.isDown('down');
  const left = input.isDown('left');
  const right = input.isDown('right');
  const x = (left ? -1 : 0) + (right ? 1 : 0);
  const y = (up ? -1 : 0) + (down ? 1 : 0);
  return { x, y };
};

const getPressedButton = ({
  gamepadPressed,
  keyboardPressed
}) => {
  if (gamepadPressed.A || keyboardPressed.A) return 'A';
  if (gamepadPressed.X || keyboardPressed.X) return 'X';
  if (gamepadPressed.Y || keyboardPressed.Y) return 'Y';
  if (gamepadPressed.B || keyboardPressed.B) return 'B';
  return null;
};

const determineChordType = ({ button, lb, dleft }) => {
  if (!button) return null;
  if (lb && dleft) {
    if (button === 'A') return 'minor6';
    if (button === 'X') return 'dim7';
    if (button === 'Y') return 'augMaj7';
    if (button === 'B') return 'minor9b5';
  }
  if (lb) {
    if (button === 'A') return 'sus2';
    if (button === 'X') return 'sus4';
    if (button === 'Y') return 'seventh';
    if (button === 'B') return 'add9';
  }
  if (dleft) {
    if (button === 'A') return 'dim';
    if (button === 'X') return 'half-dim';
    if (button === 'Y') return 'aug';
    if (button === 'B') return 'altered-dom';
  }
  if (button === 'A') return 'triad';
  if (button === 'X') return 'triad-inv1';
  if (button === 'Y') return 'triad-inv2';
  if (button === 'B') return 'power';
  return null;
};

export const normalizeRobterInput = ({
  input,
  prevDegree = 1,
  mode = 'chord'
}) => {
  const axes = input.getGamepadAxes();
  const stickX = axes.leftX || 0;
  const stickY = axes.leftY || 0;
  const stickActive = Math.hypot(stickX, stickY) > 0.35;
  const keyboardVector = buildKeyboardVector(input);
  const keyboardActive = Math.hypot(keyboardVector.x, keyboardVector.y) > 0;
  const degree = stickActive
    ? mapDirection(stickX, stickY)
    : keyboardActive
      ? mapDirection(keyboardVector.x, keyboardVector.y)
      : prevDegree;

  const gamepadPressed = {
    A: input.wasGamepadPressed('jump'),
    B: input.wasGamepadPressed('dash'),
    X: input.wasGamepadPressed('rev'),
    Y: input.wasGamepadPressed('throw')
  };

  const keyboardPressed = {
    A: input.wasPressedCode('KeyJ'),
    B: input.wasPressedCode('KeyK'),
    X: input.wasPressedCode('KeyU'),
    Y: input.wasPressedCode('KeyI')
  };

  const button = getPressedButton({ gamepadPressed, keyboardPressed });

  const lb = input.isGamepadDown('aimUp') || input.isDownCode('KeyQ');
  const dleft = input.isGamepadDown('dpadLeft') || input.isDownCode('KeyE');
  const octaveUp = input.isGamepadDown('aimDown') || input.isDownCode('KeyR');
  const chordType = mode === 'chord' ? determineChordType({ button, lb, dleft }) : null;

  return {
    degree,
    button,
    lb,
    dleft,
    octaveUp,
    chordType
  };
};

export const matchesRequiredInput = ({ required, normalized, mode }) => {
  if (!required) return false;
  if (!normalized.button) return false;
  if (required.mode === 'drum') {
    const laneMap = { A: 0, X: 1, Y: 2, B: 3 };
    return laneMap[normalized.button] === required.lane;
  }
  if (required.mode !== mode) return false;
  if (required.degree !== normalized.degree) return false;
  if (required.button !== normalized.button) return false;
  if (required.modifiers?.lb !== normalized.lb) return false;
  if (required.modifiers?.dleft !== normalized.dleft) return false;
  if (required.mode === 'chord' && required.chordType !== normalized.chordType) return false;
  if (required.mode === 'note' && required.octaveUp && !normalized.octaveUp) return false;
  return true;
};

export const getModeToggle = (input) => (
  input.wasGamepadPressed('dpadRight') || input.wasPressedCode('Tab')
);

export const getOctaveShift = (input) => {
  if (input.wasGamepadPressed('dpadUp') || input.wasPressedCode('Digit1')) return 1;
  if (input.wasGamepadPressed('dpadDown') || input.wasPressedCode('Digit2')) return -1;
  return 0;
};

export const getStarPowerTrigger = (input) => input.wasPressed('cancel') || input.wasGamepadPressed('cancel');

export const getPauseTrigger = (input) => input.wasPressed('pause') || input.wasGamepadPressed('pause');
