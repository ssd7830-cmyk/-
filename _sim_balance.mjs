// 하미 브레이커 밸런스 시뮬레이터 (headless). 실제 js/game.js 로직 복사 + 렌더/사운드 제거.
// AI 조준: 후보 각도 중 "단일 공이 벽돌을 가장 많이 긁는" 각도 선택(인간 근사).

// ===== 상수 (config.js와 동일) =====
const CFG = {
  W:540, H:655, COLS:7, GAP:6,
  TOP:115, DEADLINE:605, LAUNCH_Y:605,
  BALL_R:12, BALL_DRAW:3.2, BALL_SPEED:600,
  FIRE_GAP:0.07, HURRY_AFTER:4.0, MAX_TURN:7, MIN_VY:130,
  SKILL_BONUS:6, MAX_FIRE_TIME:2.4, WIN_STAGE:100,
  BULK_R:1.55, ROW_FILL:0.7, PICKUP_CHANCE:0.55,
};
const COLW=(CFG.W-CFG.GAP*(CFG.COLS+1))/CFG.COLS;
const SPAWN_ROW=1;
const ROWH=44, HEADER_H=100;
const colX=c=>CFG.GAP+c*(COLW+CFG.GAP);
const rowY=r=>CFG.TOP+r*(ROWH+CFG.GAP);
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));

let OPTS={roulette:true};

// ===== 핵심 로직 (game.js 복사, 부수효과 제거) =====
const EFFECTS=[
  {key:'bulk'},{key:'pierce'},{key:'rand'},{key:'mult'},{key:'power'},{key:'bonus'},
];
const RL={INTRO:1.1,SPIN:3.2,RESULT:1.6};

function newGame(){
  return { state:'menu', stage:1, ballCount:1, score:0,
    balls:[], landed:[], bricks:[], pickups:[],
    launchX:CFG.W/2, fireDir:null, fireQueue:0, fireTimer:0,
    turnTime:0, nextLaunchX:null, turnsUsed:0,
    combo:0, turnContacts:0, cleared:0, nextMilestone:1500,
    bulk:false, pierce:false, dmgMult:1, roulette:null, pendingEffect:null, fireGap:CFG.FIRE_GAP,
    fleeing:false, rouletteCount:0 };
}
function spawnTopRow(g){
  const hp=Math.max(1, OPTS.hpFn ? OPTS.hpFn(g.stage) : Math.round(g.stage*(OPTS.hpScale||1)));
  const fill=Math.min((OPTS.fillBase||0.42)+g.stage*(OPTS.fillSlope||0.006),OPTS.fillCap||0.72);
  let placed=0;
  for(let c=0;c<CFG.COLS;c++){ if(Math.random()<fill){ g.bricks.push({col:c,row:SPAWN_ROW,hp,maxHp:hp,dead:false}); placed++; } }
  if(placed===0){ const c=Math.floor(Math.random()*CFG.COLS); g.bricks.push({col:c,row:SPAWN_ROW,hp,maxHp:hp,dead:false}); }
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
function brickRect(b){ return {x:colX(b.col),y:rowY(b.row),w:COLW,h:ROWH}; }
function circleBrick(x,y,R,b){ const r=brickRect(b); const cx=clamp(x,r.x,r.x+r.w),cy=clamp(y,r.y,r.y+r.h); return (x-cx)*(x-cx)+(y-cy)*(y-cy)<=R*R; }
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
  // 시뮬: 즉시 결과 확정 (실제론 연출 후 다음 턴 적용)
  if(OPTS.roulette){ g.pendingEffect=EFFECTS[Math.floor(Math.random()*EFFECTS.length)]; }
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
        if(g.pierce){ for(const b of hitList) damageBrick(g,b,dmg+1); }
        else {
          let nb=hitList[0], nd=Infinity;
          for(const b of hitList){ const r=brickRect(b); const ccx=clamp(ball.x,r.x,r.x+r.w),ccy=clamp(ball.y,r.y,r.y+r.h);
            const d=(ball.x-ccx)*(ball.x-ccx)+(ball.y-ccy)*(ball.y-ccy); if(d<nd){nd=d;nb=b;} }
          reflectOff(ball,nb,R);
          for(const b of hitList) damageBrick(g,b,dmg);
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

// ===== AI 조준: 단일 공으로 후보각 평가, 벽돌 가장 많이 긁는 각 =====
function evalAngle(g,dir){
  let x=g.launchX,y=CFG.LAUNCH_Y,vx=dir.x*CFG.BALL_SPEED,vy=dir.y*CFG.BALL_SPEED;
  const R=CFG.BALL_R, dt=1/120; let hits=0, lowest=0; const touched=new Set();
  for(let i=0;i<2400;i++){
    x+=vx*dt; y+=vy*dt;
    if(x<R){x=R;vx=-vx;} if(x>CFG.W-R){x=CFG.W-R;vx=-vx;}
    if(y<HEADER_H+R){y=HEADER_H+R;vy=-vy;}
    if(y>CFG.LAUNCH_Y) break;
    for(const b of g.bricks){ if(b.dead)continue;
      if(circleBrick(x,y,R,b)){ const id=b.col+','+b.row; if(!touched.has(id)){ touched.add(id); hits++; lowest=Math.max(lowest,b.row); }
        // 반사 근사 (인라인)
        const r=brickRect(b), cx=clamp(x,r.x,r.x+r.w),cy=clamp(y,r.y,r.y+r.h);
        let nx=x-cx,ny=y-cy,d2=nx*nx+ny*ny;
        if(d2<1e-6){ if(Math.abs(vx)>Math.abs(vy))vx=-vx; else vy=-vy; }
        else { const d=Math.sqrt(d2); nx/=d; ny/=d; const dot=vx*nx+vy*ny; vx-=2*dot*nx; vy-=2*dot*ny; x+=nx*(R-d); y+=ny*(R-d); }
        break; } }
  }
  return hits*10 + lowest; // 많이 맞히고, 낮은 줄 우선
}
function chooseAim(g){
  let best=null,bestScore=-1;
  for(let a=-78;a<=78;a+=4){
    const rad=(-90+a)*Math.PI/180; const dir={x:Math.cos(rad),y:Math.sin(rad)};
    if(dir.y>-0.12) continue;
    const s=evalAngle(g,dir);
    if(s>bestScore){ bestScore=s; best=dir; }
  }
  return best||{x:0,y:-1};
}

// ===== 한 판 =====
function playGame(){
  const g=newGame(); startRun(g);
  let guard=0;
  while(g.state!=='over' && g.stage<300 && guard<8000){
    guard++;
    const dir=chooseAim(g);
    launch(g,dir);
    let t=0;
    while(g.state==='shooting' && t<20){ stepShooting(g,1/60); t+=1/60; }
    if(t>=20){ // 안전장치: 턴 강제 종료
      g.balls=[]; g.fireQueue=0; endTurn(g);
    }
  }
  return g;
}

// ===== 실행 =====
function pct(arr,p){ const s=[...arr].sort((a,b)=>a-b); return s[Math.floor((s.length-1)*p)]; }
function run(label,opts,N){
  OPTS=opts;
  const stages=[], rouls=[], balls={5:[],10:[],20:[],30:[]};
  for(let i=0;i<N;i++){ const g=playGame(); stages.push(g.stage); rouls.push(g.rouletteCount); }
  // 공 개수 커브는 별도로 추적
  for(let i=0;i<Math.min(N,120);i++){
    const g=newGame(); startRun(g); let guard=0;
    while(g.state!=='over'&&g.stage<60&&guard<3000){ guard++;
      if(balls[g.stage]) balls[g.stage].push(g.ballCount);
      const dir=chooseAim(g); launch(g,dir); let t=0;
      while(g.state==='shooting'&&t<20){ stepShooting(g,1/60); t+=1/60; }
      if(t>=20){ g.balls=[]; g.fireQueue=0; endTurn(g); }
    }
  }
  const mean=a=>a.reduce((x,y)=>x+y,0)/a.length;
  console.log(`\n===== ${label} (N=${N}) =====`);
  console.log(`스테이지 도달: 평균 ${mean(stages).toFixed(1)} | 중앙값 ${pct(stages,.5)} | p25 ${pct(stages,.25)} p75 ${pct(stages,.75)} p90 ${pct(stages,.9)} | 최소 ${Math.min(...stages)} 최대 ${Math.max(...stages)}`);
  console.log(`룰렛 발동/판: 평균 ${mean(rouls).toFixed(2)} | 최대 ${Math.max(...rouls)}`);
  for(const s of [5,10,20,30]){ if(balls[s].length) console.log(`  스테이지 ${s} 도달 시 공 개수: 평균 ${mean(balls[s]).toFixed(1)} (중앙 ${pct(balls[s],.5)})`); }
}

const N=parseInt(process.argv[2]||'400');
const base={roulette:true};   // 신 메커니즘(공느림/윗줄버퍼/동시타) 반영된 상태
run('×0.83', {...base, hpScale:0.83}, N);
run('×0.85', {...base, hpScale:0.85}, N);
run('×0.87', {...base, hpScale:0.87}, N);
