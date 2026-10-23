import test from 'node:test';
import assert from 'node:assert/strict';
import {menuPanelArtBounds,drawMenuPanelArt} from '../../src/menus/MenuPanelArtwork.js';
test('panel fitting trims transparent padding once and fills the full button bounds',()=>{
 const data=new Uint8ClampedArray(10*10*4);let reads=0;
 for(let y=3;y<7;y++)for(let x=1;x<9;x++)data[(y*10+x)*4+3]=255;
 data[3]=1;
 const image={width:10,height:10,getContext:()=>({getImageData:()=>{reads++;return {data};}})};
 assert.deepEqual(menuPanelArtBounds(image),{x:1,y:3,w:8,h:4});
 let args;drawMenuPanelArt({drawImage:(...a)=>args=a},image,{x:20,y:30,w:200,h:100});
 assert.deepEqual(args,[image,1,3,8,4,20,30,200,100]);assert.equal(reads,1);
});
