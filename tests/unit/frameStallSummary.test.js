import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {execFileSync} from 'node:child_process';

test('frame stall attribution clips and unions GC intervals without counting warmup or gaps',()=>{
 const dir=mkdtempSync(join(tmpdir(),'frame-stalls-'));
 try {
  const rows=Array(303).fill(0);rows[300]=120;rows[301]=10;rows[302]=150;
  const input={rows,frameSpans:[{frame:0,start:0,end:100},{frame:300,start:100,end:230},
    {frame:301,start:250,end:260},{frame:302,start:300,end:460}],
   gcEvents:[{start:90,duration:20},{start:105,duration:20},{start:225,duration:20},
    {start:270,duration:10}]};
  const path=join(dir,'input.json');writeFileSync(path,JSON.stringify(input));
  const result=JSON.parse(execFileSync(process.execPath,['tools/loadtest/summarize-frame-stalls.mjs',path],{encoding:'utf8'}));
  assert.equal(result.frames,3);assert.equal(result.gcOverlapMs,30);
  assert.equal(result.totalFrameMs,300);assert.equal(result.gcOverlapPercent,10);
  assert.equal(result.over100ms,2);assert.equal(result.over100msWithGc,1);
  assert.equal(result.worst[0].frame,302);
 } finally {rmSync(dir,{recursive:true,force:true});}
});
