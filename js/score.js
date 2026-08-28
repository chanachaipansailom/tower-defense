// ============================================================
// score.js - ระบบบันทึกคะแนน/ไฮสกอร์ ด้วย localStorage (แยกต่อแผนที่)
// ============================================================

const ScoreStore = {
  KEY: "towerDefense_highscores_v1",

  // อ่านข้อมูลไฮสกอร์ทั้งหมด { mapId: { wave, level, score }, ... }
  _readAll() {
    try {
      const raw = localStorage.getItem(this.KEY);
      return raw ? JSON.parse(raw) : {};
    } catch (e) {
      // localStorage ใช้ไม่ได้ (เช่น โหมด private) — คืน object ว่าง
      return {};
    }
  },

  _writeAll(data) {
    try {
      localStorage.setItem(this.KEY, JSON.stringify(data));
      return true;
    } catch (e) {
      return false;
    }
  },

  // ไฮสกอร์ของแผนที่หนึ่ง (คืน null ถ้ายังไม่มี)
  getHighScore(mapId) {
    const all = this._readAll();
    return all[mapId] || null;
  },

  // คำนวณคะแนนจากผลการเล่น
  computeScore(wave, level) {
    return wave * 100 + level * 25;
  },

  // บันทึกผลถ้าดีกว่าเดิม — คืน { score, isNewRecord }
  submit(mapId, wave, level) {
    const score = this.computeScore(wave, level);
    const all = this._readAll();
    const prev = all[mapId];
    const isNewRecord = !prev || score > prev.score;
    if (isNewRecord) {
      all[mapId] = { wave, level, score };
      this._writeAll(all);
    }
    return { score, isNewRecord, best: all[mapId] };
  },
};
