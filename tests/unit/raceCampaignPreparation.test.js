import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

test('North 2 prepares and transfers its real saved terrain on a small stack', {timeout:120000}, ()=>{
 const script=fileURLToPath(new URL('../../tools/campaigns/validate_loading.mjs',import.meta.url));
 const result=spawnSync(process.execPath,['--stack_size=128',script,'--stage=america-north-02'],{encoding:'utf8',timeout:110000});
 assert.equal(result.status,0,result.error?.message||result.stderr);
 const report=JSON.parse(result.stdout.trim());
 assert.equal(report.ok,true);
 assert.ok(report.triangles>10000,'exercise the large survey rather than a tiny substitute');
});
