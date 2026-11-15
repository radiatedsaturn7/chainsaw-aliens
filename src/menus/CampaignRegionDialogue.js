import dialogue from '../content/campaign-region-dialogue.json' with {type:'json'};

export function campaignRegionDialogue(ref){return dialogue[ref]||'Well... This is your journey. Where we going next?';}
// Migrate older saved campaign menus as well as newly generated maps. Leave
// custom maps alone; campaignHubs identifies the region-selection flow.
export function configureCampaignRegionMap(document){
 if(!document.parameters?.campaignHubs)return document;
 const screen=document.screens.find(s=>s.id==='world-map');if(!screen)return document;
 screen.elements=screen.elements.filter(e=>e.id!=='america-heading');
 for(const element of screen.elements){
  if(element.type==='world-map')element.showSelectedLabel=false;
  if(element.type==='race-description'){
   element.property='region-dialogue';element.label='Robtergeist';
  }
 }
 return document;
}
