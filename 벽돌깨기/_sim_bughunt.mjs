// 하미 브레이커 버그 헌터 (headless).
// 실제 js/config.js + js/game.js 를 그대로 vm 컨텍스트에서 실행한다.
// (DOM/사운드/렌더만 no-op 스텁) → 옮겨적다 생기는 가짜 버그 없이 진짜 로직을 돌린다.
import vm from 'node:vm';
import fs from 'node:fs';
import path from 'node:path';

const here = process.cwd();
const config = fs.readFileSync(path.join(here,'js','config.js'),'utf8');
const gamejs = fs.readFileSync(path.join(here,'js','game.js'),'utf8');

// ---- game.js / config.js 가 기대하는 외부 심볼을 no-op 으로 ----
const prelude = `
const SND = new Proxy({}, { get: () => () => {}, set: () => true });
function showOverlay(){} function hideOverlay(){} function render(){}
const __el = () => ({ addEventListener(){}, removeEventListener(){},
  getContext(){ return new Proxy({}, {get:()=>()=>{}}); },
  getBoundingClientRect(){ return {width:540,height:750,left:0,top:0}; },
  classList:{add(){},remove(){}}, style:{}, textContent:'', innerHTML:'', width:0, height:0 });
const document = { getElementById: __el, createElement: __el };
class Image { set src(v){} set onload(f){} }
const localStorage = { _d:{}, getItem(k){return this._d[k]??null;}, setItem(k,v){this._d[k]=''+v;} };
const window = { devicePixelRatio:1, addEventListener(){}, removeEventListener(){},
  AudioContext:function(){}, webkitAudioContext:function(){} };
class ResizeObserver { observe(){} }
function requestAnimationFrame(){ return 0; }
`;

// ---- 시뮬 본체 (실제 로직 스코프 안에서 동작 → CFG/circleBrick/startRun/update/game 등 직접 접근) ----
const postlude = `
;(function(){
  // === AI 조준: 후보각 중 단일 공이 벽돌을 가장 많이 긁는 각 (강철 약점은 단순 반사로 근사) ===
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
    for(let a=-78;a<=78;a+=3){
      const rad=(-90+a)*Math.PI/180; const dir={x:Math.cos(rad),y:Math.sin(rad)};
      if(dir.y>-0.12) continue;
      const s=evalAngle(g,dir);
      if(s>bestScore){ bestScore=s; best=dir; }
    }
    return best||{x:0,y:-1};
  }

  const D = { games:0, turns:0, ticks:0, issues:{}, samples:{} };
  function flag(key, info){
    D.issues[key]=(D.issues[key]||0)+1;
    if(!D.samples[key]) D.samples[key]=info;   // 첫 발생 예시 보관
  }
  const bad = v => !Number.isFinite(v);

  function checkTick(g){
    for(const b of g.balls){
      if(bad(b.x)||bad(b.y)||bad(b.vx)||bad(b.vy)) flag('ball_NaN',{stage:g.stage,b:{x:b.x,y:b.y,vx:b.vx,vy:b.vy}});
      // 워프 아닐 때 공이 좌우/위 경계 한참 밖
      if(!g.warp){
        if(b.x < -5 || b.x > CFG.W+5) flag('ball_out_x',{stage:g.stage,x:b.x,warp:g.warp});
      }
      if(b.y < HEADER_H-5) flag('ball_above_header',{stage:g.stage,y:b.y});
      if(b.y > CFG.LAUNCH_Y+40) flag('ball_below_launch',{stage:g.stage,y:b.y});
      const sp=Math.hypot(b.vx,b.vy);
      if(sp>CFG.BALL_SPEED*5) flag('ball_overspeed',{stage:g.stage,sp:Math.round(sp)});
    }
    for(const b of g.bricks){
      if(b.dead) continue;
      const left=colX(b.col)+(b.mx||0), right=left+COLW;
      if(left < -2 || right > CFG.W+2) flag('brick_out_x',{stage:g.stage,type:b.type,col:b.col,mx:b.mx});
      if(bad(b.mx===undefined?0:b.mx)) flag('brick_mx_NaN',{stage:g.stage});
      if(b.type==='steel' && (!b.weakSides || b.weakSides.length===0)) flag('steel_no_weak',{stage:g.stage,col:b.col});
    }
  }
  function checkTurn(g){
    for(const b of g.bricks){
      if(!b.dead && b.hp<=0) flag('dead_brick_alive',{stage:g.stage,hp:b.hp});
      if(b.row<0) flag('brick_row_neg',{stage:g.stage,row:b.row});
    }
    if(g.ballCount<=0) flag('ballcount_zero',{stage:g.stage,bc:g.ballCount});
    if(g.ballCount>8000) flag('ballcount_explode',{stage:g.stage,bc:g.ballCount});
    if(bad(g.nextMilestone)) flag('milestone_NaN',{stage:g.stage});
    if(bad(g.combo)||g.combo<0) flag('combo_bad',{stage:g.stage,combo:g.combo});
    if(bad(g.launchX)) flag('launchX_NaN',{stage:g.stage});
    // 데드라인 통과인데 게임오버 안 된 채 다음 턴 진행?
    if(g.state!=='over' && g.bricks.some(b=>!b.dead && rowY(b.row)+ROWH>=CFG.DEADLINE))
      flag('deadline_passed_not_over',{stage:g.stage});
  }

  function playGame(maxStage){
    startRun();
    const g = game;
    let guard=0;
    while(g.state!=='over' && g.stage<maxStage && guard<6000){
      guard++; D.turns++;
      const dir = chooseAim(g);
      launch(g, dir);
      let ticks=0;
      const startStage=g.stage;
      // 한 턴 = 다시 aiming(또는 over) 될 때까지. update 가 shooting/gather/룰렛 전부 처리.
      while(g.state!=='aiming' && g.state!=='over' && ticks<5000){
        update(1/60); ticks++; D.ticks++;
        checkTick(g);
      }
      if(ticks>=5000) flag('turn_stuck',{stage:startStage, balls:g.balls.length, state:g.state, fq:g.fireQueue});
      checkTurn(g);
      if(ticks>=5000) break;   // 멈춘 판은 더 못 믿으니 종료
    }
    if(guard>=6000) flag('game_guard_hit',{stage:g.stage});
    D.games++;
    return g.stage;
  }

  const N = ${'${N}'};
  const MAXST = ${'${MAXST}'};
  const stages=[];
  for(let i=0;i<N;i++){ stages.push(playGame(MAXST)); }
  stages.sort((a,b)=>a-b);
  return { D, stageMin:stages[0], stageMax:stages[stages.length-1],
           stageMed:stages[Math.floor(stages.length/2)],
           stageMean:+(stages.reduce((a,b)=>a+b,0)/stages.length).toFixed(1) };
})()
`;

const N = parseInt(process.argv[2]||'200');
const MAXST = parseInt(process.argv[3]||'150');
const src = prelude + '\n' + config + '\n' + gamejs + '\n'
          + postlude.replace('${N}', N).replace('${MAXST}', MAXST);

const sandbox = { Math, console, Set, Map, Number, Array, JSON, Proxy, Date:{ now:()=>0 } };
vm.createContext(sandbox);
const t0 = process.hrtime.bigint();
const res = vm.runInContext(src, sandbox, { filename:'gamebundle.js' });
const ms = Number(process.hrtime.bigint()-t0)/1e6;

console.log(`\n===== 버그 헌트 (게임 ${N}판, 최대 ${MAXST}스테이지, ${ms.toFixed(0)}ms) =====`);
console.log(`총 턴 ${res.D.turns} · 총 틱 ${res.D.ticks}`);
console.log(`도달 스테이지: 평균 ${res.D.games&&res.stageMean} · 중앙 ${res.stageMed} · 최소 ${res.stageMin} · 최대 ${res.stageMax}`);
const issues = res.D.issues;
const keys = Object.keys(issues);
if(keys.length===0){ console.log('\n✅ 탐지된 이상 없음'); }
else {
  console.log('\n⚠️  탐지된 이상:');
  for(const k of keys.sort((a,b)=>issues[b]-issues[a])){
    console.log(`  ${k}: ${issues[k]}회  | 예시 ${JSON.stringify(res.D.samples[k])}`);
  }
}
