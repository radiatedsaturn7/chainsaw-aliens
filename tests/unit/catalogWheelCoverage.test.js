import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {gunzipSync} from 'node:zlib';
import RaceEditor from '../../src/ui/RaceEditor.js';
import {decodePng} from '../../scripts/car-catalog-import.mjs';
for(const [slug,name] of [['foxmint-2000','Foxmint 1.7 2000'],['hazel-2011','Hazel S 2011'],['primrose-st-2005','Primrose ST 2005'],['bluebell-gt-2006','Bluebell GT 2006'],['chicory-gt-2008','Chicory GT 2008'],['mallow-s-2006','Mallow S 2006'],['firethorn-turbo-2005','Firethorn Turbo 2005'],['copperhead-sc-2006','Copperhead SC 2006'],['snowdrop-t5-2008','Snowdrop T5 2008'],['aster-170-2003','Aster 170 2003'],['foxglove-z-2003','Foxglove Z 2003'],['ironbloom-gt-2005','Ironbloom GT 2005'],['starwort-2005','Starwort 2005'],['bellflower-2006','Bellflower 2006'],['redbud-v6-2007','Redbud V6 2007'],['boxelder-2005','Boxelder 2005'],['stonepod-2006','Stonepod 2006'],['clover-2007','Clover Sport 2007'],['sorrel-2008','Sorrel 133 2008'],['buttoncap-2003','Buttoncap Turbo 2003'],['cubby-2014','Cubby 1.8 2014'],['sunmallow-2006','Sunmallow 2006'],['copperwing-2004','Copperwing 2004'],['dewskipper-2004','Dewskipper 2004'],['podmoss-2005','Podmoss 2005'],['glasswing-1990','Glasswing 1990'],['quince-2014','Quince 2014'],['mossling-2019','Mossling 2019'],['cicada-turbo-2015','Cicada Turbo 2015'],['nettle-turbo-2017','Nettle Turbo 2017'],['marigold-1991','Marigold 1991'],['glimmer-1986','Glimmer 1986'],['rosefinch-1991','Rosefinch 1991'],['larch-turbo-1995','Larch Turbo 1995'],['bramble-2021','Bramble 2021'],['vesper-v6-2003','Vesper V6 2003'],['sundew-660-1991','Sundew 660 1991'],['pipit-100-2007','Pipit 100 2007'],['cairn-1974','Cairn 1974'],['ashbaron-1987','Ashbaron 1987'],['stormline-2002','Stormline 2002'],['gossamer-2005','Gossamer 2005'],['rotorveil-1993','Rotorveil 1993'],['cinder-si-1991','Cinder Si 1991'],['lark-1600-1990','Lark 1600 1990'],['kestrel-660-2018','2018 Kestrel 660'],['trailglass-2024','Trailglass 2024'],['sentinel-sedan-2024','2024 Sentinel Sedan'],['ember-pod','Ember Pod Prototype'],['nightcoil-gt-1995','Nightcoil GT 1995']]){
 test(name+' published wheel graphics cover original opening heights without changing physical radius',()=>{
  const root=new URL('../../',import.meta.url);
  const read=p=>{const v=JSON.parse(fs.readFileSync(new URL(p,root)));return v.__chainsawStorage?JSON.parse(gunzipSync(Buffer.from(v.data,'base64'))):v;};
  const cfg=read('assets/car-catalog/'+slug+'/import.json');
  const car=read('data/server-storage/files/cars/'+name+'/document.json').car;
  const packed=read('data/server-storage/files/art/catalog-'+slug+'-body/document.json');
  const art=packed.__chainsawStorage?JSON.parse(gunzipSync(Buffer.from(packed.data,'base64'))):packed;
  const im=decodePng(new URL('assets/car-catalog/'+slug+'/body.png',root).pathname);
  const editor=new RaceEditor({deviceIsMobile:false,isMobile:false},{mode:'car'});
  assert.equal(cfg.wheelFit,'cover');
  assert.equal(car.tuning.wheelRadiusM,cfg.car.tuning.wheelRadiusM);
  for(const [slot,points]of Object.entries(cfg.authoredWheelAnchors)){
   if(slot==='front'||slot==='rear')continue;
   const layer=car.art.angleLayers[slot],scale=100*layer.body.transforms.bodyScaleX/art.width;
   const neutral=structuredClone(car);neutral.art.tireScaleX=1;neutral.art.tireScaleY=1;
   const rig=editor.getRaceSpriteWheelRig({car:neutral,viewSlot:slot,bodyBaseWidth:100});
   for(const p of points){
    assert.ok(im.data[(p.y*im.width+p.x)*4+3]<128,slot+' center in opening');
    let top=p.y;
    while(top>0&&im.data[((top-1)*im.width+p.x)*4+3]<128)top--;
    const extent=p.y-top;
    assert.ok(extent>20&&extent<100,slot+' bounded upper opening');
    assert.ok(p.radius>=extent,slot+' vertical measurement');
    const rendered=rig.wheels[p.wheel].height*layer.tires.transforms.tireScaleY/2;
    assert.ok(rendered>=extent*scale,slot+'/'+p.wheel+' covers upper hole');
    assert.ok(rendered<=p.radius*scale*1.6,slot+' limited far-wheel overfill');
   }
  }
 });
}
