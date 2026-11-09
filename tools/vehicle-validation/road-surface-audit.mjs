import fs from 'node:fs';
import zlib from 'node:zlib';
import RaceEditor from '../../src/ui/RaceEditor.js';
const root=new URL('../../',import.meta.url);
const catalog=JSON.parse(fs.readFileSync(new URL('data/campaigns/america/catalog.json',root)));
const names=[...catalog.map(s=>s.name),'Mount Washington Auto Road %E2%80%94 point-to-point'];
const selected=process.argv.find(a=>a.startsWith('--name='))?.slice(7);
for(const name of names){
 if(selected&&!name.includes(selected))continue;
 const stored=JSON.parse(fs.readFileSync(new URL(`data/server-storage/files/races/${name.replaceAll('%','%25')}/document.json`,root)));
 const doc=stored.__chainsawStorage?JSON.parse(zlib.gunzipSync(Buffer.from(stored.data,'base64'))):stored;
 const editor=new RaceEditor({exitRaceEditor(){}});editor.applyLoadedRaceDocument(doc.race,{name});
 const length=editor.getRaceRouteLength(),runtimeType=editor.getSelectedRaceRuntimeType();
 const report={name,length,bumpiness:[...new Set(editor.selectedRace.road.segments.map(s=>s.bumpiness))],steps:[]};
 for(const step of [editor.getRaceWorldBakeSurfaceStep(),2.5]){
  const sections=editor.getRaceSurfaceBake({routeLength:length,runtimeType,allowVisualExtension:false,step}).sections;
  let priorGrade=null,maxGradeBreakDeg=0,maxGrade=0;const breaks=[];
  for(let i=1;i<sections.length;i++){
   const a=sections[i-1].center,b=sections[i].center;
   const run=Math.hypot(b.x-a.x,(b.z??b.y)-(a.z??a.y));if(run<.01)continue;
   const grade=(b.elevation-a.elevation)*12/run;
   maxGrade=Math.max(maxGrade,Math.abs(grade));
   if(priorGrade!==null){const change=Math.abs(Math.atan(grade)-Math.atan(priorGrade))*180/Math.PI;maxGradeBreakDeg=Math.max(maxGradeBreakDeg,change);breaks.push(change);}
   priorGrade=grade;
  }
  breaks.sort((a,b)=>a-b);report.steps.push({step,sections:sections.length,maxGrade,maxGradeBreakDeg,p99GradeBreakDeg:breaks[Math.floor(breaks.length*.99)]});
 }
 console.log(JSON.stringify(report));
}
