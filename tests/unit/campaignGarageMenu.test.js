import test from 'node:test';
import assert from 'node:assert/strict';
import MenuPlayer from '../../src/menus/MenuPlayer.js';
import {MenuFlow} from '../../src/menus/MenuFlow.js';
import {createMenuDocument,normalizeMenuDocument} from '../../src/menus/MenuDocument.js';
import {ItemSystem} from '../../src/items/ItemSystem.js';
import {campaignCarPrice} from '../../src/garage/CampaignEconomy.js';
async function fixture(){
 const game={menuProgress:{selectedGameCar:'RTG-001'},player:{credits:20000},abilities:{},campaignSaves:{hasActive:true,save:async()=>({ok:true})},resolveRaceTravelCarAsync:async()=>({car:{}})};
 game.items=new ItemSystem(game,{load:async()=>({}),save:async()=>({ok:true})});await game.items.load();
 const player=new MenuPlayer(game);game.menuPlayer=player;player.enterScreen=()=>{};
 player.flow=new MenuFlow(createMenuDocument(),{campaignGarage:(action,value)=>player.campaignGarage(action,value)});
 player.resources.choices=()=>['RTG-001',...Array.from({length:20},(_,i)=>`Car ${i}`)].map(value=>({value,label:value}));
 player.resources.performance=()=>({points:500});player.flow.lockCar('RTG-001');player.flow.goTo('garage');player.installCampaignGarage();
 return {game,player};
}
test('Drive, Tune, Upgrade and Garage share one row, and repeated installation does not duplicate controls',async()=>{
 const {player}=await fixture();player.installCampaignGarage();
 const screen=player.flow.screen,buttons=screen.elements.filter(e=>e.type==='button');
 assert.deepEqual(buttons.map(e=>e.label),['Drive','Tune','Upgrade','Garage']);assert.equal(new Set(buttons.map(e=>e.w)).size,1);
 for(let i=1;i<buttons.length;i++)assert.ok(buttons[i].x>=buttons[i-1].x+buttons[i-1].w);
 assert.ok(buttons.at(-1).x+buttons.at(-1).w<=1);assert.equal(screen.elements.filter(e=>e.id==='race-rewards').length,1);
 assert.doesNotThrow(()=>normalizeMenuDocument(player.flow.document));
});
test('owned list excludes shop cars; paginated shop stays within eight choices; purchase and switch retain route and build',async()=>{
 const {game,player}=await fixture();player.flow.parameters.raceRef='Laurel Highlands';
 game.items.progress.garage.cars['RTG-001']={installed:{},tune:{torqueScale:.9}};
 await player.flow.run({type:'campaign-garage',target:'owned'});
 assert.ok(player.flow.screen.elements.some(e=>e.label==='RTG-001 ✓'));assert.ok(!player.flow.screen.elements.some(e=>e.label==='Car 0'));
 await player.flow.run({type:'campaign-garage',target:'shop'});
 for(let page=0;page<4;page++){
  await player.flow.run({type:'campaign-garage',target:'shop',value:{page}});
  assert.ok(player.flow.screen.elements.filter(e=>e.type==='button').length<=8);
 }
 await player.flow.run({type:'campaign-garage',target:'inspect',value:{ref:'Car 0'}});
 assert.ok(player.flow.screen.elements.some(e=>e.label===`${campaignCarPrice(500).toLocaleString()} scrap`));
 await player.flow.run({type:'campaign-garage',target:'buy',value:{ref:'Car 0'}});
 assert.equal(game.player.credits,20000-campaignCarPrice(500));assert.deepEqual(game.items.progress.garage.ownedCars,['RTG-001','Car 0']);
 await player.flow.run({type:'campaign-garage',target:'select',value:{ref:'Car 0'}});
 assert.equal(player.flow.error,'');assert.equal(player.flow.screenId,'garage');assert.equal(player.flow.lockedCarRef,'Car 0');assert.equal(game.menuProgress.selectedGameCar,'Car 0');
 assert.equal(player.flow.parameters.raceRef,'Laurel Highlands');assert.equal(game.items.garage.configuration('RTG-001').tune.torqueScale,.9);
});
test('unaffordable purchases and unowned selection cannot change car or currency',async()=>{
 const {game,player}=await fixture();game.player.credits=500;
 assert.equal(await player.flow.run({type:'campaign-garage',target:'buy',value:{ref:'Car 0'}}),false);assert.match(player.flow.error,/Not enough scrap/);
 assert.equal(await player.flow.run({type:'campaign-garage',target:'select',value:{ref:'Car 0'}}),false);assert.match(player.flow.error,/do not own/);
 assert.equal(game.player.credits,500);assert.equal(game.menuProgress.selectedGameCar,'RTG-001');
});

test('actual normalized Garage and Buy Cars buttons tolerate empty action payloads',async()=>{
 const {player}=await fixture();
 // Menu serialization represents an omitted action value as null.
 const doc=normalizeMenuDocument(player.flow.document);
 const garageButton=doc.screens.find(s=>s.id==='garage').elements.find(e=>e.id==='campaign-garage');
 assert.equal(garageButton.action.value,null);
 assert.equal(await player.flow.run(garageButton.action),true,player.flow.error);
 assert.equal(player.flow.screenId,'fleet-owned');
 const shopButton=player.flow.screen.elements.find(e=>e.label==='Buy Cars');
 assert.equal(shopButton.action.value,null);
 assert.equal(await player.flow.run(shopButton.action),true,player.flow.error);
 assert.equal(player.flow.screenId,'fleet-shop');
 const next=player.flow.screen.elements.find(e=>e.label==='Next');
 assert.equal(await player.flow.run(next.action),true,player.flow.error);
 assert.ok(player.flow.screen.elements.some(e=>e.label==='Car 5'));
 const previous=player.flow.screen.elements.find(e=>e.label==='Previous');
 assert.equal(await player.flow.run(previous.action),true,player.flow.error);
 assert.ok(player.flow.screen.elements.some(e=>e.label==='Car 0'));
});
