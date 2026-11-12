/** Calibrate original sprite wheel wells to the production rear-axle anchored rig.
 * Points are measured in ORIGINAL sheet pixels. This changes graphics only.
 * Perspective/holes are artist estimates, not vehicle physics specifications. */
export function calibrateCatalogPlacement(editor, car, document, prepared, mapping, anchors) {
 const slots=['front','frontRight','right','rearRight','rear','rearLeft','left','frontLeft'];
 for(const [index,slot] of slots.entries()) {
  const points=anchors[slot];
  if(!Array.isArray(points)||points.length<2)throw Error(`Two measured wheel wells required: ${slot}`);
  const frame=mapping[index],crop=prepared.crops[frame],bounds=document.frameBounds[frame];
  const neutral=structuredClone(car);neutral.art.tireScaleX=1;neutral.art.tireScaleY=1;
  const rig=editor.getRaceSpriteWheelRig({car:neutral,viewSlot:slot,bodyBaseWidth:100});
  const p=points.map(a=>{
   if(!rig.wheels[a.wheel]||![a.x,a.y,a.radius].every(Number.isFinite)||a.radius<=0)throw Error('Invalid measured wheel well');
   return {...a,x:a.x-crop.x+bounds.x,y:a.y-crop.y+bounds.y,target:rig.wheels[a.wheel]};
  });
  const mx=p.reduce((s,a)=>s+a.x,0)/p.length,my=p.reduce((s,a)=>s+a.y,0)/p.length;
  const tx=p.reduce((s,a)=>s+a.target.x,0)/p.length,ty=p.reduce((s,a)=>s+a.target.y,0)/p.length;
  const variance=p.reduce((s,a)=>s+(a.x-mx)**2,0);
  const scale=p.reduce((s,a)=>s+(a.x-mx)*(a.target.x-tx),0)/variance;
  if(!(scale>0&&Number.isFinite(scale)))throw Error(`Wheel mapping mirrored or degenerate: ${slot}`);
  const left=tx-scale*mx,top=ty-scale*my,w=document.width*scale,h=document.height*scale;
  const body={bodyScaleX:w/100,bodyScaleY:h/74,bodyOffsetX:(left+w/2)/16,bodyOffsetY:(top+h*.58)/(74*.22),bodyRotationDeg:0};
  const tireScale=p.reduce((s,a)=>s+2*a.radius*scale/a.target.height,0)/p.length;
  const tires={tireScaleX:tireScale,tireScaleY:tireScale,tireSpacingScale:1,frontTireOffsetX:0,frontTireOffsetY:0,rearTireOffsetX:0,rearTireOffsetY:0};
  for(const axle of ['front','rear']) {
   const group=p.filter(a=>a.wheel.startsWith(axle==='front'?'f':'r'));
   if(!group.length)continue;
   tires[axle+'TireOffsetX']=group.reduce((s,a)=>s+left+scale*a.x-a.target.x,0)/group.length/(100*rig.offsetScale*.14);
   tires[axle+'TireOffsetY']=group.reduce((s,a)=>s+top+scale*a.y-a.target.y,0)/group.length/(74*rig.offsetScale*.2);
  }
  car.art.angleLayers[slot].body.transforms=body;
  car.art.angleLayers[slot].body.fitToCar=true;
  car.art.angleLayers[slot].tires.transforms=tires;
 }
}
