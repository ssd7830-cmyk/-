// 강철/이동 벽돌(스테이지 20+) 밸런스 시뮬. _sim_balance.mjs 기반 + 특수벽돌 반영.
// 강철: 약점 면(상/하/좌/우 랜덤)에서만 데미지. 이동: 좌우로 흔들리다 막히면 반전.
// AI 조준 2모드: aimSteel=true → 약점 면 노릴 줄 앎(현실 플레이어), false → 모름(최악 하한).

const CFG = {
  W:540, H:750, COLS:7, GAP:6,
  TOP:130, DEADLINE:680, LAUNCH_Y:680,
  BALL_R:12, BALL_DRAW:2.5, BALL_SPEED:600,
  FIRE_GAP:0.07, HURRY_AFTER:10, MAX_TURN:7, MIN_VY:130,
  SKILL_BONUS:6, MAX_FIRE_TIME:2.4, WIN_STAGE:100,
  BULK_R:1.55, ROW_FILL:0.7, PICKUP_CHANCE:0.55,
  SPECIAL_FROM:20, STEEL_CHANCE:0.18, MOVE_CHANCE:0.14, MOVE_SPEED:42,
};
const COLW=(CFG.W-CFG.GAP*(CFG.COLS+1))/CFG.COLS;
const SPAWN_ROW=1;
const ROWH=46, HEADER_H=104;
const colX=c=>CFG.GAP+c*(COLW+CFG.GAP);
const rowY=r=>CFG.TOP+r*(ROWH+CFG.GAP);
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const WEAK_VEC=[[0,-1],[1,0],[0,1],[-1,0]];

let OPTS={roulette:true};

const EFFECTS=[{key:'bulk'},{key:'pierce'},{key:'rand'},{key:'mult'},{key:'power'},{key:'bonus'}];

function newGame(){
  return { state:'menu', stage:1, ballCount:1, score:0,
    balls:[], landed:[], bricks:[], pickups:[],
    launchX:CFG.W/2, fireDir:null, fireQueue:0, fireTimer:0,
    turnTime:0, nextLaunchX:null, turnsUsed:0,
    combo:0, turnContacts:0, cleared:0, nextMilestone:1500,
    bulk:false, pierce:false, dmgMult:1, roulette:null, pendingEffect:null, fireGap:CFG.FIRE_GAP,
    fleeing:false, rouletteCount:0 };
}
// 약점 방향 추출: weakDist=[상,우,하,좌] 가중치. 기본은 균등
function pickWeak(){ const w=OPTS.weakDist||[1,1,1,1]; const sum=w.reduce((a,b)=>a+b,0);
  let r=Math.random()*sum; for(let i=0;i<4;i++){ if((r-=w[i])<0) return i; } return 2; }
function makeBrick(g,c,hp){
  const b={col:c,row:SPAWN_ROW,hp,maxHp:hp,dead:false,type:'normal'};
  if(g.stage>=CFG.SPECIAL_FROM && OPTS.special!==false){
    const sc=OPTS.steelChance!=null?OPTS.steelChance:CFG.STEEL_CHANCE;
    const mc=OPTS.moveChance!=null?OPTS.moveChance:CFG.MOVE_CHANCE;
    if(Math.random()<sc){ b.type='steel'; b.weakSide=pickWeak();
      if(OPTS.steelHpFlat!=null){ b.hp=OPTS.steelHpFlat; }
      else { const sh=OPTS.steelHp||1; b.hp=Math.max(1,Math.round(hp*sh)); }
      b.maxHp=b.hp; }
    else if(Math.random()<mc){ b.type='move'; b.mdir=Math.random()<0.5?-1:1; b.mx=0; }
  }
  return b;
}
function spawnTopRow(g){
  const hp=Math.max(1, OPTS.hpFn ? OPTS.hpFn(g.stage) : Math.round(g.stage*(OPTS.hpScale||1)));
  const fill=Math.min((OPTS.fillBase||0.42)+g.stage*(OPTS.fillSlope||0.006),OPTS.fillCap||0.72);
  let placed=0;
  for(let c=0;c<CFG.COLS;c++){ if(Math.random()<fill){ g.bricks.push(makeBrick(g,c,hp)); placed++; } }
  if(placed===0){ const c=Math.floor(Math.random()*CFG.COLS); g.bricks.push(makeBrick(g,c,hp)); }
  let empties=[];
  for(let c=0;c<CFG.COLS;c++) if(!g.bricks.some(b=>b.row===SPAWN_ROW&&b.col===c)) empties.push(c);
  if(empties.length===0){ const c=Math.floor(Math.random()*CFG.COLS); g.bricks=g.bricks.filter(b=>!(b.row===SPAWN_ROW&&b.col===c)); empties=[c]; }
  const c=empties[Math.floor(Math.random()*empties.length)];
  g.pickups.push({col:c,row:SPAWN_ROW,taken:false,amount:1});
}
function startRun(g){
  g.stage=1; g.ballCount=OPTS.startBalls||1; g.score=1;
  g.balls=[]; g.landed=[]; g.bricks=[]; g.pickups=[];
  g.nextLaunchX=null; g.fireQueue=0; g.turnTime=0;
  g.combo=0; g.turnContacts=0; g.cleared=0; g.nextMilestone=1500;
  g.bulk=false; g.pierce=false; g.dmgMult=1; g.roulette=null; g.pendingEffect=null;
  g.launchX=CFG.W/2;
  spawnTopRow(g); g.state='aiming';
}
function launch(g,dir){
  g.state='shooting'; g.fireTimer=0; g.fireDir=dir; g.turnTime=0; g.nextLaunchX=null; g.turnsUsed++;
  g.turnContacts=0; g.cleared=0; g.bulk=false; g.pierce=false; g.dmgMult=1; g.fleeing=false;
  let mult=1;
  if(g.pendingEffect){ const k=g.pendingEffect.key; g.pendingEffect=null;
    if(k==='bulk')g.bulk=true; else if(k==='pierce')g.pierce=true; else if(k==='power')g.dmgMult=2;
    else if(k==='bonus')g.ballCount+=1; else if(k==='rand')destroyRandomBricks(g,5); else if(k==='mult')mult=2;
  }
  g.fireQueue=Math.min(1200,g.ballCount*mult);
  g.fireGap=Math.max(0.004,Math.min(CFG.FIRE_GAP,CFG.MAX_FIRE_TIME/g.fireQueue));
}
function brickRect(b){ return {x:colX(b.col)+(b.mx||0),y:rowY(b.row),w:COLW,h:ROWH}; }
function circleBrick(x,y,R,b){ const r=brickRect(b); const cx=clamp(x,r.x,r.x+r.w),cy=clamp(y,r.y,r.y+r.h); return (x-cx)*(x-cx)+(y-cy)*(y-cy)<=R*R; }
function steelHitOk(b,ball){ const r=brickRect(b);
  const cx=clamp(ball.x,r.x,r.x+r.w),cy=clamp(ball.y,r.y,r.y+r.h);
  let nx=ball.x-cx,ny=ball.y-cy,nl=Math.hypot(nx,ny); const W=WEAK_VEC[b.weakSide||0];
  if(nl<1e-3){ const sp=Math.hypot(ball.vx,ball.vy)||1; return (-ball.vx/sp*W[0]+-ball.vy/sp*W[1])>0.4; }
  return (nx/nl*W[0]+ny/nl*W[1])>0.5; }
function reflectOff(ball,b,R){ const r=brickRect(b);
  const cx=clamp(ball.x,r.x,r.x+r.w),cy=clamp(ball.y,r.y,r.y+r.h);
  let nx=ball.x-cx,ny=ball.y-cy,d2=nx*nx+ny*ny;
  if(d2<1e-6){ const L=ball.x-r.x,Rr=r.x+r.w-ball.x,T=ball.y-r.y,B=r.y+r.h-ball.y,m=Math.min(L,Rr,T,B);
    if(m===L){ball.x=r.x-R;ball.vx=-Math.abs(ball.vx);} else if(m===Rr){ball.x=r.x+r.w+R;ball.vx=Math.abs(ball.vx);}
    else if(m===T){ball.y=r.y-R;ball.vy=-Math.abs(ball.vy);} else {ball.y=r.y+r.h+R;ball.vy=Math.abs(ball.vy);} }
  else { const d=Math.sqrt(d2); nx/=d; ny/=d; const dot=ball.vx*nx+ball.vy*ny; ball.vx-=2*dot*nx; ball.vy-=2*dot*ny; const push=R-d; ball.x+=nx*push; ball.y+=ny*push; } }
function fireOne(g){ g.balls.push({x:g.launchX,y:CFG.LAUNCH_Y,vx:g.fireDir.x*CFG.BALL_SPEED,vy:g.fireDir.y*CFG.BALL_SPEED,active:true}); }
function damageBrick(g,b,dmg){ b.hp-=dmg; if(b.hp<=0&&!b.dead){ b.dead=true; g.cleared++; } }
function destroyRandomBricks(g,n){ const alive=g.bricks.filter(b=>!b.dead);
  for(let k=alive.length-1;k>0;k--){ const j=Math.floor(Math.random()*(k+1)); const t=alive[k];alive[k]=alive[j];alive[j]=t; }
  for(let k=0;k<Math.min(n,alive.length);k++){ alive[k].dead=true; g.cleared++; } }
function triggerRoulette(g){ if(g.roulette)return; g.nextMilestone+=2000; g.rouletteCount++;
  if(OPTS.roulette){ g.pendingEffect=EFFECTS[Math.floor(Math.random()*EFFECTS.length)]; } }
function moveBricks(g,dt){
  for(const b of g.bricks){ if(b.dead||b.type!=='move')continue;
    if(!b.mdir) b.mdir=1;
    const nx=(b.mx||0)+CFG.MOVE_SPEED*dt*b.mdir;
    const left=colX(b.col)+nx, right=left+COLW;
    let blocked=(left<CFG.GAP||right>CFG.W-CFG.GAP);
    if(!blocked){ for(const o of g.bricks){ if(o===b||o.dead||o.row!==b.row)continue;
      const ox=colX(o.col)+(o.mx||0); if(left<ox+COLW&&right>ox){ blocked=true; break; } } }
    if(blocked) b.mdir*=-1; else b.mx=nx;
  }
}
function stepBall(g,ball,dt){
  const R=g.bulk?CFG.BALL_R*CFG.BULK_R:CFG.BALL_R;
  const dist=Math.hypot(ball.vx,ball.vy)*dt;
  const steps=Math.max(1,Math.ceil(dist/(R*0.8)));
  const h=dt/steps;
  for(let s=0;s<steps&&ball.active;s++){
    ball.x+=ball.vx*h; ball.y+=ball.vy*h;
    if(ball.x<R){ball.x=R;ball.vx=Math.abs(ball.vx);}
    if(ball.x>CFG.W-R){ball.x=CFG.W-R;ball.vx=-Math.abs(ball.vx);}
    if(ball.y<HEADER_H+R){ball.y=HEADER_H+R;ball.vy=Math.abs(ball.vy);}
    if(ball.y>CFG.LAUNCH_Y){ ball.active=false; if(g.nextLaunchX===null)g.nextLaunchX=ball.x; return; }
    if(!g.fleeing){
      let hitList=null;
      for(const b of g.bricks){ if(b.dead)continue; if(circleBrick(ball.x,ball.y,R,b)){ (hitList||(hitList=[])).push(b); } }
      if(hitList){
        g.combo++; g.turnContacts++;
        if(g.combo>=g.nextMilestone) triggerRoulette(g);
        const dmg=(g.bulk?2:1)*(g.dmgMult||1);
        if(g.pierce){ for(const b of hitList) damageBrick(g,b,dmg+1); }   // 관통=강철 약점 무시
        else {
          let nb=hitList[0], nd=Infinity;
          for(const b of hitList){ const r=brickRect(b); const ccx=clamp(ball.x,r.x,r.x+r.w),ccy=clamp(ball.y,r.y,r.y+r.h);
            const d=(ball.x-ccx)*(ball.x-ccx)+(ball.y-ccy)*(ball.y-ccy); if(d<nd){nd=d;nb=b;} }
          reflectOff(ball,nb,R);
          for(const b of hitList){
            if(b.type==='steel' && !steelHitOk(b,ball)) continue;   // 약점 면 아니면 데미지 0
            damageBrick(g,b,dmg);
          }
        }
      }
    }
    for(const p of g.pickups){ if(p.taken)continue; const px=colX(p.col)+COLW/2,py=rowY(p.row)+ROWH/2;
      if(Math.hypot(ball.x-px,ball.y-py)<R+16){ p.taken=true; g.ballCount+=(p.amount||1); } }
    if(!g.bulk && g.turnTime<=CFG.HURRY_AFTER && Math.abs(ball.vy)<CFG.MIN_VY){
      ball.vy=(ball.vy<0?-1:1)*CFG.MIN_VY; const sp=Math.hypot(ball.vx,ball.vy)||CFG.BALL_SPEED;
      const k=Math.sqrt(Math.max(0,sp*sp-ball.vy*ball.vy)); ball.vx=(ball.vx<0?-1:1)*k; }
  }
}
function stepShooting(g,dt){
  g.turnTime+=dt;
  if(g.fireQueue>0){ g.fireTimer-=dt; while(g.fireQueue>0&&g.fireTimer<=0){ fireOne(g); g.fireQueue--; g.fireTimer+=g.fireGap; } }
  if(g.fireQueue===0 && g.turnTime>CFG.HURRY_AFTER){ const boost=1+Math.min(2.2,(g.turnTime-CFG.HURRY_AFTER)*0.7);
    for(const b of g.balls){ if(!b.active)continue; b.vy+=260*dt; const sp=Math.hypot(b.vx,b.vy)||1,t=CFG.BALL_SPEED*boost; b.vx=b.vx/sp*t; b.vy=b.vy/sp*t; } }
  if(g.fireQueue===0 && g.turnTime>CFG.MAX_TURN){ g.fleeing=true; for(const b of g.balls){ if(!b.active)continue; b.vx*=0.4; b.vy=Math.abs(b.vy)+CFG.BALL_SPEED; } }
  for(const b of g.balls) if(b.active) stepBall(g,b,dt);
  moveBricks(g,dt);
  g.balls=g.balls.filter(b=>b.active);
  if(g.fireQueue===0&&g.balls.length===0){ endTurn(g); }
}
function endTurn(g){
  if(g.nextLaunchX!==null) g.launchX=clamp(g.nextLaunchX,COLW*0.3,CFG.W-COLW*0.3);
  g.bricks=g.bricks.filter(b=>!b.dead);
  g.pickups=g.pickups.filter(p=>!p.taken);
  const cleared=g.cleared;
  if(g.turnContacts===0){ g.combo=0; g.nextMilestone=1500; }
  g.bulk=false; g.pierce=false; g.dmgMult=1;
  for(const b of g.bricks) b.row++;
  for(const p of g.pickups) p.row++;
  if(g.bricks.some(b=>rowY(b.row)+ROWH>=CFG.DEADLINE)){ g.state='over'; return; }
  g.stage++; g.score=g.stage;
  spawnTopRow(g);
  const bonus=Math.floor(cleared/(OPTS.skill||CFG.SKILL_BONUS));
  if(bonus>0){ g.ballCount+=bonus; }
  g.state='aiming';
}

// ===== AI 조준 =====
// aimSteel=true면 강철 약점 면 hit만 유효타로 세서 약점을 노림(현실 플레이어 근사)
function evalAngle(g,dir){
  let x=g.launchX,y=CFG.LAUNCH_Y,vx=dir.x*CFG.BALL_SPEED,vy=dir.y*CFG.BALL_SPEED;
  const R=CFG.BALL_R, dt=1/120; let hits=0, lowest=0; const touched=new Set();
  for(let i=0;i<2400;i++){
    x+=vx*dt; y+=vy*dt;
    if(x<R){x=R;vx=-vx;} if(x>CFG.W-R){x=CFG.W-R;vx=-vx;}
    if(y<HEADER_H+R){y=HEADER_H+R;vy=-vy;}
    if(y>CFG.LAUNCH_Y) break;
    for(const b of g.bricks){ if(b.dead)continue;
      if(circleBrick(x,y,R,b)){ const id=b.col+','+b.row;
        const effective = !(b.type==='steel') || !OPTS.aimSteel || steelHitOk(b,{x,y,vx,vy});
        if(!touched.has(id) && effective){ touched.add(id); hits++; lowest=Math.max(lowest,b.row); }
        const r=brickRect(b), cx=clamp(x,r.x,r.x+r.w),cy=clamp(y,r.y,r.y+r.h);
        let nx=x-cx,ny=y-cy,d2=nx*nx+ny*ny;
        if(d2<1e-6){ if(Math.abs(vx)>Math.abs(vy))vx=-vx; else vy=-vy; }
        else { const d=Math.sqrt(d2); nx/=d; ny/=d; const dot=vx*nx+vy*ny; vx-=2*dot*nx; vy-=2*dot*ny; x+=nx*(R-d); y+=ny*(R-d); }
        break; } }
  }
  return hits*10 + lowest;
}
function chooseAim(g){
  let best=null,bestScore=-1;
  for(let a=-78;a<=78;a+=2){
    const rad=(-90+a)*Math.PI/180; const dir={x:Math.cos(rad),y:Math.sin(rad)};
    if(dir.y>-0.12) continue;
    const s=evalAngle(g,dir);
    if(s>bestScore){ bestScore=s; best=dir; }
  }
  return best||{x:0,y:-1};
}
function playGame(){
  const g=newGame(); startRun(g);
  let guard=0;
  while(g.state!=='over' && g.stage<300 && guard<8000){
    guard++;
    const dir=chooseAim(g);
    launch(g,dir);
    let t=0;
    while(g.state==='shooting' && t<20){ stepShooting(g,1/60); t+=1/60; }
    if(t>=20){ g.balls=[]; g.fireQueue=0; endTurn(g); }
  }
  return g;
}
function pct(arr,p){ const s=[...arr].sort((a,b)=>a-b); return s[Math.floor((s.length-1)*p)]; }
function run(label,opts,N){
  OPTS=opts;
  const stages=[], rouls=[]; let died20=0, passed20=0;
  for(let i=0;i<N;i++){ const g=playGame(); stages.push(g.stage); rouls.push(g.rouletteCount);
    if(g.stage<20) died20++; else passed20++; }
  const mean=a=>a.reduce((x,y)=>x+y,0)/a.length;
  console.log(`\n===== ${label} (N=${N}) =====`);
  console.log(`스테이지: 평균 ${mean(stages).toFixed(1)} | 중앙값 ${pct(stages,.5)} | p25 ${pct(stages,.25)} p75 ${pct(stages,.75)} p90 ${pct(stages,.9)} | 최소 ${Math.min(...stages)} 최대 ${Math.max(...stages)}`);
  console.log(`20 도달 전 사망: ${died20}/${N} (${(died20/N*100).toFixed(0)}%) | 20 돌파: ${passed20}`);
  // 20 돌파한 판들만: 거기서 얼마나 더 가나(특수벽돌 구간 생존력)
  const after=stages.filter(s=>s>=20);
  if(after.length) console.log(`20 돌파판 최종스테이지: 중앙 ${pct(after,.5)} p25 ${pct(after,.25)} p90 ${pct(after,.9)} 최대 ${Math.max(...after)}`);
}

const N=parseInt(process.argv[2]||'400');
const hp=s=>Math.round(s*(0.85+s*0.004));   // 현행 곡선
console.log('### 현행 HP곡선 0.85+s*0.004 기준, 특수벽돌 영향 비교 ###');
run('A. 특수 없음(기준선)', {roulette:true, hpFn:hp, special:false}, N);
run('B. 균등약점 강철0.18+이동0.14', {roulette:true, hpFn:hp, aimSteel:true}, N);
// 위(0) 약점 제거: 아래 위주 + 좌우 가끔. weakDist=[상,우,하,좌]
run('F. 약점=아래위주[0,1,3,1] 강철0.18', {roulette:true, hpFn:hp, aimSteel:true, weakDist:[0,1,3,1]}, N);
run('G. 약점=아래위주 + 강철HP0.6배', {roulette:true, hpFn:hp, aimSteel:true, weakDist:[0,1,3,1], steelHp:0.6}, N);
run('H. 약점=아래위주 + HP0.6 + 비율0.10/이동0.10', {roulette:true, hpFn:hp, aimSteel:true, weakDist:[0,1,3,1], steelHp:0.6, steelChance:0.10, moveChance:0.10}, N);
run('I. 약점=아래60좌우40 + HP0.5 + 비율0.12', {roulette:true, hpFn:hp, aimSteel:true, weakDist:[0,1,2,1], steelHp:0.5, steelChance:0.12, moveChance:0.12}, N);
console.log('\n### 퍼즐형: 강철HP 고정(약점 찾으면 즉사급) ###');
run('J. 강철HP=1 즉사 + 약점아래위주 + 비율0.14', {roulette:true, hpFn:hp, aimSteel:true, weakDist:[0,1,3,1], steelHpFlat:1, steelChance:0.14, moveChance:0.12}, N);
run('K. 강철HP=2 + 약점아래위주 + 비율0.12', {roulette:true, hpFn:hp, aimSteel:true, weakDist:[0,1,3,1], steelHpFlat:2, steelChance:0.12, moveChance:0.12}, N);
console.log('\n### 양념용: 강철 비율 매우 낮춤 ###');
run('L. 강철0.06+이동0.10 (양념) 균등약점 HP×1', {roulette:true, hpFn:hp, aimSteel:true, steelChance:0.06, moveChance:0.10}, N);
run('M. 이동만0.16 (강철 없음)', {roulette:true, hpFn:hp, aimSteel:true, steelChance:0, moveChance:0.16}, N);
