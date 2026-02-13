/**
 * @typedef {Object} IState
 * @property {(prevState: string|null, context?: object) => void} [enter]
 * @property {(nextState: string, context?: object) => void} [exit]
 * @property {(dt: number, input: object) => void} [update]
 * @property {(ctx: CanvasRenderingContext2D) => void} [draw]
 */

export {};
