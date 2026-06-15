// ---- 렌더 ----
function roundRect(x,y,w,h,r){ ctx.beginPath(); ctx.moveTo(x+r,y);
  ctx.arcTo(x+w,y,x+w,y+h,r); ctx.arcTo(x+w,y+h,x,y+h,r); ctx.arcTo(x,y+h,x,y,r); ctx.arcTo(x,y,x+w,y,r); ctx.closePath(); }

// 강철벽돌 약점 면 표시(뚫린 틈=얇은 형광 + 안쪽 가리키는 삼각형). side 0:상 1:우 2:하 3:좌
function drawWeakSide(side,x,y,w,h){
  const bar=3;
  ctx.save(); ctx.fillStyle=THEME.weak; ctx.shadowColor=THEME.weakGlow; ctx.shadowBlur=7;
  if(side===0) ctx.fillRect(x,y,w,bar);
  else if(side===1) ctx.fillRect(x+w-bar,y,bar,h);
  else if(side===2) ctx.fillRect(x,y+h-bar,w,bar);
  else ctx.fillRect(x,y,bar,h);
  ctx.restore();
  ctx.fillStyle=THEME.weak; const cx=x+w/2, cy=y+h/2, s=5; ctx.beginPath();
  if(side===0){ ctx.moveTo(cx-s,y+bar+3); ctx.lineTo(cx+s,y+bar+3); ctx.lineTo(cx,y+bar+3+s); }
  else if(side===2){ ctx.moveTo(cx-s,y+h-bar-3); ctx.lineTo(cx+s,y+h-bar-3); ctx.lineTo(cx,y+h-bar-3-s); }
  else if(side===1){ ctx.moveTo(x+w-bar-3,cy-s); ctx.lineTo(x+w-bar-3,cy+s); ctx.lineTo(x+w-bar-3-s,cy); }
  else { ctx.moveTo(x+bar+3,cy-s); ctx.lineTo(x+bar+3,cy+s); ctx.lineTo(x+bar+3+s,cy); }
  ctx.closePath(); ctx.fill();
}
// 이동벽돌 ↔ 마크(좌우 끝 작은 삼각형, 숫자 안 가림)
function drawMoveMark(x,y,w,h){
  ctx.fillStyle=THEME.moveEdge; const cy=y+h/2, s=4, m=5;
  ctx.beginPath(); ctx.moveTo(x+m+s,cy-s); ctx.lineTo(x+m+s,cy+s); ctx.lineTo(x+m,cy); ctx.closePath(); ctx.fill();
  ctx.beginPath(); ctx.moveTo(x+w-m-s,cy-s); ctx.lineTo(x+w-m-s,cy+s); ctx.lineTo(x+w-m,cy); ctx.closePath(); ctx.fill();
}
function drawBrick(g,b){
  const r=brickRect(b), sx=b.shake>0?(Math.random()-0.5)*4*b.shake:0, hit=b.hit||0;
  const x=r.x+sx, y=r.y, w=r.w, h=r.h;
  if(b.type==='steel'){
    const weak=new Set(b.weakSides||[2]);
    ctx.fillStyle=brickColor(b.hp,g.stage); ctx.fillRect(x,y,w,h);   // 일반 벽돌색
    ctx.strokeStyle='rgba(150,40,20,.35)'; ctx.lineWidth=1.5; ctx.strokeRect(x,y,w,h);
    // 막힌 면(데미지 X) = 짙은 철판 + 볼트로 막아버림. 테두리 없는(뚫린) 면이 약점
    const aw=8; ctx.fillStyle=THEME.steelEdge;
    if(!weak.has(0)) ctx.fillRect(x,y,w,aw);
    if(!weak.has(1)) ctx.fillRect(x+w-aw,y,aw,h);
    if(!weak.has(2)) ctx.fillRect(x,y+h-aw,w,aw);
    if(!weak.has(3)) ctx.fillRect(x,y,aw,h);
    ctx.fillStyle=THEME.steelRivet;
    const bolt=(bx,by)=>{ ctx.beginPath(); ctx.arc(bx,by,2,0,6.2832); ctx.fill(); };
    if(!weak.has(0)) bolt(x+w*0.5,y+aw*0.5);
    if(!weak.has(1)) bolt(x+w-aw*0.5,y+h*0.5);
    if(!weak.has(2)) bolt(x+w*0.5,y+h-aw*0.5);
    if(!weak.has(3)) bolt(x+aw*0.5,y+h*0.5);
  } else {
    ctx.fillStyle=brickColor(b.hp,g.stage); ctx.fillRect(x,y,w,h);
    if(b.type==='move'){ ctx.strokeStyle=THEME.moveEdge; ctx.lineWidth=3; ctx.strokeRect(x+1.5,y+1.5,w-3,h-3); drawMoveMark(x,y,w,h); }
    else { ctx.strokeStyle='rgba(150,40,20,.35)'; ctx.lineWidth=1.5; ctx.strokeRect(x,y,w,h); }
  }
  if(hit>0){ ctx.globalAlpha=hit*0.5; ctx.fillStyle='#fff'; ctx.fillRect(x,y,w,h); ctx.globalAlpha=1; }
  ctx.fillStyle='#fff'; ctx.textAlign='center'; ctx.textBaseline='middle';
  ctx.font=`bold ${Math.round(h*0.46*(1+hit*0.5))}px sans-serif`;
  ctx.fillText(b.hp,x+w/2,y+h/2+1);
}

// 관통 효과: 역도 하미가 바벨로 다 밀어버림 (크게, 똑바로)
function drawPierceHami(g,b,br){
  if(pierceReady){
    const ar=(PIERCE_IMG.naturalWidth/PIERCE_IMG.naturalHeight)||1;
    const h=br*CFG.BALL_DRAW, w=h*ar;
    ctx.drawImage(PIERCE_IMG,b.x-w/2,b.y-h/2,w,h);
  } else drawHami(b.x,b.y,br);
}

function render(){
  const g=game;
  // 버퍼 전체를 먼저 지우고 배경칠(비율 어긋나도 바닥 잔상 안 생기게)
  ctx.setTransform(1,0,0,1,0,0);
  ctx.clearRect(0,0,cv.width,cv.height);
  ctx.fillStyle=THEME.bg; ctx.fillRect(0,0,cv.width,cv.height);
  ctx.setTransform(RS,0,0,RS,0,0);   // 고해상도 버퍼에 논리좌표로 그림
  ctx.imageSmoothingEnabled=true; ctx.imageSmoothingQuality='high';
  ctx.save();
  if(g&&g.shake>0) ctx.translate((Math.random()-0.5)*g.shake,(Math.random()-0.5)*g.shake);

  // 데드라인 — 평소엔 은은한 실선, 벽돌이 가까워지면 달아오르며 맥동+흔들림
  {
    let danger=0;
    if(g){ let lowest=0; for(const b of g.bricks){ if(b.dead)continue; const yb=rowY(b.row)+ROWH; if(yb>lowest)lowest=yb; }
      const zone=2*(ROWH+CFG.GAP);   // 두 칸 안으로 들어오면 경고 시작
      danger=clamp((lowest-(CFG.DEADLINE-zone))/zone,0,1); }
    const t=performance.now()/1000;
    const pulse=danger>0?(0.5+0.5*Math.sin(t*(7+danger*13))):0;   // 위험할수록 빠르게 맥동
    const dy=CFG.DEADLINE + (danger>0?(Math.random()-0.5)*danger*3.2:0);   // 위험 시 미세 진동
    ctx.save();
    // 위험 존 글로우(아래로 붉게 차오름)
    if(danger>0){
      const grad=ctx.createLinearGradient(0,CFG.DEADLINE,0,CFG.H);
      grad.addColorStop(0,`rgba(229,57,53,${0.16*danger*(0.6+0.4*pulse)})`);
      grad.addColorStop(1,'rgba(229,57,53,0)');
      ctx.fillStyle=grad; ctx.fillRect(0,CFG.DEADLINE,CFG.W,CFG.H-CFG.DEADLINE);
    }
    const a=clamp(0.45 + danger*(0.4+0.4*pulse),0,1);
    ctx.strokeStyle=`rgba(229,57,53,${a})`;
    ctx.lineWidth=2 + danger*3*(0.5+0.5*pulse);
    ctx.shadowColor='#e53935'; ctx.shadowBlur=danger>0?(5+danger*18*pulse):3;
    ctx.beginPath(); ctx.moveTo(0,dy); ctx.lineTo(CFG.W,dy); ctx.stroke();
    ctx.restore();
  }

  if(g){
    // 벽돌 — 일반/강철/이동 타입별
    for(const b of g.bricks){ if(b.dead)continue; drawBrick(g,b); }
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
    // 공 트레일(잔상) → 역동적. 공 많아지면 끄지 말고 꼬리만 짧게(총 그리는 양 일정 = 렉X, 깜빡임X)
    const br=g.bulk?CFG.BALL_R*CFG.BULK_R:(g.pierce?CFG.BALL_R*CFG.PIERCE_R:CFG.BALL_R);
    {
      const nb=g.balls.length||1;
      // 전체 세그먼트 ~3000개로 캡: 공 적으면 긴 꼬리, 많으면 짧은 꼬리
      const maxSeg=nb<=50?60:Math.max(5,Math.floor(3000/nb));
      ctx.lineCap='round';
      for(const b of g.balls){ const tr=b.trail; if(!tr||tr.length<2)continue;
        const start=Math.max(1,tr.length-maxSeg);
        for(let i=start;i<tr.length;i++){ const a=(i-start+1)/(tr.length-start+1);
          const al=0.025+a*0.12;
          ctx.strokeStyle=g.bulk?`rgba(190,150,225,${al})`:`rgba(150,195,255,${al})`;
          ctx.lineWidth=br*2*a;
          ctx.beginPath(); ctx.moveTo(tr[i-1].x,tr[i-1].y); ctx.lineTo(tr[i].x,tr[i].y); ctx.stroke();
        }
      }
    }
    // 공 — 관통이면 칼 든 하미(휘적휘적), 아니면 일반
    for(const b of g.balls){ if(g.pierce) drawPierceHami(g,b,br); else drawHami(b.x,b.y,br); }
    // 바닥에 떨어져 모이는 하미들 — 관통 턴이면 날아갈 때와 같은 역도 하미로
    if(g.landed) for(const l of g.landed){ if(g.pierce) drawPierceHami(g,l,br); else drawHami(l.x,l.y,br); }
    // 발사대 하미 — 다음 턴 효과 반영해 "실제 날아갈 모습/크기"와 똑같이 세워둠
    if(g.state==='aiming'){
      const k=g.pendingEffect&&g.pendingEffect.key;
      if(k==='pierce' && pierceReady){
        const ar=(PIERCE_IMG.naturalWidth/PIERCE_IMG.naturalHeight)||1;
        const h=CFG.BALL_R*CFG.PIERCE_R*CFG.BALL_DRAW, w=h*ar;
        ctx.drawImage(PIERCE_IMG,g.launchX-w/2,CFG.LAUNCH_Y-h/2,w,h);
      } else {
        // 벌크업 대기면 커진 하미, 그 외엔 일반 공과 동일 크기(BALL_R)
        drawHami(g.launchX,CFG.LAUNCH_Y, k==='bulk'?CFG.BALL_R*CFG.BULK_R:CFG.BALL_R);
      }
    }
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

  // 발사 전: 이번에 쓸 룰렛 효과 안내 배너 (친절 설명)
  if(g && g.state==='aiming' && g.pendingEffect){
    const e=g.pendingEffect, cx=CFG.W/2, cy=CFG.LAUNCH_Y-44;
    const txt=e.emoji+' '+e.label+' — '+e.desc;
    ctx.font='bold 18px sans-serif';
    const w=ctx.measureText(txt).width+30;
    ctx.fillStyle=e.color; ctx.globalAlpha=0.95; roundRect(cx-w/2,cy-19,w,38,19); ctx.fill();
    ctx.globalAlpha=1; ctx.strokeStyle='rgba(255,255,255,.9)'; ctx.lineWidth=2; roundRect(cx-w/2,cy-19,w,38,19); ctx.stroke();
    ctx.fillStyle='#fff'; ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.fillText(txt,cx,cy);
  }

  // 연속 격파 칭찬 연출 — 확 떴다가 잠깐 유지 후 페이드아웃("딱!" 하고 사라짐)
  if(g && g.celebrate){
    const c=g.celebrate, p=clamp(c.t/c.dur,0,1);
    let scale, alpha;
    if(p<0.12){ const k=p/0.12; scale=0.4+0.85*k; alpha=k; }          // 확 커지며 등장
    else if(p<0.20){ const k=(p-0.12)/0.08; scale=1.25-0.25*k; alpha=1; }  // 살짝 오버슈트→정착
    else if(p<0.58){ scale=1; alpha=1; }                              // 잠깐 유지
    else { const k=(p-0.58)/0.42; scale=1+0.18*k; alpha=1-k; }        // 살짝 커지며 페이드아웃
    ctx.save();
    ctx.translate(CFG.W/2, CFG.H*0.40);
    ctx.scale(scale,scale);
    ctx.globalAlpha=clamp(alpha,0,1);
    ctx.textAlign='center'; ctx.textBaseline='middle';
    ctx.font=`900 ${c.size}px sans-serif`;
    ctx.lineWidth=7; ctx.strokeStyle='rgba(255,255,255,.95)'; ctx.strokeText(c.text,0,0);
    ctx.fillStyle=c.color; ctx.fillText(c.text,0,0);
    ctx.restore();
    ctx.globalAlpha=1;
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
    if(EFFECTS[i].key==='pierce' && pierceReady){ const s=36, ar=(PIERCE_IMG.naturalWidth/PIERCE_IMG.naturalHeight)||1; ctx.drawImage(PIERCE_IMG,-s*ar/2,-16-s/2,s*ar,s); }
    else { ctx.font='30px sans-serif'; ctx.fillText(EFFECTS[i].emoji,0,-16); }
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
