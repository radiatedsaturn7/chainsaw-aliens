import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';

const read=p=>JSON.parse(fs.readFileSync(p,'utf8'));

function historicalClaims(phases,cfg) {
  const alias='source-'+cfg.id,stable='saved-car:'+cfg.name;
  const file=path.join(phases,'art-handoff-queue-source-supplement.json');
  return !fs.existsSync(file)?[]:read(file).queue.filter(e=>
    [cfg.id,alias].includes(e.id)||[cfg.id,alias].includes(e.runtimeDocumentId)||
    e.name===cfg.name||e.stableCarId===stable);
}
export function requiresRuntimeSourceAlias({phases,cfg,identity,source}) {
  // An originating historical alias keeps the route mandatory even if the
  // canonical row is stale or the proposed source directory looks canonical.
  return Object.hasOwn(identity,'sourcePackageId')||
    path.basename(source).startsWith('source-')||historicalClaims(phases,cfg).length>0;
}
export function verifyRuntimeSourceAlias({repo,documentPath,cfg,source,original,queue,identity,phases,sha}) {
  const alias='source-'+cfg.id, stable='saved-car:'+cfg.name;
  const catalog=path.join(repo,'assets/car-catalog');
  const designated=path.join(catalog,alias);
  const storage=path.join(repo,'data/server-storage/files');
  const docRelative='cars/'+cfg.name+'/document.json';
  assert.equal(identity.sourcePackageId,alias,'Missing or stale canonical queue sourcePackageId');
  assert.equal(source,designated,'Unexpected physical source alias');
  assert.equal(fs.realpathSync(source),source,'Physical source alias must not be linked');
  const member=basename=>{
    const file=path.join(source,basename);
    const a=fs.lstatSync(file);
    assert.ok(a.isFile()&&a.nlink===1&&fs.realpathSync(file)===file,'Unsafe external or linked source member: '+basename);
    return fs.readFileSync(file,{flag:fs.constants.O_RDONLY|fs.constants.O_NOFOLLOW});
  };
  const markerBytes=member('package-status.json'), configBytes=member('package-config.json');
  const sourceStatus=JSON.parse(markerBytes), packageConfig=JSON.parse(configBytes);
  const pngBytes={};
  for(const role of ['body','dashboard','tires']){
    pngBytes[role]=member(role+'.png');
    assert.equal(sha(pngBytes[role]),cfg.sourceHashes[role],'Stale '+role+' source');
  }
  assert.equal(sourceStatus?.id,alias,'Unexpected source marker identity');
  assert.equal(sourceStatus.runtimeDocumentIdVerified,true,'Source alias must be verified');
  assert.equal(sourceStatus.runtimeDocumentId,cfg.id,'Wrong canonical source binding');
  assert.equal(sourceStatus.name,cfg.name);
  assert.equal(sourceStatus.stableCarId,stable);
  assert.equal(sourceStatus.productionIntegrated,false,'Source already integrated');
  assert.equal(sourceStatus.gameplayAccepted,false,'Source already accepted');
  assert.equal(packageConfig.id,alias);
  assert.equal(packageConfig.name,cfg.name);
  assert.equal(packageConfig.stableCarId,stable);
  assert.deepEqual(packageConfig.mapping,cfg.mapping);
  assert.deepEqual(sourceStatus.mapping,cfg.mapping);
  assert.deepEqual(sourceStatus.sourceHashes,cfg.sourceHashes);
  assert.ok(!sourceStatus.visualHold&&!packageConfig.visualHold,'Source alias is held');
  assert.equal(identity.stableCarId,stable);
  assert.equal(identity.runtimeDocumentIdVerified,true);
  assert.equal(identity.runtimeDocumentId,cfg.id);
  assert.equal(queue.queue.filter(e=>[cfg.id,alias].includes(e.id)||[cfg.id,alias].includes(e.runtimeDocumentId)||e.name===cfg.name||e.stableCarId===stable||e.sourcePackageId===alias).length,1,'Conflicting canonical queue claim');
  const historical=historicalClaims(phases,cfg);
  assert.equal(historical.length,1,'Conflicting historical source claim');
  const [entry]=historical;
  assert.equal(entry.id,alias);
  assert.equal(entry.name,cfg.name);
  assert.equal(entry.stableCarId,stable);
  assert.equal(entry.runtimeDocumentId,null);
  assert.equal(entry.runtimeDocumentIdVerified,false);
  assert.equal(entry.handoffScope,'source-generation-only');
  assert.deepEqual(identity.sources,entry.sources,'Unexpected historical source provenance');
  const claims=fs.readdirSync(catalog,{withFileTypes:true}).filter(x=>x.isDirectory()||x.isSymbolicLink()).filter(x=>{
    const candidate=path.join(catalog,x.name,'package-status.json');
    if(!fs.existsSync(candidate))return false;
    const m=read(candidate);
    return [cfg.id,alias].includes(m.id)||[cfg.id,alias].includes(m.runtimeDocumentId)||m.name===cfg.name||m.stableCarId===stable;
  });
  assert.deepEqual(claims.map(x=>x.name),[alias],'Conflicting physical source package');
  const manifest=read(path.join(storage,'manifest.json')).folders;
  assert.equal(manifest.cars[cfg.name],docRelative);
  assert.equal(Object.values(manifest.cars).filter(ref=>ref===docRelative).length,1,'Conflicting roster manifest claim');
  assert.equal(documentPath,path.join(storage,docRelative),'Input must be the canonical roster document');
  assert.equal(fs.realpathSync(documentPath),documentPath,'Canonical roster document must not be linked');
  const placeholder=original.car.catalogProvenance?.placeholder;
  assert.ok(placeholder?.sourceCar==='RTG-001'&&placeholder.sharedArtOnly===true&&placeholder.noPhysicsCopied===true,'Expected explicit artwork-only placeholder');
  const refs=['body','dashboard','tires'].map(r=>'catalog-'+cfg.id+'-'+r);
  assert.ok(!refs.some(ref=>Object.hasOwn(manifest.art,ref)||fs.existsSync(path.join(storage,'art',ref))||JSON.stringify(original.car.art).includes(JSON.stringify(ref))),'Existing native art must not be replaced');

  // Run the authoritative read-only reconciler on current complete roots, not on a
  // caller-provided receipt. Its hashes are evidence, not a signature.
  const run=spawnSync('python3',[path.join(repo,'tools/art/reconcile-art-roster.py'),'--art-root',repo,'--roster-root',repo],{encoding:'utf8',maxBuffer:32*1024*1024});
  assert.equal(run.status,0,'Official roster reconciler did not prove a clean input');
  const report=JSON.parse(run.stdout);
  const runtimeClaims=new Set();
  const collectClaims=value=>{
    if(!value||typeof value!=='object')return;
    if(value.runtimeDocumentId===cfg.id&&typeof value.path==='string')
      runtimeClaims.add(value.path);
    for(const child of Object.values(value))collectClaims(child);
  };
  collectClaims(report);
  assert.deepEqual([...runtimeClaims],['data/server-storage/files/'+docRelative],'Conflicting runtime document ID');
  const matches=report.readyBindings.filter(p=>p.boundRuntimeDocumentId===cfg.id||p.sourcePackageId===alias||p.stableCarId===stable);
  assert.equal(matches.length,1,'Expected one official ready alias binding');
  const [binding]=matches;
  assert.equal(binding.expectedRuntimeDocumentId,cfg.id);
  assert.equal(binding.boundRuntimeDocumentId,cfg.id);
  assert.equal(binding.sourcePackageId,alias);
  assert.equal(binding.stableCarId,stable);
  assert.equal(binding.document.path,'data/server-storage/files/'+docRelative);
  assert.equal(binding.document.inputDocumentSha256,cfg.expectedDocumentSha256);
  assert.deepEqual(binding.sourceHashes,cfg.sourceHashes);
  assert.equal(binding.document.placeholderExplicit,true);
  assert.equal(binding.document.complete,true);
  assert.equal(binding.productionIntegrated,false);
  assert.equal(binding.sourceHeld,false);
  return {sourcePackageId:alias,pngBytes,pins:{
    packageStatusSha256:sha(markerBytes),packageConfigSha256:sha(configBytes),
    queueRecordSha256:sha(JSON.stringify(identity)),historicalRecordSha256:sha(JSON.stringify(entry)),
    reconcilerSha256:report.toolSha256,reconciledBindingSha256:sha(JSON.stringify(binding)),
  }};
}
