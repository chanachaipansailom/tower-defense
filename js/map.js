// ============================================================
// map.js - แผนที่และเส้นทางเดินของมอนสเตอร์
// waypoints ทุกจุดอยู่ที่ศูนย์กลาง grid cell (col*40+20, row*40+20)
// ============================================================

const MAPS = {
  meadow: {
    id: "meadow",
    name: "ทุ่งหญ้า",
    icon: "🌿",
    difficulty: 1.0,
    grass: "#3a7d34",
    roadColor: "#6d5b3f",
    desc: "เส้นทางคดเคี้ยวคลาสสิก เหมาะสำหรับผู้เริ่มต้น",
    waypoints: [
      { x: -20,  y: 100 },   // entry left, row 2
      { x: 220,  y: 100 },   // col 5
      { x: 220,  y: 300 },   // row 7
      { x: 500,  y: 300 },   // col 12
      { x: 500,  y: 140 },   // row 3
      { x: 700,  y: 140 },   // col 17
      { x: 700,  y: 460 },   // row 11
      { x: 340,  y: 460 },   // col 8
      { x: 340,  y: 580 },   // row 14
      { x: 100,  y: 580 },   // col 2
      { x: 100,  y: 620 },   // exit bottom
    ],
  },
  desert: {
    id: "desert",
    name: "ทะเลทราย",
    icon: "🏜️",
    difficulty: 1.25,
    grass: "#b8894b",
    roadColor: "#8d6e3a",
    desc: "ทางยาวหักศอกหลายมุม ศัตรูแข็งแกร่งขึ้น",
    waypoints: [
      { x: -20,  y: 300 },   // entry left, row 7
      { x: 140,  y: 300 },   // col 3
      { x: 140,  y: 100 },   // row 2
      { x: 380,  y: 100 },   // col 9
      { x: 380,  y: 420 },   // row 10
      { x: 620,  y: 420 },   // col 15
      { x: 620,  y: 140 },   // row 3
      { x: 780,  y: 140 },   // col 19
      { x: 820,  y: 140 },   // exit right
    ],
  },
  cavern: {
    id: "cavern",
    name: "ถ้ำมืด",
    icon: "🕳️",
    difficulty: 1.5,
    grass: "#2c3e50",
    roadColor: "#4a4a6a",
    desc: "เส้นทางซับซ้อนวนไปมา ท้าทายที่สุด",
    waypoints: [
      { x: 420,  y: -20 },   // entry top, col 10
      { x: 420,  y: 140 },   // row 3
      { x: 140,  y: 140 },   // col 3
      { x: 140,  y: 300 },   // row 7
      { x: 660,  y: 300 },   // col 16
      { x: 660,  y: 500 },   // row 12
      { x: 300,  y: 500 },   // col 7
      { x: 300,  y: 220 },   // row 5
      { x: 500,  y: 220 },   // col 12
      { x: 500,  y: 580 },   // row 14
      { x: 500,  y: 620 },   // exit bottom
    ],
  },
  volcano: {
    id: "volcano",
    name: "ภูเขาไฟ",
    icon: "🌋",
    difficulty: 1.75,
    grass: "#4a1500",
    roadColor: "#7f3800",
    desc: "ลาวาไหลรอบข้าง ศัตรูแกร่งสุดขีด",
    waypoints: [
      { x: -20,  y: 500 },   // entry left, row 12
      { x: 140,  y: 500 },   // col 3
      { x: 140,  y: 140 },   // row 3
      { x: 340,  y: 140 },   // col 8
      { x: 340,  y: 420 },   // row 10
      { x: 540,  y: 420 },   // col 13
      { x: 540,  y: 100 },   // row 2
      { x: 740,  y: 100 },   // col 18
      { x: 740,  y: 340 },   // row 8
      { x: 620,  y: 340 },   // col 15
      { x: 620,  y: 580 },   // row 14
      { x: 820,  y: 580 },   // exit right
    ],
  },
  forest: {
    id: "forest",
    name: "ป่าทึบ",
    icon: "🌲",
    difficulty: 1.35,
    grass: "#1a4a1a",
    roadColor: "#5a3d20",
    desc: "ทางคดเคี้ยวในป่า มุมหักศอกถี่",
    waypoints: [
      { x: -20,  y: 220 },   // entry left, row 5
      { x: 100,  y: 220 },   // col 2
      { x: 100,  y: 460 },   // row 11
      { x: 300,  y: 460 },   // col 7
      { x: 300,  y: 100 },   // row 2
      { x: 460,  y: 100 },   // col 11
      { x: 460,  y: 340 },   // row 8
      { x: 660,  y: 340 },   // col 16
      { x: 660,  y: 500 },   // row 12
      { x: 780,  y: 500 },   // col 19
      { x: 820,  y: 500 },   // exit right
    ],
  },
  ice_field: {
    id: "ice_field",
    name: "ทุ่งน้ำแข็ง",
    icon: "🧊",
    difficulty: 1.6,
    grass: "#a8d8ea",
    roadColor: "#74b9d4",
    desc: "ลื่นไถล แนวตรงยาว ศัตรูเดินเร็วขึ้น",
    waypoints: [
      { x: -20,  y: 100 },   // entry left, row 2
      { x: 700,  y: 100 },   // col 17
      { x: 700,  y: 220 },   // row 5
      { x: 100,  y: 220 },   // col 2
      { x: 100,  y: 340 },   // row 8
      { x: 700,  y: 340 },   // col 17
      { x: 700,  y: 500 },   // row 12
      { x: 100,  y: 500 },   // col 2
      { x: 100,  y: 620 },   // exit bottom
    ],
  },
};

const MAP_IDS = Object.keys(MAPS);

const GameMap = {
  currentId: "meadow",
  currentMap: MAPS.meadow,
  waypoints: MAPS.meadow.waypoints,
  pathWidth: 40,        // = tileSize → เส้นทางพอดีกับ 1 cell
  pathCells: new Set(), // Set ของ "col,row" ที่เป็นเส้นทาง

  load(id) {
    const map = MAPS[id];
    if (!map) return false;
    this.currentId  = id;
    this.currentMap = map;
    this.waypoints  = map.waypoints;
    this._buildPathCells();
    return true;
  },

  loadRandom(excludeId) {
    const available = MAP_IDS.filter(id => id !== excludeId);
    const pick = available[Math.floor(Math.random() * available.length)];
    return this.load(pick), pick;
  },

  // สร้าง pathCells: ทุก cell ที่เส้นทางผ่าน (ใช้ rectangle bounding box)
  _buildPathCells() {
    const ts  = CONFIG.tileSize;   // 40
    const hw  = ts / 2 - 1;       // 19 (ลบ 1 ไม่ให้ bleeding เข้า cell ข้างๆ)
    const maxCol = Math.floor(CONFIG.canvasWidth  / ts) - 1;  // 19
    const maxRow = Math.floor(CONFIG.canvasHeight / ts) - 1;  // 14
    this.pathCells = new Set();
    const wps = this.waypoints;

    for (let i = 0; i < wps.length - 1; i++) {
      const a = wps[i], b = wps[i + 1];
      const x1 = Math.min(a.x, b.x) - hw;
      const x2 = Math.max(a.x, b.x) + hw;
      const y1 = Math.min(a.y, b.y) - hw;
      const y2 = Math.max(a.y, b.y) + hw;

      const colStart = Math.max(0, Math.floor(x1 / ts));
      const colEnd   = Math.min(maxCol, Math.floor(x2 / ts));
      const rowStart = Math.max(0, Math.floor(y1 / ts));
      const rowEnd   = Math.min(maxRow, Math.floor(y2 / ts));

      for (let col = colStart; col <= colEnd; col++) {
        for (let row = rowStart; row <= rowEnd; row++) {
          this.pathCells.add(`${col},${row}`);
        }
      }
    }
  },

  // ตรวจว่า cell (cx,cy = ศูนย์กลาง) อยู่บนเส้นทางหรือเปล่า
  isCellOnPath(cx, cy) {
    const ts  = CONFIG.tileSize;
    const col = Math.floor(cx / ts);
    const row = Math.floor(cy / ts);
    return this.pathCells.has(`${col},${row}`);
  },

  // เก็บไว้เพื่อ backward-compat (ใช้ใน isOnPath เดิม)
  isOnPath(x, y) {
    return this.isCellOnPath(x, y);
  },

  _distToSegment(px, py, a, b) {
    const dx = b.x - a.x, dy = b.y - a.y;
    const lenSq = dx * dx + dy * dy;
    if (lenSq === 0) return Math.hypot(px - a.x, py - a.y);
    const t = Math.max(0, Math.min(1, ((px - a.x) * dx + (py - a.y) * dy) / lenSq));
    return Math.hypot(px - (a.x + t * dx), py - (a.y + t * dy));
  },

  draw(ctx) {
    const m  = this.currentMap;
    const ts = CONFIG.tileSize;

    // พื้นหลัง
    ctx.fillStyle = m.grass;
    ctx.fillRect(0, 0, CONFIG.canvasWidth, CONFIG.canvasHeight);

    // เส้นทาง (วาดก่อนตาราง เพื่อให้ตารางอยู่บนสุด)
    ctx.strokeStyle = m.roadColor || "#6d5b3f";
    ctx.lineWidth   = this.pathWidth;
    ctx.lineJoin    = "round";
    ctx.lineCap     = "round";
    ctx.beginPath();
    ctx.moveTo(this.waypoints[0].x, this.waypoints[0].y);
    for (let i = 1; i < this.waypoints.length; i++)
      ctx.lineTo(this.waypoints[i].x, this.waypoints[i].y);
    ctx.stroke();

    // เส้นประกลางถนน
    ctx.strokeStyle = "rgba(255,255,255,0.2)";
    ctx.lineWidth   = 2;
    ctx.setLineDash([10, 10]);
    ctx.beginPath();
    ctx.moveTo(this.waypoints[0].x, this.waypoints[0].y);
    for (let i = 1; i < this.waypoints.length; i++)
      ctx.lineTo(this.waypoints[i].x, this.waypoints[i].y);
    ctx.stroke();
    ctx.setLineDash([]);

    // ลายตาราง (วาดทับเส้นทาง)
    ctx.strokeStyle = "rgba(255,255,255,0.06)";
    ctx.lineWidth   = 1;
    for (let x = 0; x <= CONFIG.canvasWidth; x += ts) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, CONFIG.canvasHeight); ctx.stroke();
    }
    for (let y = 0; y <= CONFIG.canvasHeight; y += ts) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(CONFIG.canvasWidth, y); ctx.stroke();
    }

    // จุดเข้า
    const start = this.waypoints[0];
    const sx    = Math.max(14, start.x < 0 ? 14 : start.x);
    const sy    = Math.max(14, start.y < 0 ? 14 : start.y);
    ctx.fillStyle = "#2ecc71";
    ctx.beginPath(); ctx.arc(sx, sy, 13, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#fff"; ctx.font = "bold 10px sans-serif";
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText("เข้า", sx, sy);

    // ฐาน (จุดสุดท้าย)
    const end = this.waypoints[this.waypoints.length - 1];
    const bx  = Math.max(26, Math.min(CONFIG.canvasWidth - 26, end.x < 0 ? 26 : end.x > CONFIG.canvasWidth ? CONFIG.canvasWidth - 26 : end.x));
    const by  = Math.max(20, Math.min(CONFIG.canvasHeight - 30, end.y < 0 ? 20 : end.y > CONFIG.canvasHeight ? CONFIG.canvasHeight - 30 : end.y - 15));
    ctx.fillStyle = "#e74c3c";
    ctx.fillRect(bx - 26, by, 52, 30);
    ctx.fillStyle = "#fff"; ctx.font = "bold 11px sans-serif";
    ctx.textAlign = "center"; ctx.textBaseline = "alphabetic";
    ctx.fillText("🏠 ฐาน", bx, by + 20);
    ctx.textAlign = "start";
  },
};

// โหลดแผนที่เริ่มต้น
GameMap.load("meadow");
