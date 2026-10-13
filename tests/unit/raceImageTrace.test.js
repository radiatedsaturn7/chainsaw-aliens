import test from 'node:test';
import assert from 'node:assert/strict';
import { traceRaceImage, raceFromImageTrace } from '../../src/racing/RaceImageTrace.js';
import RaceEditor from '../../src/ui/RaceEditor.js';

function drawing(width=240, height=180, background = () => 250) {
  const data = new Uint8ClampedArray(width*height*4);
  for (let y=0;y<height;y++) for (let x=0;x<width;x++) {
    const i=(y*width+x)*4; data[i]=data[i+1]=data[i+2]=background(x,y); data[i+3]=255;
  }
  const dot = (x,y,value=75,r=1) => {
    for (let dy=-r;dy<=r;dy++) for(let dx=-r;dx<=r;dx++) {
      const px=Math.round(x)+dx, py=Math.round(y)+dy;
      if(px<0||px>=width||py<0||py>=height) continue;
      const i=(py*width+px)*4; data[i]=data[i+1]=data[i+2]=value;
    }
  };
  return { data,width,height,dot };
}
function ellipse(image,cx,cy,rx,ry,value=75) {
  for(let t=0;t<Math.PI*2;t+=.006) image.dot(cx+Math.cos(t)*rx,cy+Math.sin(t)*ry,value);
}
function line(image,x0,y0,x1,y1,value=75) {
  const n=Math.ceil(Math.hypot(x1-x0,y1-y0)*2);
  for(let i=0;i<=n;i++) image.dot(x0+(x1-x0)*i/n,y0+(y1-y0)*i/n,value);
}

test('closed pencil circuit produces a closed editable race with chosen scale', () => {
  const image=drawing(); ellipse(image,120,90,85,55);
  const {candidates}=traceRaceImage(image);
  assert.equal(candidates.length,1); assert.equal(candidates[0].closed,true);
  const race=raceFromImageTrace(candidates[0],{lengthM:2000,roadWidthM:10});
  assert.equal(race.type,'circuit'); assert.equal(race.road.nodes.length,race.road.segments.length+1);
  assert.equal(race.road.nodes[0].x,race.road.nodes.at(-1).x);
  assert.equal(race.road.nodes[0].y,race.road.nodes.at(-1).y);
  assert.ok(Math.abs(race.road.segments.reduce((sum,s)=>sum+s.length,0)-2000)<.001);
  assert.ok(race.road.segments.every(s=>s.roadWidthM===10));
});
test('open pencil route stays point to point and can reverse direction', () => {
  const image=drawing(); line(image,25,40,100,120); line(image,100,120,210,50);
  const {candidates}=traceRaceImage(image);
  assert.equal(candidates.length,1); assert.equal(candidates[0].closed,false);
  const normal=raceFromImageTrace(candidates[0]), reversed=raceFromImageTrace(candidates[0],{reverse:true});
  assert.equal(normal.type,'destination');
  assert.ok(Math.abs(normal.road.nodes.at(-1).x+reversed.road.nodes.at(-1).x)<.001);
});
test('ten separate drawings are selectable without joining their tracks', () => {
  const image=drawing(600,300);
  for(let row=0;row<2;row++) for(let col=0;col<5;col++) ellipse(image,60+120*col,75+150*row,40,45);
  const {candidates}=traceRaceImage(image);
  assert.equal(candidates.length,10); assert.ok(candidates.every(c=>c.closed));
  for(const c of candidates) assert.ok(Math.max(...c.points.map(p=>p.x))-Math.min(...c.points.map(p=>p.x))<90);
});
test('faint pencil under a gradual shadow can be traced', () => {
  const image=drawing(240,180,(x)=>220+x/10);
  ellipse(image,120,90,85,55,195);
  const result=traceRaceImage(image,{sensitivity:90});
  assert.equal(result.candidates.length,1); assert.equal(result.candidates[0].closed,true);
});
test('blank photos and branching drawings do not invent a race', () => {
  assert.equal(traceRaceImage(drawing()).candidates.length,0);
  const image=drawing(); line(image,30,90,210,90); line(image,120,30,120,150);
  const result=traceRaceImage(image);
  assert.equal(result.candidates.length,0); assert.ok(result.rejected>0);
  assert.throws(()=>raceFromImageTrace(null),/Select/);
  assert.throws(()=>traceRaceImage({data:[],width:1000,height:1000}),/crop/);
});
test('circuit start and reverse retain closure and reject invalid dimensions', () => {
  const trace={closed:true,points:[{x:0,y:0},{x:100,y:0},{x:100,y:100},{x:0,y:100},{x:0,y:0}]};
  const race=raceFromImageTrace(trace,{startIndex:2,reverse:true,lengthM:400});
  assert.deepEqual(race.road.nodes.map(n=>[n.x,n.y]),[[0,0],[0,-100],[-100,-100],[-100,0],[0,0]]);
  assert.throws(()=>raceFromImageTrace(trace,{lengthM:NaN}),/length/);
});
test('image import preserves existing races and supports undo/redo', () => {
  const editor=new RaceEditor({deviceIsMobile:false,isMobile:false},{mode:'race'});
  const original=JSON.stringify(editor.project);
  const race=raceFromImageTrace({closed:false,points:[{x:0,y:0},{x:50,y:50},{x:100,y:0}]},{name:'Paper Track'});
  const count=editor.project.races.length;
  assert.equal(editor.applyImageRace(race),true);
  assert.equal(editor.project.races.length,count+1);
  assert.equal(editor.selectedRace.id,race.id);
  assert.equal(editor.selectedRace.road.nodes.length,3);
  assert.ok(editor.getRaceRawMapPoints().length>=3);
  assert.equal(editor.undoRaceHistory(),true); assert.equal(JSON.stringify(editor.project),original);
  assert.equal(editor.redoRaceHistory(),true); assert.equal(editor.selectedRace.id,race.id);
});
test('From Image is enabled in Race File menu, excluded from Car and opening does not record history', () => {
  const editor=new RaceEditor({deviceIsMobile:false,isMobile:false},{mode:'race'});
  const action=editor.getMenuItems('file').find(a=>a.id==='race-from-image');
  assert.equal(action?.disabled,false); assert.equal(action.label,'From Image');
  assert.equal(editor.shouldCaptureRaceHistory('race-from-image'),false);
  editor.mode='car'; assert.ok(!editor.getMenuItems('file').some(a=>a.id==='race-from-image'));
});

test('a tiny pencil break can be joined without changing a genuine open route', () => {
  const image=drawing(); ellipse(image,120,90,85,55);
  for(let y=30;y<41;y++) for(let x=120;x<122;x++) {
    const i=(y*image.width+x)*4; image.data[i]=image.data[i+1]=image.data[i+2]=250;
  }
  assert.equal(traceRaceImage(image,{bridgeGaps:false}).candidates[0]?.closed,false);
  assert.equal(traceRaceImage(image,{bridgeGaps:true}).candidates[0]?.closed,true);
});
test('modal input lock prevents editor actions while selecting a drawing', () => {
  const editor=new RaceEditor({deviceIsMobile:false,isMobile:false},{mode:'race'});
  editor.raceImageImportOpen=true;
  const before=JSON.stringify(editor.project);
  assert.doesNotThrow(()=>editor.update(null,1));
  editor.handlePointerDown({x:10,y:10}); editor.handlePointerMove({x:20,y:20}); editor.handlePointerUp({x:20,y:20}); editor.handleWheel({deltaY:100});
  assert.equal(JSON.stringify(editor.project),before);
});
test('cancel without a browser does not mutate the project', async () => {
  const editor=new RaceEditor({deviceIsMobile:false,isMobile:false},{mode:'race'});
  const before=JSON.stringify(editor.project);
  assert.equal(await editor.importRaceFromImage(),false);
  assert.equal(editor.raceImageImportOpen,false); assert.equal(editor.raceHistory.length,0);
  assert.equal(JSON.stringify(editor.project),before);
});

test('reusing a photo name creates distinct races instead of a save-name collision', () => {
  const editor=new RaceEditor({deviceIsMobile:false,isMobile:false},{mode:'race'});
  const trace={closed:false,points:[{x:0,y:0},{x:80,y:100}]};
  const name=editor.selectedRace.name;
  editor.applyImageRace(raceFromImageTrace(trace,{name}));
  assert.equal(editor.selectedRace.name,`${name} 2`);
  editor.applyImageRace(raceFromImageTrace(trace,{name}));
  assert.equal(editor.selectedRace.name,`${name} 3`);
});
