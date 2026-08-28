// ============================================================
// config.js
// ============================================================
const CONFIG = {
  canvasWidth: 800, canvasHeight: 600, tileSize: 40,
  startGold: 200, startLives: 20,
  baseExp: 100, expGrowth: 1.35, maxLevel: 20,
  totalWaves: 15,
};

const ABILITIES = {
  bomb: { key:"bomb", name:"ระเบิดทั้งจอ", icon:"💣", cost:120, cooldown:25, damage:150, desc:"สร้างดาเมจ 150 ให้ศัตรูทุกตัว" },
  repair: { key:"repair", name:"ซ่อมฐาน", icon:"🔧", cost:80, cooldown:30, healAmount:5, desc:"ซ่อมฐาน +5 ❤️" },
};

// =====================================================
// 4 ป้อมหลัก สไตล์ Endless Siege
// แต่ละป้อมมี 3 Tier ที่เปลี่ยนรูปร่างและการโจมตี
// Tier 1 = lv 1-3 | Tier 2 = lv 4-7 | Tier 3 = lv 8-10
// =====================================================
const TOWER_TYPES = {
  ballista: {
    key: "ballista", name: "บัลลิสต้า", icon: "🏹",
    cost: 60, range: 100, damage: 4, fireRate: 0.55,
    projectileSpeed: 450, color: "#8d6e63",
    projectileColor: "#cddc39", unlockLevel: 1,
    special: null,
    targetType: ["ground", "air"],
    tierName: ["หน้าไม้", "หน้าไม้ยักษ์", "ธนูสายฟ้า"],
    desc: "T1: ยิงลูกธนูเร็ว · T2: ยิง 3 นัดพร้อมกัน · T3: ฟ้าผ่าลูกโซ่",
  },
  torch: {
    key: "torch", name: "คบไฟ", icon: "🔥",
    cost: 110, range: 70, damage: 2, fireRate: 0.18,
    projectileSpeed: 300, color: "#ff5722",
    projectileColor: "#ff9800", unlockLevel: 3,
    special: "burn", burnDamage: 2, burnDuration: 2.5,
    targetType: ["ground"],
    tierName: ["คบไฟ", "ขดสายฟ้า Tesla", "ลูกพลาสมา"],
    desc: "T1: พ่นไฟ+เผา · T2: Tesla Chain · T3: Plasma AOE",
  },
  cannon: {
    key: "cannon", name: "ปืนใหญ่", icon: "💣",
    cost: 180, range: 95, damage: 15, fireRate: 2.2,
    projectileSpeed: 260, color: "#795548",
    projectileColor: "#5d4037", unlockLevel: 5,
    special: "splash", splashRadius: 55,
    targetType: ["ground"],
    tierName: ["ปืนใหญ่", "ทุ่นระเบิด", "จรวดนำวิถี"],
    desc: "T1: กระสุนระเบิด · T2: วางทุ่นระเบิด · T3: จรวดสังหาร",
  },
  timewarper: {
    key: "timewarper", name: "ควบคุมเวลา", icon: "⏱️",
    cost: 140, range: 90, damage: 0, fireRate: 1.5,
    projectileSpeed: 0, color: "#7e57c2",
    projectileColor: "#b39ddb", unlockLevel: 2,
    special: "aura",
    slowFactor: 0.45, slowDuration: 2,
    freezeDuration: 1.8,
    targetType: ["ground", "air"],
    tierName: ["ชะลอเวลา", "แช่แข็ง", "ดีดกลับ"],
    desc: "T1: ชะลอศัตรูในรัศมี · T2: แช่แข็ง · T3: ดีดศัตรูถอยหลัง",
  },
};

const UPGRADE = {
  maxLevel: 10,
  damageMult: 1.32, rangeMult: 1.04, fireRateMult: 0.91,
  costFactor: 1.5,
  costFor(baseCost, level) { return Math.round(baseCost * Math.pow(this.costFactor, level)); },
  // Tier 1=lv1-3, Tier 2=lv4-7, Tier 3=lv8-10
  getTier(level) { return level >= 8 ? 3 : level >= 4 ? 2 : 1; },
  tierName(towerType, level) {
    const names = towerType.tierName;
    return names ? names[this.getTier(level)-1] : "";
  },
  glowColor(level) {
    if (level >= 10) return "#ff00ff";
    if (level >= 8)  return "#ff2200";
    if (level >= 4)  return "#ffd700";
    if (level >= 2)  return "#c0c0c0";
    return null;
  },
  glowLabel(level) {
    if (level >= 10) return "✦MAX✦";
    if (level >= 8)  return "Tier 3";
    if (level >= 4)  return "Tier 2";
    return "Tier 1";
  },
};

const ENEMY_TYPES = {
  orc: {
    key: "orc", name: "ออร์ค", hp: 100, speed: 60, gold: 8, exp: 5,
    color: "#4caf50", radius: 12, unitType: "ground",
  },
  fast_orc: {
    key: "fast_orc", name: "ออร์คเร็ว", hp: 65, speed: 130, gold: 10, exp: 7,
    color: "#ff9800", radius: 10, unitType: "ground",
  },
  orc_tank: {
    key: "orc_tank", name: "ออร์คยักษ์", hp: 450, speed: 32, gold: 22, exp: 16,
    color: "#795548", radius: 17, unitType: "ground",
  },
  wizard: {
    key: "wizard", name: "พ่อมดบิน", hp: 160, speed: 55, gold: 20, exp: 15,
    color: "#9c27b0", radius: 12, regenRate: 6, unitType: "air",
  },
  harpy: {
    key: "harpy", name: "ฮาร์ปี้", hp: 90, speed: 100, gold: 14, exp: 10,
    color: "#00bcd4", radius: 11, unitType: "air",
  },
  orc_boss: {
    key: "orc_boss", name: "บอสออร์ค", hp: 2000, speed: 28, gold: 120, exp: 70,
    color: "#b71c1c", radius: 24, unitType: "ground",
  },
};
