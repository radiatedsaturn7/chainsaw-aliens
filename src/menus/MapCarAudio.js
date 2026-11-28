import {GarageEnginePreview} from './GarageEnginePreview.js';
// Reuse the selected car's engine sound without running vehicle physics.
export class MapCarAudio {
 constructor(game){this.game=game;this.engine=new GarageEnginePreview(game);}
 update(car,moving,dt){
  if(!moving||!car){this.stop();return;}
  this.engine.update(car,.6,Math.min(.1,Math.max(0,dt||0))*.6);
 }
 stop(){
  const active=this.engine.active;
  this.engine.stop();
  if(active)this.game.audio?.setVehicleSound?.(false);
 }
}
