import * as THREE from '../vendorBridge/three.js';

// Record painted bounds while using the existing Canvas car renderer. Upload
// only that crop, not a viewport-sized texture for every opponent each frame.
export function boundedContext(context, emissionContext = null) {
  let hasEmission=false;
  let box;
  const include = (x, y, w = 0, h = 0) => {
    const m = context.getTransform();
    for (let corner=0;corner<4;corner++) {
      const px=x+(corner&1?w:0),py=y+(corner&2?h:0);
      const tx=m.a*px+m.c*py+m.e, ty=m.b*px+m.d*py+m.f;
      if (!Number.isFinite(tx+ty)) continue;
      if (!box) box={left:tx,top:ty,right:tx,bottom:ty};
      box.left=Math.min(box.left,tx);box.top=Math.min(box.top,ty);
      box.right=Math.max(box.right,tx);box.bottom=Math.max(box.bottom,ty);
    }
  };
  const copyEmission = (art,...rect)=>{
    if(!emissionContext)return;
    emissionContext.save();emissionContext.setTransform(context.getTransform());
    emissionContext.globalAlpha=context.globalAlpha;
    emissionContext.drawImage(art,...rect);emissionContext.restore();hasEmission=true;
  };
  // Complex clipped painters supply a conservative bound once, avoiding
  // getTransform and bounds work for every invisible texture triangle.
  const drawBounded = (rect,paint)=>{
    include(rect.x,rect.y,rect.width,rect.height);
    return paint(context);
  };
  const methods = new Map();
  const proxy = new Proxy(context, {
    get(target, key) {
      if(key==='__raceBoundsRecorder')return true;
      if(key==='__raceCopyEmission')return copyEmission;
      if(key==='__raceDrawBounded')return drawBounded;
      if (typeof target[key] !== 'function') return target[key];
      if (!methods.has(key)) methods.set(key, (...args) => {
        if (key === 'drawImage') {
          if(args.length===3)include(args[1],args[2],args[0].width,args[0].height);
          else {const offset=args.length-4;include(args[offset],args[offset+1],args[offset+2],args[offset+3]);}
          if(emissionContext&&target.__raceEmissive===true&&target.globalAlpha>0){
            emissionContext.save();
            emissionContext.setTransform(target.getTransform());
            emissionContext.globalAlpha=target.globalAlpha;
            emissionContext.imageSmoothingEnabled=target.imageSmoothingEnabled;
            emissionContext.drawImage(...args);emissionContext.restore();hasEmission=true;
          }
        } else if ((key==='fillRect'||key==='strokeRect'||key==='rect')) include(...args);
        else if ((key==='moveTo'||key==='lineTo')) include(args[0],args[1]);
        else if (key === 'ellipse' || key === 'arc') {
          const radius=Math.max(args[2],key==='ellipse'?args[3]:args[2]);
          include(args[0]-radius,args[1]-radius,2*radius,2*radius);
        } else if (key === 'quadraticCurveTo' || key === 'bezierCurveTo') {
          for(let i=0;i<args.length;i+=2)include(args[i],args[i+1]);
        }
        return target[key](...args);
      });
      return methods.get(key);
    },
    set(target,key,value) { target[key]=value;return true; }
  });
  return { context:proxy, bounds:()=>box,hasEmission:()=>hasEmission,reset(){box=null;hasEmission=false;} };
}

// Keep the authored screen-space image, but intersect each corner ray with a
// vertical billboard at the car. NDC depth is linear across this plane; a single
// anchor depth incorrectly pushes the lower car through sloping road/terrain.
export function carSpriteCornerDepth(camera, world, x, y, scratch = null) {
  const anchor = (scratch?.anchor || new THREE.Vector3()).set(world.x, world.y, world.z);
  const normal = camera.getWorldDirection(scratch?.normal || new THREE.Vector3());
  normal.y = 0;
  if (normal.lengthSq() < 1e-8) return anchor.project(camera).z;
  normal.normalize();
  const origin = camera.getWorldPosition(scratch?.origin || new THREE.Vector3());
  const ray = (scratch?.ray || new THREE.Vector3()).set(x, y, 0).unproject(camera).sub(origin);
  const denominator = ray.dot(normal);
  const delta = (scratch?.delta || new THREE.Vector3()).copy(anchor).sub(origin);
  const t = delta.dot(normal) / denominator;
  if (!Number.isFinite(t) || t <= 0) return anchor.project(camera).z;
  return origin.addScaledVector(ray, t).project(camera).z;
}

// Owned by a single renderer and consumed synchronously. Helpers without this
// optional scratch retain their independent-result API for other callers.
export function createCarSpritePlacementScratch() {
  return {
    normal:new THREE.Vector3(), origin:new THREE.Vector3(),
    groundNormal:new THREE.Vector3(), groundPoint:new THREE.Vector3(),
    ray:new THREE.Vector3(), delta:new THREE.Vector3(), contact:new THREE.Vector3(),
    projected:new THREE.Vector3(), view:new THREE.Vector3(),
    footprintAnchor:{x:0,y:0,z:0}, paintAnchor:{x:0,y:0,z:0},
    ground:{x:0,y:0,z:0,normal:null}, bottomNdc:{xs:[0,0],y:0}, emptyFootprint:{}
  };
}

// A sprite depicts the whole car, not a zero-thickness slice through its rear
// axle. Put its occlusion plane at the camera-facing edge of the physical
// footprint. This keeps the front wheels above uphill road surfaces without
// disabling terrain depth testing or drawing the car over distant ridges.
export function carSpriteFootprintDepthAnchor(camera, world, {x=world.x,z=world.z,yaw=0,lengthM=0,widthM=0}={}, scratch = null) {
  const normal=camera.getWorldDirection(scratch?.normal || new THREE.Vector3());normal.y=0;
  if(normal.lengthSq()<1e-8)return world;
  normal.normalize();
  const sin=Math.sin(yaw),cos=Math.cos(yaw);
  const support=Math.abs(normal.x*sin+normal.z*cos)*Math.max(0,lengthM)/2
    +Math.abs(normal.x*cos+normal.z*(-sin))*Math.max(0,widthM)/2;
  const result=scratch?.footprintAnchor || {};
  result.x=x-normal.x*(support+.08);result.y=world.y;result.z=z-normal.z*(support+.08);
  return result;
}

// Authored body/wheel offsets need not end at the physics footprint. Fit the
// occlusion plane to their painted ground contact as well, rather than letting
// the road slice off the bottom of a perfectly complete sprite. This changes
// depth only, never the screen layout; nearer scenery still depth-tests normally.
export function carSpritePaintDepthAnchor(camera, world, ground, bottomNdc, footprint = {}, scratch = null) {
  if (!ground || !Number.isFinite(ground.y)) return world;
  const normal = camera.getWorldDirection(scratch?.normal || new THREE.Vector3()); normal.y = 0;
  if (normal.lengthSq() < 1e-8) return world;
  normal.normalize();
  const origin = camera.getWorldPosition(scratch?.origin || new THREE.Vector3());
  const groundNormal = (scratch?.groundNormal || new THREE.Vector3()).set(ground.normal?.x || 0, ground.normal?.y ?? 1, ground.normal?.z || 0).normalize();
  const groundPoint = (scratch?.groundPoint || new THREE.Vector3()).set(ground.x, ground.y, ground.z);
  let shift = 0;
  for (const x of bottomNdc.xs) {
    const ray = (scratch?.ray || new THREE.Vector3()).set(x, bottomNdc.y, 0).unproject(camera).sub(origin);
    const denominator = ray.dot(groundNormal);
    if (denominator >= -1e-8) continue;
    const t = (scratch?.delta || new THREE.Vector3()).copy(groundPoint).sub(origin).dot(groundNormal) / denominator;
    if (!Number.isFinite(t) || t <= 0) continue;
    const contact = (scratch?.contact || new THREE.Vector3()).copy(origin).addScaledVector(ray, t);
    shift = Math.max(shift, (scratch?.delta || new THREE.Vector3()).set(world.x-contact.x, 0, world.z-contact.z).dot(normal) + .03);
  }
  // Malformed/oversized artwork must not pull the car through unrelated scenery.
  shift = Math.min(shift, Math.max(1, Number(footprint.lengthM) || 4.5));
  const result=scratch?.paintAnchor || {};
  result.x=world.x-normal.x*shift;result.y=world.y;result.z=world.z-normal.z*shift;
  return result;
}

export function clearCarSpriteScratch(context, canvas, box) {
  context.setTransform(1,0,0,1,0,0);
  if (!box) return;
  // Include a small antialias/stroke fringe. Canvas clips out-of-bounds clears.
  const left=Math.max(0,Math.floor(box.left)-4),top=Math.max(0,Math.floor(box.top)-4);
  const right=Math.min(canvas.width,Math.ceil(box.right)+4),bottom=Math.min(canvas.height,Math.ceil(box.bottom)+4);
  if (right>left && bottom>top) context.clearRect(left,top,right-left,bottom-top);
}

// Screen-aligned, depth-tested planes preserve the authored Canvas layout but
// participate in the same depth buffer as terrain, models, and other cars.
export class RaceCarDepthSprites {
  constructor(scene) {
    this.scene=scene;
    this.entries=new Map();
    this.scratch=document.createElement('canvas');
    this.context=this.scratch.getContext('2d');
    this.emissionScratch=document.createElement('canvas');
    this.emissionContext=this.emissionScratch.getContext('2d');
    this.boundsRecorder=boundedContext(this.context,this.emissionContext);
    this.depthScratch={anchor:new THREE.Vector3(),normal:new THREE.Vector3(),
      origin:new THREE.Vector3(),ray:new THREE.Vector3(),delta:new THREE.Vector3()};
    this.placementScratch=createCarSpritePlacementScratch();
    this.active=new Set();
  }

  begin(bounds, now = performance.now()) {
    this.now=now;
    this.frame=(this.frame||0)+1;
    this.adaptivePaints=0;
    this.stats ||= {paints:0,reuses:0,uploadedPixels:0,textureResizes:0};
    this.stats.paints=this.stats.reuses=this.stats.uploadedPixels=this.stats.textureResizes=0;
    this.stats.repaintReasons ||= {initial:0,fullRate:0,clipped:0,viewport:0,appearance:0,scale:0,camera:0,interval:0};
    for(const reason in this.stats.repaintReasons)this.stats.repaintReasons[reason]=0;
    this.bounds=bounds;
    const w=Math.max(1,Math.round(bounds.w)),h=Math.max(1,Math.round(bounds.h));
    if(this.scratch.width!==w)this.scratch.width=w;
    if(this.scratch.height!==h)this.scratch.height=h;
    if(this.emissionScratch.width!==w)this.emissionScratch.width=w;
    if(this.emissionScratch.height!==h)this.emissionScratch.height=h;
    this.active.clear();
  }

  draw(key, world, camera, draw, { intervalMs = 0, appearanceKey = '', footprint = null, adaptive = false, resting = false } = {}) {
    const scratch=this.placementScratch;
    let depthWorld=footprint?carSpriteFootprintDepthAnchor(camera,world,footprint,scratch):world;
    const projected=scratch.projected.set(world.x,world.y,world.z).project(camera);
    const view=scratch.view.set(world.x,world.y,world.z).applyMatrix4(camera.matrixWorldInverse);
    if(view.z>=0 || projected.z < -1 || projected.z > 1)return;
    const ctx=this.context, bounds=this.bounds;
    const cached=this.entries.get(key);
    const anchorX=(projected.x+1)*this.scratch.width/2;
    const anchorY=(1-projected.y)*this.scratch.height/2;
    const viewportKey=[bounds.x,bounds.y,bounds.w,bounds.h,camera.fov,camera.aspect].join(':');
    const scale=cached?.viewZ/view.z;
    // Move/reproject every frame; only the expensive artwork is rate limited.
    // Frame spacing prevents a sub-30-FPS race repainting every opponent on
    // every frame simply because its old 33 ms timer has already expired.
    const distanceInCarLengths = -view.z / Math.max(1, Number(footprint?.lengthM) || 4.5);
    const gap = distanceInCarLengths < 6 ? 2 : distanceInCarLengths < 15 ? 3 : 4;
    const refreshMs = adaptive ? (gap === 2 ? 66 : gap === 3 ? 120 : 180) : intervalMs;
    const age = this.now - (cached?.paintedAt ?? -Infinity);
    const rateLimited = age < refreshMs || (adaptive && this.frame-cached?.paintedFrame < gap);
    const budgetLimited = adaptive && this.adaptivePaints >= 8 && age < 250;
    if(cached && !cached.clipped && intervalMs>0 && (resting || rateLimited || budgetLimited)
      && cached.viewportKey===viewportKey && cached.appearanceKey===appearanceKey
      && scale>(resting ? 0 : 0.8) && scale<(resting ? Infinity : 1.25)
      && (resting || Math.abs(camera.quaternion.dot(cached.cameraRotation))>(adaptive ? 0.995 : 0.9998))){
      this.active.add(key);cached.lastSeen=this.now;cached.mesh.visible=true;
      this.stats.reuses++;
      depthWorld=this.fitPaintDepth(cached,depthWorld,world,camera,anchorX+cached.offsetX*scale,anchorY+cached.offsetY*scale,scale,footprint);
      this.place(cached,depthWorld,camera,projected,
        anchorX+cached.offsetX*scale,anchorY+cached.offsetY*scale,
        cached.canvas.width*scale,cached.canvas.height*scale);
      return;
    }
    const reason=!cached ? 'initial' : intervalMs<=0 ? 'fullRate'
      : cached.clipped ? 'clipped' : cached.viewportKey!==viewportKey ? 'viewport'
      : cached.appearanceKey!==appearanceKey ? 'appearance'
      : !(scale>(resting?0:.8) && scale<(resting?Infinity:1.25)) ? 'scale'
      : !resting && !(Math.abs(camera.quaternion.dot(cached.cameraRotation))>(adaptive ? .995 : .9998)) ? 'camera'
      : 'interval';
    this.stats.repaintReasons[reason]++;
    this.stats.paints++;
    if(adaptive)this.adaptivePaints++;
    const recorder=this.paintScratch(draw);
    const box=recorder.bounds();
    this.previousPaintBounds=box;
    if(!box)return;
    const left=Math.max(0,Math.floor(box.left)-2),top=Math.max(0,Math.floor(box.top)-2);
    const right=Math.min(this.scratch.width,Math.ceil(box.right)+2),bottom=Math.min(this.scratch.height,Math.ceil(box.bottom)+2);
    const w=right-left,h=bottom-top;
    if(w<=0||h<=0)return;
    this.active.add(key);
    const entry=this.getOrCreateEntry(key,projected);
    this.updateTexture(entry,left,top,w,h,recorder.hasEmission());
    if(entry.cameraRotation)entry.cameraRotation.copy(camera.quaternion);
    else entry.cameraRotation=camera.quaternion.clone();
    Object.assign(entry,{paintedAt:this.now,paintedFrame:this.frame,lastSeen:this.now,viewportKey,appearanceKey,
      clipped:box.left<0 || box.top<0 || box.right>this.scratch.width || box.bottom>this.scratch.height,
      paintWidth:w,paintHeight:h,
      ground:ctx.__raceSpriteGround ? {...ctx.__raceSpriteGround,
        x:ctx.__raceSpriteGround.x-world.x,y:ctx.__raceSpriteGround.y-world.y,z:ctx.__raceSpriteGround.z-world.z} : null,
      viewZ:view.z,offsetX:left-anchorX,offsetY:top-anchorY});
    entry.mesh.visible=true;
    depthWorld=this.fitPaintDepth(entry,depthWorld,world,camera,left,top,1,footprint);
    this.place(entry,depthWorld,camera,projected,left,top,entry.canvas.width,entry.canvas.height);
  }

  paintScratch(draw) {
    this.clearScratch();
    const recorder=this.boundsRecorder;
    recorder.reset();this.context.__raceSpriteGround=null;
    this.paintArtwork(draw);
    return recorder;
  }

  // Separate synchronous boundaries so detailed captures can distinguish
  // Canvas clearing from the actual car painter without timing every primitive.
  clearScratch() {
    clearCarSpriteScratch(this.context,this.scratch,this.previousPaintBounds);
    clearCarSpriteScratch(this.emissionContext,this.emissionScratch,this.previousPaintBounds);
  }

  paintArtwork(draw) {
    const ctx=this.context,bounds=this.bounds;
    ctx.save();ctx.translate(-Number(bounds.x||0),-Number(bounds.y||0));
    try { draw(this.boundsRecorder.context); } finally { ctx.restore(); }
  }

  getOrCreateEntry(key,projected) {
    let entry=this.entries.get(key);
    if(!entry){
      const canvas=document.createElement('canvas');
      const texture=new THREE.CanvasTexture(canvas);
      texture.minFilter=THREE.NearestFilter;texture.magFilter=THREE.NearestFilter;
      texture.generateMipmaps=false;
      const material=new THREE.ShaderMaterial({
        uniforms:{map:{value:texture},depth:{value:projected.z},emissiveMap:{value:texture},hasEmissive:{value:0}},
        vertexShader:'varying vec2 vUv; uniform float depth; void main(){vUv=uv;gl_Position=vec4(position,1.0);}',
        fragmentShader:'uniform sampler2D emissiveMap; uniform float hasEmissive; uniform sampler2D map; varying vec2 vUv; void main(){vec4 color=texture2D(map,vUv);if(color.a<0.01)discard;gl_FragColor=color;}',
        transparent:true,depthTest:true,depthWrite:true,toneMapped:false
      });
      material.userData.raceSpriteEmissive=true;
      const mesh=new THREE.Mesh(new THREE.PlaneGeometry(2,2),material);
      mesh.frustumCulled=false;
      this.scene.add(mesh);
      entry={canvas,texture,mesh};this.entries.set(key,entry);
    }
    return entry;
  }

  resizeTexture(canvas,texture,width,height) {
    texture.dispose();
    canvas.width=width;canvas.height=height;
  }

  copyTexture(canvas,texture,source,left,top,w,h) {
    const context=canvas.getContext('2d');
    context.clearRect(0,0,canvas.width,canvas.height);
    context.drawImage(source,left,top,w,h,0,0,w,h);
    texture.needsUpdate=true;
  }

  updateTexture(entry,left,top,w,h,hasEmission) {
    // Grow only while visible: small crop changes must not repeatedly dispose
    // and recreate GPU textures. Inactive entries have a bounded retention budget (see end()).
    const textureWidth=Math.max(entry.textureWidth||0,Math.ceil(w/32)*32);
    const textureHeight=Math.max(entry.textureHeight||0,Math.ceil(h/32)*32);
    if(entry.canvas.width!==textureWidth || entry.canvas.height!==textureHeight){
      this.stats.textureResizes++;
      this.resizeTexture(entry.canvas,entry.texture,textureWidth,textureHeight);
      entry.textureWidth=textureWidth;entry.textureHeight=textureHeight;
    }
    this.copyTexture(entry.canvas,entry.texture,this.scratch,left,top,w,h);
    this.stats.uploadedPixels+=textureWidth*textureHeight;
    entry.mesh.material.uniforms.hasEmissive.value=hasEmission?1:0;
    if(hasEmission){
      if(!entry.emissionCanvas){
        entry.emissionCanvas=document.createElement('canvas');
        entry.emissionTexture=new THREE.CanvasTexture(entry.emissionCanvas);
        entry.emissionTexture.minFilter=THREE.NearestFilter;entry.emissionTexture.magFilter=THREE.NearestFilter;entry.emissionTexture.generateMipmaps=false;
        entry.mesh.material.uniforms.emissiveMap.value=entry.emissionTexture;
      }
      if(entry.emissionCanvas.width!==textureWidth||entry.emissionCanvas.height!==textureHeight){
        this.resizeTexture(entry.emissionCanvas,entry.emissionTexture,textureWidth,textureHeight);
      }
      this.copyTexture(entry.emissionCanvas,entry.emissionTexture,this.emissionScratch,left,top,w,h);
      this.stats.uploadedPixels+=textureWidth*textureHeight;
    }
  }

  fitPaintDepth(entry,depthWorld,world,camera,left,top,scale,footprint) {
    if(!entry.ground)return depthWorld;
    const scratch=this.placementScratch,ground=scratch.ground,bottom=scratch.bottomNdc;
    ground.x=entry.ground.x+world.x;ground.y=entry.ground.y+world.y;ground.z=entry.ground.z+world.z;
    ground.normal=entry.ground.normal;
    bottom.xs[0]=left/this.scratch.width*2-1;
    bottom.xs[1]=(left+entry.paintWidth*scale)/this.scratch.width*2-1;
    bottom.y=1-(top+entry.paintHeight*scale)/this.scratch.height*2;
    return carSpritePaintDepthAnchor(camera,depthWorld,ground,bottom,footprint || scratch.emptyFootprint,scratch);
  }

  place(entry,world,camera,projected,left,top,width,height) {
    const x0=left/this.scratch.width*2-1,x1=(left+width)/this.scratch.width*2-1;
    const y0=1-top/this.scratch.height*2,y1=1-(top+height)/this.scratch.height*2;
    const vertices=entry.mesh.geometry.attributes.position;
    vertices.setXYZ(0,x0,y0,carSpriteCornerDepth(camera,world,x0,y0,this.depthScratch));
    vertices.setXYZ(1,x1,y0,carSpriteCornerDepth(camera,world,x1,y0,this.depthScratch));
    vertices.setXYZ(2,x0,y1,carSpriteCornerDepth(camera,world,x0,y1,this.depthScratch));
    vertices.setXYZ(3,x1,y1,carSpriteCornerDepth(camera,world,x1,y1,this.depthScratch));vertices.needsUpdate=true;
    entry.mesh.material.uniforms.depth.value=projected.z;
    // Used by Three's transparent sorting; vertices themselves stay in screen space.
    entry.mesh.position.set(world.x,world.y,world.z);
  }

  end(force = false) {
    // Looking away briefly must not discard every car's GPU resources and
    // recreate them together when the camera turns back. Retain the most
    // recently seen inactive entries, with an explicit 8 MiB pixel budget.
    const inactive = [];
    for (const [key, entry] of this.entries) if (force || !this.active.has(key)) {
      entry.mesh.visible = false;
      inactive.push([key, entry]);
    }
    inactive.sort((a, b) => b[1].lastSeen - a[1].lastSeen);
    let retainedBytes = 0;
    for (const [key, entry] of inactive) {
      // Include both the CPU canvas and its GPU texture, plus emission art.
      const bytes = entry.canvas.width * entry.canvas.height * 8
        + (entry.emissionCanvas ? entry.emissionCanvas.width * entry.emissionCanvas.height * 8 : 0);
      if (!force && this.now - entry.lastSeen < 30000
        && retainedBytes + bytes <= 8 * 1024 * 1024) {
        retainedBytes += bytes;
        continue;
      }
      this.scene.remove(entry.mesh);entry.mesh.geometry.dispose();entry.mesh.material.dispose();entry.texture.dispose();entry.emissionTexture?.dispose();
      this.entries.delete(key);
    }
  }

  dispose() { this.active=new Set();this.end(true); }
}
