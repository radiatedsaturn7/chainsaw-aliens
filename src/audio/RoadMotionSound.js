const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
// Ground speed, not wheel RPM: burnouts should not sound like highway travel.
export function roadMotionMix({speedMps=0,surface='asphalt',grounded=true,cockpit=false}={}){
 const speed=clamp(Math.abs(Number(speedMps)||0),0,90),roll=clamp((speed-.5)/40,0,1),wind=clamp((speed-5)/55,0,1);
 const loose=/gravel|dirt|mud|sand|grass/.test(surface),snow=/snow|slush/.test(surface),wet=/wet|water/.test(surface);
 const cabin=cockpit?.65:1;
 return {windGain:.045*wind*wind*cabin,windHz:450+speed*12,
  roadGain:grounded?(snow?.012:loose?.035:wet?.028:.018)*Math.sqrt(roll)*cabin:0,
  roadHz:(snow?200:loose?420:wet?1100:650)+speed*(loose?6:12)};
}
export class RoadMotionSound{
 constructor(ctx,output){
  this.ctx=ctx;
  const buffer=ctx.createBuffer(1,Math.ceil(ctx.sampleRate*2),ctx.sampleRate),data=buffer.getChannelData(0);
  for(let i=0;i<data.length;i++)data[i]=Math.random()*2-1;
  this.source=ctx.createBufferSource();this.source.buffer=buffer;this.source.loop=true;
  this.wind=ctx.createBiquadFilter();this.wind.type='lowpass';this.wind.Q.value=.5;
  this.road=ctx.createBiquadFilter();this.road.type='bandpass';this.road.Q.value=.6;
  this.windGain=ctx.createGain();this.roadGain=ctx.createGain();
  this.windGain.gain.value=0;this.roadGain.gain.value=0;
  this.source.connect(this.wind);this.source.connect(this.road);
  this.passing=[];
  if(ctx.createStereoPanner)for(const side of [-1,1]){
   const filter=ctx.createBiquadFilter();filter.type='bandpass';filter.frequency.value=750;filter.Q.value=.45;
   const gain=ctx.createGain(),pan=ctx.createStereoPanner();gain.gain.value=0;pan.pan.value=side*.85;
   this.source.connect(filter);filter.connect(gain);gain.connect(pan);pan.connect(output);
   this.passing.push({filter,gain,pan});
  }
  this.wind.connect(this.windGain);this.road.connect(this.roadGain);
  this.windGain.connect(output);this.roadGain.connect(output);this.source.start();
 }
 update(options){
  const mix=roadMotionMix(options),now=this.ctx.currentTime;
  for(let i=0;i<this.passing.length;i++)this.passing[i].gain.gain.setTargetAtTime(
   clamp(Number(options?.passing?.[i===0?'left':'right'])||0,0,.025)*(options?.cockpit?.65:1),now,.035);
  this.windGain.gain.setTargetAtTime(mix.windGain,now,.15);
  this.roadGain.gain.setTargetAtTime(mix.roadGain,now,.08);
  this.wind.frequency.setTargetAtTime(mix.windHz,now,.15);
  this.road.frequency.setTargetAtTime(mix.roadHz,now,.08);
 }
 stop(){
  this.source.stop();this.source.disconnect();
  for(const p of this.passing){p.filter.disconnect();p.gain.disconnect();p.pan.disconnect();}
  this.wind.disconnect();this.road.disconnect();this.windGain.disconnect();this.roadGain.disconnect();
 }
}
