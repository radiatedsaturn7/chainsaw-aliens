import test from 'node:test';
import assert from 'node:assert/strict';
import {paceNoteIcon,PACE_NOTE_COLORS,drawPaceNoteIcon} from '../../src/racing/RacePaceNoteIcons.js';
test('structured and manual notes share direction, sharpness color and safety qualifiers',()=>{
 for(let severity=1;severity<=6;severity++)for(const direction of ['Left','Right']){
  const structured=paceNoteIcon({direction,severity}),manual=paceNoteIcon({text:`${severity} ${direction.toLowerCase()}`});
  assert.equal(structured.color,PACE_NOTE_COLORS[severity]);assert.equal(manual.color,structured.color);assert.equal(manual.direction,direction.toLowerCase());
 }
 assert.equal(paceNoteIcon({text:'Hairpin left'}).color,PACE_NOTE_COLORS[1]);
 assert.equal(paceNoteIcon({text:'Square right'}).shape,'square');
 assert.deepEqual(paceNoteIcon({text:"Right 3, don't cut, into Left 6"}).modifiers,["don't cut"]);
 assert.equal(paceNoteIcon({text:'Crest'}).kind,'crest');assert.equal(paceNoteIcon({text:'Dip'}).kind,'dip');
 assert.equal(paceNoteIcon({text:'Caution bridge'}).text,'Caution bridge');
});
test('left and right icons mirror their geometry and different severities change the curve',()=>{
 const path=note=>{const points=[];const ctx=new Proxy({moveTo:(x,y)=>points.push([x,y]),lineTo:(x,y)=>points.push([x,y])},{get:(o,k)=>o[k]||(()=>{})});drawPaceNoteIcon(ctx,note,0,0);return points;};
 const left=path({direction:'Left',severity:6}),right=path({direction:'Right',severity:6});
 assert.equal(left.length,right.length);
 left.forEach(([x,y])=>assert.ok(right.some(([rx,ry])=>Math.abs(x+rx)<1e-9&&Math.abs(y-ry)<1e-9)));
 assert.notDeepEqual(right,path({direction:'Right',severity:1}));
 assert.ok(path({direction:'Right',shape:'Square'}).length<right.length);
});
