import fs from 'node:fs';
import zlib from 'node:zlib';
import RaceEditor from '../../src/ui/RaceEditor.js';
import {buildRaceAiRoadPlan} from '../../src/racing/RaceAiRoadPlan.js';
import {racingLineTrack} from '../../tests/fixtures/racingLineTrack.js';
const dir='artifacts/racing-line';fs.mkdirSync(dir,{recursive:true});
const catalog=JSON.parse(fs.readFileSync('data/campaigns/america/catalog.json'));
const editor=new RaceEditor({});const report=[];
for(const stage of catalog){
 const stored=JSON.parse(fs.readFileSync(`data/server-storage/files/races/${stage.name}/document.json`));
 const doc=stored.__chainsawStorage?JSON.parse(zlib.gunzipSync(Buffer.from(stored.data,'base64'))):stored;
 editor.applyLoadedRaceDocument(doc.race);
 const start=performance.now();
 const plan=editor.withRaceGeometryReadCache(()=>buildRaceAiRoadPlan(editor,{routeLength:editor.getRaceRouteLength(),runtimeType:'destination'}));
 const line=plan?.racingLine;if(!line)throw Error(`No optimized line for ${stage.name}`);
 let maxOffset=0,minClearance=Infinity;
 for(let i=0;i<plan.count;i++){
  maxOffset=Math.max(maxOffset,Math.abs(line.offsets[i]));
  minClearance=Math.min(minClearance,plan.halfWidth[i]-Math.abs(line.offsets[i])-line.vehicleWidth/2);
 }
 if(minClearance<line.margin-1e-6)throw Error(`Clearance failed: ${stage.name}`);
 const row={race:stage.name,samples:plan.count,buildMs:Math.round(performance.now()-start),maxOffsetM:+maxOffset.toFixed(2),minClearanceM:+minClearance.toFixed(2),centerPeakCurvature:Math.max(...plan.centerCurvature),linePeakCurvature:Math.max(...plan.curvature)};
 report.push(row);console.log(JSON.stringify(row));
}
fs.writeFileSync(`${dir}/campaign-validation.json`,JSON.stringify(report,null,2)+'\n');
const t=racingLineTrack(),plan=buildRaceAiRoadPlan(t.editor,{routeLength:t.length,runtimeType:'destination'}),line=plan.racingLine;
const scale=2.8,xy=p=>`${(75+p.x*scale).toFixed(2)},${(500-p.z*scale).toFixed(2)}`;
const path=points=>points.map((p,i)=>`${i?'L':'M'}${xy(p)}`).join(' ');
const centers=line.centers,edge=sign=>centers.map(p=>({x:p.x+Math.cos(p.yaw)*t.width/2*sign,z:p.z-Math.sin(p.yaw)*t.width/2*sign}));
const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="640" height="560" viewBox="0 0 640 560"><rect width="640" height="560" fill="#101821"/><text x="24" y="30" fill="white" font-family="sans-serif" font-size="20">Optimized racing line · 90° corner</text><path d="${path(centers)}" fill="none" stroke="#374552" stroke-width="${t.width*scale}"/><path d="${path(edge(1))}" fill="none" stroke="#92a2ad"/><path d="${path(edge(-1))}" fill="none" stroke="#92a2ad"/><path d="${path(centers)}" fill="none" stroke="#ffbd66" stroke-width="2" stroke-dasharray="5 5"/><path d="${path(line.points)}" fill="none" stroke="#51ed91" stroke-width="3"/><text x="300" y="420" fill="#ffbd66" font-family="sans-serif">Dashed: road center</text><text x="300" y="446" fill="#51ed91" font-family="sans-serif">Green: shared guide / AI path</text><text x="24" y="540" fill="white" font-family="sans-serif">Outside entry → inside apex → outside exit · vehicle clearance enforced</text></svg>`;
fs.writeFileSync(`${dir}/optimized-line.svg`,svg);
