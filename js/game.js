// ---- DOM ----
const cv=document.getElementById('cv');
const ctx=cv.getContext('2d');
const overlay=document.getElementById('overlay');
const btn=document.getElementById('btn');
const ttl=document.getElementById('ttl');
const sub=document.getElementById('sub');
const scoreLine=document.getElementById('scoreLine');
const logoEl=document.getElementById('logo');
const hintEl=document.getElementById('hint');

// ---- 캔버스 고해상도(레티나) 맞춤 : 표시크기 × 픽셀비율로 버퍼 키워서 선명하게 ----
let RS=1;   // 논리좌표(540×655) → 실제 픽셀 배율
function fitCanvas(){
  const dpr=window.devicePixelRatio||1;
  const rect=cv.getBoundingClientRect();
  if(!rect.width) return;
  // 화면에 실제 박히는 픽셀 밀도. 단, 모니터/창 크기에 휘둘리지 않게 2~3배로 고정
  // → dpr=1인 PC도 2배 슈퍼샘플링으로 선명, 큰 모니터도 3배에서 멈춰 렉 방지
  let q=rect.width*dpr/CFG.W;
  q=Math.max(2,Math.min(q,3));
  const w=Math.round(CFG.W*q), h=Math.round(CFG.H*q);   // 버퍼는 항상 540:750 비율(왜곡 X), CSS가 화면에 맞춰 늘림
  if(cv.width!==w||cv.height!==h){ cv.width=w; cv.height=h; }
  RS=cv.width/CFG.W;
}

// ---- 하미 이미지 ----
const HAMI_IMG=new Image();
let hamiReady=false;
HAMI_IMG.onload=()=>{ hamiReady=true; };
HAMI_IMG.src='hami.png';
const HAMI_AR=266/273;
// 관통용 역도 하미 (바벨로 다 밀어버림)
const PIERCE_IMG=new Image();
let pierceReady=false;
PIERCE_IMG.onload=()=>{ pierceReady=true; };
PIERCE_IMG.src='하미_역도.png';
function drawHami(x,y,r){
  if(hamiReady){ const h=r*CFG.BALL_DRAW, w=h*HAMI_AR; ctx.drawImage(HAMI_IMG,x-w/2,y-h/2,w,h); return; }
  ctx.fillStyle='#fffdf7'; ctx.strokeStyle='#ffcc80'; ctx.lineWidth=Math.max(1,r*0.18);
  ctx.beginPath(); ctx.ellipse(x,y+r*0.1,r*0.92,r,0,0,6.2832); ctx.fill(); ctx.stroke();
}

// ---- 게임 상태 ----
let game=null;
let gameSpeed=1;   // 1× / 1.5× 토글
function newGame(){
  return { state:'menu', stage:1, ballCount:1, score:0,
           best:+(localStorage.getItem('hami_best')||0),
           balls:[], landed:[], bricks:[], pickups:[], particles:[], popups:[],
           launchX:CFG.W/2, aim:null, fireDir:null, fireQueue:0, fireTimer:0,
           turnTime:0, nextLaunchX:null, turnsUsed:0, par:1,
           combo:0, comboPunch:0, comboHitT:9, turnContacts:0, cleared:0, nextMilestone:1500, slowDone:false,
           bulk:false, pierce:false, warp:false, dmgMult:1, roulette:null, pendingEffect:null, fireGap:CFG.FIRE_GAP,
           shake:0, hitstop:0, timeScale:1 };
}

// 강철 약점 면들 (0:상 1:우 2:하 3:좌). 스테이지 오를수록 막힌 면이 늘어 어려워짐
//  ~49: 1면 막힘(약점 3) / 50~69: 2면 막힘(약점 2) / 70+: 3면 막힘(약점 1)
// 약점은 항상 "칠 수 있는 면"(벽에 안 붙은)에 배치, 벽에 붙은 면은 자동으로 막힘
function pickWeakSides(col,stage){
  const blocked = stage>=70?3 : stage>=50?2 : 1;
  const weakN = 4-blocked;                         // 약점 면 개수(1~3)
  const open=[0,2];                                // 상·하는 항상 칠 수 있음
  if(col>0) open.push(3);                          // 맨왼쪽 아니면 좌도 가능
  if(col<CFG.COLS-1) open.push(1);                 // 맨오른쪽 아니면 우도 가능
  for(let i=open.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); const t=open[i];open[i]=open[j];open[j]=t; }
  const weak=open.slice(0,Math.min(weakN,open.length));
  return weak.length?weak:[2];
}
// 벽돌 1개 생성 — 스테이지 20+면 일정 확률로 강철/이동
function makeBrick(g,c,hp){
  const b={col:c,row:SPAWN_ROW,hp,maxHp:hp,type:'normal',shake:0,dead:false};
  // 강철=SPECIAL_FROM(20)부터, 이동=MOVE_FROM(10)부터
  if(g.stage>=CFG.SPECIAL_FROM && Math.random()<CFG.STEEL_CHANCE){ b.type='steel'; b.weakSides=pickWeakSides(c,g.stage); }
  else if(g.stage>=CFG.MOVE_FROM && Math.random()<CFG.MOVE_CHANCE){ b.type='move'; b.mdir=Math.random()<0.5?-1:1; b.mx=0; }
  return b;
}
// 맨 윗줄(row 0) 새로 생성 — 벽돌 숫자(HP) = 현재 스테이지
function spawnTopRow(g){
  const hp=Math.max(1,Math.round(g.stage*(0.85+g.stage*0.004)));   // 고단계로 갈수록 HP 가팔라짐(초반=현행 유지, 50+부터 벽). 시뮬: 중앙값 75→56, 캡300 제거
  const fill=Math.min(0.42+g.stage*0.006,0.72);  // 벽돌 개수 살짝 올림(난이도↑)
  let placed=0;
  for(let c=0;c<CFG.COLS;c++){
    if(Math.random()<fill){
      g.bricks.push(makeBrick(g,c,hp));
      placed++;
    }
  }
  if(placed===0){ const c=Math.floor(Math.random()*CFG.COLS);
    g.bricks.push(makeBrick(g,c,hp)); }
  // 매 줄마다 하미 픽업 1개 — 먹으면 +1 (하미 늘리는 유일한 수단)
  let empties=[];
  for(let c=0;c<CFG.COLS;c++) if(!g.bricks.some(b=>b.row===SPAWN_ROW&&b.col===c)) empties.push(c);
  if(empties.length===0){ const c=Math.floor(Math.random()*CFG.COLS);
    g.bricks=g.bricks.filter(b=>!(b.row===SPAWN_ROW&&b.col===c)); empties=[c]; }
  const c=empties[Math.floor(Math.random()*empties.length)];
  g.pickups.push({col:c,row:SPAWN_ROW,taken:false,amount:1});
}

function startRun(){
  if(!game) game=newGame();
  const g=game;
  g.stage=1; g.ballCount=1; g.score=1; g.prevBest=g.best;
  g.balls=[]; g.landed=[]; g.bricks=[]; g.pickups=[]; g.particles=[]; g.popups=[];
  g.aim=null; g.nextLaunchX=null; g.fireQueue=0; g.turnTime=0;
  g.combo=0; g.comboPunch=0; g.comboHitT=9; g.turnContacts=0; g.cleared=0; g.nextMilestone=1500; g.slowDone=false;
  g.bulk=false; g.pierce=false; g.warp=false; g.dmgMult=1; g.roulette=null; g.pendingEffect=null;
  g.shake=0; g.hitstop=0; g.timeScale=1; g.launchX=CFG.W/2;
  // 스테이지 1: 한 줄로 시작 (하미 픽업 1개 같이)
  spawnTopRow(g);
  g.state='aiming';
  hideOverlay();
}

// ---- 입력 ----
function canvasPos(evt){
  const rect=cv.getBoundingClientRect();
  const src=evt.touches?evt.touches[0]:(evt.changedTouches?evt.changedTouches[0]:evt);
  return { x:(src.clientX-rect.left)/rect.width*CFG.W, y:(src.clientY-rect.top)/rect.height*CFG.H };
}
let dragging=false;
function onDown(e){ if(!game||game.state!=='aiming')return; e.preventDefault();
  SND.init();   // 폰: 첫 터치에서 오디오 깨움
  const p=canvasPos(e); if(p.y<CFG.TOP)return; dragging=true; game.aim=p; }
function onMove(e){ if(!dragging||!game)return; e.preventDefault(); game.aim=canvasPos(e); }
function onUp(e){ if(!dragging||!game)return; e.preventDefault(); dragging=false;
  const dir=aimDir(game); game.aim=null; if(!dir)return; launch(game,dir); }
function aimDir(g){ if(!g.aim)return null;
  let dx=g.aim.x-g.launchX, dy=g.aim.y-CFG.LAUNCH_Y; const len=Math.hypot(dx,dy);
  if(len<8)return null; dx/=len; dy/=len;
  // 너무 수평/아래로 내려도 사라지지 않고 최소 각도에서 멈춤
  if(dy>-0.12){ dy=-0.12; const k=Math.sqrt(Math.max(0,1-dy*dy)); dx=(dx<0?-1:1)*k; }
  return {x:dx,y:dy}; }
function launch(g,dir){ SND.shoot(); g.state='shooting'; g.fireTimer=0;
  g.fireDir=dir; g.turnTime=0; g.nextLaunchX=null; g.turnsUsed++;
  g.turnContacts=0; g.cleared=0; g.bulk=false; g.pierce=false; g.warp=false; g.dmgMult=1;
  g.slowDone=false; g.fleeing=false;   // 콤보(g.combo)는 유지 — 턴 넘어가도 안 지움
  // 룰렛 효과 적용 (이번 턴)
  let mult=1;
  if(g.pendingEffect){ const k=g.pendingEffect.key, e=g.pendingEffect; g.pendingEffect=null;
    if(k==='bulk')g.bulk=true; else if(k==='pierce')g.pierce=true; else if(k==='warp')g.warp=true; else if(k==='mult')mult=2;
    addPopup(g,g.launchX,CFG.LAUNCH_Y-34,e.emoji+' '+e.label+'!',e.color,26);
  }
  g.fireQueue=Math.min(1200,g.ballCount*mult);
  // 공 많으면 발사 간격 줄여서 총 발사시간 ~1.6초로 캡
  g.fireGap=Math.max(0.004, Math.min(CFG.FIRE_GAP, CFG.MAX_FIRE_TIME/g.fireQueue)); }
cv.addEventListener('mousedown',onDown);
cv.addEventListener('mousemove',onMove);
window.addEventListener('mouseup',onUp);
cv.addEventListener('touchstart',onDown,{passive:false});
cv.addEventListener('touchmove',onMove,{passive:false});
window.addEventListener('touchend',onUp,{passive:false});

// ---- 물리 ----
function brickRect(b){ return {x:colX(b.col)+(b.mx||0),y:rowY(b.row),w:COLW,h:ROWH}; }
// 약점 방향벡터 (0:상 1:우 2:하 3:좌)
const WEAK_VEC=[[0,-1],[1,0],[0,1],[-1,0]];
// 강철벽돌: 공이 약점 면(여러 개 중 하나) 쪽에서 닿았는지
function steelHitOk(b,ball){ const r=brickRect(b);
  const cx=clamp(ball.x,r.x,r.x+r.w), cy=clamp(ball.y,r.y,r.y+r.h);
  let nx=ball.x-cx, ny=ball.y-cy, nl=Math.hypot(nx,ny);
  const sides=b.weakSides||[2];
  const sp=Math.hypot(ball.vx,ball.vy)||1;
  for(const s of sides){ const W=WEAK_VEC[s];
    if(nl<1e-3){ if((-ball.vx/sp*W[0] + -ball.vy/sp*W[1]) > 0.4) return true; }   // 깊이 박히면 진입방향
    else if((nx/nl*W[0] + ny/nl*W[1]) > 0.5) return true;
  }
  return false; }
function circleBrick(x,y,R,b){ const r=brickRect(b);
  const cx=clamp(x,r.x,r.x+r.w), cy=clamp(y,r.y,r.y+r.h);
  return (x-cx)*(x-cx)+(y-cy)*(y-cy)<=R*R; }
function reflectOff(ball,b,R){ const r=brickRect(b);
  const cx=clamp(ball.x,r.x,r.x+r.w), cy=clamp(ball.y,r.y,r.y+r.h);
  let nx=ball.x-cx, ny=ball.y-cy, d2=nx*nx+ny*ny;
  if(d2<1e-6){ const L=ball.x-r.x,Rr=r.x+r.w-ball.x,T=ball.y-r.y,B=r.y+r.h-ball.y,m=Math.min(L,Rr,T,B);
    if(m===L){ball.x=r.x-R;ball.vx=-Math.abs(ball.vx);} else if(m===Rr){ball.x=r.x+r.w+R;ball.vx=Math.abs(ball.vx);}
    else if(m===T){ball.y=r.y-R;ball.vy=-Math.abs(ball.vy);} else {ball.y=r.y+r.h+R;ball.vy=Math.abs(ball.vy);} }
  else { const d=Math.sqrt(d2); nx/=d; ny/=d; const dot=ball.vx*nx+ball.vy*ny;
    ball.vx-=2*dot*nx; ball.vy-=2*dot*ny; const push=R-d; ball.x+=nx*push; ball.y+=ny*push; } }

function fireOne(g){ g.balls.push({x:g.launchX,y:CFG.LAUNCH_Y,vx:g.fireDir.x*CFG.BALL_SPEED,vy:g.fireDir.y*CFG.BALL_SPEED,active:true,trail:[],wb:0}); }

function stepBall(g,ball,dt){
  const R=g.bulk?CFG.BALL_R*CFG.BULK_R:(g.pierce?CFG.BALL_R*CFG.PIERCE_R:CFG.BALL_R);
  const dist=Math.hypot(ball.vx,ball.vy)*dt;
  const steps=Math.max(1,Math.ceil(dist/(R*0.8)));
  const h=dt/steps;
  for(let s=0;s<steps&&ball.active;s++){
    ball.x+=ball.vx*h; ball.y+=ball.vy*h;
    // 좌우 벽: 워프=반대편 통과 / 일반=반사 / 관통=벽 1번만 튕기고 2번째 벽 닿으면 회수
    if(g.warp){
      if(ball.x<0) ball.x+=CFG.W; else if(ball.x>CFG.W) ball.x-=CFG.W;
    } else {
      let wall=false;
      if(ball.x<R){ball.x=R;ball.vx=Math.abs(ball.vx);wall=true;}
      else if(ball.x>CFG.W-R){ball.x=CFG.W-R;ball.vx=-Math.abs(ball.vx);wall=true;}
      if(wall && g.pierce && (++ball.wb)>2){ ball.active=false; if(g.nextLaunchX===null)g.nextLaunchX=ball.x;
        g.landed.push({x:clamp(ball.x,R,CFG.W-R),y:CFG.LAUNCH_Y}); return; }
    }
    if(ball.y<HEADER_H+R){ ball.y=HEADER_H+R; ball.vy=Math.abs(ball.vy);   // 윗벽=헤더선
      if(g.pierce && (++ball.wb)>2){ ball.active=false; if(g.nextLaunchX===null)g.nextLaunchX=ball.x;
        g.landed.push({x:clamp(ball.x,R,CFG.W-R),y:CFG.LAUNCH_Y}); return; } }
    if(ball.y>CFG.LAUNCH_Y){ ball.active=false; if(g.nextLaunchX===null)g.nextLaunchX=ball.x;
      g.landed.push({x:clamp(ball.x,R,CFG.W-R),y:CFG.LAUNCH_Y}); return; }   // 떨어진 자리에 깔아둠
    if(!g.fleeing){   // 탈출모드면 벽돌 통과
      let hitList=null;
      for(const b of g.bricks){ if(b.dead)continue;
        if(circleBrick(ball.x,ball.y,R,b)){ (hitList||(hitList=[])).push(b); } }
      if(hitList){
        g.combo++; g.turnContacts++;                 // 콤보 = 부딪힌 횟수(누적)
        g.comboPunch=1; g.comboHitT=0;                // 리듬게임식 펀치
        if(g.combo>=g.nextMilestone) triggerRoulette(g);
        const dmg=(g.bulk?3:1)*(g.dmgMult||1);   // 벌크업 = 데미지 3배
        if(g.pierce){ for(const b of hitList) damageBrick(g,b,dmg+1,ball.x,ball.y); }   // 관통: 안 튕기고 뚫음
        else {
          // 가장 가까운 벽돌 + 충돌점 찾기 (닿은 벽돌은 전부 깎음 → 이음새 명중 시 동시타)
          let nb=hitList[0], nd=Infinity, ncx=ball.x, ncy=ball.y;
          for(const b of hitList){ const r=brickRect(b);
            const ccx=clamp(ball.x,r.x,r.x+r.w),ccy=clamp(ball.y,r.y,r.y+r.h);
            const d=(ball.x-ccx)*(ball.x-ccx)+(ball.y-ccy)*(ball.y-ccy); if(d<nd){nd=d;nb=b;ncx=ccx;ncy=ccy;} }
          // 충돌 법선(벽돌표면→공) 기준 입사각 판정
          let nx=ball.x-ncx, ny=ball.y-ncy; const nl=Math.hypot(nx,ny), sp=Math.hypot(ball.vx,ball.vy)||1;
          // 비스듬히 스침(거의 평행) → 반사 안 하고 방향 유지하며 통과, 데미지만
          if(nl>1e-3 && (ball.vx*nx+ball.vy*ny)/(nl*sp) > -0.35){
            nx/=nl; ny/=nl; const push=R-nl; if(push>0){ ball.x+=nx*push; ball.y+=ny*push; }
          } else {
            reflectOff(ball,nb,R);   // 정면이면 정상 반사
          }
          for(const b of hitList){
            // 강철: 약점 면에서만 데미지, 아니면 "탱!" 스파크만(튕김은 위에서 이미 처리)
            if(b.type==='steel' && !steelHitOk(b,ball)){ b.shake=1; b.hit=0.5; SND.pop(280,0.04,0.14,3); spawnSpark(g,ball.x,ball.y); continue; }
            // 같은 공이 같은 벽돌을 짧은 시간에 중복 타격 방지(이동벽돌이 공을 밀어 데미지 누적되던 버그)
            const id=b.col+'_'+b.row;
            if(!ball.cd) ball.cd={};
            if(ball.cd[id]!=null && g.turnTime-ball.cd[id]<0.12) continue;
            ball.cd[id]=g.turnTime;
            damageBrick(g,b,dmg,ball.x,ball.y);
          }
        }
      }
    }
    for(const p of g.pickups){ if(p.taken)continue;
      const px=colX(p.col)+COLW/2, py=rowY(p.row)+ROWH/2;
      if(Math.hypot(ball.x-px,ball.y-py)<R+16){ p.taken=true; g.ballCount+=(p.amount||1);
        spawnPick(g,px,py); addPopup(g,px,py,'+'+(p.amount||1),p.amount>=2?'#1b5e20':'#2e7d32',p.amount>=2?28:20); }
    }
    // 수평 고착 방지 — 단, 회수(hurry) 중엔 끄고 아래로 흘려보냄
    if(!g.bulk && g.turnTime<=CFG.HURRY_AFTER && Math.abs(ball.vy)<CFG.MIN_VY){
      ball.vy=(ball.vy<0?-1:1)*CFG.MIN_VY;
      const sp=Math.hypot(ball.vx,ball.vy)||CFG.BALL_SPEED;
      const k=Math.sqrt(Math.max(0,sp*sp-ball.vy*ball.vy)); ball.vx=(ball.vx<0?-1:1)*k;
    }
  }
}

function damageBrick(g,b,dmg,hx,hy){
  b.hp-=dmg; b.shake=1; b.hit=1; spawnHit(g,hx,hy);   // b.hit = 맞은 순간 펀치/플래시
  if(b.hp<=0&&!b.dead){
    b.dead=true; g.cleared++;                 // 이번 턴 부순 수(실력보너스용)
    spawnPop(g,colX(b.col)+COLW/2,rowY(b.row)+ROWH/2,false);
    SND.brk(Math.min(20,g.cleared));
    g.shake=Math.min(15,g.shake+2.4);
    if(!g.slowDone && g.bricks.filter(x=>!x.dead).length===1){ g.timeScale=0.35; g.slowDone=true; }
  }
}

// ===== 룰렛 벌크업 (다음 턴 적용) =====
// 전부 "이번 턴만" 효과 (영구 보상 없음 = 눈덩이 방지)
const EFFECTS = [
  { key:'mult',  label:'증식',   desc:'하미 수 2배로 발사!',       emoji:'✨', color:'#ab47bc' },
  { key:'bulk',  label:'벌크업', desc:'하미 거대화 + 데미지 3배!', emoji:'💪', color:'#ff9800' },
  { key:'warp',  label:'워프',   desc:'좌우 벽을 뚫고 반대편으로!', emoji:'🌀', color:'#42a5f5' },
  { key:'pierce',label:'관통',   desc:'벽돌 다 뚫음 (벽 2번 튕김)', emoji:'🗡️', color:'#26a69a' },
];
const RL = { INTRO:1.1, SPIN:3.2, RESULT:1.6 };  // 단계별 시간
function destroyRandomBricks(g,n){
  const alive=g.bricks.filter(b=>!b.dead);
  for(let k=alive.length-1;k>0;k--){ const j=Math.floor(Math.random()*(k+1)); const t=alive[k];alive[k]=alive[j];alive[j]=t; }
  for(let k=0;k<Math.min(n,alive.length);k++){ const b=alive[k]; b.dead=true; g.cleared++;
    spawnPop(g,colX(b.col)+COLW/2,rowY(b.row)+ROWH/2,true); }
  g.shake=16;
}
function triggerRoulette(g){
  if(g.roulette) return;
  const hit=g.nextMilestone; g.nextMilestone+=2000;
  g.roulette={phase:'intro',t:0,chosen:Math.floor(Math.random()*EFFECTS.length),milestone:hit,tickSeg:-1};
  SND.bulk();
}
function updateRoulette(g,dt){
  const r=g.roulette; r.t+=dt;
  if(r.phase==='intro'){ if(r.t>=RL.INTRO){ r.phase='spin'; r.t=0; } }
  else if(r.phase==='spin'){
    // 회전각 (도는 동안 칸 경계 지날 때 똑딱 소리)
    const seg=6.2832/EFFECTS.length, p=Math.min(1,r.t/RL.SPIN), ease=1-Math.pow(1-p,4);
    const finalRot=(6*6.2832)+(-1.5708 - r.chosen*seg);
    const rot=ease*finalRot, curSeg=Math.floor(rot/seg);
    if(p>0.5 && curSeg!==r.tickSeg){ r.tickSeg=curSeg; SND.pop(720,0.03,0.3,4); }
    if(r.t>=RL.SPIN){ r.phase='result'; r.t=0; g.pendingEffect=EFFECTS[r.chosen]; g.shake=18; SND.brk(120); SND.bulk(); }
  }
  else if(r.phase==='result'){ if(r.t>=RL.RESULT) g.roulette=null; }
}

// ---- 파티클 / 팝업 ----
function part(x,y,c,s,sq,lifeK){ const a=Math.random()*6.28, v=70+Math.random()*230;
  return {x,y,vx:Math.cos(a)*v,vy:Math.sin(a)*v-60,life:(0.45+Math.random()*0.3)*(lifeK||1),c,s:s+Math.random()*2,
          sq:!!sq,rot:Math.random()*6.28,vr:(Math.random()-0.5)*14}; }
function spawnHit(g,x,y){ SND.hit(); if(g.particles.length<160) g.particles.push(part(x,y,'#ffb300',2)); }
// 강철 약점 아닌 면 맞을 때: 회색 스파크
function spawnSpark(g,x,y){ if(g.particles.length<200) for(let i=0;i<4;i++) g.particles.push(part(x,y,'#cfd8dc',2,false,0.5)); }
// 이동벽돌: 같은 줄에서 좌우로 흔들림. 벽/다른 벽돌에 막히면 반전, 양쪽 다 막히면 정지
function moveBricks(g,dt){
  const speed=Math.min(CFG.MOVE_SPEED_MAX, CFG.MOVE_SPEED_BASE+g.stage*CFG.MOVE_SPEED_K);   // 스테이지 비례
  for(const b of g.bricks){ if(b.dead||b.type!=='move')continue;
    if(!b.mdir) b.mdir=1;
    const nx=(b.mx||0)+speed*dt*b.mdir;
    const left=colX(b.col)+nx, right=left+COLW;
    let blocked = (left<CFG.GAP || right>CFG.W-CFG.GAP);
    if(!blocked){ for(const o of g.bricks){ if(o===b||o.dead||o.row!==b.row)continue;
      const ox=colX(o.col)+(o.mx||0);
      if(left<ox+COLW && right>ox){ blocked=true; break; } } }
    if(blocked) b.mdir*=-1;   // 반전(이번 프레임 이동 취소 = 갇히면 제자리)
    else b.mx=nx;
  }
}
// 벽돌 깨질 때: 파편 적당히 + 살짝 길게 떨어짐 (너무 많으면 화면 도배되니 절제)
function spawnPop(g,x,y,big){ if(g.particles.length>240) return; const n=big?12:7, cols=['#ff7043','#ff8a65','#ffab40','#f4511e','#e65100'];
  for(let i=0;i<n;i++) g.particles.push(part(x,y,cols[i%cols.length],big?4:3,true,1.5)); }
function spawnPick(g,x,y){ for(let i=0;i<10;i++) g.particles.push(part(x,y,THEME.pickup,3)); }
function addPopup(g,x,y,text,color,size){ g.popups.push({x,y,text,color,size,vy:-70,life:0.9}); }
function comboColor(c){ return c<6?'#ff9800':c<10?'#f4511e':c<16?'#d500f9':'#aa00ff'; }
// 벽돌 색 = 현재 스테이지 기준 3단계 (높음=빨강 / 중간=주황 / 낮음=연노랑)
function brickColor(hp,stage){
  const t=hp/Math.max(1,stage);
  if(t>=0.66) return '#ef5350';   // 빨강
  if(t>=0.33) return '#ffa726';   // 주황
  return '#ffd180';               // 연한 노랑
}

// ---- 턴 종료 / 스테이지 흐름 ----
function endTurn(g){
  if(g.nextLaunchX!==null) g.launchX=clamp(g.nextLaunchX,COLW*0.3,CFG.W-COLW*0.3);
  g.bricks=g.bricks.filter(b=>!b.dead);
  g.pickups=g.pickups.filter(p=>!p.taken);
  // 이번 턴 하나도 못 맞췄으면 콤보 초기화
  if(g.turnContacts===0){ g.combo=0; g.nextMilestone=1500; }
  g.bulk=false; g.pierce=false; g.warp=false; g.dmgMult=1;
  // 한 칸 내림
  for(const b of g.bricks) b.row++;
  for(const p of g.pickups) p.row++;
  // 데드라인 닿으면 게임오버
  if(g.bricks.some(b=>rowY(b.row)+ROWH>=CFG.DEADLINE)){ gameOver(g); return; }
  // 다음 스테이지: 새 윗줄(숫자=스테이지)
  g.stage++; g.score=g.stage;
  if(g.stage>g.best){ g.best=g.stage; localStorage.setItem('hami_best',g.best); }
  spawnTopRow(g);
  // 하미는 픽업 먹어야만 늘어남(실력보너스 폭증 제거 → 50스테이지 70개 같은 과잉 방지)
  g.state='aiming';
}
function emitResult(g){
  console.log('[HAMI_RESULT]',JSON.stringify({stage:g.stage,score:g.score,balls:g.ballCount}));
}
function gameOver(g){
  g.state='over'; SND.over(); emitResult(g);
  const isNew = g.best>(g.prevBest||0);
  showOverlay('게임 오버',
    `<div class="lbl">최종 스테이지</div><span class="big">${g.stage}</span>`+
    `<div class="row">🏆 최고 ${g.best}　·　🌾 하미 ${g.ballCount}</div>`+
    (isNew?`<div class="nb">🎉 신기록 달성!</div>`:''),
    '다시 도전', ()=>{ startRun(); }, '💥');
}

// ---- 궤적 예측 ----
function predictPath(g,dir){
  let x=g.launchX,y=CFG.LAUNCH_Y,vx=dir.x*CFG.BALL_SPEED,vy=dir.y*CFG.BALL_SPEED;
  const R=CFG.BALL_R, dtp=1/120, pts=[{x,y}];
  for(let i=0;i<1000;i++){
    x+=vx*dtp; y+=vy*dtp;
    // 첫 접촉(벽/벽돌)에서 멈춤 — 처음 한 줄(직선)만 표시
    let stop=(x<R||x>CFG.W-R||y<HEADER_H+R);
    if(!stop) for(const b of g.bricks){ if(b.dead)continue; if(circleBrick(x,y,R,b)){stop=true;break;} }
    if(i%4===0) pts.push({x,y});
    if(stop){ pts.push({x,y}); break; }
    if(y>CFG.LAUNCH_Y) break;
  }
  return pts;
}

// ---- 업데이트 ----
function update(dt){
  const g=game; if(!g) return;
  if(g.shake>0) g.shake=Math.max(0,g.shake-dt*55);
  g.comboPunch=Math.max(0,(g.comboPunch||0)-dt*7); g.comboHitT=(g.comboHitT||0)+dt;
  g.timeScale+=(1-g.timeScale)*Math.min(1,dt*3.5);
  if(g.roulette){ updateRoulette(g,dt); }   // 룰렛 중 물리 정지
  else if(g.hitstop>0){ g.hitstop-=dt; }
  else if(g.state==='shooting'){ stepShooting(g,dt*g.timeScale*gameSpeed); }
  else if(g.state==='gather'){ stepGather(g,dt*gameSpeed); }
  // 이동벽돌은 룰렛/게임오버 빼고 항상 끊김없이 움직임(턴 전환 때 멈춰서 순간이동처럼 보이던 문제 해결)
  if(!g.roulette && g.state!=='over'){
    moveBricks(g, g.state==='shooting' ? dt*g.timeScale*gameSpeed : dt);
  }
  for(const p of g.particles){ p.x+=p.vx*dt; p.y+=p.vy*dt; p.vy+=620*dt; p.life-=dt; if(p.sq)p.rot+=p.vr*dt;
    if(p.y>CFG.DEADLINE) p.life=0; }   // 데드라인 아래로는 안 쌓이게 즉시 소멸(바닥 도배 방지)
  g.particles=g.particles.filter(p=>p.life>0);
  if(g.particles.length>200) g.particles.splice(0,g.particles.length-200);   // 총량 상한
  for(const p of g.popups){ p.y+=p.vy*dt; p.vy*=0.92; p.life-=dt; }
  g.popups=g.popups.filter(p=>p.life>0);
  for(const b of g.bricks){ if(b.shake>0) b.shake=Math.max(0,b.shake-dt*6); if(b.hit>0) b.hit=Math.max(0,b.hit-dt*6); }
}
function stepShooting(g,dt){
  g.turnTime+=dt;
  if(g.fireQueue>0){ g.fireTimer-=dt; while(g.fireQueue>0&&g.fireTimer<=0){ fireOne(g); g.fireQueue--; g.fireTimer+=g.fireGap; } }
  // 오래 튕기면: 점점 빨라지고 아래로 당겨서 자연스럽게 회수 (텔레포트 X)
  if(g.fireQueue===0 && g.turnTime>CFG.HURRY_AFTER){
    const boost=1+Math.min(2.2,(g.turnTime-CFG.HURRY_AFTER)*0.7);
    for(const b of g.balls){ if(!b.active)continue;
      b.vy+=260*dt;                                   // 아래로 당김
      const sp=Math.hypot(b.vx,b.vy)||1, t=CFG.BALL_SPEED*boost;
      b.vx=b.vx/sp*t; b.vy=b.vy/sp*t;                 // 속도 부스트
    }
  }
  for(const b of g.balls) if(b.active){ stepBall(g,b,dt);
    if(b.active){ b.trail.push({x:b.x,y:b.y}); if(b.trail.length>60) b.trail.shift(); } }
  g.balls=g.balls.filter(b=>b.active);
  if(g.fireQueue===0&&g.balls.length===0){
    if(g.landed.length>0){ g.state='gather'; g.gatherT=0; }   // 떨어진 하미들 모으기 시작
    else endTurn(g);
  }
}

// 떨어진 하미들이 발사 위치로 스르륵 모이는 모션
function stepGather(g,dt){
  const tx=clamp(g.nextLaunchX!=null?g.nextLaunchX:g.launchX, COLW*0.3, CFG.W-COLW*0.3);
  g.gatherT=(g.gatherT||0)+dt;
  if(g.gatherT<0.18) return;                     // 잠깐 멈췄다가 (착지 여운)
  let home=true;
  for(let i=0;i<g.landed.length;i++){
    const l=g.landed[i];
    const delay=Math.min(i,12)*0.035;            // 살짝 시간차로 줄줄이 빨려옴
    if(g.gatherT-0.18<delay){ home=false; continue; }
    const d=tx-l.x;
    // 이징 + 최소속도 → 부드럽게 출발하되 끝에서 안 기어감
    const step=Math.max(Math.abs(d)*Math.min(1,dt*5), 380*dt);
    l.x += Math.sign(d)*Math.min(Math.abs(d),step);
    if(Math.abs(tx-l.x)>1) home=false;
  }
  if(home){ g.landed.length=0; g.gatherT=0; endTurn(g); }   // 다 모이면 다음 턴
}
