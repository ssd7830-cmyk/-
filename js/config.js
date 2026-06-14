"use strict";
/* =========================================================================
   하미 브레이커 v2 — 스테이지 / 콤보 / 벌크업 / 궤적예측 / juice
   파일 분리: config → sound → game → render → main 순서로 로드
   ========================================================================= */

// ---- CONFIG : 재미 튜닝은 여기 ----
const CFG = {
  W:540, H:655, COLS:7, GAP:6,
  TOP:115, DEADLINE:605, LAUNCH_Y:605,   // 벽돌 9칸 내려오면 데드라인, 발사대=데드라인 선 위에서 시작
  BALL_R:12, BALL_DRAW:2.5, BALL_SPEED:600,   // 느리게 → 숫자 깎이는 게 보이고 손맛↑ / 하미 작게(안 겹치게)
  FIRE_GAP:0.07, HURRY_AFTER:10, MAX_TURN:7, MIN_VY:130,   // 10초 지나면 점점 빨라짐(회수). 벽통과 빼내기는 제거
  SKILL_BONUS:6,      // 한 턴에 이만큼 깰 때마다 보너스 하미 +1 (실력 보상)
  MAX_FIRE_TIME:2.4,  // 공 많아도 이 시간까진 간격 유지(너무 안 뭉치게)
  WIN_STAGE:100,
  BULK_R:1.55,        // 벌크 시 공 크기 배율
  PIERCE_R:2.0,       // 관통 시 공 크기 배율(크게 = 다 밀어버림)
  ROW_FILL:0.7,       // 새 줄 벽돌 생길 확률
  PICKUP_CHANCE:0.55, // 새 줄에 픽업 들어갈 확률
};
const COLW=(CFG.W-CFG.GAP*(CFG.COLS+1))/CFG.COLS;
const SPAWN_ROW=1;   // 맨 윗줄(row 0)은 항상 비우고, 한 칸 아래에서 새 줄 생성(예고 버퍼)
const ROWH=44;   // 벽돌 높이 (스와이프식 얇은 직사각형)
const HEADER_H=100;  // 상단 헤더 높이(정보 영역)
const colX=c=>CFG.GAP+c*(COLW+CFG.GAP);
const rowY=r=>CFG.TOP+r*(ROWH+CFG.GAP);
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));

// ---- 테마 ----
const THEME = {
  bg:'#fff8e1',
  brick1:'#ffcc80', brick2:'#ffa726', brick3:'#fb8c00', bomb:'#ef5350',
  brickEdge:'#e65100', text:'#5d2c00',
  pickup:'#66bb6a', dead:'#e53935',
};
