const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const normalizeVector3=(v={})=>{const x=Number(v.x||0),y=Number(v.y??0),z=Number(v.z||0);const length=Math.hypot(x,y,z)||1;return {x:x/length,y:y/length,z:z/length};};
const cross=(a,b)=>({x:Number(a.y||0)*Number(b.z||0)-Number(a.z||0)*Number(b.y||0),y:Number(a.z||0)*Number(b.x||0)-Number(a.x||0)*Number(b.z||0),z:Number(a.x||0)*Number(b.y||0)-Number(a.y||0)*Number(b.x||0)});
export function sampleDeckAtDistance(distance = 0, options = {}) {
    const runtimeType = options.runtimeType || this.getRuntimeType();
    const routeLength = Math.max(1, Number(options.routeLength || this.getRouteLength()) || 1);
    const roadbed = options.roadbedProfile || (typeof this.adapter.getRoadbedProfile === 'function'
      ? this.adapter.getRoadbedProfile({
        samples: options.samples || null,
        routeLength,
        runtimeType,
        allowVisualExtension: Boolean(options.allowVisualExtension)
      })
      : null);
    const local = typeof this.adapter.sampleRoadbedProfileAtDistance === 'function'
      ? this.adapter.sampleRoadbedProfileAtDistance(distance, roadbed)
      : null;
    const fallbackPose = local || this.adapter.getWorldPoseAtDistance?.(distance, {
      samples: options.samples || null,
      routeLength,
      runtimeType,
      allowVisualExtension: Boolean(options.allowVisualExtension)
    }) || {};
    const segment = fallbackPose.segment || this.adapter.getSegmentAtDistance?.(distance) || null;
    const yaw = Number(fallbackPose.yaw || 0);
    const tangent = normalizeVector3({
      ...this.getForwardVector(yaw),
      y: Number(fallbackPose.grade || 0)
    });
    const right = normalizeVector3({ ...this.getRightVector(yaw), y: 0 });
    const normal = normalizeVector3(cross(right, tangent));
    const roadHalfWidth = Math.max(0, Number(fallbackPose.roadHalfWidth ?? this.adapter.getRoadHalfWidth?.(segment) ?? 0) || 0);
    const marginWidth = Math.max(0, Number(fallbackPose.marginWidth ?? this.adapter.getMarginWidth?.(segment) ?? 0) || 0);
    const shoulderWidth = Math.max(0, Number(fallbackPose.shoulderWidth ?? this.adapter.getShoulderWidth?.(segment) ?? 0) || 0);
    return {
      ...fallbackPose,
      distance: Number(distance) || 0,
      x: Number(fallbackPose.x || 0),
      z: Number(fallbackPose.z || 0),
      y: Number(fallbackPose.z || 0),
      yaw,
      elevation: this.clampElevation(fallbackPose.elevation),
      routeElevation: this.clampElevation(fallbackPose.routeElevation ?? fallbackPose.elevation),
      terrainElevation: this.clampElevation(fallbackPose.terrainElevation ?? fallbackPose.elevation),
      supportElevation: this.clampElevation(fallbackPose.supportElevation ?? fallbackPose.elevation),
      grade: clamp(Number(fallbackPose.grade || 0), -0.42, 0.42),
      tangent,
      normal,
      right,
      segment,
      bankAngleRad: this.getBankAngleRadAtDistance(distance, { ...options, segment }),
      roadHalfWidth,
      marginWidth,
      shoulderWidth,
      stampedHalfWidth: Math.max(roadHalfWidth, Number(fallbackPose.stampedHalfWidth || roadHalfWidth + marginWidth + shoulderWidth)),
      blendWidth: Math.max(
        shoulderWidth > 0 ? 2.5 : 0.35,
        Number(fallbackPose.blendWidth || 0),
        Number(this.adapter.getBlendWidth?.(segment) || 0)
      )
    };
  }
