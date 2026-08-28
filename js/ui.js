// ============================================================
// ui.js - จัดการหน้าจอ: HUD, ร้านค้าป้อม, ข้อความ, overlay
// ============================================================

const UI = {
  el: {},
  messageTimer: null,

  init() {
    this.el = {
      gold:        document.getElementById("gold"),
      lives:       document.getElementById("lives"),
      level:       document.getElementById("level"),
      exp:         document.getElementById("exp"),
      expNext:     document.getElementById("exp-next"),
      wave:        document.getElementById("wave"),
      shop:        document.getElementById("tower-shop"),
      message:     document.getElementById("message"),
      startWaveBtn:document.getElementById("start-wave-btn"),
      speedBtn:    document.getElementById("speed-btn"),
      autoPlayBtn: document.getElementById("auto-play-btn"),
      devBtn:      document.getElementById("dev-btn"),
      overlay:     document.getElementById("overlay"),
      overlayTitle:document.getElementById("overlay-title"),
      overlaySub:  document.getElementById("overlay-sub"),
      overlayBtn:  document.getElementById("overlay-btn"),
      // Tower Popup (บนแคนวาส)
      towerPopup:  document.getElementById("tower-popup"),
      popupIcon:   document.getElementById("popup-icon"),
      popupName:   document.getElementById("popup-name"),
      popupTier:   document.getElementById("popup-tier"),
      popupStats:  document.getElementById("popup-stats"),
      popupUpgrade:document.getElementById("popup-upgrade-info"),
      upgradeBtn:  document.getElementById("upgrade-btn"),
      sellBtn:     document.getElementById("sell-btn"),
      popupCloseBtn:document.getElementById("popup-close-btn"),
      canvas:      document.getElementById("game-canvas"),
    };
    this.buildShop();
  },

  // ===================== ร้านค้า (compact 2 คอลัมน์) =====================
  buildShop() {
    this.el.shop.innerHTML = "";
    for (const key in TOWER_TYPES) {
      const t = TOWER_TYPES[key];
      const card = document.createElement("div");
      card.className = "tower-card";
      card.dataset.key = key;
      card.title = `${t.name}\n${t.desc}\nTiers: ${t.tierName ? t.tierName.join(" → ") : "—"}`;
      card.innerHTML = `
        <span class="tc-icon">${t.icon}</span>
        <span class="tc-name">${t.name}</span>
        <span class="tc-cost">💰 ${t.cost}</span>
        <span class="tc-lock hidden">🔒 Lv.${t.unlockLevel}</span>
      `;
      card.addEventListener("click", () => game.selectTowerType(key));
      this.el.shop.appendChild(card);
    }
  },

  // ===================== อัพเดต HUD + ร้านค้า =====================
  update(game) {
    const eco = game.economy;
    this.el.gold.textContent   = window.DEV_MODE ? "∞" : eco.gold;
    this.el.lives.textContent  = eco.lives;
    this.el.level.textContent  = eco.level;
    this.el.exp.textContent    = eco.exp;
    this.el.expNext.textContent = eco.level >= CONFIG.maxLevel ? "MAX" : eco.expToNext;
    this.el.wave.textContent   = `${game.waveNumber}/${CONFIG.totalWaves}`;

    const cards = this.el.shop.querySelectorAll(".tower-card");
    cards.forEach(card => {
      const key     = card.dataset.key;
      const unlocked = eco.isTowerUnlocked(key);
      const lockEl  = card.querySelector(".tc-lock");
      const costEl  = card.querySelector(".tc-cost");
      card.classList.toggle("locked",   !unlocked);
      card.classList.toggle("selected", game.selectedTowerType === key);
      lockEl.classList.toggle("hidden", unlocked);
      costEl.classList.toggle("cant-afford",
        unlocked && !window.DEV_MODE && eco.gold < TOWER_TYPES[key].cost);
    });

    const allDone = game.waveNumber >= CONFIG.totalWaves;
    this.el.startWaveBtn.disabled = game.waveInProgress || allDone;
    this.el.startWaveBtn.textContent = game.waveInProgress
      ? "⚔️ กำลังต่อสู้..."
      : allDone
        ? "🏁 ครบทุก Wave"
        : `▶️ Wave ${game.waveNumber + 1}`;
  },

  // ===================== Tower Popup บนแคนวาส =====================
  showSelectedTower(tower) {
    if (!tower) {
      this.el.towerPopup.classList.add("hidden");
      return;
    }
    const t = tower.type;
    const glowColor = UPGRADE.glowColor(tower.level);
    const tierLabel = UPGRADE.glowLabel(tower.level);
    const tierName  = UPGRADE.tierName ? UPGRADE.tierName(t, tower.level) : "";

    // Header
    this.el.popupIcon.textContent = t.icon;
    this.el.popupName.textContent = t.name;
    this.el.popupTier.textContent = `${tierLabel}${tierName ? " · " + tierName : ""} (Lv.${tower.level}/${UPGRADE.maxLevel})`;
    if (glowColor) {
      this.el.popupTier.style.color = glowColor;
      this.el.popupTier.style.textShadow = `0 0 8px ${glowColor}`;
    } else {
      this.el.popupTier.style.color = "#ffd369";
      this.el.popupTier.style.textShadow = "";
    }

    // Stats
    this.el.popupStats.innerHTML = `
      <div class="stat-row"><span>⚔️ ดาเมจ</span><span class="stat-val">${tower.damage}</span></div>
      <div class="stat-row"><span>🎯 ระยะ</span><span class="stat-val">${tower.range}</span></div>
      <div class="stat-row"><span>⏱️ อัตรายิง</span><span class="stat-val">${tower.fireRate}s</span></div>
      <div class="stat-row"><span>💰 ลงทุน</span><span class="stat-val">${tower.totalInvested}</span></div>
    `;

    // Upgrade preview
    if (tower.canUpgrade) {
      const n = tower.nextStats;
      const nextTier = UPGRADE.glowLabel(tower.level + 1);
      const nextName = UPGRADE.tierName ? UPGRADE.tierName(t, tower.level + 1) : "";
      this.el.popupUpgrade.classList.remove("maxed");
      this.el.popupUpgrade.innerHTML = `
        ▲ ${nextTier}${nextName ? " · " + nextName : ""}<br>
        ⚔️ ${n.damage} · 🎯 ${n.range} · ⏱️ ${n.fireRate}s
      `;
      this.el.upgradeBtn.disabled = false;
      this.el.upgradeBtn.textContent = `⭐ อัปเกรด (${tower.upgradeCost}💰)`;
    } else {
      this.el.popupUpgrade.classList.add("maxed");
      this.el.popupUpgrade.innerHTML = "✦ ระดับสูงสุดแล้ว!";
      this.el.upgradeBtn.disabled = true;
      this.el.upgradeBtn.textContent = "✦ MAX";
    }

    const refund = Math.floor(tower.totalInvested * 0.6);
    this.el.sellBtn.textContent = `💰 ขาย (+${refund})`;

    // แสดงและจัดตำแหน่ง popup ใกล้ป้อม
    this.el.towerPopup.classList.remove("hidden");
    this._positionPopup(tower);
  },

  _positionPopup(tower) {
    const canvas = this.el.canvas;
    const stage  = canvas.parentElement;
    const scaleX = canvas.clientWidth  / 800;
    const scaleY = canvas.clientHeight / 600;

    // พิกัดป้อมบนหน้าจอ (relative ต่อ stage)
    const cx = canvas.offsetLeft + tower.x * scaleX;
    const cy = canvas.offsetTop  + tower.y * scaleY;

    const popW   = 215;
    const popH   = 230;
    const stageW = stage.clientWidth;
    const stageH = stage.clientHeight;
    const margin = 8;

    // วางทางขวาก่อน ถ้าไม่พอค่อยซ้าย
    let left = cx + 36;
    let top  = cy - 80;

    if (left + popW > stageW - margin) left = cx - popW - 30;
    if (left < margin) left = margin;
    if (top < margin) top = margin;
    if (top + popH > stageH - margin) top = stageH - popH - margin;

    this.el.towerPopup.style.left = left + "px";
    this.el.towerPopup.style.top  = top  + "px";
  },

  // ===================== ข้อความ / Overlay =====================
  showMessage(text, duration = 2500) {
    this.el.message.textContent = text;
    clearTimeout(this.messageTimer);
    this.messageTimer = setTimeout(() => { this.el.message.textContent = ""; }, duration);
  },

  showOverlay(title, sub, btnText = "เริ่มใหม่") {
    this.el.overlay.classList.remove("hidden");
    this.el.overlayTitle.textContent = title;
    const safe = String(sub)
      .replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;")
      .replace(/\n/g,"<br>");
    this.el.overlaySub.innerHTML = safe;
    this.el.overlayBtn.textContent = btnText;
  },

  hideOverlay() {
    this.el.overlay.classList.add("hidden");
  },
};
