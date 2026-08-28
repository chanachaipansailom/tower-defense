// ============================================================
// economy.js - ระบบเศรษฐกิจ: ทอง, เลเวลผู้เล่น, การปลดล็อกป้อม
// ============================================================

class Economy {
  constructor() {
    this.gold = CONFIG.startGold;
    this.lives = CONFIG.startLives;
    this.level = 1;
    this.exp = 0;
    this.expToNext = this._expForLevel(1);
  }

  _expForLevel(n) {
    return Math.round(CONFIG.baseExp * Math.pow(n, CONFIG.expGrowth));
  }

  addGold(amount) {
    this.gold += amount;
  }

  spendGold(amount) {
    if (window.DEV_MODE) return true;   // DEV: ทองไม่อั้น
    if (this.gold >= amount) {
      this.gold -= amount;
      return true;
    }
    return false;
  }

  loseLife(amount = 1) {
    this.lives -= amount;
    if (this.lives < 0) this.lives = 0;
  }

  get isGameOver() {
    return this.lives <= 0;
  }

  addExp(amount) {
    const levelsGained = [];
    this.exp += amount;
    while (this.level < CONFIG.maxLevel && this.exp >= this.expToNext) {
      this.exp -= this.expToNext;
      this.level++;
      levelsGained.push(this.level);
      this.expToNext = this._expForLevel(this.level);
    }
    if (this.level >= CONFIG.maxLevel) {
      this.exp = 0;
      this.expToNext = 0;
    }
    return levelsGained;
  }

  isTowerUnlocked(typeKey) {
    if (window.DEV_MODE) return true;   // DEV: ปลดล็อกทุกป้อม
    return this.level >= TOWER_TYPES[typeKey].unlockLevel;
  }

  canAfford(typeKey) {
    if (window.DEV_MODE) return true;   // DEV: ซื้อได้เสมอ
    const t = TOWER_TYPES[typeKey];
    return this.isTowerUnlocked(typeKey) && this.gold >= t.cost;
  }

  purchaseError(typeKey) {
    if (window.DEV_MODE) return null;   // DEV: ไม่มี error
    const t = TOWER_TYPES[typeKey];
    if (!this.isTowerUnlocked(typeKey)) {
      return `🔒 ต้องถึงเลเวล ${t.unlockLevel} ก่อนจึงปลดล็อก ${t.name}`;
    }
    if (this.gold < t.cost) {
      return `💰 ทองไม่พอ! ต้องการ ${t.cost} (มี ${this.gold})`;
    }
    return null;
  }
}
