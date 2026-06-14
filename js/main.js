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
let soundOn=true;
function applySound(){ SND.muted=!soundOn; SND.master=soundOn?4.5:0;
  if(SND.bus) SND.bus.gain.value=SND.master; muteBtn.textContent=soundOn?'🔊':'🔇'; }
muteBtn.addEventListener('click',()=>{ SND.init(); soundOn=!soundOn; applySound(); });
// 폰: 첫 상호작용에서 오디오 확실히 깨움
const _unlockAudio=()=>{ SND.init(); applySound(); };
window.addEventListener('pointerdown',_unlockAudio,{once:true});
window.addEventListener('touchend',_unlockAudio,{once:true});

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
// 캔버스 표시크기 바뀔 때만 버퍼 재설정(선명 유지, 매 프레임 reflow 안 함 → 렉 X)
if(window.ResizeObserver){ new ResizeObserver(fitCanvas).observe(cv); }
// 첫 로드 레이아웃 잡힌 뒤 한번 더(초기 흐림 방지)
window.addEventListener('load',fitCanvas);
requestAnimationFrame(loop);
