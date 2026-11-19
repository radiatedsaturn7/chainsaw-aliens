import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {createHash} from 'node:crypto';
import {CAR_COMPONENT_ART_FIELDS} from '../../src/racing/CarDirectionalArt.js';

// Opt-in compatibility for calibrated sprite transforms only. Release checks are elsewhere.
const anchorsBySlot={
  front:['fl','fr'],frontRight:['fr','rr'],right:['fr','rr'],rearRight:['fr','rr'],
  rear:['rl','rr'],rearLeft:['fl','rl'],left:['fl','rl'],frontLeft:['fl','rl']
};
const obliques=['frontRight','rearRight','rearLeft','frontLeft'];
const sides=['left','right'], cardinals=['front','rear'];
const record=(v)=>v!==null&&typeof v==='object'&&!Array.isArray(v)&&Object.getPrototypeOf(v)===Object.prototype;
function allowed(o,keys,label){
  assert.ok(record(o),label+' must be an object');
  for(const k of Object.keys(o))assert.ok(keys.includes(k),'Unsupported '+label+' field: '+k);
}
function sameKeys(o,keys,label){
  allowed(o,keys,label);assert.equal(Object.keys(o).length,keys.length,'Missing '+label+' field');
}
export function validateMeasuredPrep(cfg){
  allowed(cfg,['id','name','rosterCommit','expectedDocumentSha256','sourceDirectory','sourceHashes','mapping',
    'authoredWheelAnchors','wheelFit','cockpitCalibration','steeringWheelSource','measurementReview',
    'allowSideTireOverrides','allowCardinalTireOverrides','nativeTireTransformOverrides'],'measured prep input');
  sameKeys(cfg.sourceHashes,['body','dashboard','tires'],'source role');
  assert.ok(Object.values(cfg.sourceHashes).every(s=>/^[a-f0-9]{64}$/.test(s)),'Invalid source hash');
  sameKeys(cfg.authoredWheelAnchors,Object.keys(anchorsBySlot),'anchor slot');
  for(const [slot,points] of Object.entries(cfg.authoredWheelAnchors)){
    assert.ok(Array.isArray(points)&&points.length===2,'Two physical wheel anchors required: '+slot);
    for(const p of points)sameKeys(p,['wheel','x','y','radius'],'physical wheel anchor');
    assert.deepEqual(points.map(p=>p.wheel).sort(),[...anchorsBySlot[slot]].sort(),'Wrong physical axle roles: '+slot);
  }
  for(const flag of ['allowSideTireOverrides','allowCardinalTireOverrides']){
    if(Object.hasOwn(cfg,flag))assert.equal(cfg[flag],true,'Explicit true required: '+flag);
  }
  const slots=[...obliques,...(cfg.allowSideTireOverrides===true?sides:[]),...(cfg.allowCardinalTireOverrides===true?cardinals:[])];
  const o=cfg.nativeTireTransformOverrides;
  allowed(o,slots,'tire transform slot');
  assert.ok(Object.keys(o).length,'At least one measured tire transform slot required');
  for(const t of Object.values(o)){
    allowed(t,CAR_COMPONENT_ART_FIELDS.tires,'tire transform');
    assert.ok(Object.keys(t).length,'Empty measured tire transform');
    for(const [k,v] of Object.entries(t)){
      const [lo,hi]=k.includes('Scale')?[.05,12]:[-16,16];
      assert.ok(Number.isFinite(v)&&v>=lo&&v<=hi,'Invalid measured tire transform: '+k);
    }
  }
  const c=cfg.cockpitCalibration;
  allowed(c,['size','cluster','wheel','wheelOpening','gaugeColor','gaugeBackground','viewportWheelScale',
    'dashboardGaugeFontSize','measuredDashboardWheel','instrumentPodBounds','renderedInstrumentPodBounds'],'measured cockpit');
  assert.equal(typeof c.wheelOpening,'boolean','Missing measured wheel-opening mode');
  if(Object.hasOwn(c,'dashboardGaugeFontSize'))assert.ok(!c.wheelOpening&&Number.isFinite(c.dashboardGaugeFontSize)&&
    c.dashboardGaugeFontSize>=9&&c.dashboardGaugeFontSize<=30,'Invalid measured non-opening dashboard font');
  if(Object.hasOwn(c,'measuredDashboardWheel'))assert.ok(c.measuredDashboardWheel===true&&!c.wheelOpening&&c.viewportWheelScale===undefined,
    'Measured dashboard wheel conflicts with viewport override');
  if(Object.hasOwn(cfg,'measurementReview'))assert.ok(record(cfg.measurementReview),'Invalid inert measurement review');
  assert.ok(Array.isArray(c.size)&&c.size.length===2&&c.size.every(x=>Number.isSafeInteger(x)&&x>0),'Invalid measured cockpit size');
  const [w,h]=c.size;
  const rect=(z)=>Array.isArray(z)&&z.length===4&&z.every(Number.isFinite);
  assert.ok(rect(c.cluster)&&c.cluster[0]>=0&&c.cluster[1]>=0&&c.cluster[2]>0&&c.cluster[3]>0
    &&c.cluster[0]+c.cluster[2]<=w&&c.cluster[1]+c.cluster[3]<=h,'Invalid measured cockpit cluster');
  assert.ok(Array.isArray(c.wheel)&&c.wheel.length===3&&c.wheel.every(Number.isFinite),'Invalid measured cockpit wheel');
  const [wx,wy,ww]=c.wheel;
  assert.ok(wx>=0&&wx<=w&&wy>=0&&wy<=h&&ww>0&&ww<=w,'Out-of-bounds measured cockpit wheel center or width');
  for(const key of ['gaugeColor','gaugeBackground']){
    if(Object.hasOwn(c,key))assert.ok(typeof c[key]==='string'&&/^#[0-9a-f]{6}([0-9a-f]{2})?$/i.test(c[key]),'Invalid measured cockpit '+key);
  }
  if(Object.hasOwn(c,'viewportWheelScale'))assert.ok(Number.isFinite(c.viewportWheelScale)&&c.viewportWheelScale>=.05&&c.viewportWheelScale<=12,
    'Invalid measured cockpit viewport wheel scale');
  for(const k of ['instrumentPodBounds','renderedInstrumentPodBounds']){
    if(!Object.hasOwn(c,k))continue;
    const z=c[k];
    assert.ok(Array.isArray(z)&&z.length===4&&z.every(Number.isFinite),'Invalid measured cockpit bounds: '+k);
    const [x,y,rw,rh]=z;
    assert.ok(x>=0&&y>=0&&rw>0&&rh>0&&x+rw<=w&&y+rh<=h,'Out-of-bounds measured cockpit bounds: '+k);
  }
  if(cfg.steeringWheelSource!==undefined)allowed(cfg.steeringWheelSource,['artRef','frameIndex'],'steering source');
}
export function applyMeasuredPrep(car,cfg){
  const c=cfg.cockpitCalibration;
  if(Object.hasOwn(c,'dashboardGaugeFontSize')){
    for(const g of car.art.gauges.interior.widgets)if(g.showValue!==false)g.fontSize=c.dashboardGaugeFontSize;
  }
  if(c.measuredDashboardWheel){
    const w=car.art.interior.steeringWheel;
    // Purple's marker already matches stock. No new steering override path.
    assert.ok(w.scaleX===1&&w.scaleY===1&&w.sizeSpace===undefined,'Measured steering marker is not the stock normalized dashboard size');
  }
  for(const [slot,t] of Object.entries(cfg.nativeTireTransformOverrides)){
    Object.assign(car.art.angleLayers[slot].tires.transforms,t);
  }
}
export function canonicalizeMeasuredTireMetadata(car){
  for(const layer of Object.values(car.art.angleLayers)){
    delete layer.tires.region;delete layer.tires.bounds; // Native serializer keeps these on tireSurfaces only.
  }
}


// Read from exact existing, non-redirected input; retain bytes for hashing and decoding.
export const measuredSha=bytes=>createHash('sha256').update(bytes).digest('hex');
export function readMeasuredFile(file){
  assert.ok(fs.lstatSync(file).isFile()&&fs.realpathSync(file)===file,'Measured input must be a regular, non-symlink file');
  return fs.readFileSync(file, {flag:fs.constants.O_RDONLY|fs.constants.O_NOFOLLOW});
}
const contained=(base,p)=>p===base||p.startsWith(base+path.sep);
export function checkMeasuredOutput(output,repo,source){
  const parent=path.dirname(output);
  assert.ok(fs.statSync(parent).isDirectory()&&fs.realpathSync(parent)===parent,
    'Measured output parent must already exist without symlinks');
  assert.ok(!fs.lstatSync(output,{throwIfNoEntry:false}),
    'Measured output must be a new path, not an existing file, directory, or symlink');
  assert.ok(!contained(path.join(repo,'data/server-storage'),output)&&!contained(source,output),
    'Measured output is outside the writable evidence scope');
}
export function freezeMeasuredSource(repo,source,cfg,decodePng){
  assert.equal(source,path.join(repo,'assets/car-catalog',cfg.id),'Measured source must be the exact catalog package path');
  assert.equal(fs.realpathSync(source),source,'Measured source package cannot be redirected');
  const packageStatus=readMeasuredFile(path.join(source,'package-status.json'));
  const packageConfig=readMeasuredFile(path.join(source,'package-config.json'));
  const status=JSON.parse(packageStatus),config=JSON.parse(packageConfig);
  assert.equal(status.name,cfg.name,'Measured source package is for another car');
  assert.equal(status.id,cfg.id,'Measured source package ID differs');
  assert.deepEqual(cfg.mapping,status.mapping,'Fitting mapping differs from the reviewed source package');
  assert.ok(!config.visualHold,'Source package is held');
  const data={};
  for(const role of ['body','dashboard','tires']){
    const bytes=readMeasuredFile(path.join(source,role+'.png'));
    const hash=measuredSha(bytes);
    assert.equal(hash,cfg.sourceHashes[role],'Stale '+role+' source');
    assert.equal(hash,status.sourceHashes?.[role],'Source marker hash differs: '+role);
    data[role]=bytes;
  }
  return {images:decodeFrozenSource(data,decodePng),packageStatusSha256:measuredSha(packageStatus),packageConfigSha256:measuredSha(packageConfig)};
}
export function decodeFrozenSource(data,decodePng){
  // Use the exact unchanged importer on immutable buffers snapshotted into a private directory.
  const snapshot=fs.mkdtempSync(path.join(os.tmpdir(),'measured-catalog-source-'));
  try {
    const images={};
    for(const [role,bytes] of Object.entries(data)){
      const png=path.join(snapshot,role+'.png');
      fs.writeFileSync(png,bytes,{mode:0o400,flag:'wx'});
      images[role]=decodePng(png);
    }
    return images;
  }finally{fs.rmSync(snapshot,{recursive:true,force:true});}
}
