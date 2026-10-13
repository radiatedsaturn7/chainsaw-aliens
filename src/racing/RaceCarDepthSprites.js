import * as THREE from '../vendorBridge/three.js';

// Record painted bounds while using the existing Canvas car renderer. Upload
// only that crop, not a viewport-sized texture for every opponent each frame.
function boundedContext(context) {
  let box;
  const include = (x, y, w = 0, h = 0) => {
    const m = context.getTransform();
    for (const [px, py] of [[x,y],[x+w,y],[x,y+h],[x+w,y+h]]) {
      const tx=m.a*px+m.c*py+m.e, ty=m.b*px+m.d*py+m.f;
      if (!Number.isFinite(tx+ty)) continue;
      if (!box) box={left:tx,top:ty,right:tx,bottom:ty};
      box.left=Math.min(box.left,tx);box.top=Math.min(box.top,ty);
      box.right=Math.max(box.right,tx);box.bottom=Math.max(box.bottom,ty);
    }
  };
  const methods = new Map();
  const proxy = new Proxy(context, {
    get(target, key) {
      if (typeof target[key] !== 'function') return target[key];
      if (!methods.has(key)) methods.set(key, (...args) => {
        if (key === 'drawImage') {
          const rect=args.length===3 ? [args[1],args[2],args[0].width,args[0].height] : args.slice(-4);
          include(...rect);
        } else if (['fillRect','strokeRect','rect'].includes(key)) include(...args);
        else if (['moveTo','lineTo'].includes(key)) include(args[0],args[1]);
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
  return { context:proxy, bounds:()=>box };
}

// Screen-aligned, depth-tested planes preserve the authored Canvas layout but
// participate in the same depth buffer as terrain, models, and other cars.
export class RaceCarDepthSprites {
  constructor(scene) {
    this.scene=scene;
    this.entries=new Map();
    this.scratch=document.createElement('canvas');
    this.context=this.scratch.getContext('2d');
  }

  begin(bounds) {
    this.bounds=bounds;
    const w=Math.max(1,Math.round(bounds.w)),h=Math.max(1,Math.round(bounds.h));
    if(this.scratch.width!==w)this.scratch.width=w;
    if(this.scratch.height!==h)this.scratch.height=h;
    this.active=new Set();
  }

  draw(key, world, camera, draw) {
    const projected=new THREE.Vector3(world.x,world.y,world.z).project(camera);
    const view=new THREE.Vector3(world.x,world.y,world.z).applyMatrix4(camera.matrixWorldInverse);
    if(view.z>=0 || projected.z < -1 || projected.z > 1)return;
    const ctx=this.context, bounds=this.bounds;
    ctx.setTransform(1,0,0,1,0,0);ctx.clearRect(0,0,this.scratch.width,this.scratch.height);
    ctx.save();ctx.translate(-Number(bounds.x||0),-Number(bounds.y||0));
    const recorder=boundedContext(ctx);
    try { draw(recorder.context); } finally { ctx.restore(); }
    const box=recorder.bounds();
    if(!box)return;
    const left=Math.max(0,Math.floor(box.left)-2),top=Math.max(0,Math.floor(box.top)-2);
    const right=Math.min(this.scratch.width,Math.ceil(box.right)+2),bottom=Math.min(this.scratch.height,Math.ceil(box.bottom)+2);
    const w=right-left,h=bottom-top;
    if(w<=0||h<=0)return;
    this.active.add(key);
    let entry=this.entries.get(key);
    if(!entry){
      const canvas=document.createElement('canvas');
      const texture=new THREE.CanvasTexture(canvas);
      texture.minFilter=THREE.NearestFilter;texture.magFilter=THREE.NearestFilter;
      texture.generateMipmaps=false;
      const material=new THREE.ShaderMaterial({
        uniforms:{map:{value:texture},depth:{value:projected.z}},
        vertexShader:'varying vec2 vUv; uniform float depth; void main(){vUv=uv;gl_Position=vec4(position.xy,depth,1.0);}',
        fragmentShader:'uniform sampler2D map; varying vec2 vUv; void main(){vec4 color=texture2D(map,vUv);if(color.a<0.01)discard;gl_FragColor=color;}',
        transparent:true,depthTest:true,depthWrite:true,toneMapped:false
      });
      const mesh=new THREE.Mesh(new THREE.PlaneGeometry(2,2),material);
      mesh.frustumCulled=false;
      this.scene.add(mesh);
      entry={canvas,texture,mesh};this.entries.set(key,entry);
    }
    const textureWidth=Math.ceil(w/32)*32,textureHeight=Math.ceil(h/32)*32;
    if(entry.canvas.width!==textureWidth || entry.canvas.height!==textureHeight){
      entry.texture.dispose();
      entry.canvas.width=textureWidth;entry.canvas.height=textureHeight;
    }
    const cropped=entry.canvas.getContext('2d');
    cropped.clearRect(0,0,textureWidth,textureHeight);cropped.drawImage(this.scratch,left,top,w,h,0,0,w,h);
    entry.texture.needsUpdate=true;
    const x0=left/this.scratch.width*2-1,x1=(left+textureWidth)/this.scratch.width*2-1;
    const y0=1-top/this.scratch.height*2,y1=1-(top+textureHeight)/this.scratch.height*2;
    const vertices=entry.mesh.geometry.attributes.position;
    vertices.setXYZ(0,x0,y0,0);vertices.setXYZ(1,x1,y0,0);
    vertices.setXYZ(2,x0,y1,0);vertices.setXYZ(3,x1,y1,0);vertices.needsUpdate=true;
    entry.mesh.material.uniforms.depth.value=projected.z;
    // Used by Three's transparent sorting; vertices themselves stay in screen space.
    entry.mesh.position.set(world.x,world.y,world.z);
  }

  end() {
    for(const [key,entry] of this.entries)if(!this.active.has(key)){
      this.scene.remove(entry.mesh);entry.mesh.geometry.dispose();entry.mesh.material.dispose();entry.texture.dispose();
      this.entries.delete(key);
    }
  }

  dispose() { this.active=new Set();this.end(); }
}
