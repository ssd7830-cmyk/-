// ---- 루프 ----
let last=0;
function loop(now){ let dt=(now-last)/1000; last=now; if(!isFinite(dt)||dt>0.05)dt=0.05;
  update(dt); render(); requestAnimationFrame(loop); }

// ---- 오버레이 / 버튼 ----
let overlayAction=startRun;
function showOverlay(title,html,label,action,emoji){
  ttl.innerHTML=title; sub.style.display='none';
  if(emoji) logoEl.textContent=emoji;
  if(hintEl) hintEl.style.display='none';
  scoreLine.style.display='block'; scoreLine.innerHTML=html;
  btn.textContent=label; overlayAction=action; overlay.classList.add('show');
}
function hideOverlay(){ overlay.classList.remove('show'); }
btn.addEventListener('click',()=>{ SND.init(); if(overlayAction) overlayAction(); });

const muteBtn=document.getElementById('mute');
const VOL=[{m:0,icon:'🔇'},{m:1.8,icon:'🔈'},{m:3.2,icon:'🔉'},{m:4.5,icon:'🔊'}];
let volIdx=3;
muteBtn.addEventListener('click',()=>{ SND.init(); volIdx=(volIdx+1)%VOL.length;
  SND.master=VOL[volIdx].m; SND.muted=(SND.master===0);
  if(SND.bus) SND.bus.gain.value=SND.master; muteBtn.textContent=VOL[volIdx].icon; });

// ===== [임시 테스트] 키 1~4 = 해당 룰렛 강제, R = 랜덤 룰렛 (나중에 지울 것) =====
window.addEventListener('keydown',e=>{
  if(!game) return;
  if(e.key>='1'&&e.key<='4'){
    if(!game.roulette){ game.roulette={phase:'intro',t:0,chosen:(+e.key-1),milestone:game.nextMilestone,tickSeg:-1}; SND.init(); SND.bulk(); }
  } else if(e.key==='r'||e.key==='R'){ SND.init(); triggerRoulette(game); }
});

game=newGame();
if(game.best>0 && hintEl) hintEl.innerHTML='🏆 최고 STAGE '+game.best+' · 콤보 쌓으면 🎰 룰렛!';
fitCanvas();
window.addEventListener('resize',fitCanvas);
requestAnimationFrame(loop);
