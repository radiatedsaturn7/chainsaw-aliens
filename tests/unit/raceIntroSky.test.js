import test from 'node:test';
import assert from 'node:assert/strict';
import RaceEditor from '../../src/ui/RaceEditor.js';
import {raceIntroShot} from '../../src/racing/RaceIntro.js';
test('cinematic cuts retain camera height, including the rear shot',()=>{
 const heights=[.7,2.5,4.3].map(elapsed=>raceIntroShot({raceIntro:{active:true,elapsed}}).height);
 assert.deepEqual(heights,[2,2,2]);
});
test('panorama covers the entire viewport above and below its artwork without changing its scale',()=>{
 const e=new RaceEditor({});e.getRaceSkyboxSettings=()=>({artRef:'sky',scaleX:1,scaleY:.25,offsetYRatio:0,offsetXTurns:0});
 const source={width:100,height:50};e.getRaceSkyboxRenderCanvas=()=>source;
 const images=[],rects=[],ctx={save(){},restore(){},beginPath(){},clip(){},rect:(...args)=>rects.push(args),drawImage:(...args)=>images.push(args)};
 const bounds={x:0,y:0,w:600,h:400};
 assert.equal(e.drawRaceSkyboxArt(ctx,bounds,{horizon:200}),true);
 assert.deepEqual(rects[0],[0,0,600,400]);
 assert.ok(images.some(args=>args.length===9&&args[2]===0&&args[6]===0));
 assert.ok(images.some(args=>args.length===9&&args[2]===49&&Math.abs(args[6]+args[8]-400)<.001));
 const main=images.find(args=>args.length===5);assert.equal(main[4],72);
});
