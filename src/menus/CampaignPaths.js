// Authored campaign itinerary. References resolve to existing imported races;
// coordinates below are illustrated-map positions, never replacement GPS data.
export const CAMPAIGN_PATHS = [
 ["Tower Hill Road", "Blue Hills — Reservation Parkways", "RI 116 — North Smithfield Scituate", "RI 44 — Putnam Pike Glocester", "Pachaug State Forest — public gravel access roads"],
 ["Hurricane Mountain Road — Conway", "Pinkham Notch — NH 16", "Bear Notch Road — Bartlett", "Kancamagus Highway — NH 112", "Team O’Neil-inspired Rally Stage (2994)"],
 ["Brandywine Valley — Montchanin Road", "Forbes State Forest — designated gravel roads", "County Line Road — Seven Springs", "PA 711 — Normalville Champion", "US 40 — Chalk Hill Summit"],
 ["OH 536 — Ohio River hills", "OH 26 — Covered Bridge Scenic Byway", "OH 550 — Barlow approach", "Washington County western covered-bridge gravel loop", "OH 555 — Triple Nickel"],
 ["MO 19 — Eminence Current River", "MO 106 — Alley Spring approach", "MO H NN — Roberts Field access", "Jerktail Landing gravel road", "Pig Trail — Arkansas 23"],
 ["IL 100 — Great River Road bluffs", "MO 94 — Defiance Augusta", "World Wide Technology Raceway — road course", "I-70 — Stan Musial Veterans Memorial Bridge", "St. Louis, MO — Landmark Run"],
 ["Route 66 — Bridgeport Pony Bridge, Oklahoma", "Old Route 66 — Shamrock McLean", "Palo Duro Canyon — Park Road 5", "Amarillo — Historic 6th Avenue alignment", "Old Route 66 — Adrian Glenrio"],
 ["Garden of the Gods — paved park road", "Gold Camp Road — Colorado Springs", "US 24 — Ute Pass Woodland Park", "Phantom Canyon Road — Gold Belt Tour", "CO 67 — Woodland Park Cripple Creek"],
 ["UT 316 — Goosenecks State Park Road", "Valley of the Gods Road — San Juan CR 242", "UT 95 — Comb Ridge Cedar Mesa", "Muley Point Road — CR 241", "Burr Trail switchbacks — Capitol Reef"],
 ["SR 179 — Red Rock Scenic Byway", "Boynton Pass Road FR 525 loop", "Upper Lower Red Rock Loop Road", "Schnebly Hill Road — Sedona", "SR 89A — Mingus Mountain Jerome"],
 ["Glendora Ridge Road", "Glendora Mountain Road", "Los Angeles, CA — Landmark Run", "Big Tujunga Canyon Road", "Willow Springs — Horse Thief Mile"]
];
export const CAMPAIGN_BRANCHES = [
 ['Thompson Speedway — 1.7-mile road course','Boston, MA — Landmark Run'],
 ['Club Motorsports — Tamworth','Smugglers Notch — Vermont 108'],
 ['Pittsburgh International Race Complex — Wampum','Philadelphia, PA — Landmark Run'],
 ['Mid-Ohio Sports Car Course — Lexington','Charleston, WV — Landmark Run'],
 ['Ozarks International Raceway — Gravois Mills','MO V — Two Rivers access'],
 ['Chicago, IL — Landmark Run','Gateway Kartplex — WWT complex'],
 ['Hallett Motor Racing Circuit — Jennings, Oklahoma','Old Route 66 — Vega Adrian'],
 ['Bayard — Road 77 to City Park','Squaw Creek — Highland Center'],
 ['Shafer Trail — Canyonlands National Park','US 163 — Mexican Hat Monument Valley approach'],
 ['Grand Canyon — Diamond Creek Descent','Podium Club at Attesa — Casa Grande'],
 ['Willow Springs — Streets of Willow','Little Tujunga Canyon Road']
];
// Preserve the named unlock prerequisites even when the route order changes.
const CAMPAIGN_BRANCH_AFTER = [
 ["RI 116 — North Smithfield Scituate", "Pachaug State Forest — public gravel access roads"],
 ["Team O’Neil-inspired Rally Stage (2994)", "Hurricane Mountain Road — Conway"],
 ["PA 711 — Normalville Champion", "US 40 — Chalk Hill Summit"],
 ["Washington County western covered-bridge gravel loop", "OH 536 — Ohio River hills"],
 ["MO 106 — Alley Spring approach", "Jerktail Landing gravel road"],
 ["MO 94 — Defiance Augusta", "I-70 — Stan Musial Veterans Memorial Bridge"],
 ["Old Route 66 — Shamrock McLean", "Palo Duro Canyon — Park Road 5"],
 ["Gold Camp Road — Colorado Springs", "Phantom Canyon Road — Gold Belt Tour"],
 ["Valley of the Gods Road — San Juan CR 242", "Muley Point Road — CR 241"],
 ["Boynton Pass Road FR 525 loop", "Schnebly Hill Road — Sedona"],
 ["Big Tujunga Canyon Road", "Glendora Mountain Road"]
];
export function authorCampaignPath(region) {
 const mainPath=CAMPAIGN_PATHS[region.stage-1];
 if(!mainPath)return region;
 const branches=CAMPAIGN_BRANCHES[region.stage-1].map((raceRef,i)=>({raceRef,after:CAMPAIGN_BRANCH_AFTER[region.stage-1][i]}));
 for(const ref of [...mainPath,...branches.map(b=>b.raceRef)])if(!region.events.includes(ref))return region; // Partial/custom catalogs keep their existing menus.
 return {...region,mainPath:[...mainPath],branches,bossClears:mainPath.length};
}
export function campaignPathScreen(region,name) {
 const id=`campaign-hub-${region.stage}`;
 const points=[[.12,.77],[.34,.63],[.18,.39],[.46,.25],[.72,.39],[.87,.16],[.60,.78],[.73,.64]];
 const refs=[...region.mainPath,region.bossRef,...region.branches.map(b=>b.raceRef)];
 const nodes=refs.map((raceRef,i)=>({id:`stop-${i}`,raceRef,label:i===5?'Boss':i>5?'Detour':`${i+1}`,x:points[i][0],y:points[i][1]}));
 const connections=nodes.slice(1,6).map((n,i)=>({from:nodes[i].id,to:n.id,curve:'bezier'}));
 region.branches.forEach((branch,i)=>connections.push({from:nodes[region.mainPath.indexOf(branch.after)].id,to:nodes[6+i].id,pattern:'dotted',curve:'bezier'}));
 return {id,name,background:'#000000',useDefaultBackground:false,musicMode:'continue',elements:[
  {id:'heading',type:'text',label:name,x:.04,y:.02,w:.92,h:.09,fontSize:26,useDefaultFont:true},
  {id:'regional-path',type:'world-map',property:'campaign-path',assetRef:region.bossRef,binding:'raceRef',x:.025,y:.14,w:.57,h:.68,
   mapEntrance:'auto',mapManual:true,nodes,connections,showSelectedLabel:false,color:'#ffffff',mapStyle:{cursor:'car',labels:'selected',lineColor:'#e7c98d',lineWidth:5,unselectedOpacity:1,disabledOpacity:.45},
   action:{type:'screen',target:'garage'}},
  {id:'route-name',type:'race-description',property:'route-title',binding:'raceRef',x:.62,y:.13,w:.35,h:.13,fontSize:20,useDefaultFont:true,color:'#ffffff'},
  {id:'route-preview',type:'race-description',property:'route-preview',binding:'raceRef',x:.62,y:.28,w:.35,h:.56,useDefaultFont:true,color:'#ffffff'}
 ]};
}
