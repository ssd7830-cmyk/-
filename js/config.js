"use strict";
/* =========================================================================
   하미 브레이커 v2 — 스테이지 / 콤보 / 벌크업 / 궤적예측 / juice
   파일 분리: config → sound → game → render → main 순서로 로드
   ========================================================================= */

// ---- CONFIG : 재미 튜닝은 여기 ----
const CFG = {
  W:540, H:655, COLS:7, GAP:6,
  TOP:115, DEADLINE:605, LAUNCH_Y:605,   // 벽돌 9칸 내려오면 데드라인, 발사대=데드라인 선 위에서 시작
  BALL_R:12, BALL_DRAW:3.2, BALL_SPEED:880,
  FIRE_GAP:0.04, HURRY_AFTER:4.0, MAX_TURN:7, MIN_VY:130,
  SKILL_BONUS:6,      // 한 턴에 이만큼 깰 때마다 보너스 하미 +1 (실력 보상)
  MAX_FIRE_TIME:1.6,  // 공 전체 발사에 걸리는 최대 시간(초)
  WIN_STAGE:100,
  BULK_R:1.55,        // 벌크 시 공 크기 배율
  ROW_FILL:0.7,       // 새 줄 벽돌 생길 확률
  PICKUP_CHANCE:0.55, // 새 줄에 픽업 들어갈 확률
};
const COLW=(CFG.W-CFG.GAP*(CFG.COLS+1))/CFG.COLS;
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
