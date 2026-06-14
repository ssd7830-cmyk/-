// ---- 사운드 (Web Audio, 합성) ----
const SND = {
  ctx:null, muted:false, master:4.5, bus:null, noise:null, lastHit:0,
  init(){
    if(!this.ctx){ try{ this.ctx=new (window.AudioContext||window.webkitAudioContext)(); }catch(e){} }
    if(this.ctx&&!this.bus){
      const comp=this.ctx.createDynamicsCompressor();
      comp.threshold.value=-10; comp.ratio.value=3; comp.attack.value=0.002; comp.release.value=0.12;
      this.bus=this.ctx.createGain(); this.bus.gain.value=this.master;
      this.bus.connect(comp); comp.connect(this.ctx.destination);
    }
    if(this.ctx&&!this.noise){ const n=Math.floor(this.ctx.sampleRate*0.3);
      const buf=this.ctx.createBuffer(1,n,this.ctx.sampleRate), d=buf.getChannelData(0);
      for(let i=0;i<n;i++) d[i]=Math.random()*2-1; this.noise=buf; }
    if(this.ctx&&this.ctx.state==='suspended') this.ctx.resume();
  },
  // 필터된 노이즈 = 퍼커시브 "톡/퍽"
  pop(freq,dur,vol,q){
    if(this.muted||!this.ctx||!this.noise) return;
    const t=this.ctx.currentTime;
    const s=this.ctx.createBufferSource(); s.buffer=this.noise;
    const bp=this.ctx.createBiquadFilter(); bp.type='bandpass';
    bp.frequency.setValueAtTime(freq,t); bp.frequency.exponentialRampToValueAtTime(Math.max(80,freq*0.45),t+dur);
    bp.Q.value=q||4;
    const g=this.ctx.createGain(); g.gain.setValueAtTime(vol||0.3,t); g.gain.exponentialRampToValueAtTime(0.0001,t+dur);
    s.connect(bp); bp.connect(g); g.connect(this.bus||this.ctx.destination); s.start(t); s.stop(t+dur);
  },
  // 부드러운 톤 (코인/팡파레)
  beep(freq,dur,vol,type){
    if(this.muted||!this.ctx) return;
    const t=this.ctx.currentTime;
    const o=this.ctx.createOscillator(), g=this.ctx.createGain();
    o.type=type||'sine'; o.frequency.value=freq;
    g.gain.setValueAtTime(0,t); g.gain.linearRampToValueAtTime(vol||0.2,t+0.012); g.gain.exponentialRampToValueAtTime(0.0001,t+dur);
    o.connect(g); g.connect(this.bus||this.ctx.destination); o.start(t); o.stop(t+dur);
  },
  hit(){ if(!this.ctx)return; if(this.ctx.currentTime-this.lastHit<0.018)return; this.lastHit=this.ctx.currentTime; this.pop(950,0.05,0.18,2); },
  brk(combo){ this.pop(420+Math.min(900,(combo||1)*55),0.12,0.55,3); },
  pick(){ this.beep(880,0.10,0.30,'sine'); setTimeout(()=>this.beep(1320,0.13,0.26,'sine'),55); },
  shoot(){ this.pop(280,0.06,0.16,1); },
  bulk(){ this.pop(150,0.5,0.6,1.4); this.beep(220,0.45,0.3,'sawtooth'); setTimeout(()=>this.beep(440,0.4,0.26,'square'),130); },
  clear(){ [660,880,1100,1320].forEach((f,i)=>setTimeout(()=>this.beep(f,0.25,0.3,'sine'),i*100)); },
  over(){ this.beep(330,0.45,0.32,'sine'); setTimeout(()=>this.beep(196,0.6,0.32,'sine'),120); },
  win(){ [523,659,784,1047,1319,1568].forEach((f,i)=>setTimeout(()=>this.beep(f,0.28,0.3,'triangle'),i*140)); },
};
