export const isHostileToPlayer = (alignment) => alignment === 'enemy';
export const shouldAttackPlayer = (alignment, { interaction } = {}) => alignment === 'enemy' && interaction?.interactType !== 'talk-only';
export const shouldIgnorePlayer = (alignment) => alignment === 'impartial';
export const canPeacefullyInteract = (alignment) => alignment === 'friendly' || alignment === 'impartial';
