// ============================================================
// projectile.js - กระสุนและเอฟเฟกต์ Endless Siege
// ============================================================

// ── กระสุนทั่วไป (ติดตามเป้าหมาย) ───────────────────────────
class Projectile {
  constructor(x, y, target, towerType, damage) {
    this.x = x; this.y = y;
    this.target = target;
    this.towerType = towerType;
    this.speed = towerType.projectileSpeed;
    this.damage = damage != null ? damage : towerType.damage;
    this.color = towerType.projectileColor;
    this.done = false;
    this.angle = Math.atan2(target.y - y, target.x - x);
  }

  update(dt) {
    if (!this.target || this.target.dead || this.target.reachedBase) { this.done = true; return; }
    const dx = this.target.x - this.x, dy = this.target.y - this.y;
    const dist = Math.hypot(dx, dy);
    const step = this.speed * dt;
    this.angle = Math.atan2(dy, dx);
    if (dist <= step) { this._hit(); this.done = true; }
    else { this.x += (dx / dist) * step; this.y += (dy / dist) * step; }
  }

  _hit() {
    const t = this.towerType;
    if (t.special === "burn") {
      this.target.takeDamage(this.damage);
      this.target.applyBurn(t.burnDamage, t.burnDuration);
    } else if (t.special === "splash") {
      for (const e of game.enemies) {
        if (e.dead || e.reachedBase) continue;
        if (Math.hypot(e.x - this.target.x, e.y - this.target.y) <= t.splashRadius) e.takeDamage(this.damage);
      }
      game.effects.push(new ExplosionEffect(this.target.x, this.target.y, t.splashRadius));
    } else {
      this.target.takeDamage(this.damage);
    }
  }

  draw(ctx) {
    const key = this.towerType.key;
    ctx.save(); ctx.translate(this.x, this.y); ctx.rotate(this.angle);
    if (key === "ballista")    this._drawArrow(ctx);
    else if (key === "torch")  this._drawFlame(ctx);
    else if (key === "cannon") this._drawCannonball(ctx);
    else {
      ctx.fillStyle = this.color;
      ctx.beginPath(); ctx.arc(0, 0, 5, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  }

  _drawArrow(ctx) {
    ctx.strokeStyle = "#a0522d"; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(-10, 0); ctx.lineTo(6, 0); ctx.stroke();
    ctx.fillStyle = "#cddc39";
    ctx.beginPath(); ctx.moveTo(10, 0); ctx.lineTo(4, -3); ctx.lineTo(4, 3); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = "#8bc34a"; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(-8, 0); ctx.lineTo(-12, -3); ctx.moveTo(-8, 0); ctx.lineTo(-12, 3); ctx.stroke();
  }

  _drawFlame(ctx) {
    const r = 6;
    const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, r * 2);
    grad.addColorStop(0, "#fff"); grad.addColorStop(0.3, "#ffeb3b");
    grad.addColorStop(0.7, "#ff5722"); grad.addColorStop(1, "rgba(255,87,34,0)");
    ctx.fillStyle = grad; ctx.beginPath(); ctx.arc(0, 0, r * 2, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(0, 0, 2, 0, Math.PI * 2); ctx.fill();
  }

  _drawCannonball(ctx) {
    const r = 7;
    const grad = ctx.createRadialGradient(-2, -2, 0, 0, 0, r);
    grad.addColorStop(0, "#888"); grad.addColorStop(0.5, "#333"); grad.addColorStop(1, "#111");
    ctx.fillStyle = grad; ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,0.25)"; ctx.beginPath(); ctx.arc(-2, -2, 3, 0, Math.PI * 2); ctx.fill();
  }
}

// ── Spread Arrow (Ballista T2/T3: multi-shot) ─────────────────
class SpreadProjectile {
  constructor(x, y, angle, speed, towerType, damage) {
    this.x = x; this.y = y;
    this.angle = angle;
    this.vx = Math.cos(angle) * speed;
    this.vy = Math.sin(angle) * speed;
    this.speed = speed;
    this.towerType = towerType;
    this.damage = damage;
    this.maxDist = towerType.range * 1.4;
    this.traveled = 0;
    this.done = false;
  }

  update(dt) {
    const step = this.speed * dt;
    this.x += this.vx * dt; this.y += this.vy * dt;
    this.traveled += step;
    if (this.traveled >= this.maxDist) { this.done = true; return; }
    for (const e of game.enemies) {
      if (e.dead || e.reachedBase) continue;
      if (Math.hypot(e.x - this.x, e.y - this.y) <= (e.radius || 14) + 5) {
        this._hitEnemy(e);
        this.done = true; return;
      }
    }
  }

  _hitEnemy(hitEnemy) {
    const t = this.towerType;
    if (t.special === 'splash') {
      for (const e of game.enemies) {
        if (e.dead || e.reachedBase) continue;
        if (Math.hypot(e.x - hitEnemy.x, e.y - hitEnemy.y) <= t.splashRadius) e.takeDamage(this.damage);
      }
      game.effects.push(new ExplosionEffect(hitEnemy.x, hitEnemy.y, t.splashRadius));
    } else if (t.special === 'burn') {
      hitEnemy.takeDamage(this.damage);
      hitEnemy.applyBurn(t.burnDamage, t.burnDuration);
    } else {
      hitEnemy.takeDamage(this.damage);
    }
  }

  draw(ctx) {
    ctx.save(); ctx.translate(this.x, this.y); ctx.rotate(this.angle);
    const key = this.towerType.key;
    if (key === 'cannon') {
      // Small cannonball
      const r = 6;
      const grad = ctx.createRadialGradient(-2, -2, 0, 0, 0, r);
      grad.addColorStop(0, '#888'); grad.addColorStop(0.5, '#333'); grad.addColorStop(1, '#111');
      ctx.fillStyle = grad; ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.2)'; ctx.beginPath(); ctx.arc(-2, -2, 2.5, 0, Math.PI * 2); ctx.fill();
    } else {
      // Default: arrow
      ctx.strokeStyle = "#a0522d"; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(-10, 0); ctx.lineTo(6, 0); ctx.stroke();
      ctx.fillStyle = "#cddc39";
      ctx.beginPath(); ctx.moveTo(10, 0); ctx.lineTo(4, -3); ctx.lineTo(4, 3); ctx.closePath(); ctx.fill();
    }
    ctx.restore();
  }
}

// ── Mine (Cannon T2) ─────────────────────────────────────────
class MineProjectile {
  constructor(x, y, target, towerType, damage) {
    this.x = x; this.y = y;
    this.destX = target.x; this.destY = target.y;
    this.towerType = towerType;
    this.damage = damage;
    this.speed = towerType.projectileSpeed * 0.6;
    this.angle = Math.atan2(target.y - y, target.x - x);
    this.planted = false;
    this.plantTimer = 5;
    this.detonRadius = 50;
    this.done = false;
    this._animTime = 0;
  }

  update(dt) {
    this._animTime += dt;
    if (!this.planted) {
      const dx = this.destX - this.x, dy = this.destY - this.y;
      const dist = Math.hypot(dx, dy);
      const step = this.speed * dt;
      if (dist <= step) { this.x = this.destX; this.y = this.destY; this.planted = true; }
      else { this.x += (dx / dist) * step; this.y += (dy / dist) * step; }
    } else {
      this.plantTimer -= dt;
      if (this.plantTimer <= 0) { this.done = true; return; }
      for (const e of game.enemies) {
        if (e.dead || e.reachedBase) continue;
        if (Math.hypot(e.x - this.x, e.y - this.y) <= this.detonRadius) { this._explode(); return; }
      }
    }
  }

  _explode() {
    for (const e of game.enemies) {
      if (e.dead || e.reachedBase) continue;
      if (Math.hypot(e.x - this.x, e.y - this.y) <= this.detonRadius) e.takeDamage(this.damage * 1.5);
    }
    game.effects.push(new ExplosionEffect(this.x, this.y, this.detonRadius));
    this.done = true;
  }

  draw(ctx) {
    if (!this.planted) {
      ctx.save(); ctx.translate(this.x, this.y);
      ctx.fillStyle = "#5d4037";
      ctx.beginPath(); ctx.arc(0, 0, 5, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = "#ffeb3b"; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(0, 0, 5, 0, Math.PI * 2); ctx.stroke();
      ctx.restore();
    } else {
      const blink = Math.sin(this._animTime * 8) > 0;
      ctx.save(); ctx.translate(this.x, this.y);
      ctx.fillStyle = blink ? "#f57f17" : "#5d4037";
      ctx.beginPath(); ctx.arc(0, 0, 7, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = "#ffeb3b"; ctx.lineWidth = 2;
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        ctx.beginPath();
        ctx.moveTo(Math.cos(a) * 7, Math.sin(a) * 7);
        ctx.lineTo(Math.cos(a) * 11, Math.sin(a) * 11);
        ctx.stroke();
      }
      ctx.restore();
    }
  }
}

// ── Rocket (Cannon T3) ────────────────────────────────────────
class RocketProjectile {
  constructor(x, y, target, towerType, damage) {
    this.x = x; this.y = y;
    this.target = target;
    this.towerType = towerType;
    this.damage = damage;
    this.speed = towerType.projectileSpeed * 0.7;
    this.angle = Math.atan2(target.y - y, target.x - x);
    this.done = false;
  }

  update(dt) {
    if (!this.target || this.target.dead || this.target.reachedBase) { this.done = true; return; }
    const dx = this.target.x - this.x, dy = this.target.y - this.y;
    const dist = Math.hypot(dx, dy);
    const step = this.speed * dt;
    this.angle = Math.atan2(dy, dx);
    if (dist <= step) {
      const splashR = (this.towerType.splashRadius || 55) * 1.5;
      for (const e of game.enemies) {
        if (e.dead || e.reachedBase) continue;
        if (Math.hypot(e.x - this.target.x, e.y - this.target.y) <= splashR) e.takeDamage(this.damage * 1.5);
      }
      game.effects.push(new ExplosionEffect(this.target.x, this.target.y, splashR));
      this.done = true;
    } else {
      this.x += (dx / dist) * step; this.y += (dy / dist) * step;
    }
  }

  draw(ctx) {
    ctx.save(); ctx.translate(this.x, this.y); ctx.rotate(this.angle);
    ctx.fillStyle = "#ef5350"; ctx.fillRect(-10, -3, 18, 6);
    ctx.fillStyle = "#b71c1c";
    ctx.beginPath(); ctx.moveTo(8, 0); ctx.lineTo(14, -4); ctx.lineTo(14, 4); ctx.closePath(); ctx.fill();
    ctx.fillStyle = "#757575";
    ctx.beginPath(); ctx.moveTo(-10, 0); ctx.lineTo(-14, -5); ctx.lineTo(-8, -3); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(-10, 0); ctx.lineTo(-14, 5); ctx.lineTo(-8, 3); ctx.closePath(); ctx.fill();
    ctx.fillStyle = "#ff9800"; ctx.shadowColor = "#ff9800"; ctx.shadowBlur = 8;
    ctx.beginPath(); ctx.moveTo(-10, -2); ctx.lineTo(-16, 0); ctx.lineTo(-10, 2); ctx.closePath(); ctx.fill();
    ctx.shadowBlur = 0;
    ctx.restore();
  }
}

// ── GroundMine (Mortar Cannon) ────────────────────────────────
// Flies in an arc from tower to target path cell, lands and waits.
// Explodes when an enemy steps on it; triggers a replacement mine.
class GroundMine {
  constructor(srcX, srcY, destX, destY, damage, splashRadius) {
    this.srcX = srcX; this.srcY = srcY;
    this.destX = destX; this.destY = destY;
    this.x = srcX; this.y = srcY;
    this.damage = damage;
    this.splashRadius = splashRadius || 55;
    this.done = false;
    this.landed = false;
    this._animTime = 0;
    // Arc flight: duration based on distance
    var dist = Math.hypot(destX - srcX, destY - srcY);
    this._flightDur = Math.max(0.4, dist / 300);
    this._flightT = 0;
    // Arc height proportional to distance
    this._arcHeight = Math.min(60, dist * 0.35);
  }

  update(dt) {
    this._animTime += dt;
    if (!this.landed) {
      this._flightT += dt;
      var t = Math.min(1, this._flightT / this._flightDur);
      // Linear interpolation + parabolic arc
      this.x = this.srcX + (this.destX - this.srcX) * t;
      this.y = this.srcY + (this.destY - this.srcY) * t - this._arcHeight * 4 * t * (1 - t);
      if (t >= 1) {
        this.x = this.destX;
        this.y = this.destY;
        this.landed = true;
      }
      return;
    }
    // Check for enemy contact — all unit types (ground + air) trigger the mine
    for (var i = 0; i < game.enemies.length; i++) {
      var e = game.enemies[i];
      if (e.dead || e.reachedBase) continue;
      // Air enemies float visually but their path coords are the same; use a
      // slightly larger trigger radius so the explosion feels fair for flyers.
      var triggerR = (e.radius || 14) + (e.isAir ? 18 : 10);
      if (Math.hypot(e.x - this.destX, e.y - this.destY) <= triggerR) {
        this._explode();
        return;
      }
    }
  }

  _explode() {
    // Splash damages ALL enemy types within radius (ground and air)
    for (var i = 0; i < game.enemies.length; i++) {
      var e = game.enemies[i];
      if (e.dead || e.reachedBase) continue;
      if (Math.hypot(e.x - this.destX, e.y - this.destY) <= this.splashRadius) {
        e.takeDamage(this.damage);
      }
    }
    game.effects.push(new ExplosionEffect(this.destX, this.destY, this.splashRadius));
    this.done = true;
  }

  draw(ctx) {
    if (!this.landed) {
      // Draw flying bomb (small sphere with fuse spark)
      ctx.save();
      ctx.translate(this.x, this.y);
      // Shadow on ground
      var t = Math.min(1, this._flightT / this._flightDur);
      var gx = this.srcX + (this.destX - this.srcX) * t;
      var gy = this.srcY + (this.destY - this.srcY) * t;
      ctx.save();
      ctx.translate(gx - this.x, gy - this.y);
      var shadowScale = 0.3 + 0.7 * t;
      ctx.globalAlpha = 0.2 * t;
      ctx.fillStyle = '#000';
      ctx.scale(shadowScale, shadowScale * 0.5);
      ctx.beginPath(); ctx.arc(0, 0, 6, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
      ctx.globalAlpha = 1;
      // Bomb body
      var bg = ctx.createRadialGradient(-2, -2, 0, 0, 0, 6);
      bg.addColorStop(0, '#9e9e9e'); bg.addColorStop(0.6, '#424242'); bg.addColorStop(1, '#1a1a1a');
      ctx.fillStyle = bg;
      ctx.beginPath(); ctx.arc(0, 0, 6, 0, Math.PI * 2); ctx.fill();
      // Fuse
      ctx.strokeStyle = '#ff8f00'; ctx.lineWidth = 1.5; ctx.lineCap = 'round';
      ctx.shadowColor = '#ff6d00'; ctx.shadowBlur = 4;
      ctx.beginPath(); ctx.moveTo(0, -6); ctx.bezierCurveTo(3, -9, 5, -8, 4, -11); ctx.stroke();
      // Spark
      var sp = 0.6 + 0.4 * Math.sin(this._animTime * 30);
      ctx.fillStyle = 'rgba(255,220,50,' + sp + ')';
      ctx.shadowColor = '#ffcc00'; ctx.shadowBlur = 5;
      ctx.beginPath(); ctx.arc(4, -11, 2, 0, Math.PI * 2); ctx.fill();
      ctx.shadowBlur = 0;
      ctx.restore();
    } else {
      // Planted mine — circular device on path
      var blink = Math.sin(this._animTime * 5) > 0;
      ctx.save();
      ctx.translate(this.destX, this.destY);
      // Outer ring
      ctx.strokeStyle = blink ? '#ff6d00' : '#546e7a';
      ctx.lineWidth = 2;
      ctx.globalAlpha = 0.85;
      ctx.beginPath(); ctx.arc(0, 0, 9, 0, Math.PI * 2); ctx.stroke();
      // Body
      var mg = ctx.createRadialGradient(-2, -2, 0, 0, 0, 7);
      mg.addColorStop(0, '#616161'); mg.addColorStop(1, '#212121');
      ctx.fillStyle = mg; ctx.globalAlpha = 0.9;
      ctx.beginPath(); ctx.arc(0, 0, 7, 0, Math.PI * 2); ctx.fill();
      // Cross indicator
      ctx.strokeStyle = blink ? '#ff3d00' : '#90a4ae';
      ctx.lineWidth = 1.5; ctx.globalAlpha = 0.8;
      ctx.beginPath(); ctx.moveTo(-4, 0); ctx.lineTo(4, 0); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, -4); ctx.lineTo(0, 4); ctx.stroke();
      // Center dot
      ctx.fillStyle = blink ? '#ff3d00' : '#cfd8dc';
      ctx.globalAlpha = 1;
      ctx.beginPath(); ctx.arc(0, 0, 2.5, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 1;
      ctx.restore();
    }
  }
}

// ── LaserEffect (Torch T3 weapon) ─────────────────────────────
// Hitscan beam that flashes for a short duration.
class LaserEffect {
  constructor(x, y, angle, range, color) {
    this.x = x; this.y = y;
    this.angle = angle;
    this.range = range;
    this.color = color || '#ff1744';
    this.life = 0.12;
    this.maxLife = 0.12;
    this.done = false;
  }

  update(dt) {
    this.life -= dt;
    if (this.life <= 0) this.done = true;
  }

  draw(ctx) {
    var alpha = this.life / this.maxLife;
    var ex = this.x + Math.cos(this.angle) * this.range;
    var ey = this.y + Math.sin(this.angle) * this.range;

    ctx.save();
    ctx.globalAlpha = alpha;

    // Outer glow beam
    ctx.strokeStyle = this.color;
    ctx.lineWidth = 6 * alpha + 2;
    ctx.lineCap = 'round';
    ctx.shadowColor = this.color;
    ctx.shadowBlur = 18 * alpha;
    ctx.globalAlpha = alpha * 0.4;
    ctx.beginPath(); ctx.moveTo(this.x, this.y); ctx.lineTo(ex, ey); ctx.stroke();

    // Core beam
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = '#ff8a80';
    ctx.lineWidth = 2;
    ctx.shadowBlur = 8;
    ctx.beginPath(); ctx.moveTo(this.x, this.y); ctx.lineTo(ex, ey); ctx.stroke();

    // Hot white center
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1;
    ctx.shadowColor = '#ffffff';
    ctx.shadowBlur = 4;
    ctx.globalAlpha = alpha * 0.8;
    ctx.beginPath(); ctx.moveTo(this.x, this.y); ctx.lineTo(ex, ey); ctx.stroke();

    // Impact bloom at end
    ctx.globalAlpha = alpha * 0.6;
    var bloom = ctx.createRadialGradient(ex, ey, 0, ex, ey, 14 * alpha);
    bloom.addColorStop(0, 'rgba(255,255,255,0.9)');
    bloom.addColorStop(0.3, 'rgba(255,80,50,0.7)');
    bloom.addColorStop(1, 'rgba(255,0,0,0)');
    ctx.fillStyle = bloom;
    ctx.shadowBlur = 0;
    ctx.beginPath(); ctx.arc(ex, ey, 14, 0, Math.PI * 2); ctx.fill();

    ctx.restore();
  }
}

// ── LightningEffect ───────────────────────────────────────────
class LightningEffect {
  constructor(points, color) {
    this.points = points; this.color = color;
    this.life = 0.2; this.done = false;
  }
  update(dt) { this.life -= dt; if (this.life <= 0) this.done = true; }
  draw(ctx) {
    if (this.points.length < 2) return;
    const alpha = this.life / 0.2;
    ctx.save(); ctx.globalAlpha = alpha;
    ctx.strokeStyle = this.color; ctx.lineWidth = 3;
    ctx.shadowColor = this.color; ctx.shadowBlur = 18;
    ctx.beginPath(); ctx.moveTo(this.points[0].x, this.points[0].y);
    for (let i = 1; i < this.points.length; i++) {
      const prev = this.points[i-1], cur = this.points[i];
      const mx = (prev.x + cur.x)/2 + (Math.random()-0.5)*16;
      const my = (prev.y + cur.y)/2 + (Math.random()-0.5)*16;
      ctx.lineTo(mx, my); ctx.lineTo(cur.x, cur.y);
    }
    ctx.stroke();
    ctx.strokeStyle = "#fff"; ctx.lineWidth = 1; ctx.shadowBlur = 5;
    ctx.beginPath(); ctx.moveTo(this.points[0].x, this.points[0].y);
    for (let i = 1; i < this.points.length; i++) {
      const prev = this.points[i-1], cur = this.points[i];
      const mx = (prev.x + cur.x)/2 + (Math.random()-0.5)*8;
      const my = (prev.y + cur.y)/2 + (Math.random()-0.5)*8;
      ctx.lineTo(mx, my); ctx.lineTo(cur.x, cur.y);
    }
    ctx.stroke(); ctx.shadowBlur = 0; ctx.restore();
  }
}

// ── SplashEffect ──────────────────────────────────────────────
class SplashEffect {
  constructor(x, y, radius, color) {
    this.x = x; this.y = y; this.maxRadius = radius;
    this.color = color; this.life = 0.35; this.maxLife = 0.35; this.done = false;
  }
  update(dt) { this.life -= dt; if (this.life <= 0) this.done = true; }
  draw(ctx) {
    const progress = 1 - this.life / this.maxLife;
    ctx.save(); ctx.globalAlpha = (1 - progress) * 0.8;
    ctx.strokeStyle = this.color; ctx.lineWidth = 3;
    ctx.shadowColor = this.color; ctx.shadowBlur = 8;
    ctx.beginPath(); ctx.arc(this.x, this.y, this.maxRadius * progress, 0, Math.PI * 2); ctx.stroke();
    ctx.shadowBlur = 0; ctx.restore();
  }
}

// ── ExplosionEffect ───────────────────────────────────────────
class ExplosionEffect {
  constructor(x, y, radius) {
    this.x = x; this.y = y; this.maxRadius = radius;
    this.life = 0.4; this.maxLife = 0.4; this.done = false;
    this.sparks = Array.from({ length: 8 }, () => ({
      angle: Math.random() * Math.PI * 2,
      speed: 40 + Math.random() * 60,
      px: 0, py: 0,
    }));
  }
  update(dt) {
    this.life -= dt;
    if (this.life <= 0) { this.done = true; return; }
    const p = 1 - this.life / this.maxLife;
    for (const s of this.sparks) { s.px = Math.cos(s.angle)*s.speed*p*1.2; s.py = Math.sin(s.angle)*s.speed*p*1.2; }
  }
  draw(ctx) {
    const progress = 1 - this.life / this.maxLife;
    const alpha = 1 - progress;
    ctx.save(); ctx.globalAlpha = alpha;
    const grad = ctx.createRadialGradient(this.x, this.y, 0, this.x, this.y, this.maxRadius * progress);
    grad.addColorStop(0, "rgba(255,255,255,0.9)"); grad.addColorStop(0.3, "rgba(255,200,50,0.7)");
    grad.addColorStop(0.7, "rgba(255,80,0,0.4)"); grad.addColorStop(1, "rgba(100,0,0,0)");
    ctx.fillStyle = grad;
    ctx.beginPath(); ctx.arc(this.x, this.y, this.maxRadius * progress, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = "#ffcc00"; ctx.lineWidth = 2;
    for (const s of this.sparks) {
      ctx.beginPath(); ctx.moveTo(this.x + s.px*0.4, this.y + s.py*0.4);
      ctx.lineTo(this.x + s.px, this.y + s.py); ctx.stroke();
    }
    ctx.restore();
  }
}

// ── PlasmaEffect (Torch T3) ───────────────────────────────────
class PlasmaEffect {
  constructor(x, y, radius) {
    this.x = x; this.y = y; this.maxRadius = radius;
    this.life = 0.5; this.maxLife = 0.5; this.done = false;
  }
  update(dt) { this.life -= dt; if (this.life <= 0) this.done = true; }
  draw(ctx) {
    const progress = 1 - this.life / this.maxLife;
    const alpha = 1 - progress;
    ctx.save();
    const r = this.maxRadius * progress;
    const grad = ctx.createRadialGradient(this.x, this.y, 0, this.x, this.y, r);
    grad.addColorStop(0, `rgba(255,255,255,${alpha})`);
    grad.addColorStop(0.3, `rgba(224,64,251,${alpha * 0.8})`);
    grad.addColorStop(0.7, `rgba(106,27,154,${alpha * 0.5})`);
    grad.addColorStop(1, "rgba(106,27,154,0)");
    ctx.fillStyle = grad; ctx.beginPath(); ctx.arc(this.x, this.y, r, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = `rgba(206,147,216,${alpha})`;
    ctx.lineWidth = 3; ctx.shadowColor = "#e040fb"; ctx.shadowBlur = 15;
    ctx.beginPath(); ctx.arc(this.x, this.y, r, 0, Math.PI * 2); ctx.stroke();
    ctx.shadowBlur = 0; ctx.restore();
  }
}
