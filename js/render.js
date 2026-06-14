// ---- 렌더 ----
function roundRect(x,y,w,h,r){ ctx.beginPath(); ctx.moveTo(x+r,y);
  ctx.arcTo(x+w,y,x+w,y+h,r); ctx.arcTo(x+w,y+h,x,y+h,r); ctx.arcTo(x,y+h,x,y,r); ctx.arcTo(x,y,x+w,y,r); ctx.closePath(); }

function render(){
  const g=game;
  ctx.setTransform(RS,0,0,RS,0,0);   // 고해상도 버퍼에 논리좌표로 그림
  ctx.imageSmoothingEnabled=true; ctx.imageSmoothingQuality='high';
  ctx.clearRect(0,0,CFG.W,CFG.H);
  ctx.fillStyle=THEME.bg; ctx.fillRect(0,0,CFG.W,CFG.H);
  ctx.save();
  if(g&&g.shake>0) ctx.translate((Math.random()-0.5)*g.shake,(Math.random()-0.5)*g.shake);

  // 데드라인
  ctx.strokeStyle=THEME.dead; ctx.lineWidth=3; ctx.setLineDash([10,8]);
  ctx.beginPath(); ctx.moveTo(0,CFG.DEADLINE); ctx.lineTo(CFG.W,CFG.DEADLINE); ctx.stroke();
  ctx.setLineDash([]);

  if(g){
    // 벽돌 — 숫자 높을수록 진한 빨강, 낮을수록 연하게
    for(const b of g.bricks){ if(b.dead)continue;
      const r=brickRect(b), sx=b.shake>0?(Math.random()-0.5)*4*b.shake:0, hit=b.hit||0;
      ctx.fillStyle=brickColor(b.hp,g.stage);
      ctx.strokeStyle='rgba(150,40,20,.35)'; ctx.lineWidth=1.5;
      roundRect(r.x+sx,r.y,r.w,r.h,7); ctx.fill(); ctx.stroke();
      // 맞은 순간 흰 플래시
      if(hit>0){ ctx.globalAlpha=hit*0.5; ctx.fillStyle='#fff'; roundRect(r.x+sx,r.y,r.w,r.h,7); ctx.fill(); ctx.globalAlpha=1; }
      // 숫자 — 맞을 때 살짝 커졌다 줄어듦(펀치)
      ctx.fillStyle='#fff'; ctx.textAlign='center'; ctx.textBaseline='middle';
      ctx.font=`bold ${Math.round(r.h*0.46*(1+hit*0.5))}px sans-serif`;
      ctx.fillText(b.hp,r.x+r.w/2+sx,r.y+r.h/2+1);
    }
    // 픽업
    for(const p of g.pickups){ if(p.taken)continue;
      const px=colX(p.col)+COLW/2, py=rowY(p.row)+ROWH/2, amt=p.amount||1;
      ctx.fillStyle=THEME.pickup; ctx.globalAlpha=0.22; ctx.beginPath(); ctx.arc(px,py,20,0,6.2832); ctx.fill(); ctx.globalAlpha=1;
      drawHami(px,py,11);
      ctx.fillStyle=amt>=2?'#1b5e20':'#2e7d32'; ctx.font=`bold ${amt>=2?16:13}px sans-serif`;
      ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.fillText('+'+amt,px,py+24);
    }
    // 파티클 (사각 조각 / 원)
    for(const p of g.particles){ ctx.globalAlpha=Math.max(0,Math.min(1,p.life*2.5)); ctx.fillStyle=p.c;
      if(p.sq){ ctx.save(); ctx.translate(p.x,p.y); ctx.rotate(p.rot);
        ctx.fillRect(-p.s,-p.s,p.s*2,p.s*2); ctx.restore(); }
      else { ctx.beginPath(); ctx.arc(p.x,p.y,p.s,0,6.2832); ctx.fill(); } }
    ctx.globalAlpha=1;
    // 궤적 예측
    if(dragging){ const dir=aimDir(g); if(dir){ const pts=predictPath(g,dir);
      for(let i=0;i<pts.length;i++){ const a=1-i/pts.length; ctx.globalAlpha=0.2+0.6*a;
        ctx.fillStyle='#ff9800'; ctx.beginPath(); ctx.arc(pts[i].x,pts[i].y,4,0,6.2832); ctx.fill(); }
      ctx.globalAlpha=1; const last=pts[pts.length-1];
      ctx.strokeStyle='rgba(229,57,53,.9)'; ctx.lineWidth=3; ctx.beginPath(); ctx.arc(last.x,last.y,11,0,6.2832); ctx.stroke();
    }}
    // 공 트레일(잔상) → 역동적. 공 많으면 끔(폰 렉 방지, 공무리 자체가 화려함)
    const br=g.bulk?CFG.BALL_R*CFG.BULK_R:CFG.BALL_R;
    if(g.balls.length<=60){
      ctx.lineCap='round';
      for(const b of g.balls){ const tr=b.trail; if(!tr||tr.length<2)continue;
        for(let i=1;i<tr.length;i++){ const a=i/tr.length;
          const al=0.025+a*0.12;
          ctx.strokeStyle=g.bulk?`rgba(190,150,225,${al})`:`rgba(150,195,255,${al})`;
          ctx.lineWidth=br*2*a;
          ctx.beginPath(); ctx.moveTo(tr[i-1].x,tr[i-1].y); ctx.lineTo(tr[i].x,tr[i].y); ctx.stroke();
        }
      }
    }
    // 공
    for(const b of g.balls) drawHami(b.x,b.y,br);
    // 바닥에 떨어져 모이는 하미들
    if(g.landed) for(const l of g.landed) drawHami(l.x,l.y,br);
    // 발사대 하미
    if(g.state==='aiming') drawHami(g.launchX,CFG.LAUNCH_Y,13);
    // 팝업
    for(const p of g.popups){ ctx.globalAlpha=Math.max(0,Math.min(1,p.life*1.6));
      ctx.fillStyle=p.color; ctx.font=`900 ${p.size}px sans-serif`; ctx.textAlign='center'; ctx.textBaseline='middle';
      ctx.fillText(p.text,p.x,p.y); }
    ctx.globalAlpha=1;
  }
  ctx.restore();

  // ===== 상단 헤더 (흔들림 영향 X) =====
  if(g){
    // 헤더 배경 + 구분선
    ctx.fillStyle='#fffdf5'; ctx.fillRect(0,0,CFG.W,HEADER_H);
    ctx.strokeStyle='rgba(93,44,0,.25)'; ctx.lineWidth=2;
    ctx.beginPath(); ctx.moveTo(0,HEADER_H); ctx.lineTo(CFG.W,HEADER_H); ctx.stroke();
    // 좌: 스테이지 + 최고
    ctx.fillStyle=THEME.text; ctx.textAlign='left'; ctx.textBaseline='alphabetic';
    ctx.font='bold 30px sans-serif'; ctx.fillText('STAGE '+g.stage,16,46);
    ctx.font='bold 14px sans-serif'; ctx.fillStyle='#a1887f';
    ctx.fillText('최고 '+g.best,18,68);
    // 우: 하미 수 (버튼 아래쪽)
    ctx.textAlign='right'; ctx.font='bold 23px sans-serif'; ctx.fillStyle='#2e7d32';
    ctx.fillText('🌾 '+g.ballCount,CFG.W-16,90);
    // 중앙: 콤보 (리듬게임식 — 때릴 때 퐁, 안 때리면 흐려짐)
    if(g.combo>0){
      const idle=Math.max(0,g.comboHitT-0.5);
      const alpha=Math.max(0.28,1-idle*1.1);
      const scale=1+ (g.comboPunch||0)*0.4;
      const cx=CFG.W/2, cy=46;
      ctx.save(); ctx.translate(cx,cy); ctx.scale(scale,scale);
      ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.globalAlpha=alpha;
      const near=g.nextMilestone-g.combo;
      ctx.fillStyle=near<150?'#d500f9':comboColor(Math.min(20,g.combo/70));
      ctx.font='900 34px sans-serif'; ctx.fillText(g.combo.toLocaleString(),0,0);
      ctx.restore();
      ctx.globalAlpha=Math.max(0.3,alpha); ctx.textAlign='center';
      ctx.fillStyle='#8d6e63'; ctx.font='bold 12px sans-serif'; ctx.fillText('COMBO',cx,68);
      ctx.fillStyle='#ab47bc'; ctx.font='bold 11px sans-serif';
      ctx.fillText('룰렛까지 '+near,cx,84);
      ctx.globalAlpha=1;
    }
  }

  // 룰렛 (화면 정지)
  if(g&&g.roulette) drawRoulette(g);
}

function drawRoulette(g){
  const r=g.roulette, N=EFFECTS.length, seg=6.2832/N;
  const cx=CFG.W/2, cy=CFG.H*0.40, rad=Math.min(CFG.W*0.46,250);  // 크게
  // 배경 어둡게
  ctx.save();
  ctx.fillStyle='rgba(27,20,16,.82)'; ctx.fillRect(0,0,CFG.W,CFG.H);
  ctx.textAlign='center'; ctx.textBaseline='middle';

  // ── 1) 인트로: 콤보 강조 ──
  if(r.phase==='intro'){
    const k=Math.min(1,r.t/0.25), pop=k<1?k:1+Math.sin((r.t-0.25)*9)*0.05;
    ctx.save(); ctx.translate(cx,CFG.H*0.42); ctx.scale(pop,pop);
    ctx.fillStyle='#ffd54f'; ctx.font='900 34px sans-serif'; ctx.fillText('🔥 COMBO 🔥',0,-60);
    ctx.fillStyle='#fff'; ctx.font='900 110px sans-serif';
    ctx.strokeStyle='#ff6f00'; ctx.lineWidth=8;
    ctx.strokeText(r.milestone.toLocaleString(),0,30); ctx.fillText(r.milestone.toLocaleString(),0,30);
    ctx.fillStyle='#ffab40'; ctx.font='900 26px sans-serif'; ctx.fillText('하미 룰렛 시작!',0,110);
    ctx.restore(); ctx.restore(); return;
  }

  // 회전각
  let rot;
  if(r.phase==='spin'){ const p=Math.min(1,r.t/RL.SPIN), ease=1-Math.pow(1-p,4);
    rot=ease*((6*6.2832)+(-1.5708 - r.chosen*seg)); }
  else { rot=(6*6.2832)+(-1.5708 - r.chosen*seg); }  // result: 멈춤

  // ── 휠 ──
  ctx.translate(cx,cy); ctx.rotate(rot);
  const pulse = r.phase==='result' ? 1+Math.sin(r.t*12)*0.04 : 1;
  for(let i=0;i<N;i++){
    const a0=i*seg-seg/2, a1=a0+seg, win=(r.phase==='result'&&i===r.chosen);
    ctx.beginPath(); ctx.moveTo(0,0); ctx.arc(0,0,rad*(win?pulse:1),a0,a1); ctx.closePath();
    ctx.fillStyle=EFFECTS[i].color; ctx.globalAlpha=(r.phase==='result'&&!win)?0.45:1; ctx.fill(); ctx.globalAlpha=1;
    ctx.strokeStyle=win?'#fff':'rgba(255,255,255,.5)'; ctx.lineWidth=win?5:2; ctx.stroke();
    // 이모지 + 라벨 (항상 똑바로)
    ctx.save(); ctx.rotate(i*seg); ctx.translate(rad*0.66,0); ctx.rotate(-i*seg-rot);
    ctx.textAlign='center'; ctx.textBaseline='middle';
    ctx.font='30px sans-serif'; ctx.fillText(EFFECTS[i].emoji,0,-16);
    ctx.fillStyle='#fff'; ctx.font='900 15px sans-serif'; ctx.fillText(EFFECTS[i].label,0,8);
    ctx.font='11px sans-serif'; ctx.globalAlpha=0.9; ctx.fillText(EFFECTS[i].desc,0,24); ctx.globalAlpha=1;
    ctx.restore();
  }
  ctx.rotate(-rot);
  if(hamiReady){ const h=rad*0.42,w=h*HAMI_AR; ctx.drawImage(HAMI_IMG,-w/2,-h/2,w,h); }
  ctx.restore();
  // 포인터(위)
  ctx.fillStyle='#ffeb3b'; ctx.strokeStyle='#5d2c00'; ctx.lineWidth=2;
  ctx.beginPath(); ctx.moveTo(cx-18,cy-rad-8); ctx.lineTo(cx+18,cy-rad-8); ctx.lineTo(cx,cy-rad+20); ctx.closePath();
  ctx.fill(); ctx.stroke();

  // ── 결과 강조 ──
  ctx.textAlign='center'; ctx.textBaseline='middle';
  if(r.phase==='result'){
    const e=EFFECTS[r.chosen], k=Math.min(1,r.t/0.18), pop=k<1?k:1+Math.sin((r.t-0.18)*10)*0.06;
    ctx.save(); ctx.translate(cx,cy+rad+70); ctx.scale(pop,pop);
    ctx.fillStyle=e.color; ctx.font='900 50px sans-serif';
    ctx.strokeStyle='#fff'; ctx.lineWidth=5;
    ctx.strokeText(e.emoji+' '+e.label,0,0); ctx.fillText(e.emoji+' '+e.label,0,0);
    ctx.restore();
    ctx.fillStyle='#ffd54f'; ctx.font='900 20px sans-serif'; ctx.fillText('다음 턴에 적용! ('+e.desc+')',cx,cy+rad+108);
  } else {
    ctx.fillStyle='#ffd54f'; ctx.font='900 24px sans-serif'; ctx.fillText('두근두근...',cx,cy+rad+70);
  }
  ctx.restore();
}
