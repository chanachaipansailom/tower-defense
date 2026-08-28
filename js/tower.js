// ============================================================
// tower.js — Tier-based visual + gameplay upgrades
// Ballista: 1/2/3-shot  |  Torch: watchtower→laser
// Cannon: mortar mines   |  Timewarper: clock tower aura
// ============================================================

class Tower {
  constructor(x, y, typeKey) {
    var type = TOWER_TYPES[typeKey];
    this.x = x; this.y = y;
    this.typeKey = typeKey;
    this.type = type;
    this.range = type.range;
    this.damage = type.damage;
    this.fireRate = type.fireRate;
    this.cost = type.cost;
    this.level = 1;
    this.totalInvested = type.cost;
    this.cooldown = 0;
    this.angle = 0;
    this.selected = false;
    this._animTime = 0;

    // Mortar mine management
    if (typeKey === 'cannon') {
      this._mines = [];
      this._mineTimer = 0;
    }
  }

  get canUpgrade() { return this.level < UPGRADE.maxLevel; }
  get upgradeCost() { return this.canUpgrade ? UPGRADE.costFor(this.type.cost, this.level) : null; }
  get nextStats() {
    if (!this.canUpgrade) return null;
    return {
      damage:   Math.round(this.damage   * UPGRADE.damageMult),
      range:    Math.round(this.range    * UPGRADE.rangeMult),
      fireRate: +(this.fireRate * UPGRADE.fireRateMult).toFixed(2),
    };
  }

  upgrade() {
    if (!this.canUpgrade) return false;
    this.totalInvested += this.upgradeCost;
    this.level++;
    this.damage   = Math.round(this.damage   * UPGRADE.damageMult);
    this.range    = Math.round(this.range    * UPGRADE.rangeMult);
    this.fireRate = +(this.fireRate * UPGRADE.fireRateMult).toFixed(3);
    return true;
  }

  _findTarget(enemies) {
    var targetTypes = this.type.targetType || ["ground"];
    var best = null, bestProgress = -1;
    for (var i = 0; i < enemies.length; i++) {
      var e = enemies[i];
      if (e.dead || e.reachedBase) continue;
      var eUnit = (e.type && e.type.unitType) || "ground";
      if (targetTypes.indexOf(eUnit) === -1) continue;
      if (Math.hypot(e.x - this.x, e.y - this.y) <= this.range) {
        if (e.targetIndex > bestProgress) { bestProgress = e.targetIndex; best = e; }
      }
    }
    return best;
  }

  // ── UPDATE ────────────────────────────────────────────────
  update(dt, enemies) {
    this._animTime += dt;

    if (this.typeKey === 'cannon') {
      var tier = UPGRADE.getTier(this.level);
      if (tier >= 3) {
        // T3: mortar — proactively places mines, no normal firing
        this._updateMortarMines(dt);
        return;
      }
      // T1/T2: normal cannon targeting
    }

    if (this.cooldown > 0) this.cooldown -= dt;
    var target = this._findTarget(enemies);
    if (target) {
      this.angle = Math.atan2(target.y - this.y, target.x - this.x);
      if (this.cooldown <= 0) { this._fire(target, enemies); this.cooldown = this.fireRate; }
    }
  }

  // ── FIRE ──────────────────────────────────────────────────
  _fire(target, enemies) {
    var tier = UPGRADE.getTier(this.level);
    Sound.playFire(this.typeKey);
    switch (this.typeKey) {
      case 'ballista':
        this._fireBallista(target, tier);
        break;
      case 'torch':
        if (tier >= 3) {
          this._fireLaser(enemies);
        } else {
          game.projectiles.push(new Projectile(this.x, this.y, target, this.type, this.damage));
        }
        break;
      case 'cannon':
        this._fireCannon(target, tier);
        break;
      case 'timewarper':
        this._fireAura(enemies);
        break;
      default:
        game.projectiles.push(new Projectile(this.x, this.y, target, this.type, this.damage));
    }
  }

  _fireCannon(target, tier) {
    // T1: single shot, T2: two barrels fire together (tiny spread)
    if (tier === 1) {
      game.projectiles.push(new Projectile(this.x, this.y, target, this.type, this.damage));
    } else {
      // T2: two simultaneous shots slightly spread apart
      var spread = 0.10;
      for (var i = 0; i < 2; i++) {
        var offset = (i - 0.5) * spread;
        var a = this.angle + offset;
        game.projectiles.push(new SpreadProjectile(
          this.x, this.y, a, this.type.projectileSpeed, this.type, this.damage
        ));
      }
    }
  }

  _fireBallista(target, tier) {
    // T1: 1 arrow, T2: 2 arrows, T3: 3 arrows
    if (tier === 1) {
      game.projectiles.push(new Projectile(this.x, this.y, target, this.type, this.damage));
    } else {
      var count = tier; // 2 or 3
      var spread = 0.14;
      for (var i = 0; i < count; i++) {
        var offset = (i - (count - 1) / 2) * spread;
        var a = this.angle + offset;
        game.projectiles.push(new SpreadProjectile(
          this.x, this.y, a, this.type.projectileSpeed, this.type, this.damage
        ));
      }
    }
  }

  _fireLaser(enemies) {
    var angle = this.angle;
    var range = this.range;
    var hitCount = 0;
    for (var i = 0; i < enemies.length; i++) {
      var e = enemies[i];
      if (e.dead || e.reachedBase) continue;
      var d = Math.hypot(e.x - this.x, e.y - this.y);
      if (d > range) continue;
      var ea = Math.atan2(e.y - this.y, e.x - this.x);
      var diff = Math.abs(((ea - angle + Math.PI * 3) % (Math.PI * 2)) - Math.PI);
      if (diff < 0.32) { e.takeDamage(this.damage); hitCount++; }
    }
    // If nothing in cone, hit the aimed target directly
    if (hitCount === 0) {
      var t = this._findTarget(enemies);
      if (t) t.takeDamage(this.damage);
    }
    game.effects.push(new LaserEffect(this.x, this.y, angle, range, '#ff1744'));
  }

  _fireAura(enemies) {
    // Timewarper targets all types
    var targetTypes = this.type.targetType || ["ground", "air"];
    for (var i = 0; i < enemies.length; i++) {
      var e = enemies[i];
      if (e.dead || e.reachedBase) continue;
      var eUnit = (e.type && e.type.unitType) || "ground";
      if (targetTypes.indexOf(eUnit) === -1) continue;
      if (Math.hypot(e.x - this.x, e.y - this.y) <= this.range) {
        e.slowFactor = this.type.slowFactor   || 0.4;
        e.slowTimer  = this.type.slowDuration || 1.5;
      }
    }
  }

  // ── MORTAR MINE MANAGEMENT ────────────────────────────────
  _updateMortarMines(dt) {
    var tier = UPGRADE.getTier(this.level);
    var maxMines = 3 + tier; // T1:4, T2:5, T3:6

    // Update existing mines
    for (var i = 0; i < this._mines.length; i++) {
      this._mines[i].update(dt);
    }
    this._mines = this._mines.filter(function(m) { return !m.done; });

    // Place new mines to fill up
    if (this._mines.length < maxMines) {
      this._mineTimer -= dt;
      if (this._mineTimer <= 0) {
        this._placeMine(tier);
        this._mineTimer = 0.5; // 0.5s between placements
      }
    }
  }

  _placeMine(tier) {
    var candidates = this._getPathCellsInRange();
    // Exclude cells already targeted by existing mines
    var self = this;
    candidates = candidates.filter(function(c) {
      for (var i = 0; i < self._mines.length; i++) {
        var m = self._mines[i];
        if (Math.abs(m.destX - c.x) < 5 && Math.abs(m.destY - c.y) < 5) return false;
      }
      return true;
    });
    if (candidates.length === 0) return;
    var pick = candidates[Math.floor(Math.random() * candidates.length)];
    var splashR = (this.type.splashRadius || 55) * (0.7 + tier * 0.15);
    var mine = new GroundMine(this.x, this.y, pick.x, pick.y, this.damage, splashR);
    this._mines.push(mine);
  }

  _getPathCellsInRange() {
    var ts = CONFIG.tileSize;
    var self = this;
    var candidates = [];
    if (!GameMap.pathCells) return candidates;
    GameMap.pathCells.forEach(function(key) {
      var parts = key.split(',');
      var col = parseInt(parts[0]), row = parseInt(parts[1]);
      var cx = col * ts + ts / 2, cy = row * ts + ts / 2;
      if (Math.hypot(cx - self.x, cy - self.y) <= self.range) {
        candidates.push({ x: cx, y: cy });
      }
    });
    return candidates;
  }

  // =========================================================
  //  DRAW
  // =========================================================
  draw(ctx) {
    var tier  = UPGRADE.getTier(this.level);
    var glow  = UPGRADE.glowColor(this.level);
    var pulse = 0.5 + 0.5 * Math.sin(this._animTime * 3.2);

    // Range ring (selected)
    if (this.selected) {
      ctx.save();
      ctx.beginPath(); ctx.arc(this.x, this.y, this.range, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(255,255,255,0.05)"; ctx.fill();
      ctx.strokeStyle = "rgba(255,255,255,0.55)"; ctx.lineWidth = 1.5;
      ctx.setLineDash([5, 4]); ctx.stroke(); ctx.setLineDash([]);
      ctx.restore();
    }

    // Glow rings
    if (glow) {
      ctx.save();
      ctx.shadowColor = glow; ctx.shadowBlur = 18 + 10 * pulse;
      ctx.strokeStyle = glow; ctx.globalAlpha = 0.7 + 0.3 * pulse; ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.arc(this.x, this.y, 21, 0, Math.PI * 2); ctx.stroke();
      if (tier >= 3) {
        ctx.globalAlpha = 0.3 + 0.15 * pulse; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.arc(this.x, this.y, 29, 0, Math.PI * 2); ctx.stroke();
      }
      ctx.restore();
    }

    // Draw mines on path (cannon T3 only)
    if (this.typeKey === 'cannon' && tier >= 3 && this._mines) {
      for (var mi = 0; mi < this._mines.length; mi++) {
        this._mines[mi].draw(ctx);
      }
    }

    // Body
    this._drawBody(ctx, tier, pulse);

    // Rotating weapon (not for timewarper — pure aura)
    if (this.typeKey !== 'timewarper') {
      ctx.save();
      ctx.translate(this.x, this.y);
      // Mortar (cannon T3) doesn't rotate; T1/T2 cannon rotates normally
      if (this.typeKey !== 'cannon' || tier < 3) ctx.rotate(this.angle);
      this._drawWeapon(ctx, tier, pulse);
      ctx.restore();
    }

    // Tier badge
    this._drawLevel(ctx, tier, glow);
  }

  // ── BODY ──────────────────────────────────────────────────
  _drawBody(ctx, tier, pulse) {
    if (this.typeKey === 'torch')      { this._bodyTorch(ctx, tier, pulse); return; }
    if (this.typeKey === 'timewarper') { this._bodyTimewarper(ctx, tier, pulse); return; }
    // Ballista and Cannon: disc platform
    this._bodyDisc(ctx, tier, pulse);
  }

  // Disc body (ballista / cannon) — pseudo-3D cylinder platform
  _bodyDisc(ctx, tier, pulse) {
    var x = this.x, y = this.y;
    var C = {
      ballista: { o0:'#0d2260', o1:'#1565c0', side:'#0a1a4a', i0:'#1a3a8f', i1:'#42a5f5', rim:'#90a4ae' },
      cannon:   { o0:'#1a1200', o1:'#3e2723', side:'#0e0900', i0:'#2c1810', i1:'#6d4c41', rim:'#78909c' },
    }[this.typeKey] || { o0:'#222', o1:'#444', side:'#111', i0:'#333', i1:'#666', rim:'#aaa' };
    var R = 19;

    ctx.save();

    // Cast shadow (offset lower-right)
    ctx.fillStyle = 'rgba(0,0,0,0.42)';
    ctx.beginPath(); ctx.ellipse(x+4, y+7, R+1, Math.round(R*0.62), 0, 0, Math.PI*2); ctx.fill();

    // Cylinder side wall (visible strip at bottom — gives depth)
    var wallH = 5;
    var wallG = ctx.createLinearGradient(x - R, y + R - wallH, x + R, y + R + wallH);
    wallG.addColorStop(0, C.o1);
    wallG.addColorStop(0.5, C.side);
    wallG.addColorStop(1, 'rgba(0,0,0,0.85)');
    ctx.fillStyle = wallG;
    ctx.beginPath();
    ctx.ellipse(x, y + wallH*0.6, R, Math.round(R*0.38), 0, 0, Math.PI);
    ctx.fill();

    // Top face outer ring (lit from upper-left)
    var og = ctx.createRadialGradient(x-6, y-8, 1, x+2, y+2, R*1.1);
    og.addColorStop(0, C.o1); og.addColorStop(1, C.o0);
    ctx.fillStyle = og;
    ctx.beginPath(); ctx.arc(x, y, R, 0, Math.PI*2); ctx.fill();

    // Rim edge (lit upper-left, dark lower-right)
    var rimG = ctx.createLinearGradient(x - R*0.7, y - R*0.7, x + R*0.7, y + R*0.7);
    rimG.addColorStop(0, 'rgba(220,230,245,0.65)');
    rimG.addColorStop(0.42, C.rim);
    rimG.addColorStop(1, 'rgba(0,0,0,0.55)');
    ctx.strokeStyle = rimG; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(x, y, R, 0, Math.PI*2); ctx.stroke();

    // Inner platform face
    var ig = ctx.createRadialGradient(x-5, y-7, 1, x+2, y+2, 15);
    ig.addColorStop(0, C.i1); ig.addColorStop(1, C.i0);
    ctx.fillStyle = ig;
    ctx.beginPath(); ctx.arc(x, y, 14, 0, Math.PI*2); ctx.fill();

    // Rivets (with 3D ball shading)
    for (var i=0; i<8; i++) {
      var a = (i/8)*Math.PI*2;
      var rx = x + Math.cos(a)*16.5, ry = y + Math.sin(a)*16.5;
      // Rivet shadow
      ctx.fillStyle = 'rgba(0,0,0,0.4)';
      ctx.beginPath(); ctx.arc(rx+0.8, ry+0.8, 1.7, 0, Math.PI*2); ctx.fill();
      // Rivet body
      ctx.fillStyle = C.rim;
      ctx.beginPath(); ctx.arc(rx, ry, 1.7, 0, Math.PI*2); ctx.fill();
      // Rivet highlight
      var rg = ctx.createRadialGradient(rx-0.55, ry-0.55, 0, rx, ry, 1.7);
      rg.addColorStop(0, 'rgba(255,255,255,0.55)'); rg.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = rg;
      ctx.beginPath(); ctx.arc(rx, ry, 1.7, 0, Math.PI*2); ctx.fill();
    }

    // Top-face specular shine
    var sh = ctx.createRadialGradient(x-6, y-7, 0, x-3, y-4, 13);
    sh.addColorStop(0, 'rgba(255,255,255,0.52)');
    sh.addColorStop(0.45, 'rgba(255,255,255,0.1)');
    sh.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = sh;
    ctx.beginPath(); ctx.arc(x, y, 13, 0, Math.PI*2); ctx.fill();

    // Emblem
    this._drawEmblem(ctx, x, y, tier, pulse);
    ctx.restore();
  }

  // Tower body for Torch — pseudo-3D cylindrical stone tower
  _bodyTorch(ctx, tier, pulse) {
    var x = this.x, y = this.y;
    var wallColors  = ['#546e7a','#607d8b','#78909c'];
    var wallDark    = ['#37474f','#455a64','#546e7a'];
    var innerColors = ['#4e342e','#5d4037','#6d4c41'];
    var wallC = wallColors[tier-1];
    var wallD = wallDark[tier-1];
    var innerC = innerColors[tier-1];
    var size = 16 + tier * 2;

    ctx.save();

    // Cast shadow
    ctx.fillStyle = 'rgba(0,0,0,0.38)';
    ctx.beginPath(); ctx.ellipse(x+4, y+7, size+2, Math.round((size+2)*0.58), 0, 0, Math.PI*2); ctx.fill();

    // Cylinder side wall strip (depth illusion at bottom)
    var wallH = 6;
    var wg = ctx.createLinearGradient(x, y + size - wallH, x, y + size + wallH);
    wg.addColorStop(0, wallC); wg.addColorStop(1, 'rgba(0,0,0,0.9)');
    ctx.fillStyle = wg;
    ctx.beginPath();
    ctx.ellipse(x, y + wallH*0.55, size, Math.round(size*0.35), 0, 0, Math.PI);
    ctx.fill();

    // Stone outer wall ring — lit from upper-left
    var stoneG = ctx.createLinearGradient(x - size*0.7, y - size*0.7, x + size*0.7, y + size*0.7);
    stoneG.addColorStop(0, '#90a4ae');
    stoneG.addColorStop(0.35, wallC);
    stoneG.addColorStop(1, wallD);
    ctx.strokeStyle = stoneG;
    ctx.lineWidth = 8;
    ctx.globalAlpha = 0.96;
    ctx.beginPath(); ctx.arc(x, y, size, 0, Math.PI*2); ctx.stroke();
    ctx.globalAlpha = 1;

    // Stone texture crack lines on wall
    ctx.strokeStyle = 'rgba(0,0,0,0.18)'; ctx.lineWidth = 0.8;
    for (var ci=0; ci<4; ci++) {
      var ca = (ci/4)*Math.PI*2 + 0.3;
      var cr = size - 1;
      ctx.beginPath(); ctx.moveTo(x+Math.cos(ca)*cr, y+Math.sin(ca)*cr);
      ctx.lineTo(x+Math.cos(ca+0.18)*(cr-3), y+Math.sin(ca+0.18)*(cr-3)); ctx.stroke();
    }

    // 3D Battlements — each merlon is a lit box
    var merlons = 4 + tier * 2;
    for (var i=0; i<merlons; i++) {
      var a = (i/merlons)*Math.PI*2;
      var bx = x + Math.cos(a)*size, by = y + Math.sin(a)*size;
      ctx.save(); ctx.translate(bx, by); ctx.rotate(a);
      // Merlon shadow (slightly offset)
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      ctx.fillRect(-2.5+1, -2.5+1, 6, 6);
      // Merlon top face
      var mG = ctx.createLinearGradient(-3,-3,3,3);
      mG.addColorStop(0, '#90a4ae'); mG.addColorStop(1, wallD);
      ctx.fillStyle = mG;
      ctx.fillRect(-3, -3, 6, 6);
      // Merlon highlight edge
      ctx.fillStyle = 'rgba(200,220,230,0.45)';
      ctx.fillRect(-3, -3, 6, 1.5);
      ctx.fillRect(-3, -3, 1.5, 6);
      ctx.restore();
    }

    // Courtyard floor (3D recessed look)
    var cg = ctx.createRadialGradient(x-4, y-4, 1, x, y, size-4);
    cg.addColorStop(0, innerC); cg.addColorStop(1, '#2c1400');
    ctx.fillStyle = cg;
    ctx.beginPath(); ctx.arc(x, y, size-5, 0, Math.PI*2); ctx.fill();
    // Courtyard inner rim (recessed edge shadow)
    ctx.strokeStyle = 'rgba(0,0,0,0.4)'; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.arc(x, y, size-5, 0, Math.PI*2); ctx.stroke();

    // Fire / laser core
    if (tier >= 3) {
      ctx.shadowColor = '#ff1744'; ctx.shadowBlur = 12+7*pulse;
      var lcg = ctx.createRadialGradient(x-1,y-1,0,x,y,7+2*pulse);
      lcg.addColorStop(0,'rgba(255,255,255,0.92)');
      lcg.addColorStop(0.35,'rgba(255,50,50,0.72)');
      lcg.addColorStop(1,'rgba(200,0,0,0)');
      ctx.fillStyle=lcg; ctx.beginPath(); ctx.arc(x,y,7+2*pulse,0,Math.PI*2); ctx.fill();
      ctx.shadowBlur=0;
    } else {
      var flameR = 4 + tier + 3*pulse;
      var fg = ctx.createRadialGradient(x,y,0,x,y,flameR+4);
      fg.addColorStop(0,'rgba(255,255,200,0.96)');
      fg.addColorStop(0.3,'rgba(255,160,0,0.82)');
      fg.addColorStop(0.7,'rgba(255,60,0,0.42)');
      fg.addColorStop(1,'rgba(255,60,0,0)');
      ctx.fillStyle=fg; ctx.shadowColor='#ff6d00'; ctx.shadowBlur=10+7*pulse;
      ctx.beginPath(); ctx.arc(x,y,flameR+4,0,Math.PI*2); ctx.fill();
      ctx.shadowBlur=0;
    }

    // Top surface specular
    var sh = ctx.createRadialGradient(x-5, y-6, 0, x-2, y-3, size*0.62);
    sh.addColorStop(0,'rgba(255,255,255,0.32)'); sh.addColorStop(1,'rgba(255,255,255,0)');
    ctx.fillStyle=sh; ctx.beginPath(); ctx.arc(x,y,size-4,0,Math.PI*2); ctx.fill();

    ctx.restore();
  }

  // Tower body for Timewarper — pseudo-3D crystalline purple tower
  _bodyTimewarper(ctx, tier, pulse) {
    var x = this.x, y = this.y;
    var wallColors = ['#4a148c','#6a1b9a','#7b1fa2'];
    var wallDark   = ['#2d0063','#4a0072','#560082'];
    var wallC = wallColors[tier-1];
    var wallD = wallDark[tier-1];
    var size = 16 + tier * 2;
    var t = this._animTime;

    ctx.save();

    // Aura rings (behind shadow so they look like ground effect)
    var ringColors = tier>=3 ? 'rgba(255,200,50,' : tier>=2 ? 'rgba(100,220,255,' : 'rgba(128,203,196,';
    [size+11, size+7, size+3].forEach(function(r,i) {
      var alpha = Math.max(0, 0.25 - i*0.06 + 0.15*Math.sin(t*2.5 + i*1.2));
      ctx.strokeStyle = ringColors+alpha+')';
      ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI*2); ctx.stroke();
    });

    // Cast shadow
    ctx.fillStyle = 'rgba(0,0,0,0.38)';
    ctx.beginPath(); ctx.ellipse(x+4, y+7, size+2, Math.round((size+2)*0.58), 0, 0, Math.PI*2); ctx.fill();

    // Cylinder side wall strip (purple depth)
    var wallH = 6;
    var wg = ctx.createLinearGradient(x, y + size - wallH, x, y + size + wallH);
    wg.addColorStop(0, wallC); wg.addColorStop(1, 'rgba(0,0,0,0.95)');
    ctx.fillStyle = wg;
    ctx.beginPath();
    ctx.ellipse(x, y + wallH*0.55, size, Math.round(size*0.35), 0, 0, Math.PI);
    ctx.fill();

    // Crystal wall ring — lit gradient
    var crystG = ctx.createLinearGradient(x - size*0.7, y - size*0.7, x + size*0.7, y + size*0.7);
    crystG.addColorStop(0, tier>=3 ? '#ce93d8' : '#ab47bc');
    crystG.addColorStop(0.35, wallC);
    crystG.addColorStop(1, wallD);
    ctx.strokeStyle = crystG;
    ctx.lineWidth = 8; ctx.globalAlpha = 0.96;
    ctx.beginPath(); ctx.arc(x, y, size, 0, Math.PI*2); ctx.stroke();
    ctx.globalAlpha = 1;

    // Crystal facet shimmer lines
    ctx.strokeStyle = 'rgba(200,150,255,0.22)'; ctx.lineWidth = 1;
    for (var ci=0; ci<5; ci++) {
      var ca = (ci/5)*Math.PI*2 + t*0.15;
      ctx.beginPath(); ctx.moveTo(x+Math.cos(ca)*(size-1), y+Math.sin(ca)*(size-1));
      ctx.lineTo(x+Math.cos(ca+0.2)*(size-4), y+Math.sin(ca+0.2)*(size-4)); ctx.stroke();
    }

    // 3D Battlements
    var merlons = 4 + tier * 2;
    for (var i=0; i<merlons; i++) {
      var a = (i/merlons)*Math.PI*2;
      var bx = x + Math.cos(a)*size, by = y + Math.sin(a)*size;
      ctx.save(); ctx.translate(bx, by); ctx.rotate(a);
      ctx.fillStyle = 'rgba(0,0,0,0.28)'; ctx.fillRect(-2.5+1, -2.5+1, 6, 6);
      var mG = ctx.createLinearGradient(-3,-3,3,3);
      mG.addColorStop(0, '#ce93d8'); mG.addColorStop(1, wallD);
      ctx.fillStyle = mG; ctx.fillRect(-3,-3,6,6);
      ctx.fillStyle = 'rgba(220,180,255,0.4)';
      ctx.fillRect(-3,-3,6,1.5); ctx.fillRect(-3,-3,1.5,6);
      ctx.restore();
    }

    // Inner courtyard — deep purple void
    var cg = ctx.createRadialGradient(x-4, y-4, 1, x, y, size-4);
    cg.addColorStop(0, '#3b0068'); cg.addColorStop(1, '#0d001a');
    ctx.fillStyle = cg;
    ctx.beginPath(); ctx.arc(x, y, size-5, 0, Math.PI*2); ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.45)'; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.arc(x, y, size-5, 0, Math.PI*2); ctx.stroke();

    // Clock face
    var clockC = tier>=3 ? '#ffd54f' : '#80cbc4';
    ctx.strokeStyle = clockC; ctx.lineWidth = 1.5;
    ctx.shadowColor = clockC; ctx.shadowBlur = 4;
    ctx.beginPath(); ctx.arc(x, y, 9, 0, Math.PI*2); ctx.stroke();
    ctx.shadowBlur = 0;
    // Hour ticks
    ctx.strokeStyle = 'rgba(178,235,242,0.72)'; ctx.lineWidth = 1;
    for (var ti=0; ti<12; ti++) {
      var ta = (ti/12)*Math.PI*2;
      var r1=7, r2 = (ti%3===0) ? 9 : 8;
      ctx.beginPath(); ctx.moveTo(x+Math.cos(ta)*r1, y+Math.sin(ta)*r1); ctx.lineTo(x+Math.cos(ta)*r2, y+Math.sin(ta)*r2); ctx.stroke();
    }
    // Clock hands
    var handC = tier>=3 ? '#ffd54f' : '#b2dfdb';
    ctx.strokeStyle = handC; ctx.lineWidth = 1.8; ctx.lineCap = 'round';
    ctx.shadowColor = handC; ctx.shadowBlur = 3;
    ctx.beginPath(); ctx.moveTo(x,y); ctx.lineTo(x+Math.cos(t*0.6)*5.5, y+Math.sin(t*0.6)*5.5); ctx.stroke();
    ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.moveTo(x,y); ctx.lineTo(x+Math.cos(t*5)*3.8, y+Math.sin(t*5)*3.8); ctx.stroke();
    if (tier>=3) {
      ctx.strokeStyle = 'rgba(255,180,80,0.72)'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(x,y); ctx.lineTo(x+Math.cos(-t*3)*4.2, y+Math.sin(-t*3)*4.2); ctx.stroke();
    }
    ctx.shadowBlur = 0;
    // Center jewel
    var jg = ctx.createRadialGradient(x-1,y-1,0,x,y,3.5);
    jg.addColorStop(0,'rgba(255,255,255,0.9)'); jg.addColorStop(1, tier>=3?'rgba(255,200,50,0.2)':'rgba(100,220,255,0.2)');
    ctx.fillStyle=jg; ctx.beginPath(); ctx.arc(x,y,3.5,0,Math.PI*2); ctx.fill();

    // Top specular
    var sh = ctx.createRadialGradient(x-5, y-6, 0, x-2, y-3, size*0.62);
    sh.addColorStop(0,'rgba(255,255,255,0.3)'); sh.addColorStop(1,'rgba(255,255,255,0)');
    ctx.fillStyle=sh; ctx.beginPath(); ctx.arc(x,y,size-4,0,Math.PI*2); ctx.fill();

    ctx.restore();
  }

  _drawEmblem(ctx, x, y, tier, pulse) {
    if (this.typeKey === 'ballista') {
      ctx.strokeStyle='#ffd54f'; ctx.lineWidth=2; ctx.lineCap='round'; ctx.globalAlpha=0.8;
      ctx.beginPath(); ctx.moveTo(x-3,y-3); ctx.quadraticCurveTo(x-11,y-9,x-6,y-12); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x-3,y+3); ctx.quadraticCurveTo(x-11,y+9,x-6,y+12); ctx.stroke();
      ctx.globalAlpha=1;
      ctx.strokeStyle='rgba(255,245,200,0.7)'; ctx.lineWidth=1;
      ctx.beginPath(); ctx.moveTo(x-6,y-12); ctx.lineTo(x+5,y); ctx.lineTo(x-6,y+12); ctx.stroke();
      ctx.fillStyle='#e3f2fd'; ctx.beginPath(); ctx.arc(x,y,4,0,Math.PI*2); ctx.fill();
    } else if (this.typeKey === 'cannon') {
      // Mortar crosshair
      ctx.strokeStyle='#90a4ae'; ctx.lineWidth=2.5; ctx.globalAlpha=0.7;
      ctx.beginPath(); ctx.moveTo(x-9,y); ctx.lineTo(x+9,y); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x,y-9); ctx.lineTo(x,y+9); ctx.stroke();
      ctx.globalAlpha=1;
      ctx.fillStyle='#cfd8dc'; ctx.beginPath(); ctx.arc(x,y,5,0,Math.PI*2); ctx.fill();
      ctx.strokeStyle='#546e7a'; ctx.lineWidth=1.5; ctx.stroke();
    }
  }

  // ── WEAPON (ctx translated+rotated) ──────────────────────
  _drawWeapon(ctx, tier, pulse) {
    switch (this.typeKey) {
      case 'ballista':   this._wBallista(ctx, tier, pulse); break;
      case 'torch':      this._wTorch(ctx, tier, pulse);    break;
      case 'cannon':
        if (tier >= 3)  this._wMortar(ctx, tier, pulse);
        else if (tier === 2) this._wCannon2(ctx, pulse);
        else            this._wCannon1(ctx, pulse);
        break;
    }
  }

  // ── Ballista: 1/2/3 arrows by tier — enhanced 3D wood look ──
  _wBallista(ctx, tier, pulse) {
    // Wooden trough (3D: top face lighter, shadow below)
    var bg = ctx.createLinearGradient(0,-4,0,4);
    bg.addColorStop(0,'#d4a343'); bg.addColorStop(0.45,'#8b5e13'); bg.addColorStop(1,'#3e2200');
    ctx.fillStyle = bg; ctx.fillRect(-12,-3.5,32,7);
    // Wood grain highlights
    ctx.strokeStyle = 'rgba(212,163,67,0.45)'; ctx.lineWidth = 0.8;
    ctx.beginPath(); ctx.moveTo(-10,-1.5); ctx.lineTo(18,-1.5); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-10, 1.0); ctx.lineTo(18, 1.0); ctx.stroke();
    // Trough end cap
    var eg = ctx.createLinearGradient(18,-3.5,20,3.5);
    eg.addColorStop(0,'#5c3a08'); eg.addColorStop(1,'#2c1a00');
    ctx.fillStyle=eg; ctx.fillRect(18,-3.5,2,7);

    // Bow limbs — 3D round look (wider limb w/ shadow)
    var limbW = 3 + tier * 0.6;
    ctx.shadowColor = 'rgba(0,0,0,0.4)'; ctx.shadowBlur = 3; ctx.shadowOffsetX = 1; ctx.shadowOffsetY = 1;
    ctx.strokeStyle='#3e2200'; ctx.lineWidth = limbW + 1; ctx.lineCap='round';
    ctx.beginPath(); ctx.moveTo(-9,-3); ctx.quadraticCurveTo(-18-tier*2,-14-tier*2,-7-tier,-16-tier*2); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-9, 3); ctx.quadraticCurveTo(-18-tier*2, 14+tier*2,-7-tier, 16+tier*2); ctx.stroke();
    ctx.shadowBlur=0; ctx.shadowOffsetX=0; ctx.shadowOffsetY=0;
    // Limb main color
    ctx.strokeStyle='#6d4c41'; ctx.lineWidth=limbW;
    ctx.beginPath(); ctx.moveTo(-9,-3); ctx.quadraticCurveTo(-18-tier*2,-14-tier*2,-7-tier,-16-tier*2); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-9, 3); ctx.quadraticCurveTo(-18-tier*2, 14+tier*2,-7-tier, 16+tier*2); ctx.stroke();
    // Limb sheen
    ctx.strokeStyle='rgba(212,163,67,0.55)'; ctx.lineWidth = Math.max(1,limbW*0.4);
    ctx.beginPath(); ctx.moveTo(-9,-3.2); ctx.quadraticCurveTo(-17-tier*2,-13-tier*2,-7-tier,-16-tier*2); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-9, 3.2); ctx.quadraticCurveTo(-17-tier*2, 13+tier*2,-7-tier, 16+tier*2); ctx.stroke();
    // Bowstring
    ctx.strokeStyle='rgba(255,245,200,0.92)'; ctx.lineWidth=1.2;
    ctx.beginPath(); ctx.moveTo(-7-tier,-16-tier*2); ctx.lineTo(10,0); ctx.lineTo(-7-tier,16+tier*2); ctx.stroke();

    // Arrows
    var arrowOffsets = tier===3 ? [-5,0,5] : tier===2 ? [-3.5,3.5] : [0];
    for (var ai=0; ai<arrowOffsets.length; ai++) {
      var oy = arrowOffsets[ai];
      // Shaft (3D rounded)
      var shG = ctx.createLinearGradient(6,oy-1.5,6,oy+1.5);
      shG.addColorStop(0,'#ffe082'); shG.addColorStop(0.5,'#d4a343'); shG.addColorStop(1,'#8b5e13');
      ctx.fillStyle=shG; ctx.fillRect(6,oy-1.5,18,3);
      // Metal tip
      var tipG = ctx.createLinearGradient(20,oy-3,24,oy+3);
      tipG.addColorStop(0,'#eceff1'); tipG.addColorStop(1,'#78909c');
      ctx.fillStyle=tipG;
      ctx.beginPath(); ctx.moveTo(24,oy); ctx.lineTo(20,oy-3.5); ctx.lineTo(20,oy+3.5); ctx.closePath(); ctx.fill();
      ctx.strokeStyle='rgba(255,255,255,0.3)'; ctx.lineWidth=0.8;
      ctx.beginPath(); ctx.moveTo(24,oy); ctx.lineTo(20.5,oy-2.5); ctx.stroke();
      // Fletching
      ctx.fillStyle = ai===0 ? '#e53935' : '#c62828';
      ctx.beginPath(); ctx.moveTo(8,oy); ctx.lineTo(4,oy-4.5); ctx.lineTo(6,oy); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.moveTo(8,oy); ctx.lineTo(4,oy+4.5); ctx.lineTo(6,oy); ctx.closePath(); ctx.fill();
    }
  }

  // ── Torch weapon: fire spout (T1/T2) or laser emitter (T3) ──
  _wTorch(ctx, tier, pulse) {
    if (tier >= 3) {
      // Laser emitter — thin metal barrel with red glow tip
      var lg=ctx.createLinearGradient(0,-3,0,3);
      lg.addColorStop(0,'#b0bec5'); lg.addColorStop(1,'#37474f');
      ctx.fillStyle=lg; ctx.fillRect(0,-3,28,6);
      // Barrel rings
      ctx.fillStyle='#546e7a'; ctx.fillRect(2,-3.5,4,7); ctx.fillRect(12,-3.5,4,7); ctx.fillRect(22,-3.5,4,7);
      // Glow tip
      ctx.shadowColor='#ff1744'; ctx.shadowBlur=14+8*pulse;
      var ltg=ctx.createRadialGradient(28,0,0,28,0,7+3*pulse);
      ltg.addColorStop(0,'rgba(255,255,255,0.95)');
      ltg.addColorStop(0.4,'rgba(255,50,50,0.8)');
      ltg.addColorStop(1,'rgba(255,0,0,0)');
      ctx.fillStyle=ltg; ctx.beginPath(); ctx.arc(28,0,7+3*pulse,0,Math.PI*2); ctx.fill();
      ctx.shadowBlur=0;
    } else {
      // Fire spout — short barrel + flame
      var hg=ctx.createLinearGradient(0,-3,0,3);
      hg.addColorStop(0,'#a1887f'); hg.addColorStop(1,'#4e342e');
      ctx.fillStyle=hg; ctx.fillRect(0,-3,16,6);
      // Bowl
      ctx.fillStyle='#5d4037';
      ctx.beginPath(); ctx.moveTo(14,-5); ctx.lineTo(20,-6); ctx.lineTo(20,6); ctx.lineTo(14,5); ctx.closePath(); ctx.fill();
      // Flame
      var flameH = 9+3*pulse + (tier===2 ? 4 : 0);
      var fg=ctx.createRadialGradient(20,0,0,20,0,flameH);
      fg.addColorStop(0,'rgba(255,255,200,0.95)'); fg.addColorStop(0.3,'rgba(255,160,0,0.85)');
      fg.addColorStop(0.7,'rgba(255,60,0,0.5)'); fg.addColorStop(1,'rgba(255,60,0,0)');
      ctx.fillStyle=fg; ctx.shadowColor='#ff6d00'; ctx.shadowBlur=10+7*pulse;
      ctx.beginPath(); ctx.arc(20,0,flameH,0,Math.PI*2); ctx.fill();
      ctx.shadowBlur=0;
      // Second flame lobe at T2
      if (tier>=2) {
        ctx.beginPath(); ctx.arc(20,-5,7+2*pulse,0,Math.PI*2); ctx.fill();
        ctx.beginPath(); ctx.arc(20, 5,7+2*pulse,0,Math.PI*2); ctx.fill();
      }
      ctx.fillStyle='rgba(255,255,200,0.9)'; ctx.beginPath(); ctx.arc(20,0,4+2*pulse,0,Math.PI*2); ctx.fill();
    }
  }

  // ── Cannon T1: single barrel — 3D cylindrical barrel ──
  _wCannon1(ctx, pulse) {
    // Barrel top face gradient (light = top, dark = bottom)
    var bg = ctx.createLinearGradient(0, -6, 0, 6);
    bg.addColorStop(0, '#bdbdbd'); bg.addColorStop(0.35, '#616161'); bg.addColorStop(1, '#1a1a1a');
    ctx.fillStyle = bg;
    ctx.fillRect(-2, -5.5, 29, 11);
    // Barrel highlight stripe (top edge)
    ctx.fillStyle = 'rgba(255,255,255,0.18)'; ctx.fillRect(2,-5,20,2.5);
    // Barrel shadow stripe (bottom edge)
    ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.fillRect(2,3,20,2);
    // Reinforcement bands (ring-shaped bands give cylindrical look)
    ctx.fillStyle = '#424242';
    ctx.fillRect(4,-6.2,3.5,12.4); ctx.fillRect(14,-6.2,3.5,12.4);
    ctx.fillStyle = 'rgba(180,180,180,0.35)';
    ctx.fillRect(4,-6.2,3.5,3); ctx.fillRect(14,-6.2,3.5,3);
    // Muzzle flare
    ctx.fillStyle = '#424242'; ctx.fillRect(22,-7,6,14);
    ctx.fillStyle = 'rgba(200,200,200,0.3)';
    ctx.fillRect(22,-7,6,3.5);
    // Muzzle bore (dark ellipse)
    ctx.fillStyle = '#111';
    ctx.beginPath(); ctx.ellipse(28,0,5,7,0,0,Math.PI*2); ctx.fill();
    ctx.strokeStyle = '#616161'; ctx.lineWidth=1.5; ctx.stroke();
    // Bore inner glow hint
    ctx.fillStyle = 'rgba(90,50,0,0.25)';
    ctx.beginPath(); ctx.ellipse(28,0,3.5,5,0,0,Math.PI*2); ctx.fill();
    // Breech block
    var brG = ctx.createLinearGradient(-2,-7,5,7);
    brG.addColorStop(0,'#78909c'); brG.addColorStop(1,'#37474f');
    ctx.fillStyle=brG; ctx.fillRect(-3,-7,8,14);
    ctx.strokeStyle='#546e7a'; ctx.lineWidth=1; ctx.strokeRect(-3,-7,8,14);
    ctx.fillStyle='rgba(255,255,255,0.22)'; ctx.fillRect(-2,-6,4,4);
    // Cannonball visible inside barrel
    var bomG = ctx.createRadialGradient(18,-1.5,0,18.5,0,5);
    bomG.addColorStop(0,'#bdbdbd'); bomG.addColorStop(0.5,'#616161'); bomG.addColorStop(1,'#1a1a1a');
    ctx.fillStyle=bomG;
    ctx.beginPath(); ctx.arc(18,0,5,0,Math.PI*2); ctx.fill();
    ctx.fillStyle='rgba(255,255,255,0.22)';
    ctx.beginPath(); ctx.arc(16,-2,2,0,Math.PI*2); ctx.fill();
  }

  // ── Cannon T2: twin barrels — 3D cylindrical pair ──
  _wCannon2(ctx, pulse) {
    var offsets = [-7, 7];
    for (var i = 0; i < 2; i++) {
      var oy = offsets[i];
      // Barrel body
      var bg = ctx.createLinearGradient(0, oy-4.5, 0, oy+4.5);
      bg.addColorStop(0, '#bdbdbd'); bg.addColorStop(0.35, '#616161'); bg.addColorStop(1, '#1a1a1a');
      ctx.fillStyle=bg; ctx.fillRect(-2,oy-4.5,26,9);
      // Top highlight
      ctx.fillStyle='rgba(255,255,255,0.18)'; ctx.fillRect(2,oy-4.5,18,2.5);
      // Bottom shadow
      ctx.fillStyle='rgba(0,0,0,0.28)'; ctx.fillRect(2,oy+2.5,18,2);
      // Reinforcement bands
      ctx.fillStyle='#455a64'; ctx.fillRect(7,oy-5.2,3,10.4); ctx.fillRect(15,oy-5.2,3,10.4);
      ctx.fillStyle='rgba(180,200,210,0.3)';
      ctx.fillRect(7,oy-5.2,3,2.5); ctx.fillRect(15,oy-5.2,3,2.5);
      // Muzzle bore
      ctx.fillStyle='#111';
      ctx.beginPath(); ctx.ellipse(24,oy,4,5,0,0,Math.PI*2); ctx.fill();
      ctx.strokeStyle='#616161'; ctx.lineWidth=1; ctx.stroke();
      ctx.fillStyle='rgba(90,50,0,0.2)';
      ctx.beginPath(); ctx.ellipse(24,oy,2.5,3.5,0,0,Math.PI*2); ctx.fill();
    }
    // Shared breech block (3D box)
    var breechG = ctx.createLinearGradient(-4,-12,4,12);
    breechG.addColorStop(0,'#78909c'); breechG.addColorStop(0.5,'#546e7a'); breechG.addColorStop(1,'#263238');
    ctx.fillStyle=breechG; ctx.fillRect(-5,-12,9,24);
    ctx.strokeStyle='#455a64'; ctx.lineWidth=1.5; ctx.strokeRect(-5,-12,9,24);
    // Breech specular
    ctx.fillStyle='rgba(255,255,255,0.2)'; ctx.fillRect(-4,-11,4,22);
    // Barrel lock bolts on breech
    ctx.fillStyle='#90a4ae';
    ctx.beginPath(); ctx.arc(-1,-5.5,2,0,Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.arc(-1,5.5,2,0,Math.PI*2); ctx.fill();
    ctx.fillStyle='rgba(255,255,255,0.35)';
    ctx.beginPath(); ctx.arc(-1.5,-6,0.8,0,Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.arc(-1.5,5,0.8,0,Math.PI*2); ctx.fill();
  }

  // ── Mortar: upward-angled fat barrel (static, no rotation) ──
  _wMortar(ctx, tier, pulse) {
    // Tilt the mortar up visually
    ctx.save(); ctx.rotate(-0.45);
    var barrelW = 8 + tier * 2;
    var barrelL = 14 + tier * 2;

    // Barrel
    var bg=ctx.createLinearGradient(0,-barrelW,0,barrelW);
    bg.addColorStop(0,'#9e9e9e'); bg.addColorStop(0.5,'#424242'); bg.addColorStop(1,'#212121');
    ctx.fillStyle=bg; ctx.fillRect(4,-barrelW,barrelL,barrelW*2);
    ctx.fillStyle='#616161';
    ctx.fillRect(4,-barrelW-1,4,barrelW*2+2); ctx.fillRect(13,-barrelW-1,4,barrelW*2+2);
    // Muzzle
    ctx.fillStyle='#111';
    ctx.beginPath(); ctx.ellipse(4+barrelL,0,barrelW-1,barrelW+2,0,0,Math.PI*2); ctx.fill();
    ctx.strokeStyle='#757575'; ctx.lineWidth=2; ctx.stroke();

    // Bomb in barrel (visible round)
    var br=barrelW-1;
    var bomG=ctx.createRadialGradient(4+barrelL-2,-3,0,4+barrelL,0,br);
    bomG.addColorStop(0,'#9e9e9e'); bomG.addColorStop(1,'#212121');
    ctx.fillStyle=bomG; ctx.beginPath(); ctx.arc(4+barrelL,0,br,0,Math.PI*2); ctx.fill();
    // Fuse
    ctx.strokeStyle='#ff8f00'; ctx.lineWidth=1.5; ctx.lineCap='round';
    ctx.shadowColor='#ff6d00'; ctx.shadowBlur=4+3*pulse;
    ctx.beginPath(); ctx.moveTo(4+barrelL,-(br)); ctx.bezierCurveTo(4+barrelL+3,-br-4,4+barrelL+5,-br-2,4+barrelL+4,-br+2); ctx.stroke();
    ctx.shadowBlur=0;
    // Spark
    ctx.fillStyle='rgba(255,220,50,'+(0.7+0.3*pulse)+')';
    ctx.shadowColor='#ffcc00'; ctx.shadowBlur=4;
    ctx.beginPath(); ctx.arc(4+barrelL+4,-br+2,1.5+pulse*0.5,0,Math.PI*2); ctx.fill();
    ctx.shadowBlur=0;
    ctx.restore();

    // Stabiliser legs
    ctx.strokeStyle='#546e7a'; ctx.lineWidth=3; ctx.lineCap='round';
    ctx.beginPath(); ctx.moveTo(-4,0); ctx.lineTo(-12,12); ctx.stroke();
    ctx.beginPath(); ctx.moveTo( 4,0); ctx.lineTo( 12,12); ctx.stroke();
  }

  // ── TIER BADGE ────────────────────────────────────────────
  _drawLevel(ctx, tier, glow) {
    if (this.level <= 1) return;
    var x = this.x, y = this.y;
    var color = glow || '#ffd369';
    var badgeY = y - 26;

    ctx.save();
    ctx.fillStyle='rgba(0,0,0,0.72)'; ctx.strokeStyle=color; ctx.lineWidth=1.5;
    ctx.beginPath(); ctx.arc(x,badgeY,9,0,Math.PI*2); ctx.fill();
    if (glow) { ctx.shadowColor=color; ctx.shadowBlur=8; }
    ctx.stroke(); ctx.shadowBlur=0;

    ctx.font='bold 8px sans-serif'; ctx.textAlign='center'; ctx.textBaseline='middle';
    ctx.fillStyle=color;
    if (glow) { ctx.shadowColor=color; ctx.shadowBlur=6; }
    ctx.fillText(tier>=3 ? '★★★' : tier>=2 ? '★★' : '★', x, badgeY);
    ctx.restore();

    // Tier name at T2+
    if (tier >= 2) {
      var tName = UPGRADE.tierName(this.type, this.level);
      if (tName) {
        ctx.save();
        ctx.font='8px sans-serif'; ctx.textAlign='center'; ctx.textBaseline='top';
        ctx.fillStyle='rgba(0,0,0,0.65)'; ctx.fillText(tName,x+1,y+22+1);
        ctx.fillStyle=color; ctx.fillText(tName,x,y+22);
        ctx.restore();
      }
    }
  }

  _blendColor(base,glow){return glow;}
}
