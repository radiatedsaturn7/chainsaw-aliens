import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {execFileSync} from 'node:child_process';

test('deopt summary separates startup and handles anonymous and parenthesized reasons',()=>{
 const dir=mkdtempSync(join(tmpdir(),'deopt-'));
 try{
  const event=(name,reason)=>`[bailout (kind: deopt-eager, reason: ${reason}): begin. deoptimizing 0x1 <JSFunction ${name}(sfi = 0x2)>, details]`;
  const path=join(dir,'trace.log');
  writeFileSync(path,[event('step ','wrong map'),'{"frame":300,"updateMs":4}',event('step ','wrong map'),event('','(unknown)'),'{"frame":610,"updateMs":5}',event('step ','wrong map')].join('\n'));
  const r=JSON.parse(execFileSync(process.execPath,['tools/loadtest/summarize-v8-deopts.mjs',path],{encoding:'utf8'}));
  assert.equal(r.total,4);assert.equal(r.afterWarmup,3);
  assert.equal(r.functions.find(x=>x.name==='step').count,2);
  assert.equal(r.functions.find(x=>x.name==='(anonymous)').count,1);
  assert.equal(r.reasons.find(x=>x.name==='(unknown)').count,1);
  assert.deepEqual(r.windows,{'0':2,'600':1});
 }finally{rmSync(dir,{recursive:true,force:true});}
});
