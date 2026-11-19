import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';

const ids=['fl','fr','rl','rr'];
const bytes=p=>Buffer.from(p.buffer,p.byteOffset,p.byteLength);
const sha=p=>createHash('sha256').update(bytes(p)).digest('hex');
const png=c=>c.toDataURL('image/png').split(',')[1];

export function captureNativeLayers(editor,options,original,width,height){
  const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;
  const ctx=canvas.getContext('2d'),visibility=editor.isCarWheelVisible;
  const ownVisibility=Object.getOwnPropertyDescriptor(editor,'isCarWheelVisible');
  const originalDraw=ctx.drawImage.bind(ctx),originalTranslate=ctx.translate.bind(ctx);
  const images={};
  let draws,translations,observations,only;
  const matrix=()=>{const m=ctx.getTransform();const a=[m.a,m.b,m.c,m.d,m.e,m.f];assert.ok(a.every(Number.isFinite));return a;};
  ctx.drawImage=(image,...args)=>{
    assert.ok(args.every(Number.isFinite));
    draws.push({imageSize:[image.width,image.height],args,matrix:matrix(),smoothing:ctx.imageSmoothingEnabled});
    return originalDraw(image,...args);
  };
  ctx.translate=(x,y)=>{assert.ok([x,y].every(Number.isFinite));translations.push([x,y]);return originalTranslate(x,y);};
  editor.isCarWheelVisible=function(layer,id){
    assert.ok(ids.includes(id),'Unrecognized native wheel role');
    const allowed=visibility.call(this,layer,id);
    assert.equal(typeof allowed,'boolean');
    if(Object.hasOwn(observations,id))assert.equal(observations[id],allowed,'Unstable native wheel visibility');
    observations[id]=allowed;
    return allowed&&(only===null||id===only);
  };
  const replay=(overrides={},role=null)=>{
    assert.deepEqual(matrix(),[1,0,0,1,0,0]);
    ctx.clearRect(0,0,width,height);draws=[];translations=[];observations={};only=role;
    editor.drawRaceCarBillboardLayers(ctx,{...options,...overrides});
    return {draws,translations,observations,pixels:ctx.getImageData(0,0,width,height).data};
  };
  const store=(label,pixels)=>{
    let left=width,top=height,right=-1,bottom=-1;
    for(let y=0;y<height;y++)for(let x=0;x<width;x++)if(pixels[(y*width+x)*4+3]!==0){
      left=Math.min(left,x);top=Math.min(top,y);right=Math.max(right,x);bottom=Math.max(bottom,y);
    }
    assert.ok(left>0&&top>0&&right<width-1&&bottom<height-1&&right>=left,'Empty or clipped evidence layer');
    const w=right-left+1,h=bottom-top+1;
    const c=document.createElement('canvas');c.width=w;c.height=h;const target=c.getContext('2d');
    const data=target.createImageData(w,h);
    for(let y=0;y<h;y++){const start=((top+y)*width+left)*4;data.data.set(pixels.subarray(start,start+w*4),y*w*4);}
    target.putImageData(data,0,0);
    assert.equal(Buffer.compare(bytes(target.getImageData(0,0,w,h).data),bytes(data.data)),0,'Evidence crop lost native pixels');
    const file='native-evidence-'+label+'.png';images[file]=png(c);c.width=1;
    return {file,bounds:[left,top,w,h],fullRGBA256:sha(pixels),cropRGBA256:sha(data.data)};
  };
  try{
    const composite=replay();
    assert.equal(Buffer.compare(bytes(original),bytes(composite.pixels)),0,'Diagnostic hooks altered the normal composite');
    const roles=ids.filter(id=>composite.observations[id]===true);
    assert.ok(roles.length>0,'No native named wheels observed');
    const body=replay({drawWheels:false});
    assert.equal(body.draws.length,1,'Missing or ambiguous actual body draw');
    assert.deepEqual(body.observations,{},'Unexpected wheel path in body-only replay');
    const bodyProof={...store('body',body.pixels),draws:body.draws,translations:body.translations};
    const wheels={};
    for(const role of roles){
      const w=replay({drawBodyLayer:false},role);
      assert.deepEqual(w.observations,composite.observations,'Wheel isolation changed native visibility evaluation');
      assert.equal(w.translations.length,1,'Missing or ambiguous isolated wheel translation');
      assert.ok(w.draws.length>0,'No attributable isolated wheel drawImage');
      let footprintPixels=0,visiblePixels=0;
      for(let i=3;i<w.pixels.length;i+=4)if(w.pixels[i]>32){
        footprintPixels++;if(body.pixels[i]<=32)visiblePixels++;
      }
      assert.ok(visiblePixels>0,'Wheel role enabled but no visible isolated footprint');
      wheels[role]={...store(role,w.pixels),draws:w.draws,translations:w.translations,
        alphaVisibilityDiagnostic:{threshold:32,footprintPixels,bodyUncoveredPixels:visiblePixels}};

    }
    return {images,receipt:{schema:1,evidenceOnly:true,accepted:false,choice:options.artChoice,
      canvas:[width,height],pose:{centerX:options.centerX,anchorY:options.anchorY,baseWidth:options.baseWidth,baseHeight:options.baseHeight,bodyBaseWidth:options.bodyBaseWidth,bodyBaseHeight:options.bodyBaseHeight,drawShadowLayer:false},
      composite:{...store('composite',composite.pixels),fullRGBAParity:true,draws:composite.draws},
      observedNativeVisibility:composite.observations,body:bodyProof,wheels}};
  }finally{
    if(ownVisibility)Object.defineProperty(editor,'isCarWheelVisible',ownVisibility);else delete editor.isCarWheelVisible;
    canvas.width=1;
  }
}
