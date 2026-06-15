"use strict";
/* =========================================================================
   하미 브레이커 v2 — 스테이지 / 콤보 / 벌크업 / 궤적예측 / juice
   파일 분리: config → sound → game → render → main 순서로 로드
   ========================================================================= */

// ---- CONFIG : 재미 튜닝은 여기 ----
const CFG = {
  W:540, H:750, COLS:7, GAP:6,           // 7칸 유지, 벽돌크기 그대로. 세로만 줄여 9칸 죽음
  TOP:130, DEADLINE:680, LAUNCH_Y:680,   // 벽돌 9칸(row1→row10) 내려오면 죽음, 발사대=데드라인 선
  BALL_R:12, BALL_DRAW:2.5, BALL_SPEED:600,   // 느리게 → 숫자 깎이는 게 보이고 손맛↑ / 하미 작게(안 겹치게)
  FIRE_GAP:0.07, HURRY_AFTER:10, MAX_TURN:7, MIN_VY:130,   // 10초 지나면 점점 빨라짐(회수). 벽통과 빼내기는 제거
  SKILL_BONUS:6,      // 한 턴에 이만큼 깰 때마다 보너스 하미 +1 (실력 보상)
  MAX_FIRE_TIME:2.4,  // 공 많아도 이 시간까진 간격 유지(너무 안 뭉치게)
  WIN_STAGE:100,
  BULK_R:1.75,        // 벌크 시 공 크기 배율(증식과 차별화 — 더 큼 + 데미지 3배)
  PIERCE_R:2.0,       // 관통 시 공 크기 배율(크게 = 다 밀어버림)
  ROW_FILL:0.7,       // 새 줄 벽돌 생길 확률
  PICKUP_CHANCE:0.55, // 새 줄에 픽업 들어갈 확률
  // ---- 특수벽돌 (스테이지 20부터 등장) ----
  SPECIAL_FROM:20,    // 이 스테이지부터 강철/이동 벽돌 섞임
  STEEL_CHANCE:0.18,  // 새 줄 벽돌 중 강철이 될 확률
  MOVE_CHANCE:0.14,   // (강철 아닌) 벽돌 중 이동벽돌이 될 확률
  MOVE_SPEED:58,      // 이동벽돌 가로 속도 (px/s)
};
const COLW=(CFG.W-CFG.GAP*(CFG.COLS+1))/CFG.COLS;
const SPAWN_ROW=1;   // 맨 윗줄(row 0)은 항상 비우고, 한 칸 아래에서 새 줄 생성(예고 버퍼)
const ROWH=46;   // 벽돌 높이 (얇고 넓은 직사각형 = 스와이프 느낌. 가로 COLW≈70)
const HEADER_H=104;  // 상단 헤더 높이(정보 영역)
const colX=c=>CFG.GAP+c*(COLW+CFG.GAP);
const rowY=r=>CFG.TOP+r*(ROWH+CFG.GAP);
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));

// ---- 테마 ----
const THEME = {
  bg:'#fff8e1',
  brick1:'#ffcc80', brick2:'#ffa726', brick3:'#fb8c00', bomb:'#ef5350',
  brickEdge:'#e65100', text:'#5d2c00',
  pickup:'#66bb6a', dead:'#e53935',
  steel:'#607d8b', steelEdge:'#37474f', steelRivet:'#cfd8dc',  // 강철벽돌
  weak:'#d4ff32', weakGlow:'#aeea00',                          // 약점 면(형광 라임)
  moveEdge:'#5c6bc0',                                          // 이동벽돌 테두리
};
