const clamp=(n,min,max)=>Math.max(min,Math.min(max,n));
export function vehicleSoundSettings(audio={}) {
  const number=(key,fallback,min,max)=>clamp(Number.isFinite(Number(audio[key]))?Number(audio[key]):fallback,min,max);
  return {
    backfireEnabled:audio.backfireEnabled!==false,
    backfireVolume:number('backfireVolume',.35,0,1),
    backfireToneHz:number('backfireToneHz',180,60,900),
    backfireDuration:number('backfireDuration',.12,.04,.4),
    turboEnabled:audio.turboEnabled??/wrx|turbo/.test(audio.engineProfile||''),
    turboVolume:number('turboVolume',.25,0,1),
    turboToneHz:number('turboToneHz',2200,800,6000),
    turboReleaseVolume:number('turboReleaseVolume',.3,0,1)
  };
}

// Independent of the engine loop so custom engine samples keep these effects.
export class VehicleSound {
  constructor(ctx,output){this.ctx=ctx;this.output=output;this.nodes=[];this.lastThrottle=0;this.boost=0;this.lastTime=ctx.currentTime;this.lastPop=-10;}
  burst(frequency,duration,volume,tonal=true){
    if(volume<=0)return;
    const ctx=this.ctx,now=ctx.currentTime;
    const source=ctx.createBufferSource(),filter=ctx.createBiquadFilter(),gain=ctx.createGain();
    const buffer=ctx.createBuffer(1,Math.ceil(ctx.sampleRate*duration),ctx.sampleRate),data=buffer.getChannelData(0);
    for(let i=0;i<data.length;i++){
      const t=i/ctx.sampleRate;
      data[i]=(Math.random()*2-1)*.6+(tonal?Math.sin(2*Math.PI*frequency*t*Math.exp(-t*2))*.4:0);
    }
    source.buffer=buffer;filter.type='lowpass';filter.frequency.value=tonal?frequency*5:frequency;
    gain.gain.setValueAtTime(.0001,now);gain.gain.linearRampToValueAtTime(volume*.22,now+.003);gain.gain.exponentialRampToValueAtTime(.0001,now+duration);
    source.connect(filter);filter.connect(gain);gain.connect(this.output);
    const nodes=[source,filter,gain];this.nodes.push(nodes);
    source.onended=()=>{nodes.forEach(n=>n.disconnect());this.nodes=this.nodes.filter(n=>n!==nodes);};
    source.start();source.stop(now+duration);
  }
  update({rpm=900,redlineRpm=6200,throttle=0,settings={}}={}){
    const s=vehicleSoundSettings(settings),now=this.ctx.currentTime,dt=clamp(now-this.lastTime,0,.1);
    const ratio=clamp(rpm/Math.max(1,redlineRpm),0,1.1),lift=this.lastThrottle>.55&&throttle<.2;
    if(s.backfireEnabled&&ratio>.45&&lift&&now-this.lastPop>.3){this.burst(s.backfireToneHz,s.backfireDuration,s.backfireVolume);this.lastPop=now;}
    if(s.turboEnabled){
      if(!this.whistle){
        this.whistle=this.ctx.createOscillator();this.whistle.type='sine';this.whistleGain=this.ctx.createGain();this.whistleGain.gain.value=0;
        this.whistle.connect(this.whistleGain);this.whistleGain.connect(this.output);this.whistle.start();
      }
      if(lift&&this.boost>.15)this.burst(s.turboToneHz,.22,s.turboReleaseVolume*this.boost,false);
      const target=clamp((ratio-.25)*1.6,0,1)*clamp(throttle,0,1);
      this.boost+=(target-this.boost)*(1-Math.exp(-dt/(target > this.boost ? .3 : .12)));
      this.whistle.frequency.setTargetAtTime(s.turboToneHz*(.6+this.boost*.6),now,.08);
      this.whistleGain.gain.setTargetAtTime(this.boost*s.turboVolume*.045,now,.06);
    }else if(this.whistle){this.whistle.stop();this.whistle.disconnect();this.whistleGain.disconnect();this.whistle=null;this.boost=0;}
    this.lastThrottle=throttle;this.lastTime=now;
  }
  stop(){
    if(this.whistle){this.whistle.stop();this.whistle.disconnect();this.whistleGain.disconnect();this.whistle=null;}
    for(const [source,...rest] of this.nodes){source.onended=null;source.stop();source.disconnect();rest.forEach(n=>n.disconnect());}
    this.nodes=[];
  }
}
