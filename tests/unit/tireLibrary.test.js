import test from 'node:test';
import assert from 'node:assert/strict';
import {buildTireLibraryChoices,openTireLibrary} from '../../src/ui/TireLibrary.js';
import {createTireDefinition} from '../../src/racing/raceTires.js';
import {upsertCachedProjectFile,clearCachedProjectFilesForTests} from '../../src/ui/serverStorage.js';
import {resetProjectFilesForTests} from '../../src/ui/projectFiles.js';

function fakeDocument(){
  const nodes=[];
  const document={activeElement:null,createElement(tag){
    const listeners=new Map();const node={tag,children:[],style:{},textContent:'',disabled:false,value:'',
      appendChild(child){this.children.push(child);},replaceChildren(){this.children=[];},setAttribute(key,value){this[key]=value;},
      addEventListener(key,callback){listeners.set(key,callback);},showModal(){},close(){listeners.get('close')?.();},remove(){},focus(){}};
    nodes.push(node);return node;
  }};
  document.body=document.createElement('body');return {document,nodes};
}
const flush=()=>new Promise(resolve=>setImmediate(resolve));
function seed(){
  clearCachedProjectFilesForTests();resetProjectFilesForTests();
  const tire=createTireDefinition('offroad');tire.graphics.tireSurfaces={tread:{artRef:'Offroad art',frameIndex:0},wheel:{artRef:'Offroad art',frameIndex:1}};
  const put=(folder,name,data)=>upsertCachedProjectFile(folder,name,JSON.stringify({folder,name,savedAt:1,data}));
  put('tires','Offroad',tire);put('art','Offroad art',{width:2,height:2,frames:[Array(4).fill('#ff0000'),Array(4).fill('#00ff00')]});
  return tire;
}

test('saved Offroad is distinct from the artwork-free template and is offered first',()=>{
  const files=[{name:'Offroad'}],model=buildTireLibraryChoices(files);
  assert.equal(model.value,'saved:Offroad');
  assert.equal(model.choices[0].group,'Saved tires');
  assert.match(model.choices[0].label,/Offroad.*saved/);
  assert.match(model.choices.find(option=>option.value==='builtin:offroad').label,/template.*no artwork/);
  assert.equal(buildTireLibraryChoices(files,'Offroad').value,'saved:Offroad');
  assert.equal(buildTireLibraryChoices(files,'builtin:offroad').value,'builtin:offroad');
});

test('Apply waits for the saved tire artwork and returns the saved Offroad definition',async()=>{
  const expected=seed(),previousDocument=globalThis.document,{document,nodes}=fakeDocument();globalThis.document=document;
  try{
    const pending=openTireLibrary({allowEditor:true});
    const select=nodes.find(node=>node.tag==='select');
    const apply=nodes.find(node=>node.tag==='button'&&node.textContent==='Apply');
    assert.equal(select.value,'saved:Offroad');assert.equal(apply.disabled,true);
    await flush();assert.equal(apply.disabled,false);
    assert.match(nodes.find(node=>node.role==='status').textContent,/saved tire.*Saved artwork is ready/);
    apply.onclick();const selected=await pending;
    assert.equal(selected.ref,'Offroad');assert.deepEqual(selected.tire.graphics.tireSurfaces,expected.graphics.tireSurfaces);
  }finally{globalThis.document=previousDocument;clearCachedProjectFilesForTests();resetProjectFilesForTests();}
});

test('changing to a template while saved artwork is loading never applies the stale saved selection',async()=>{
  seed();const previousDocument=globalThis.document,{document,nodes}=fakeDocument();globalThis.document=document;
  try{
    const pending=openTireLibrary();const select=nodes.find(node=>node.tag==='select');
    select.value='builtin:offroad';select.onchange();await flush();
    assert.match(nodes.find(node=>node.role==='status').textContent,/built-in template.*No custom artwork/);
    nodes.find(node=>node.tag==='button'&&node.textContent==='Apply').onclick();
    const selected=await pending;assert.equal(selected.ref,'builtin:offroad');assert.equal(selected.tire.graphics.tireSurfaces,undefined);
  }finally{globalThis.document=previousDocument;clearCachedProjectFilesForTests();resetProjectFilesForTests();}
});

test('Cancel closes the chooser without applying a prepared saved tire',async()=>{
  seed();const previousDocument=globalThis.document,{document,nodes}=fakeDocument();globalThis.document=document;
  try{
    const pending=openTireLibrary();await flush();nodes.find(node=>node.tag==='button'&&node.textContent==='Cancel').onclick();
    assert.equal(await pending,null);
  }finally{globalThis.document=previousDocument;clearCachedProjectFilesForTests();resetProjectFilesForTests();}
});

test('missing artwork keeps Apply disabled and reports the load failure',async()=>{
  seed();upsertCachedProjectFile('tires','Offroad',JSON.stringify({folder:'tires',name:'Offroad',savedAt:2,
    data:{...createTireDefinition('offroad'),graphics:{tires:['Missing Tire Art']}}}));
  const previousDocument=globalThis.document,previousFetch=globalThis.fetch,{document,nodes}=fakeDocument();globalThis.document=document;
  globalThis.fetch=async()=>({ok:false,status:404,json:async()=>({error:'Not found'})});
  try{
    const pending=openTireLibrary();await flush();await flush();
    assert.equal(nodes.find(node=>node.tag==='button'&&node.textContent==='Apply').disabled,true);
    assert.match(nodes.find(node=>node.role==='status').textContent,/Could not load.*Missing Tire Art/);
    nodes.find(node=>node.tag==='button'&&node.textContent==='Cancel').onclick();assert.equal(await pending,null);
  }finally{globalThis.document=previousDocument;globalThis.fetch=previousFetch;clearCachedProjectFilesForTests();resetProjectFilesForTests();}
});

test('opening tire picker refreshes all saved tires and preserves the selected tire',async()=>{
  seed();const previousDocument=globalThis.document,previousFetch=globalThis.fetch;
  const {document,nodes}=fakeDocument();globalThis.document=document;
  let requested='';
  globalThis.fetch=async url=>{requested=String(url);return {ok:true,json:async()=>({ok:true,index:{tires:{Offroad:{updatedAt:1},Tarmac:{updatedAt:2},Dirt:{updatedAt:3}}}})};};
  try{
    const pending=openTireLibrary({currentRef:'Offroad'});
    await flush();await flush();
    assert.match(requested,/__storage\/index\?folder=tires/);
    const select=nodes.find(node=>node.tag==='select');
    const saved=select.children.find(node=>node.label==='Saved tires').children.map(node=>node.value);
    assert.deepEqual(new Set(saved),new Set(['saved:Offroad','saved:Tarmac','saved:Dirt']));
    assert.equal(select.value,'saved:Offroad');
    nodes.find(node=>node.tag==='button'&&node.textContent==='Cancel').onclick();await pending;
  }finally{globalThis.document=previousDocument;globalThis.fetch=previousFetch;clearCachedProjectFilesForTests();resetProjectFilesForTests();}
});
