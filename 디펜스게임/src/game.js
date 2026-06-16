// 하미디펜스 Prototype 0.0.1 - 게임 로직
// 좌표계: 가상 너비 900(=9칸*100). 적은 x=900(오른쪽)에서 x<=0(왼쪽 창고)으로 이동.
(function () {
  "use strict";

  const D = window.HAMI_DATA;
  const { FIELD, ECONOMY, defenderTypes, enemyTypes, waveSchedule, HAMI_LINES, cardOrder } = D;

  // 데이터의 speed(가상좌표/초)를 실제 체감 속도로 변환하는 배율.
  // 진딧물 22 -> 약 57/초 -> 화면(900) 횡단 약 16초. 막을 시간을 준다.
  const SPEED_SCALE = 2.6;

  // 유닛/적 임시 아이콘 (CSS 아트 + 이모지 혼합)
  const ICONS = {
    compostBin: "🪣",
    scarecrowSlinger: "🎯",
    pumpkinWall: "🎃",
    aphid: "🐛",
    caterpillar: "🐌",
  };

  // ---------- DOM ----------
  const el = {
    rice: document.getElementById("rice-amount"),
    cardBar: document.getElementById("card-bar"),
    grid: document.getElementById("grid"),
    entities: document.getElementById("entities"),
    bubble: document.getElementById("hami-bubble"),
    waveFill: document.getElementById("wave-fill"),
    waveText: document.getElementById("wave-text"),
    overlay: document.getElementById("overlay"),
    overlayTitle: document.getElementById("overlay-title"),
    overlayMsg: document.getElementById("overlay-msg"),
    restartBtn: document.getElementById("restart-btn"),
    restartTop: document.getElementById("restart-top"),
  };

  // ---------- 상태 ----------
  let state;
  let lastTs = 0;
  let nextId = 1;
  const id = () => nextId++;

  function newState() {
    return {
      rice: ECONOMY.startRice,
      selectedCard: null,
      defenders: [], // {id, type, row, col, hp, maxHp, attackTimer, produceTimer, dom, hpDom}
      enemies: [], // {id, type, row, x, hp, maxHp, attackTimer, dom, hpDom, dying}
      projectiles: [], // {id, row, x, damage, speed, dom}
      grid: {}, // "row,col" -> defender id
      gameTime: 0,
      status: "playing", // playing | win | lose
      waveIndex: 0,
      totalWaves: waveSchedule.length,
      baseProduceTimer: 0,
      bubbleLockUntil: 0,
      incomingShown: false,
    };
  }

  // ---------- 초기화 ----------
  function buildGrid() {
    el.grid.innerHTML = "";
    for (let r = 0; r < FIELD.rows; r++) {
      for (let c = 0; c < FIELD.cols; c++) {
        const cell = document.createElement("div");
        cell.className = "cell";
        cell.dataset.row = r;
        cell.dataset.col = c;
        cell.addEventListener("click", () => onCellClick(r, c, cell));
        el.grid.appendChild(cell);
      }
    }
  }

  function buildCards() {
    el.cardBar.innerHTML = "";
    cardOrder.forEach((key) => {
      const def = defenderTypes[key];
      const card = document.createElement("div");
      card.className = "card";
      card.dataset.key = key;
      card.innerHTML =
        '<div class="card-icon">' + ICONS[key] + "</div>" +
        '<div class="card-name">' + def.name + "</div>" +
        '<div class="card-role">' + def.desc + "</div>" +
        '<div class="card-cost">' + def.cost + "</div>";
      card.addEventListener("click", () => selectCard(key));
      el.cardBar.appendChild(card);
    });
  }

  function selectCard(key) {
    if (state.status !== "playing") return;
    state.selectedCard = state.selectedCard === key ? null : key;
    refreshCards();
    refreshPlaceHints();
  }

  function refreshCards() {
    [...el.cardBar.children].forEach((card) => {
      const key = card.dataset.key;
      const def = defenderTypes[key];
      card.classList.toggle("selected", state.selectedCard === key);
      card.classList.toggle("disabled", state.rice < def.cost);
    });
  }

  function refreshPlaceHints() {
    [...el.grid.children].forEach((cell) => {
      cell.classList.remove("placeable", "blocked");
      if (!state.selectedCard) return;
      const r = +cell.dataset.row;
      const c = +cell.dataset.col;
      if (state.grid[r + "," + c] != null) cell.classList.add("blocked");
      else cell.classList.add("placeable");
    });
  }

  // ---------- 배치 ----------
  function onCellClick(r, c) {
    if (state.status !== "playing") return;
    const key = state.selectedCard;
    if (!key) return;
    const def = defenderTypes[key];

    if (state.grid[r + "," + c] != null) {
      say("이미 유닛이 있어요!", true, 1200);
      return;
    }
    if (state.rice < def.cost) {
      say(HAMI_LINES.noRice, true, 1200);
      return;
    }

    state.rice -= def.cost;
    placeDefender(key, r, c);
    state.selectedCard = null;
    refreshCards();
    refreshPlaceHints();
    updateRice();
  }

  function placeDefender(key, r, c) {
    const def = defenderTypes[key];
    const dom = document.createElement("div");
    dom.className = "unit unit-" + def.role;
    dom.innerHTML =
      '<span class="unit-icon">' + ICONS[key] + "</span>" +
      '<div class="hpbar"><i></i></div>';
    el.entities.appendChild(dom);

    const unit = {
      id: id(),
      type: key,
      row: r,
      col: c,
      hp: def.hp,
      maxHp: def.hp,
      attackTimer: 0,
      produceTimer: 0,
      dom: dom,
      hpDom: dom.querySelector(".hpbar > i"),
    };
    placeAt(dom, colCenterX(c), rowCenterY(r));
    state.defenders.push(unit);
    state.grid[r + "," + c] = unit.id;
  }

  // ---------- 좌표 변환 ----------
  // 가상 x(0~900) -> 필드 내 % 위치
  function colCenterX(c) {
    return c * FIELD.cellSize + FIELD.cellSize / 2;
  }
  function rowCenterY(r) {
    return (r + 0.5) / FIELD.rows;
  }
  function placeAt(dom, vx, yFrac) {
    dom.style.left = (vx / FIELD.width) * 100 + "%";
    dom.style.top = yFrac * 100 + "%";
  }

  // ---------- 적 스폰 ----------
  function spawnEnemy(typeKey, row) {
    const t = enemyTypes[typeKey];
    const dom = document.createElement("div");
    dom.className = "enemy enemy-" + typeKey;
    dom.style.fontSize = 22 + t.size * 16 + "px";
    dom.innerHTML =
      '<div class="hpbar"><i></i></div>' +
      '<span class="enemy-icon">' + ICONS[typeKey] + "</span>";
    el.entities.appendChild(dom);

    const enemy = {
      id: id(),
      type: typeKey,
      row: row,
      x: FIELD.width + 20, // 오른쪽 진입로에서 시작
      hp: t.hp,
      maxHp: t.hp,
      speed: t.speed,
      attackTimer: 0,
      dom: dom,
      hpDom: dom.querySelector(".hpbar > i"),
      dying: false,
    };
    placeAt(dom, enemy.x, rowCenterY(row));
    state.enemies.push(enemy);
  }

  function checkWaves() {
    while (state.waveIndex < waveSchedule.length &&
           state.gameTime >= waveSchedule[state.waveIndex].time) {
      const wave = waveSchedule[state.waveIndex];
      wave.spawns.forEach((s) => spawnEnemy(s.type, s.row));
      state.waveIndex++;
    }
  }

  // ---------- 전투 ----------
  function frontEnemyInRow(row, minX) {
    // 같은 라인에서 minX(허수아비 위치)보다 오른쪽에 있는 적 중 가장 앞선(=가장 왼쪽, x 최소) 적
    let target = null;
    for (const e of state.enemies) {
      if (e.dying || e.row !== row) continue;
      if (e.x <= minX) continue;
      if (!target || e.x < target.x) target = e;
    }
    return target;
  }

  function defenderAt(row, col) {
    const dId = state.grid[row + "," + col];
    if (dId == null) return null;
    return state.defenders.find((d) => d.id === dId) || null;
  }

  function spawnProjectile(fromDef) {
    const def = defenderTypes[fromDef.type];
    const dom = document.createElement("div");
    dom.className = "projectile";
    el.entities.appendChild(dom);
    const p = {
      id: id(),
      row: fromDef.row,
      x: colCenterX(fromDef.col) + 20,
      damage: def.damage,
      speed: def.projectileSpeed,
      dom: dom,
    };
    placeAt(dom, p.x, rowCenterY(p.row));
    state.projectiles.push(p);
  }

  function damageEnemy(enemy, dmg) {
    if (enemy.dying) return;
    enemy.hp -= dmg;
    enemy.dom.classList.remove("hit");
    void enemy.dom.offsetWidth; // 리플로우로 애니메이션 재시작
    enemy.dom.classList.add("hit");
    if (enemy.hpDom) enemy.hpDom.style.width = Math.max(0, enemy.hp / enemy.maxHp) * 100 + "%";
    if (enemy.hp <= 0) killEnemy(enemy);
  }

  function killEnemy(enemy) {
    enemy.dying = true;
    state.rice += enemyTypes[enemy.type].reward;
    spawnParticles(enemy.x, rowCenterY(enemy.row));
    enemy.dom.classList.add("dying");
    setTimeout(() => {
      if (enemy.dom.parentNode) enemy.dom.parentNode.removeChild(enemy.dom);
    }, 350);
  }

  function damageDefender(unit, dmg) {
    unit.hp -= dmg;
    unit.dom.classList.remove("hurt");
    void unit.dom.offsetWidth;
    unit.dom.classList.add("hurt");
    if (unit.hpDom) unit.hpDom.style.width = Math.max(0, unit.hp / unit.maxHp) * 100 + "%";
    if (unit.hp <= 0) removeDefender(unit);
  }

  function removeDefender(unit) {
    delete state.grid[unit.row + "," + unit.col];
    if (unit.dom.parentNode) unit.dom.parentNode.removeChild(unit.dom);
    state.defenders = state.defenders.filter((d) => d.id !== unit.id);
  }

  function spawnParticles(vx, yFrac) {
    for (let i = 0; i < 6; i++) {
      const p = document.createElement("div");
      p.className = "particle";
      const dx = (Math.random() * 30 - 15) + "px";
      const dy = (-10 - Math.random() * 18) + "px";
      p.style.setProperty("--dx", dx);
      p.style.setProperty("--dy", dy);
      placeAt(p, vx, yFrac);
      el.entities.appendChild(p);
      setTimeout(() => p.parentNode && p.parentNode.removeChild(p), 500);
    }
  }

  // ---------- 업데이트 루프 ----------
  function update(dt) {
    state.gameTime += dt;

    // 1. 기본 자원 자동 생산
    state.baseProduceTimer += dt;
    if (state.baseProduceTimer >= ECONOMY.baseProduceInterval) {
      state.baseProduceTimer -= ECONOMY.baseProduceInterval;
      state.rice += ECONOMY.baseProduceAmount;
    }

    // 2. 웨이브 스폰
    checkWaves();

    // 3. 방어 유닛 AI
    for (const u of state.defenders) {
      const def = defenderTypes[u.type];
      if (def.role === "producer") {
        u.produceTimer += dt;
        if (u.produceTimer >= def.produceInterval) {
          u.produceTimer -= def.produceInterval;
          state.rice += def.produceAmount;
        }
      } else if (def.role === "shooter") {
        const target = frontEnemyInRow(u.row, colCenterX(u.col));
        if (target) {
          u.attackTimer += dt;
          if (u.attackTimer >= def.attackInterval) {
            u.attackTimer = 0;
            spawnProjectile(u);
          }
        } else {
          u.attackTimer = def.attackInterval; // 적 오면 바로 발사 준비
        }
      }
    }

    // 4. 투사체 이동 + 충돌
    for (const p of state.projectiles) {
      p.x += p.speed * (dt / 1000) * SPEED_SCALE;
      let hit = null;
      for (const e of state.enemies) {
        if (e.dying || e.row !== p.row) continue;
        if (Math.abs(e.x - p.x) < 28) { hit = e; break; }
      }
      if (hit) {
        damageEnemy(hit, p.damage);
        p.dead = true;
      } else if (p.x > FIELD.width + 30) {
        p.dead = true;
      } else {
        placeAt(p.dom, p.x, rowCenterY(p.row));
      }
    }
    state.projectiles = state.projectiles.filter((p) => {
      if (p.dead && p.dom.parentNode) p.dom.parentNode.removeChild(p.dom);
      return !p.dead;
    });

    // 5. 적 이동 + 방벽 접촉 전투
    for (const e of state.enemies) {
      if (e.dying) continue;
      const t = enemyTypes[e.type];
      // 현재 적이 들어선 칸
      const col = Math.floor(e.x / FIELD.cellSize);
      const blocker = col >= 0 && col < FIELD.cols ? defenderAt(e.row, col) : null;

      if (blocker) {
        // 멈추고 공격
        e.attackTimer += dt;
        if (e.attackTimer >= t.attackInterval) {
          e.attackTimer = 0;
          damageDefender(blocker, t.damage);
        }
      } else {
        e.x -= t.speed * (dt / 1000) * SPEED_SCALE;
        placeAt(e.dom, e.x, rowCenterY(e.row));
        // 왼쪽 창고 도달 -> 패배
        if (e.x <= 0) {
          endGame(false);
          return;
        }
      }
    }
    // 죽은 적 정리
    state.enemies = state.enemies.filter((e) => !(e.dying && !e.dom.parentNode));

    // 6. 하미 말풍선 상태
    updateBubble();

    // 7. 승리 체크: 모든 웨이브 끝 + 살아있는 적 없음
    const aliveEnemies = state.enemies.some((e) => !e.dying);
    if (state.waveIndex >= waveSchedule.length && !aliveEnemies && state.gameTime > 5000) {
      endGame(true);
      return;
    }

    // 8. HUD
    updateRice();
    updateWaveBar();
  }

  // ---------- HUD/말풍선 ----------
  function updateRice() {
    el.rice.textContent = state.rice;
    refreshCards();
  }

  function updateWaveBar() {
    const done = state.waveIndex;
    const total = state.totalWaves;
    el.waveText.textContent = done + " / " + total;
    el.waveFill.style.width = (done / total) * 100 + "%";
  }

  function say(text, warn, holdMs) {
    state.bubbleLockUntil = state.gameTime + (holdMs || 1800);
    el.bubble.textContent = text;
    el.bubble.classList.toggle("warn", !!warn);
  }

  function updateBubble() {
    if (state.gameTime < state.bubbleLockUntil) return;

    // 위험: 적이 왼쪽 2칸 안쪽 진입
    const danger = state.enemies.some((e) => !e.dying && e.x <= FIELD.cellSize * 2);
    if (danger) {
      el.bubble.textContent = HAMI_LINES.danger;
      el.bubble.classList.add("warn");
      return;
    }

    // 첫 적 등장 예고 (15초)
    if (!state.incomingShown && state.gameTime >= 14000 && state.gameTime < 20000) {
      state.incomingShown = true;
      say(HAMI_LINES.incoming, false, 4000);
      return;
    }

    el.bubble.textContent = HAMI_LINES.start;
    el.bubble.classList.remove("warn");
  }

  // ---------- 승패 ----------
  function endGame(win) {
    if (state.status !== "playing") return;
    state.status = win ? "win" : "lose";
    el.overlay.classList.remove("hidden", "win", "lose");
    el.overlay.classList.add(win ? "win" : "lose");
    el.overlayTitle.textContent = win ? "쌀 창고 방어 성공!" : "쌀 창고가 뚫렸어요";
    el.overlayMsg.textContent = win ? HAMI_LINES.win : HAMI_LINES.lose;
  }

  // ---------- 메인 루프 ----------
  function loop(ts) {
    if (!lastTs) lastTs = ts;
    let dt = ts - lastTs;
    lastTs = ts;
    if (dt > 100) dt = 100; // 탭 전환 등으로 인한 큰 점프 방지

    if (state.status === "playing") update(dt);
    requestAnimationFrame(loop);
  }

  // ---------- 시작/재시작 ----------
  function start() {
    state = newState();
    nextId = 1;
    el.entities.innerHTML = "";
    el.overlay.classList.add("hidden");
    buildGrid();
    buildCards();
    refreshCards();
    say(HAMI_LINES.start, false, 3000);
    updateRice();
    updateWaveBar();
  }

  el.restartBtn.addEventListener("click", start);
  el.restartTop.addEventListener("click", start);

  start();
  requestAnimationFrame(loop);
})();
