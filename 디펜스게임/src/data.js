// 하미디펜스 Prototype 0.0.1 - 수치 데이터
// 모든 밸런스 수치는 이 파일에서만 수정한다.
// file:// 더블클릭 실행을 위해 전역(window.HAMI_DATA)으로 노출한다.

const HAMI_DATA = {
  // 전장 기준 (내부 가상 좌표계: 1칸 = 100, 전체 너비 = 900)
  FIELD: {
    rows: 5,
    cols: 9,
    cellSize: 100,
    width: 900,
  },

  // 자원
  ECONOMY: {
    startRice: 75,
    baseProduceAmount: 25,
    baseProduceInterval: 5000, // 5초마다 +25 (기본 자동 생산)
  },

  // 방어 유닛
  defenderTypes: {
    compostBin: {
      name: "퇴비통",
      role: "producer",
      cost: 50,
      hp: 120,
      produceAmount: 25,
      produceInterval: 7000, // 7초마다 쌀알 25
      desc: "생산",
    },
    scarecrowSlinger: {
      name: "새총 허수아비",
      role: "shooter",
      cost: 100,
      hp: 100,
      damage: 20,
      attackInterval: 1400, // 1.4초
      projectileSpeed: 220, // 가상좌표/초
      desc: "공격",
    },
    pumpkinWall: {
      name: "호박 방벽",
      role: "wall",
      cost: 50,
      hp: 400,
      desc: "방어",
    },
  },

  // 적
  enemyTypes: {
    aphid: {
      name: "진딧물",
      hp: 80,
      speed: 22, // 가상좌표/초
      damage: 10,
      attackInterval: 1000,
      reward: 5,
      size: 0.6,
      color: "#7cae5a",
    },
    caterpillar: {
      name: "애벌레",
      hp: 220,
      speed: 11,
      damage: 18,
      attackInterval: 1200,
      reward: 10,
      size: 0.85,
      color: "#caa24a",
    },
  },

  // 웨이브 (간단 버전 - 프롬프트 기준)
  // time: 등장 시각(ms), spawns: [{ type, row }]
  waveSchedule: [
    { time: 20000, spawns: [{ type: "aphid", row: 2 }] },
    { time: 40000, spawns: [{ type: "aphid", row: 1 }, { type: "aphid", row: 3 }] },
    { time: 65000, spawns: [{ type: "caterpillar", row: 2 }] },
    { time: 90000, spawns: [{ type: "aphid", row: 0 }, { type: "aphid", row: 2 }, { type: "aphid", row: 4 }] },
    { time: 120000, spawns: [{ type: "caterpillar", row: 1 }, { type: "aphid", row: 3 }, { type: "aphid", row: 4 }] },
    {
      time: 160000,
      spawns: [
        { type: "aphid", row: 0 },
        { type: "aphid", row: 1 },
        { type: "aphid", row: 3 },
        { type: "aphid", row: 4 },
        { type: "caterpillar", row: 2 },
        { type: "caterpillar", row: 4 },
      ],
    },
  ],

  // 하미 말풍선
  HAMI_LINES: {
    start: "쌀 창고를 지켜야 해요!",
    incoming: "저쪽에서 뭔가 와요!",
    danger: "쌀 창고가 위험해요!",
    win: "해냈어요! 쌀 창고를 지켰어요!",
    lose: "다음엔 더 잘 막을 수 있어요.",
    noRice: "쌀알이 부족해요!",
  },

  // 카드 노출 순서
  cardOrder: ["compostBin", "scarecrowSlinger", "pumpkinWall"],
};

window.HAMI_DATA = HAMI_DATA;
