// ============================================================
// game.js
// ============================================================
window.DEV_MODE = false;   // DEV MODE global flag

const game = {
  canvas: null, ctx: null,
  economy: null,
  enemies: [], towers: [], projectiles: [], effects: [],
  waveNumber: 0, waveInProgress: false,
  gameOver: false, won: false, started: false,
  selectedTowerType: null, selectedTower: null,
  mouse: { x: 0, y: 0, valid: false },
  spawnQueue: [], spawnTimer: 0,
  lastTime: 0, speedMultiplier: 1,
  occupiedCells: new Set(),
  autoPlay: false, _autoPlayTimer: 0, _autoWaveTimer: 0,

  _snapToGrid(x, y) {
    const ts = CONFIG.tileSize;
    const col = Math.floor(x / ts), row = Math.floor(y / ts);
    return { col, row, cx: col*ts+ts/2, cy: row*ts+ts/2, key: `${col},${row}` };
  },

  init() {
    this.canvas = document.getElementById("game-canvas");
    this.ctx = this.canvas.getContext("2d");
    UI.init();
    this._bindEvents();
    // ปลดล็อก AudioContext จากการโต้ตอบครั้งแรกของผู้เล่น (นโยบาย autoplay ของเบราว์เซอร์)
    window.addEventListener("pointerdown", () => Sound.unlock(), { once: true });
    const ids = Object.keys(MAPS);
    const pick = ids[Math.floor(Math.random() * ids.length)];
    this.startGame(pick);
    this.lastTime = performance.now();
    requestAnimationFrame((t) => this._loop(t));
  },

  startGame(mapId) {
    GameMap.load(mapId);
    this.occupiedCells = new Set();
    this.towers = []; this.enemies = []; this.projectiles = []; this.effects = [];
    this.waveNumber = 0; this.waveInProgress = false;
    this.gameOver = false; this.won = false;
    this.economy = new Economy();
    this.started = true; this._autoPlayTimer = 0;
    this.selectedTower = null;
    UI.showSelectedTower(null);
    UI.hideOverlay(); UI.update(this);
    UI.showMessage(`🗺️ ด่าน "${GameMap.currentMap.name}" (${GameMap.currentMap.icon}) — วางป้อมแล้วกด เริ่ม Wave!`, 5000);
  },

  _bindEvents() {
    this.canvas.addEventListener("click", (e) => this._onCanvasClick(e));
    this.canvas.addEventListener("mousemove", (e) => {
      const pos = this._getCanvasPos(e);
      const snap = this._snapToGrid(pos.x, pos.y);
      this.mouse.x = snap.cx; this.mouse.y = snap.cy;
      this.mouse.col = snap.col; this.mouse.row = snap.row;
      this.mouse.valid = this._canPlaceAt(snap.cx, snap.cy, snap.key);
    });
    this.canvas.addEventListener("contextmenu", (e) => {
      e.preventDefault();
      this.selectTowerType(null);
    });

    UI.el.startWaveBtn.addEventListener("click", () => this.startWave());

    UI.el.speedBtn.addEventListener("click", () => {
      this.speedMultiplier = this.speedMultiplier >= 3 ? 1 : this.speedMultiplier + 1;
      UI.el.speedBtn.textContent = `⏩ x${this.speedMultiplier}`;
    });

    // sell / upgrade อยู่ใน tower-popup
    UI.el.sellBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      this._sellSelectedTower();
    });
    UI.el.upgradeBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      this._upgradeSelectedTower();
    });

    // ปิด popup
    if (UI.el.popupCloseBtn) {
      UI.el.popupCloseBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        if (this.selectedTower) this.selectedTower.selected = false;
        this.selectedTower = null;
        UI.showSelectedTower(null);
      });
    }

    UI.el.overlayBtn.addEventListener("click", () => {
      const ids = Object.keys(MAPS);
      const pick = ids[Math.floor(Math.random() * ids.length)];
      this.startGame(pick);
    });

    if (UI.el.autoPlayBtn) {
      UI.el.autoPlayBtn.addEventListener("click", () => {
        this.autoPlay = !this.autoPlay;
        UI.el.autoPlayBtn.classList.toggle("active", this.autoPlay);
        UI.el.autoPlayBtn.textContent = this.autoPlay ? "🤖 ออโต้: เปิด" : "🤖 ออโต้: ปิด";
        if (this.autoPlay && this.won) {
          this._startNextMap();
        } else if (this.autoPlay && !this.waveInProgress && !this.gameOver) {
          // เริ่ม wave แรกใน 2 วินาทีหลังเปิด auto
          this._autoWaveTimer = 2;
        }
      });
    }

    if (UI.el.devBtn) {
      UI.el.devBtn.addEventListener("click", () => {
        window.DEV_MODE = !window.DEV_MODE;
        UI.el.devBtn.classList.toggle("active", window.DEV_MODE);
        UI.el.devBtn.textContent = window.DEV_MODE ? "🛠️ DEV: เปิด" : "🛠️ DEV: ปิด";
        UI.showMessage(
          window.DEV_MODE
            ? "🛠️ DEV MODE เปิด: ทองไม่อั้น + ปลดล็อกทุกป้อม!"
            : "🛠️ DEV MODE ปิดแล้ว",
          2500
        );
        UI.update(this); // refresh shop lock/cost colors
        // refresh popup ถ้ากำลังเปิดอยู่
        if (this.selectedTower) UI.showSelectedTower(this.selectedTower);
      });
    }
  },

  selectTowerType(key) {
    if (key && !this.economy.isTowerUnlocked(key)) {
      UI.showMessage(this.economy.purchaseError(key)); return;
    }
    this.selectedTowerType = this.selectedTowerType === key ? null : key;
    if (this.selectedTower) {
      this.selectedTower.selected = false;
      this.selectedTower = null;
      UI.showSelectedTower(null);
    }
  },

  _canPlaceAt(x, y, cellKey) {
    const ts = CONFIG.tileSize;
    const key = cellKey || this._snapToGrid(x, y).key;
    if (x-ts/2<0 || x+ts/2>CONFIG.canvasWidth || y-ts/2<0 || y+ts/2>CONFIG.canvasHeight) return false;
    if (GameMap.isCellOnPath(x, y)) return false;
    if (this.occupiedCells.has(key)) return false;
    return true;
  },

  _getCanvasPos(e) {
    const rect = this.canvas.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left) * (this.canvas.width / rect.width),
      y: (e.clientY - rect.top)  * (this.canvas.height / rect.height)
    };
  },

  _onCanvasClick(e) {
    if (!this.started || this.gameOver) return;
    const pos = this._getCanvasPos(e);
    if (this.selectedTowerType) { this._tryPlaceTower(pos.x, pos.y); return; }

    let clicked = null;
    for (const t of this.towers) {
      if (Math.hypot(t.x - pos.x, t.y - pos.y) < 22) { clicked = t; break; }
    }
    if (this.selectedTower) this.selectedTower.selected = false;
    this.selectedTower = clicked;
    if (clicked) {
      clicked.selected = true;
      UI.showSelectedTower(clicked);
    } else {
      UI.showSelectedTower(null);
    }
  },

  _tryPlaceTower(rawX, rawY) {
    const towerKey = this.selectedTowerType;
    const err = this.economy.purchaseError(towerKey);
    if (err) { UI.showMessage(err); return; }
    const snap = this._snapToGrid(rawX, rawY);
    if (!this._canPlaceAt(snap.cx, snap.cy, snap.key)) {
      UI.showMessage("❌ วางป้อมตรงนี้ไม่ได้"); return;
    }
    const cost = TOWER_TYPES[towerKey].cost;
    this.economy.spendGold(cost);
    this.occupiedCells.add(snap.key);
    const tower = new Tower(snap.cx, snap.cy, towerKey);
    tower._cellKey = snap.key;
    this.towers.push(tower);
    UI.showMessage(`✅ วาง ${TOWER_TYPES[towerKey].name}${window.DEV_MODE ? "" : ` (-${cost}💰)`}`);
    if (!this.economy.canAfford(towerKey)) this.selectedTowerType = null;
  },

  _sellSelectedTower() {
    if (!this.selectedTower) return;
    const refund = Math.floor(this.selectedTower.totalInvested * 0.6);
    this.economy.addGold(refund);
    if (this.selectedTower._cellKey) this.occupiedCells.delete(this.selectedTower._cellKey);
    this.towers = this.towers.filter(t => t !== this.selectedTower);
    UI.showMessage(`💰 ขายป้อมคืน ${refund}`);
    this.selectedTower = null;
    UI.showSelectedTower(null);
  },

  _upgradeSelectedTower() {
    const t = this.selectedTower;
    if (!t) return;
    if (!t.canUpgrade) { UI.showMessage("⭐ ระดับสูงสุดแล้ว"); return; }
    const cost = t.upgradeCost;
    if (!this.economy.spendGold(cost)) {
      UI.showMessage(`💰 ทองไม่พออัปเกรด! ต้องการ ${cost}`); return;
    }
    t.upgrade();
    UI.showMessage(`⭐ อัปเกรด ${t.type.name} เป็นระดับ ${t.level}${window.DEV_MODE ? "" : ` (-${cost}💰)`}`);
    UI.showSelectedTower(t);
  },

  startWave() {
    if (this.waveInProgress || this.gameOver) return;
    this.waveNumber++;
    this.waveInProgress = true;
    this.spawnQueue = this._buildWave(this.waveNumber);
    this.spawnTimer = 0;
    UI.showMessage(`🌊 Wave ${this.waveNumber} เริ่มแล้ว!`);
  },

  _buildWave(n) {
    const mapDiff   = GameMap.currentMap.difficulty || 1;
    const hpMult    = (1 + (n - 1) * 0.22) * mapDiff;   // +22% HP per wave
    const spdMult   = 1 + (n - 1) * 0.04;               // +4% speed per wave
    const delay     = Math.max(0.35, 0.75 - n * 0.025); // interval shrinks each wave

    const regular = [];
    const push = (type, count, hpBonus = 1) => {
      for (let i = 0; i < count; i++)
        regular.push({ type, hpMult: hpMult * hpBonus, spdMult, delay });
    };

    if (n <= 2) {
      // Wave 1-2: ออร์คธรรมดา ฝึกหัด
      push("orc", 6 + n * 2);
      if (n >= 2) push("fast_orc", 3);

    } else if (n <= 5) {
      // Wave 3-5: เริ่มมีออร์คแน่น + ลอยตัวแรก
      push("orc",      6 + n);
      push("fast_orc", 3 + n);
      if (n >= 4) push("orc_tank", Math.floor(n / 2));
      if (n >= 4) push("harpy",    n - 3);        // ฮาร์ปี้เริ่ม wave 4

    } else if (n <= 9) {
      // Wave 6-9: ลอยตัวมากขึ้น พ่อมดบินออกมา
      push("orc",      5 + n);
      push("fast_orc", 4 + n);
      push("orc_tank", 2 + Math.floor((n - 5) / 2));
      push("harpy",    3 + (n - 5));
      if (n >= 7) push("wizard", 1 + (n - 6));    // พ่อมดบินเริ่ม wave 7

    } else if (n <= 12) {
      // Wave 10-12: หนักมาก ลอยตัวเยอะ
      push("orc",      8);
      push("fast_orc", 6 + (n - 9));
      push("orc_tank", 4 + (n - 9));
      push("harpy",    5 + (n - 9));
      push("wizard",   3 + (n - 9));

    } else {
      // Wave 13-15: Elite — ทุกอย่างทีเดียว เร็วและหนา
      push("orc",      6);
      push("fast_orc", 8 + (n - 12));
      push("orc_tank", 5 + (n - 12));
      push("harpy",    6 + (n - 12));
      push("wizard",   4 + (n - 12));
    }

    // สับลำดับ regular enemies ให้สุ่ม (ไม่น่าเบื่อ)
    for (let i = regular.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [regular[i], regular[j]] = [regular[j], regular[i]];
    }

    // Boss ตามเวฟ — ต่อท้ายเสมอ
    const bosses = [];
    if (n === 5)  bosses.push({ type: "orc_boss", hpMult: hpMult * 1.5, spdMult, delay: 2 });
    if (n === 10) bosses.push({ type: "orc_boss", hpMult: hpMult * 2.0, spdMult, delay: 2 });
    if (n === 15) {
      // บอสคู่ wave สุดท้าย
      bosses.push({ type: "orc_boss", hpMult: hpMult * 2.5, spdMult, delay: 2 });
      bosses.push({ type: "orc_boss", hpMult: hpMult * 2.0, spdMult: spdMult * 1.2, delay: 3 });
    }
    // mini-boss ทุก wave ที่หาร 3 ลงตัว (ยกเว้นที่มีบอสใหญ่)
    if (n % 3 === 0 && n !== 15) {
      bosses.push({ type: "orc_boss", hpMult: hpMult * (n >= 10 ? 1.5 : 1.2), spdMult, delay: 1.8 });
    }

    return [...regular, ...bosses];
  },

  _updateSpawning(dt) {
    if (this.spawnQueue.length === 0) return;
    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0) {
      const spec = this.spawnQueue.shift();
      this.enemies.push(new Enemy(spec.type, spec.hpMult, spec.spdMult || 1));
      this.spawnTimer = spec.delay;
    }
  },

  _checkWaveEnd() {
    if (this.waveInProgress && this.spawnQueue.length === 0 && this.enemies.length === 0) {
      this.waveInProgress = false;
      if (this.autoPlay) {
        // auto mode: นับถอยหลัง 3 วินาทีแล้วยิง wave ถัดไป
        this._autoWaveTimer = 3;
        UI.showMessage(`🎉 ผ่าน Wave ${this.waveNumber}! · 🤖 Wave ถัดไปใน 3 วิ...`);
      } else {
        UI.showMessage(`🎉 ผ่าน Wave ${this.waveNumber}!`);
      }
    }
  },

  _winGame() {
    this.won = true; this.gameOver = true;
    const result = ScoreStore.submit(GameMap.currentId, this.waveNumber, this.economy.level);
    const recordLine = result.isNewRecord ? "🎉 สถิติใหม่!" : `🏆 สถิติเดิม: ${result.best.score} คะแนน`;
    if (this.autoPlay) {
      UI.showOverlay("🏆 ชนะแล้ว!",
        `พิชิต ${GameMap.currentMap.name}!\nคะแนน: ${result.score} · ${recordLine}\n🤖 เริ่มด่านใหม่ใน 3 วินาที...`,
        "⏭️ ข้าม");
      this._autoPlayTimer = 3;
    } else {
      UI.showOverlay("🏆 ชนะแล้ว!",
        `พิชิตด่าน ${GameMap.currentMap.name}!\nเลเวล ${this.economy.level} · ฐานเหลือ ${this.economy.lives} ❤️\nคะแนน: ${result.score} · ${recordLine}`,
        "🔄 เริ่มด่านใหม่");
    }
  },

  _startNextMap() {
    GameMap.loadRandom(GameMap.currentId);
    this.enemies = []; this.projectiles = []; this.effects = [];
    this.waveNumber = 0; this.waveInProgress = false;
    this.gameOver = false; this.won = false;
    this.occupiedCells = new Set(); this.towers = [];
    this.economy = new Economy();
    this._autoPlayTimer = 0;
    this.selectedTower = null;
    UI.showSelectedTower(null);
    UI.hideOverlay(); UI.update(this);
    UI.showMessage(`🗺️ แผนที่ใหม่: "${GameMap.currentMap.name}" ${GameMap.currentMap.icon}`, 5000);
  },

  _loop(now) {
    let dt = Math.min((now - this.lastTime) / 1000, 0.1);
    this.lastTime = now;
    dt *= this.speedMultiplier;
    if (this.started && !this.gameOver) {
      this._update(dt);
    } else if (this.started && this.won && this.autoPlay && this._autoPlayTimer > 0) {
      this._autoPlayTimer -= dt;
      if (this._autoPlayTimer <= 0) this._startNextMap();
    }
    this._draw();
    requestAnimationFrame(t => this._loop(t));
  },

  _update(dt) {
    this._updateSpawning(dt);
    for (const e of this.enemies) {
      e.update(dt);
      if (e.reachedBase && !e.dead) {
        e.dead = true; this.economy.loseLife(1);
        UI.showMessage("💥 ศัตรูบุกถึงฐาน! -1 ❤️", 1500);
      } else if (e.dead && !e._rewarded) {
        e._rewarded = true;
        this.economy.addGold(e.gold);
        const levels = this.economy.addExp(e.exp);
        if (levels.length > 0) this._onLevelUp(levels);
      }
    }
    this.enemies = this.enemies.filter(e => !e.dead);

    // Auto-wave: นับถอยหลังแล้วเริ่ม wave ถัดไปอัตโนมัติ
    if (this.autoPlay && !this.waveInProgress) {
      if (this._autoWaveTimer > 0) {
        this._autoWaveTimer -= dt;
        if (this._autoWaveTimer <= 0) {
          this.startWave();
        }
      }
    }

    for (const t of this.towers) t.update(dt, this.enemies);
    for (const p of this.projectiles) p.update(dt);
    this.projectiles = this.projectiles.filter(p => !p.done);
    for (const fx of this.effects) fx.update(dt);
    this.effects = this.effects.filter(fx => !fx.done);
    this._checkWaveEnd();
    if (this.economy.isGameOver) {
      this.gameOver = true;
      const result = ScoreStore.submit(GameMap.currentId, this.waveNumber, this.economy.level);
      const recordLine = result.isNewRecord ? "🎉 สถิติใหม่!" : `🏆 สถิติเดิม: ${result.best.score} คะแนน`;
      UI.showOverlay("💀 เกมจบ",
        `ด่าน ${GameMap.currentMap.name} · Wave ${this.waveNumber} · เลเวล ${this.economy.level}\nคะแนน: ${result.score} · ${recordLine}`,
        "🔄 เริ่มด่านใหม่");
    }
    UI.update(this);
  },

  _onLevelUp(levels) {
    const newLevel = levels[levels.length - 1];
    const unlocked = [];
    for (const lv of levels) {
      for (const key in TOWER_TYPES) {
        if (TOWER_TYPES[key].unlockLevel === lv) unlocked.push(TOWER_TYPES[key].name);
      }
    }
    if (unlocked.length > 0) UI.showMessage(`⭐ เลเวล ${newLevel}! ปลดล็อก: ${unlocked.join(", ")}`, 4000);
    else UI.showMessage(`⭐ เลเวลอัป! ตอนนี้เลเวล ${newLevel}`, 2500);
  },

  _draw() {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, CONFIG.canvasWidth, CONFIG.canvasHeight);
    GameMap.draw(ctx);
    for (const t of this.towers) t.draw(ctx);
    for (const e of this.enemies) e.draw(ctx);
    for (const p of this.projectiles) p.draw(ctx);
    for (const fx of this.effects) fx.draw(ctx);
    if (this.selectedTowerType && !this.gameOver) this._drawPlacementPreview(ctx);
    // Auto-wave countdown บนแคนวาส
    if (this.autoPlay && !this.waveInProgress && this._autoWaveTimer > 0 && !this.gameOver) {
      const secs = Math.ceil(this._autoWaveTimer);
      ctx.save();
      ctx.font = "bold 20px sans-serif";
      ctx.textAlign = "center";
      ctx.fillStyle = "rgba(0,0,0,0.5)";
      ctx.fillRect(CONFIG.canvasWidth/2 - 130, CONFIG.canvasHeight - 42, 260, 34);
      ctx.fillStyle = "#ffd369";
      ctx.shadowColor = "#ffd369"; ctx.shadowBlur = 10;
      ctx.fillText(`🤖 Wave ${this.waveNumber + 1} เริ่มใน ${secs}...`, CONFIG.canvasWidth/2, CONFIG.canvasHeight - 19);
      ctx.shadowBlur = 0; ctx.textAlign = "start";
      ctx.restore();
    }

    // DEV badge บนแคนวาส
    if (window.DEV_MODE) {
      ctx.save();
      ctx.font = "bold 11px monospace";
      ctx.fillStyle = "rgba(243,156,18,0.9)";
      ctx.fillRect(4, 4, 74, 18);
      ctx.fillStyle = "#000";
      ctx.textAlign = "center";
      ctx.fillText("🛠️ DEV MODE", 41, 16);
      ctx.textAlign = "start";
      ctx.restore();
    }
    if (this.won && this.autoPlay && this._autoPlayTimer > 0) {
      ctx.fillStyle = "rgba(0,0,0,0.45)";
      ctx.fillRect(0, 0, CONFIG.canvasWidth, CONFIG.canvasHeight);
      ctx.font = "bold 34px sans-serif"; ctx.textAlign = "center";
      ctx.fillStyle = "#ffd369"; ctx.shadowColor = "#ffd369"; ctx.shadowBlur = 12;
      ctx.fillText(`🤖 เริ่มด่านใหม่ใน ${Math.ceil(this._autoPlayTimer)}...`, CONFIG.canvasWidth/2, CONFIG.canvasHeight/2);
      ctx.shadowBlur = 0; ctx.textAlign = "start";
    }
  },

  _drawPlacementPreview(ctx) {
    const { x, y, valid: ok } = this.mouse;
    const type = TOWER_TYPES[this.selectedTowerType];
    const ts = CONFIG.tileSize, half = ts / 2;
    ctx.fillStyle   = ok ? "rgba(46,204,113,0.25)" : "rgba(231,76,60,0.25)";
    ctx.fillRect(x - half, y - half, ts, ts);
    ctx.strokeStyle = ok ? "rgba(46,204,113,0.9)" : "rgba(231,76,60,0.9)";
    ctx.lineWidth = 2; ctx.strokeRect(x - half, y - half, ts, ts);
    ctx.beginPath(); ctx.arc(x, y, type.range, 0, Math.PI * 2);
    ctx.fillStyle   = ok ? "rgba(46,204,113,0.07)" : "rgba(231,76,60,0.07)"; ctx.fill();
    ctx.strokeStyle = ok ? "rgba(46,204,113,0.4)" : "rgba(231,76,60,0.4)";
    ctx.lineWidth = 1; ctx.setLineDash([6, 4]); ctx.stroke(); ctx.setLineDash([]);
    ctx.globalAlpha = 0.75; ctx.font = "20px sans-serif";
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText(type.icon, x, y);
    ctx.globalAlpha = 1; ctx.textAlign = "start"; ctx.textBaseline = "alphabetic";
  },
};

window.addEventListener("DOMContentLoaded", () => game.init());
