import {normalizeItemDocument} from './ItemDocument.js';
import {normalizeItemProgress,planItemEffects,applyItemPlan} from './ItemEffects.js';

const clamp=(n,min,max)=>Math.max(min,Math.min(max,n));
export function itemSpeedMultiplier(entity) {return clamp((entity?.itemSpeedEffects||[]).reduce((value,effect)=>value*effect.amount,1),0.1,4);}
function allied(entity) {return entity?.taxonomies?.includes('Player and Allies')||entity?.attackTarget==='enemy'||entity?.faction==='friendly';}
export function itemRecipients(game,recipient) {
  const session=game.raceEditor?.playtestSession;
  let player,allies,opponents;
  if(session?.running&&!session.carEditorPreview){
    player=session;
    allies=(session.aiRuntime||[]).filter(ai=>session.teamId&&ai.teamId===session.teamId);
    opponents=(session.aiRuntime||[]).filter(ai=>!allies.includes(ai));
  }else{
    player=game.player;
    allies=[game.friendlyCompanion,...(game.enemies||[]).filter(allied)].filter(Boolean);
    opponents=(game.enemies||[]).filter(entity=>!allied(entity)&&!entity.taxonomies?.includes('Neutral')&&entity.attackTarget!=='impartial');
  }
  const result=recipient==='allies'?allies:recipient==='opponents'?opponents:recipient==='everyone'?[player,...allies,...opponents]:[player];
  return [...new Set(result)].filter(entity=>entity&&!entity.dead);
}
const point=(entity,race)=>race?{x:Number(entity.worldX??entity.vehicleDynamicsRunner?.state?.position.x??0),y:Number(entity.worldZ??entity.vehicleDynamicsRunner?.state?.position.z??0)}:{x:entity.x,y:entity.y};
function segmentDistance(p,a,b){const dx=b.x-a.x,dy=b.y-a.y,len=dx*dx+dy*dy,t=len?clamp(((p.x-a.x)*dx+(p.y-a.y)*dy)/len,0,1):0;return Math.hypot(p.x-a.x-dx*t,p.y-a.y-dy*t);}

export class ItemRuntime {
  constructor(game){this.game=game;this.projectiles=[];this.affected=new Set();this.context=null;}
  reset(){for(const entity of this.affected){entity.itemSpeedEffects=[];entity.itemSpeedMultiplier=1;}this.affected.clear();this.projectiles=[];}
  get race(){return Boolean(this.game.raceEditor?.playtestSession?.running&&!this.game.raceEditor.playtestSession.carEditorPreview);}
  syncContext(){const context=this.race?this.game.raceEditor.playtestSession:this.game.world;if(this.context&&this.context!==context)this.reset();this.context=context;}
  apply(item,when,hit=null){
    this.syncContext();
    for(const effect of normalizeItemDocument(item).effects){
      if(effect.when!==when)continue;
      const recipients=itemRecipients(this.game,effect.recipient).filter(entity=>!hit||entity===hit);
      for(const entity of recipients){
        if(effect.type==='speed'){
          entity.itemSpeedEffects||=[];entity.itemSpeedEffects.push({amount:effect.amount,remaining:effect.duration});
          entity.itemSpeedMultiplier=itemSpeedMultiplier(entity);this.affected.add(entity);continue;
        }
        // Persistent player grants are committed by ItemSystem with the inventory write.
        if(entity===this.game.player||entity===this.game.raceEditor?.playtestSession)continue;
        if(!Number.isFinite(entity.maxHealth))entity.maxHealth=Number(entity.definition?.health||entity.health||1);
        const definition={...item,effects:[{...effect,when:'collect',recipient:'player'}]};
        const proxy={player:entity,abilities:entity.abilities||{},itemProgress:entity.itemProgress||normalizeItemProgress()};
        const plan=planItemEffects(definition,entity,proxy.abilities,proxy.itemProgress);applyItemPlan(plan,proxy);
        entity.abilities=proxy.abilities;entity.itemProgress=proxy.itemProgress;
      }
    }
  }
  fire(item){
    this.syncContext();
    const effects=item.effects.filter(effect=>effect.when==='hit');if(!effects.length)return;
    const source=this.race?this.game.raceEditor.playtestSession:this.game.player;if(!source)return;
    const pos=point(source,this.race),yaw=Number(source.carYaw||0);
    const direction=this.race?{x:Math.sin(yaw),y:Math.cos(yaw)}:{x:Number(source.aimX??source.facing??1),y:Number(source.aimY||0)};
    const length=Math.hypot(direction.x,direction.y)||1;direction.x/=length;direction.y/=length;
    this.projectiles.push({item,source,race:this.race,...pos,dx:direction.x,dy:direction.y,speed:this.race?55:480,life:4});
  }
  update(dt){
    this.syncContext();
    const seconds=Math.max(0,Number(dt)||0);
    for(const entity of this.affected){
      entity.itemSpeedEffects=(entity.itemSpeedEffects||[]).map(effect=>({...effect,remaining:effect.remaining-seconds})).filter(effect=>effect.remaining>0);
      entity.itemSpeedMultiplier=itemSpeedMultiplier(entity);if(!entity.itemSpeedEffects.length)this.affected.delete(entity);
    }
    for(const projectile of this.projectiles){
      projectile.life-=seconds;const previous={x:projectile.x,y:projectile.y};
      projectile.x+=projectile.dx*projectile.speed*seconds;projectile.y+=projectile.dy*projectile.speed*seconds;
      const targets=[...new Set(projectile.item.effects.filter(e=>e.when==='hit').flatMap(e=>itemRecipients(this.game,e.recipient)))].filter(entity=>entity!==projectile.source);
      const hit=targets.find(entity=>segmentDistance(point(entity,projectile.race),previous,projectile)<(projectile.race?2:Math.max(10,Number(entity.width||20)/2)));
      if(hit){this.apply(projectile.item,'hit',hit);projectile.life=0;}
    }
    this.projectiles=this.projectiles.filter(projectile=>projectile.life>0&&projectile.race===this.race);
  }
  draw(ctx,project=point=>({x:point.x,y:point.y,visible:true})){
    ctx.save();ctx.fillStyle='#83edff';ctx.shadowColor='#38beff';ctx.shadowBlur=8;
    for(const projectile of this.projectiles){const p=project(projectile);if(!p||p.visible===false)continue;ctx.beginPath();ctx.arc(p.x,p.y,5,0,Math.PI*2);ctx.fill();}ctx.restore();
  }
}
