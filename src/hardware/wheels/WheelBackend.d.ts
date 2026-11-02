/** Backend seam for optional packaged/native integrations. Positive torque turns
 * the rim right. Values are normalized driver strength, NEVER physical Nm. */
export interface WheelOutputBackend {
 capabilities: {forceFeedback: boolean; reason: string};
 initialized: boolean;
 armed: boolean;
 error?: string | null;
 /** Explicit user authorization required; opens no automatic permission prompt. */
 initialize(): Promise<void>;
 /** Finite effect, one write in flight, no unbounded queue. */
 write(normalizedTorque: number): Promise<void>;
 /** Zero/stop while retaining explicit user arming. */
 quiet(): Promise<void>;
 /** Disarm and best-effort disable; cancel pending nonzero writes. */
 stop(): Promise<void>;
 disconnect(): void;
 dispose(): Promise<void>;
}
export interface WheelInputFrame {
 steer: number; throttle: number; brake: number; clutch: number;
 held: Record<string,boolean>; pressed: Record<string,boolean>;
}
export interface WheelPhysicsTelemetry {
 step: number; reset: number; speed: number;
 aligning: number; load: number; compression: number[];
 collision?: number; impactSequence?: number;
}
