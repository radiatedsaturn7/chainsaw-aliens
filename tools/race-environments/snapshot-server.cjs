// Read-only Git-tree view of the existing test server; no checkout or copied worktree.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const {execFileSync} = require('node:child_process');
const {Readable} = require('node:stream');
const root = path.resolve(__dirname, '../..');
const commit = execFileSync('git',['rev-parse',process.env.RACE_QA_COMMIT || 'HEAD'],{cwd:root,encoding:'utf8'}).trim();
const tree = execFileSync('git',['ls-tree','-rlz',commit],{cwd:root,maxBuffer:20e6}).toString().split('\0').filter(Boolean);
const files = new Map(), dirs = new Map([['',new Set()]]);
for (const line of tree) {
  const [meta,name] = line.split('\t');
  const [mode,type,sha,size] = meta.trim().split(/\s+/);
  if(type !== 'blob') continue;
  files.set(name,{sha,size:Number(size)});
  const parts=name.split('/');
  for(let i=0;i<parts.length;i++) {const dir=parts.slice(0,i).join('/');if(!dirs.has(dir))dirs.set(dir,new Set());dirs.get(dir).add(parts[i]);}
}
// Verify every working-file read against its immutable Git blob, falling back to
// Git if the file differs. Later art edits cannot contaminate a baseline run.
const {createHash}=require('node:crypto');
const relative = file => path.relative(root,String(file)).split(path.sep).join('/');
const bytes = name => {
 const full=path.join(root,name),entry=files.get(name);
 if(fs.existsSync(full)) {
  const data=fs.readFileSync(full);
  const hash=createHash('sha1').update(Buffer.from('blob '+data.length+'\0')).update(data).digest('hex');
  if(hash===entry.sha)return data;
 }
 return execFileSync('git',['cat-file','blob',entry.sha],{cwd:root,maxBuffer:150e6});
};
const missing = name => Object.assign(new Error('No snapshot file: '+name),{code:'ENOENT'});
const snapshotFs={
  existsSync(file){const n=relative(file);return files.has(n)||dirs.has(n);},
  readFileSync(file,encoding){const n=relative(file);if(!files.has(n))throw missing(n);const b=bytes(n);return encoding?b.toString(typeof encoding==='string'?encoding:encoding.encoding):b;},
  readdirSync(file){const n=relative(file);if(!dirs.has(n))throw missing(n);return [...dirs.get(n)];},
  statSync(file){const n=relative(file);if(!files.has(n)&&!dirs.has(n))throw missing(n);return {size:files.get(n)?.size||0,mtimeMs:1,isDirectory:()=>dirs.has(n)};},
  createReadStream(file){return Readable.from([this.readFileSync(file)]);}
};
const source=execFileSync('git',['show',commit+':tools/playwright/static-server.cjs'],{cwd:root,encoding:'utf8'});
const testModule={exports:{}};
const requireSnapshot=name=>name==='fs'?snapshotFs:require(name);
requireSnapshot.main=testModule;
console.log(JSON.stringify({snapshotCommit:commit,files:files.size,method:'Git-tree index; every file read verified against immutable Git blob; Git fallback for differences'}));
vm.runInThisContext('(function(require,module,exports,__dirname){'+source+'\n})',{filename:'snapshot-static-server.cjs'})(requireSnapshot,testModule,testModule.exports,path.join(root,'tools/playwright'));
