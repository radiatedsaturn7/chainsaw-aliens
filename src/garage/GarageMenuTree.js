import {repairConditionSummary} from './GarageRepairs.js';
// Every node is a real submenu, never a hidden page of additional controls.
export function cappedMenu(rows, classify=null) {
 if(rows.length<=8)return rows;
 if(classify){
  const groups=new Map();
  for(const row of rows){const key=classify(row);if(!groups.has(key))groups.set(key,[]);groups.get(key).push(row);}
  if(groups.size>1&&groups.size<=8)return [...groups].map(([label,children])=>children.length===1?children[0]:menuGroup(label,cappedMenu(children)));
 }
 // Custom authored content can exceed built-in families. Alphabetical ranges
 // keep arbitrarily large libraries reachable with at most eight choices.
 const sorted=rows.slice().sort((a,b)=>a.label.localeCompare(b.label)),size=Math.ceil(sorted.length/8);
 const groups=[];
 for(let i=0;i<sorted.length;i+=size){const children=sorted.slice(i,i+size),first=children[0].label.slice(0,5),last=children.at(-1).label.slice(0,5);const group=menuGroup(first===last?`${first} ${i+1}–${i+children.length}`:`${first}–${last}`,cappedMenu(children));group.id=group.value=`group:range:${i}`;group.description=children[0].label+' through '+children.at(-1).label;groups.push(group);}
 return groups;
}
function menuGroup(label,children){return {id:'group:'+label,value:'group:'+label,label,children,enabled:children.some(r=>r.enabled!==false&&!r.disabled),disabled:children.every(r=>r.disabled===true),description:`${children.length} choices`};}
export function menuAtPath(rows,path=[]){for(const id of path){const next=rows.find(r=>(r.id||r.value)===id);if(!next?.children)return [];rows=next.children;}return rows;}
export function tuningGroup(row,section){
 const id=row.id;
 if(section==='handling')return id.startsWith('ballast')?'Ballast':id.startsWith('brake')?'Brakes':/Front$/.test(id)?'Front':'Rear';
 if(section==='alignment')return /Front$/.test(id)?'Front':'Rear';
 if(section==='differential')return id.startsWith('center')?'Center':id.startsWith('front')?'Front':'Rear';
 if(section==='tires')return id.startsWith('pressure.f')?'Front':'Rear';
 if(section==='suspension')return /Front$/.test(id)?'Front':'Rear';
 if(section==='gearing')return id==='gearFinalDrive'?'Final':Number(id.split('.')[1])<5?'Low':'High';
 if(section==='repair'){
  if(id==='all')return 'Repair All';
  if(id==='service'||id.startsWith('service_'))return 'Service';
  if(/^(damper|spring|alignment)_/.test(id))return 'Suspension';
  if(/^(pads|hydraulics)_/.test(id))return 'Brakes';
  if(/^tire_/.test(id))return 'Tires';
  if(/panel|lights/.test(id))return 'Body';
  if(['clutch','gearbox','differential','axles'].includes(id))return 'Engine';
  if(['alternator','battery','starter','wiring','ecu'].includes(id))return 'Electrics';
  return 'Engine';
 }
 return 'Settings';
}
export function tuningMenu(rows,section){
 if(['handling','tires','alignment','differential'].includes(section)){
  const labels=section==='handling'?['Front','Rear','Brakes','Ballast']:section==='differential'?['Front','Rear','Center']:['Front','Rear'];
  return labels.map(label=>menuGroup(label,cappedMenu(rows.filter(r=>tuningGroup(r,section)===label)))).filter(r=>r.children.length);
 }
 // Within repairs, split the larger systems by function before the cap fallback.
 if(section==='repair'&&rows.length>8){
  const groups=cappedMenu(rows.filter(r=>r.id!=='all'),r=>tuningGroup(r,section));
  for(const group of groups){
   const members=rows.filter(r=>tuningGroup(r,section)===group.label);
   if(group.label==='Service')group.children=[...members.filter(r=>r.id==='service'),...members.filter(r=>r.id.startsWith('service_'))];
   if(group.label==='Suspension')group.children=cappedMenu(members,r=>({damper:'Dampers',spring:'Springs',alignment:'Alignment'}[r.id.split('_')[0]]));
   if(group.label==='Engine')group.children=cappedMenu(members,r=>['clutch','gearbox','differential','axles'].includes(r.id)?'Drivetrain':/radiator|thermostat|waterPump|fans/.test(r.id)?'Cooling':/oil/.test(r.id)?'Oil':/fuel/.test(r.id)?'Fuel':'Internal');
  }
  const order=['Engine','Suspension','Brakes','Tires','Body','Electrics','Service'];
  const position=row=>{const index=order.indexOf(row.children?row.label:tuningGroup(row,section));return index<0?order.length:index;};
  groups.sort((a,b)=>position(a)-position(b));
  groups.unshift(...rows.filter(r=>r.id==='all'));
  return summarizeRepairGroups(groups);
 }
 if(section==='repair')return summarizeRepairGroups(cappedMenu(rows,r=>tuningGroup(r,section)));
 return cappedMenu(rows,r=>tuningGroup(r,section));
}

export function menuPathLabels(rows,path=[]){const labels=[];for(const id of path){const row=rows.find(r=>(r.id||r.value)===id);if(!row?.children)break;labels.push(row.label);rows=row.children;}return labels;}

function summarizeRepairGroups(rows){
 for(const row of rows)if(row.children){
  summarizeRepairGroups(row.children);
  row.conditionSummary=repairConditionSummary(row.children);
 }
 return rows;
}
