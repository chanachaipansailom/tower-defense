// ============================================================
// enemy.js — Pseudo-3D sphere-shaded enemy models
// ============================================================

class Enemy {
  constructor(typeKey, hpMultiplier = 1, speedMultiplier = 1) {
    const type = ENEMY_TYPES[typeKey];
    this.type = type; this.typeKey = typeKey;
    this.x = GameMap.waypoints[0].x;
    this.y = GameMap.waypoints[0].y;
    this.targetIndex = 1;
    this.maxHp = Math.round(type.hp * hpMultiplier);
    this.hp = this.maxHp;
    this.baseSpeed = type.speed * speedMultiplier;
    this.gold = type.gold; this.exp = type.exp;
    this.radius = type.radius; this.color = type.color;
    this.armor = type.armor || 0;
    this.dead = false; this.reachedBase = false;
    this.slowTimer = 0; this.slowFactor = 1;
    this.freezeTimer = 0;
    this.burnTimer = 0; this.burnDamage = 0;
    this.poisonTimer = 0; this.poisonDamage = 0;
    this._animTime = 0;
  }

  get speed() {
    if (this.freezeTimer > 0) return 0;
    return this.baseSpeed * this.slowFactor;
  }

  applySlow(factor, duration) {
    if (factor < this.slowFactor || this.slowTimer <= 0) this.slowFactor = factor;
    this.slowTimer = Math.max(this.slowTimer, duration);
  }
  applyFreeze(duration) { this.freezeTimer = Math.max(this.freezeTimer, duration); this.slowFactor = 1; this.slowTimer = 0; }
  applyBurn(dmgPerSec, duration) { this.burnDamage = Math.max(this.burnDamage, dmgPerSec); this.burnTimer = Math.max(this.burnTimer, duration); }
  applyPoison(dmgPerSec, duration) { this.poisonDamage = Math.max(this.poisonDamage, dmgPerSec); this.poisonTimer = Math.max(this.poisonTimer, duration); }

  takeDamage(amount) {
    const effective = Math.max(1, Math.round(amount * (1 - this.armor)));
    this.hp -= effective;
    if (this.hp <= 0 && !this.dead) this.dead = true;
  }

  update(dt) {
    this._animTime += dt;

    if (this.slowTimer > 0) { this.slowTimer -= dt; if (this.slowTimer <= 0) this.slowFactor = 1; }
    if (this.freezeTimer > 0) { this.freezeTimer -= dt; }

    if (this.burnTimer > 0) {
      this.burnTimer -= dt; this.hp -= this.burnDamage * dt;
      if (this.burnTimer <= 0) this.burnDamage = 0;
      if (this.hp <= 0 && !this.dead) this.dead = true;
    }

    if (this.poisonTimer > 0) {
      this.poisonTimer -= dt; this.hp -= this.poisonDamage * dt;
      if (this.poisonTimer <= 0) this.poisonDamage = 0;
      if (this.hp <= 0 && !this.dead) this.dead = true;
    }

    // Wizard HP regen
    if (this.type.regenRate && this.freezeTimer <= 0) {
      this.hp = Math.min(this.maxHp, this.hp + this.type.regenRate * dt);
    }

    if (this.dead) return;

    const target = GameMap.waypoints[this.targetIndex];
    if (!target) { this.reachedBase = true; return; }
    const dx = target.x - this.x, dy = target.y - this.y;
    const dist = Math.hypot(dx, dy);
    const step = this.speed * dt;
    if (dist <= step) {
      this.x = target.x; this.y = target.y; this.targetIndex++;
      if (this.targetIndex >= GameMap.waypoints.length) this.reachedBase = true;
    } else {
      this.x += (dx / dist) * step; this.y += (dy / dist) * step;
    }
  }

  get isAir() { return (this.type && this.type.unitType) === "air"; }

  // =========================================================
  //  3D HELPERS
  // =========================================================

  // Sphere with upper-left lighting, rim shadow, specular highlight
  _sphere(ctx, cx, cy, r, lightCol, midCol, darkCol) {
    var g = ctx.createRadialGradient(cx - r*0.38, cy - r*0.38, r*0.02, cx + r*0.15, cy + r*0.15, r*1.05);
    g.addColorStop(0, lightCol);
    g.addColorStop(0.42, midCol);
    g.addColorStop(1, darkCol);
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI*2); ctx.fill();

    // Rim shadow (lower-right darkening)
    var rim = ctx.createRadialGradient(cx, cy, r*0.5, cx + r*0.25, cy + r*0.35, r*1.02);
    rim.addColorStop(0, 'rgba(0,0,0,0)');
    rim.addColorStop(1, 'rgba(0,0,0,0.52)');
    ctx.fillStyle = rim;
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI*2); ctx.fill();

    // Specular highlight (upper-left bright spot)
    var spec = ctx.createRadialGradient(cx - r*0.4, cy - r*0.4, 0, cx - r*0.18, cy - r*0.18, r*0.6);
    spec.addColorStop(0, 'rgba(255,255,255,0.82)');
    spec.addColorStop(0.28, 'rgba(255,255,255,0.28)');
    spec.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = spec;
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI*2); ctx.fill();
  }

  // Flat ellipse shadow on ground
  _dropShadow(ctx, cx, cy, r) {
    ctx.save();
    ctx.globalAlpha = 0.28;
    ctx.fillStyle = '#000';
    ctx.scale(1, 0.32);
    ctx.beginPath();
    ctx.arc(cx + r*0.28, (cy + r*1.15) / 0.32, r*0.95, 0, Math.PI*2);
    ctx.fill();
    ctx.restore();
  }

  // =========================================================
  //  PER-TYPE 3D BODY METHODS
  // =========================================================

  // Standard orc — green sphere, iron helmet, tusks, red eyes
  _bodyOrc(ctx) {
    var x=this.x, y=this.y, r=this.radius;
    this._dropShadow(ctx,x,y,r);
    this._sphere(ctx,x,y,r,'#a5d6a7','#4caf50','#1b5e20');

    // Iron helmet (dark dome on top half)
    ctx.fillStyle = '#455a64';
    ctx.beginPath(); ctx.arc(x, y - r*0.12, r*0.68, Math.PI, Math.PI*2); ctx.fill();
    // Helmet sheen
    var hg = ctx.createLinearGradient(x - r*0.55, y - r*0.88, x + r*0.1, y - r*0.28);
    hg.addColorStop(0, 'rgba(176,190,197,0.62)'); hg.addColorStop(1, 'rgba(176,190,197,0)');
    ctx.fillStyle = hg;
    ctx.beginPath(); ctx.arc(x, y - r*0.12, r*0.68, Math.PI, Math.PI*2); ctx.fill();
    // Helmet rim line
    ctx.strokeStyle = '#37474f'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(x, y - r*0.12, r*0.68, Math.PI, Math.PI*2); ctx.stroke();
    // Helmet cheek guard (small rectangles on sides)
    ctx.fillStyle = '#546e7a';
    ctx.beginPath(); ctx.ellipse(x - r*0.68, y - r*0.05, r*0.18, r*0.26, -0.2, 0, Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(x + r*0.68, y - r*0.05, r*0.18, r*0.26,  0.2, 0, Math.PI*2); ctx.fill();

    // Tusks
    ctx.fillStyle = '#fff9c4';
    ctx.beginPath(); ctx.ellipse(x - r*0.4, y + r*0.55, r*0.11, r*0.27, -0.22, 0, Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(x + r*0.4, y + r*0.55, r*0.11, r*0.27,  0.22, 0, Math.PI*2); ctx.fill();
    // Tusk shading
    ctx.fillStyle = 'rgba(200,180,80,0.3)';
    ctx.beginPath(); ctx.ellipse(x - r*0.42, y + r*0.6, r*0.08, r*0.2, -0.3, 0, Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(x + r*0.42, y + r*0.6, r*0.08, r*0.2,  0.3, 0, Math.PI*2); ctx.fill();

    // Eyes (red glow)
    ctx.fillStyle = '#b71c1c';
    ctx.beginPath(); ctx.arc(x - r*0.29, y - r*0.02, r*0.16, 0, Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.arc(x + r*0.29, y - r*0.02, r*0.16, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = '#ff1744'; ctx.shadowColor = '#ff1744'; ctx.shadowBlur = 4;
    ctx.beginPath(); ctx.arc(x - r*0.29, y - r*0.02, r*0.08, 0, Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.arc(x + r*0.29, y - r*0.02, r*0.08, 0, Math.PI*2); ctx.fill();
    ctx.shadowBlur = 0;
  }

  // Fast orc — orange, streamlined, speed stripes, motion trail
  _bodyFastOrc(ctx) {
    var x=this.x, y=this.y, r=this.radius, t=this._animTime;
    // Motion trail
    for (var i=3; i>=1; i--) {
      ctx.fillStyle = 'rgba(255,152,0,'+(0.06*i)+')';
      ctx.beginPath(); ctx.arc(x - r*0.42*i, y, r*(0.86-i*0.12), 0, Math.PI*2); ctx.fill();
    }
    this._dropShadow(ctx,x,y,r);
    this._sphere(ctx,x,y,r,'#ffcc80','#ff9800','#bf360c');

    // Speed stripes
    ctx.save(); ctx.globalAlpha = 0.45;
    ctx.strokeStyle = '#fffde7'; ctx.lineWidth = r*0.18; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(x - r*0.62, y - r*0.1); ctx.lineTo(x + r*0.32, y - r*0.1); ctx.stroke();
    ctx.lineWidth = r*0.1;
    ctx.beginPath(); ctx.moveTo(x - r*0.45, y + r*0.3); ctx.lineTo(x + r*0.42, y + r*0.3); ctx.stroke();
    ctx.restore();

    // Sharp angled eyes (white sclera)
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.ellipse(x - r*0.3, y - r*0.1, r*0.2, r*0.13, -0.38, 0, Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(x + r*0.3, y - r*0.1, r*0.2, r*0.13,  0.38, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = '#212121';
    ctx.beginPath(); ctx.arc(x - r*0.28, y - r*0.1, r*0.09, 0, Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.arc(x + r*0.28, y - r*0.1, r*0.09, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.beginPath(); ctx.arc(x - r*0.33, y - r*0.14, r*0.04, 0, Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.arc(x + r*0.24, y - r*0.14, r*0.04, 0, Math.PI*2); ctx.fill();

    // Small tusks
    ctx.fillStyle = '#fff9c4';
    ctx.beginPath(); ctx.ellipse(x - r*0.36, y + r*0.5, r*0.09, r*0.19, -0.18, 0, Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(x + r*0.36, y + r*0.5, r*0.09, r*0.19,  0.18, 0, Math.PI*2); ctx.fill();
  }

  // Orc tank — heavy brown, armor ring with bolts, scar
  _bodyOrcTank(ctx) {
    var x=this.x, y=this.y, r=this.radius;
    this._dropShadow(ctx,x,y,r);
    this._sphere(ctx,x,y,r,'#a1887f','#795548','#3e2723');

    // Armor plate ring
    ctx.save();
    ctx.strokeStyle = '#546e7a'; ctx.lineWidth = r*0.26; ctx.globalAlpha = 0.9;
    ctx.beginPath(); ctx.arc(x, y, r*0.8, 0, Math.PI*2); ctx.stroke();
    // Armor ring upper sheen
    var ag = ctx.createLinearGradient(x - r, y - r*0.6, x + r, y + r*0.6);
    ag.addColorStop(0, 'rgba(207,216,220,0.45)');
    ag.addColorStop(0.45, 'rgba(207,216,220,0.05)');
    ag.addColorStop(1, 'rgba(0,0,0,0.2)');
    ctx.strokeStyle = ag; ctx.lineWidth = r*0.26;
    ctx.beginPath(); ctx.arc(x, y, r*0.8, 0, Math.PI*2); ctx.stroke();
    ctx.globalAlpha = 1;
    // Bolts on ring
    ctx.fillStyle = '#90a4ae';
    for (var i=0; i<6; i++) {
      var a = (i/6)*Math.PI*2;
      var bx = x + Math.cos(a)*r*0.8, by = y + Math.sin(a)*r*0.8;
      ctx.beginPath(); ctx.arc(bx+0.5, by+0.5, r*0.09, 0, Math.PI*2); ctx.fill(); // bolt shadow
      ctx.fillStyle = '#cfd8dc';
      ctx.beginPath(); ctx.arc(bx, by, r*0.09, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = '#90a4ae';
    }
    ctx.restore();

    // Battle scar
    ctx.strokeStyle = 'rgba(55,18,10,0.65)'; ctx.lineWidth = 1.8;
    ctx.beginPath(); ctx.moveTo(x - r*0.08, y - r*0.42); ctx.lineTo(x + r*0.3, y + r*0.22); ctx.stroke();

    // Eyes (fierce red)
    ctx.fillStyle = '#c62828'; ctx.shadowColor = '#d32f2f'; ctx.shadowBlur = 7;
    ctx.beginPath(); ctx.arc(x - r*0.3, y - r*0.1, r*0.15, 0, Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.arc(x + r*0.3, y - r*0.1, r*0.15, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = '#ff5252'; ctx.shadowBlur = 0;
    ctx.beginPath(); ctx.arc(x - r*0.3, y - r*0.1, r*0.07, 0, Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.arc(x + r*0.3, y - r*0.1, r*0.07, 0, Math.PI*2); ctx.fill();

    // Heavy tusks
    ctx.fillStyle = '#fff9c4';
    ctx.beginPath(); ctx.ellipse(x - r*0.44, y + r*0.55, r*0.14, r*0.34, -0.18, 0, Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(x + r*0.44, y + r*0.55, r*0.14, r*0.34,  0.18, 0, Math.PI*2); ctx.fill();
    ctx.strokeStyle = 'rgba(180,155,60,0.45)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.ellipse(x - r*0.44, y + r*0.55, r*0.14, r*0.34, -0.18, 0, Math.PI*2); ctx.stroke();
    ctx.beginPath(); ctx.ellipse(x + r*0.44, y + r*0.55, r*0.14, r*0.34,  0.18, 0, Math.PI*2); ctx.stroke();
  }

  // Wizard — purple sphere, pointed hat, flapping wings, glowing eyes, sparkles
  _bodyWizard(ctx) {
    var x=this.x, y=this.y, r=this.radius, t=this._animTime;
    var pulse = 0.5 + 0.5*Math.sin(t*3);
    var wf = 0.6 + 0.4*Math.abs(Math.sin(t*5));

    // Wings (behind body)
    ctx.fillStyle = 'rgba(149,117,205,'+(0.48+0.3*pulse)+')';
    ctx.beginPath(); ctx.ellipse(x - r*1.75*wf, y, r*1.65*wf, r*0.52, -0.2, 0, Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(x + r*1.75*wf, y, r*1.65*wf, r*0.52,  0.2, 0, Math.PI*2); ctx.fill();
    // Wing veins
    ctx.strokeStyle = 'rgba(103,58,183,0.42)'; ctx.lineWidth = 0.8;
    for (var wi=0; wi<3; wi++) {
      ctx.beginPath(); ctx.moveTo(x - r*0.48, y); ctx.lineTo(x - r*(2.3*wf + wi*0.22), y - r*(0.14+wi*0.16)); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x + r*0.48, y); ctx.lineTo(x + r*(2.3*wf + wi*0.22), y - r*(0.14+wi*0.16)); ctx.stroke();
    }
    // Wing edge glow
    ctx.strokeStyle = 'rgba(179,136,255,'+(0.3+0.25*wf)+')'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.ellipse(x - r*1.75*wf, y, r*1.65*wf, r*0.52, -0.2, 0, Math.PI*2); ctx.stroke();
    ctx.beginPath(); ctx.ellipse(x + r*1.75*wf, y, r*1.65*wf, r*0.52,  0.2, 0, Math.PI*2); ctx.stroke();

    this._sphere(ctx,x,y,r,'#e1bee7','#9c27b0','#4a0072');

    // Pointed hat
    ctx.fillStyle = '#1a237e';
    ctx.beginPath(); ctx.moveTo(x, y - r*1.78); ctx.lineTo(x - r*0.56, y - r*0.68); ctx.lineTo(x + r*0.56, y - r*0.68); ctx.closePath(); ctx.fill();
    // Hat sheen
    var hatG = ctx.createLinearGradient(x - r*0.5, y - r*1.78, x + r*0.18, y - r*0.88);
    hatG.addColorStop(0, 'rgba(179,136,255,0.5)'); hatG.addColorStop(1, 'rgba(179,136,255,0)');
    ctx.fillStyle = hatG; ctx.beginPath(); ctx.moveTo(x, y - r*1.78); ctx.lineTo(x - r*0.56, y - r*0.68); ctx.lineTo(x + r*0.56, y - r*0.68); ctx.closePath(); ctx.fill();
    // Hat brim
    ctx.strokeStyle = 'rgba(121,85,232,0.72)'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.ellipse(x, y - r*0.68, r*0.6, r*0.18, 0, 0, Math.PI*2); ctx.stroke();
    // Hat star
    ctx.fillStyle = '#ffd54f'; ctx.shadowColor = '#ffd54f'; ctx.shadowBlur = 5;
    ctx.font = (r*0.55)+'px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('✦', x, y - r*1.18);
    ctx.shadowBlur = 0;

    // Glowing eyes
    ctx.fillStyle = '#ea80fc'; ctx.shadowColor = '#e040fb'; ctx.shadowBlur = 8+5*pulse;
    ctx.beginPath(); ctx.arc(x - r*0.28, y - r*0.04, r*0.14, 0, Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.arc(x + r*0.28, y - r*0.04, r*0.14, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.shadowBlur = 0;
    ctx.beginPath(); ctx.arc(x - r*0.23, y - r*0.09, r*0.05, 0, Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.arc(x + r*0.24, y - r*0.09, r*0.05, 0, Math.PI*2); ctx.fill();

    // Orbiting sparkles
    for (var i=0; i<3; i++) {
      var a = t*2.5 + i*2.094;
      var px = x + Math.cos(a)*(r+5), py = y + Math.sin(a)*(r+5);
      ctx.fillStyle = '#ea80fc'; ctx.shadowColor = '#e040fb'; ctx.shadowBlur = 5;
      ctx.beginPath(); ctx.arc(px, py, 2.2, 0, Math.PI*2); ctx.fill();
      ctx.shadowBlur = 0;
    }
    // Aura ring
    ctx.strokeStyle = 'rgba(224,64,251,'+(0.22+0.2*pulse)+')'; ctx.lineWidth = 1.4;
    ctx.beginPath(); ctx.arc(x, y, r + 5 + 2*pulse, 0, Math.PI*2); ctx.stroke();
  }

  // Harpy — cyan sphere, large wings, beak, eye
  _bodyHarpy(ctx) {
    var x=this.x, y=this.y, r=this.radius, t=this._animTime;
    var wf = 0.5 + 0.5*Math.abs(Math.sin(t*7));

    // Wings (behind body)
    ctx.fillStyle = 'rgba(0,188,212,'+(0.44+0.22*wf)+')';
    ctx.beginPath(); ctx.ellipse(x - r*1.55*wf, y - r*0.08, r*1.75*wf, r*0.5, -0.42, 0, Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(x + r*1.55*wf, y - r*0.08, r*1.75*wf, r*0.5,  0.42, 0, Math.PI*2); ctx.fill();
    // Feather detail lines
    ctx.strokeStyle = 'rgba(0,229,255,0.5)'; ctx.lineWidth = 0.8;
    for (var i=0; i<4; i++) {
      ctx.beginPath(); ctx.moveTo(x - r*0.35, y); ctx.lineTo(x - r*(1.85*wf+i*0.25), y + r*(0.14+i*0.1)); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x + r*0.35, y); ctx.lineTo(x + r*(1.85*wf+i*0.25), y + r*(0.14+i*0.1)); ctx.stroke();
    }
    // Wing edge
    ctx.strokeStyle = 'rgba(0,229,255,'+(0.3+0.2*wf)+')'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.ellipse(x - r*1.55*wf, y - r*0.08, r*1.75*wf, r*0.5, -0.42, 0, Math.PI*2); ctx.stroke();
    ctx.beginPath(); ctx.ellipse(x + r*1.55*wf, y - r*0.08, r*1.75*wf, r*0.5,  0.42, 0, Math.PI*2); ctx.stroke();

    this._sphere(ctx,x,y,r,'#80deea','#00bcd4','#004d5e');

    // Beak (upper + lower halves)
    ctx.fillStyle = '#f9a825';
    ctx.beginPath(); ctx.moveTo(x + r*0.4, y - r*0.1); ctx.lineTo(x + r*1.0, y + r*0.02); ctx.lineTo(x + r*0.4, y + r*0.22); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#f57f17';
    ctx.beginPath(); ctx.moveTo(x + r*0.4, y - r*0.1); ctx.lineTo(x + r*1.0, y + r*0.02); ctx.lineTo(x + r*0.4, y + r*0.04); ctx.closePath(); ctx.fill();
    // Beak highlight
    ctx.fillStyle = 'rgba(255,235,130,0.4)';
    ctx.beginPath(); ctx.moveTo(x + r*0.44, y - r*0.06); ctx.lineTo(x + r*0.88, y + r*0.02); ctx.lineTo(x + r*0.48, y + r*0.02); ctx.closePath(); ctx.fill();

    // Eye (right side facing)
    ctx.fillStyle = '#fafafa';
    ctx.beginPath(); ctx.arc(x + r*0.1, y - r*0.22, r*0.19, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = '#1a237e';
    ctx.beginPath(); ctx.arc(x + r*0.13, y - r*0.22, r*0.12, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = '#000';
    ctx.beginPath(); ctx.arc(x + r*0.14, y - r*0.22, r*0.07, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.72)';
    ctx.beginPath(); ctx.arc(x + r*0.08, y - r*0.27, r*0.05, 0, Math.PI*2); ctx.fill();
  }

  // Boss orc — massive red, horns, crown, glowing orange eyes, aura
  _bodyBoss(ctx) {
    var x=this.x, y=this.y, r=this.radius, t=this._animTime;
    var pulse = 0.5 + 0.5*Math.sin(t*2.2);

    this._dropShadow(ctx,x,y,r);

    // Pulsing outer glow ring
    ctx.strokeStyle = 'rgba(183,28,28,'+(0.35+0.25*pulse)+')';
    ctx.lineWidth = r*0.18; ctx.shadowColor = '#ff1744'; ctx.shadowBlur = 14+8*pulse;
    ctx.beginPath(); ctx.arc(x, y, r*1.12, 0, Math.PI*2); ctx.stroke();
    ctx.shadowBlur = 0;

    this._sphere(ctx,x,y,r,'#ef9a9a','#c62828','#7f0000');

    // Horns (dark twisted)
    ctx.fillStyle = '#4e342e';
    ctx.beginPath(); ctx.moveTo(x - r*0.48, y - r*0.65); ctx.lineTo(x - r*0.26, y - r*1.58); ctx.lineTo(x - r*0.1, y - r*0.72); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(x + r*0.48, y - r*0.65); ctx.lineTo(x + r*0.26, y - r*1.58); ctx.lineTo(x + r*0.1, y - r*0.72); ctx.closePath(); ctx.fill();
    // Horn sheen
    var hornG = ctx.createLinearGradient(x - r*0.48, y - r*1.58, x - r*0.1, y - r*0.65);
    hornG.addColorStop(0, 'rgba(120,80,50,0.55)'); hornG.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = hornG;
    ctx.beginPath(); ctx.moveTo(x - r*0.48, y - r*0.65); ctx.lineTo(x - r*0.26, y - r*1.58); ctx.lineTo(x - r*0.1, y - r*0.72); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(x + r*0.48, y - r*0.65); ctx.lineTo(x + r*0.26, y - r*1.58); ctx.lineTo(x + r*0.1, y - r*0.72); ctx.closePath(); ctx.fill();

    // Crown
    var cy2 = y - r*0.68;
    ctx.fillStyle = '#ffd54f'; ctx.shadowColor = '#ff9800'; ctx.shadowBlur = 5+3*pulse;
    ctx.beginPath();
    ctx.moveTo(x - r*0.52, cy2);
    ctx.lineTo(x - r*0.46, cy2 - r*0.4);
    ctx.lineTo(x - r*0.22, cy2 - r*0.22);
    ctx.lineTo(x,           cy2 - r*0.44);
    ctx.lineTo(x + r*0.22, cy2 - r*0.22);
    ctx.lineTo(x + r*0.46, cy2 - r*0.4);
    ctx.lineTo(x + r*0.52, cy2);
    ctx.closePath(); ctx.fill();
    ctx.shadowBlur = 0;
    // Crown jewels
    ctx.fillStyle = '#f44336'; ctx.beginPath(); ctx.arc(x, cy2 - r*0.38, r*0.11, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = '#1a237e'; ctx.beginPath(); ctx.arc(x - r*0.3, cy2 - r*0.14, r*0.07, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = '#1a237e'; ctx.beginPath(); ctx.arc(x + r*0.3, cy2 - r*0.14, r*0.07, 0, Math.PI*2); ctx.fill();

    // Tusks (large boss tusks)
    ctx.fillStyle = '#fff9c4';
    ctx.beginPath(); ctx.ellipse(x - r*0.5, y + r*0.58, r*0.15, r*0.36, -0.16, 0, Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(x + r*0.5, y + r*0.58, r*0.15, r*0.36,  0.16, 0, Math.PI*2); ctx.fill();
    ctx.strokeStyle = 'rgba(180,155,55,0.4)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.ellipse(x - r*0.5, y + r*0.58, r*0.15, r*0.36, -0.16, 0, Math.PI*2); ctx.stroke();
    ctx.beginPath(); ctx.ellipse(x + r*0.5, y + r*0.58, r*0.15, r*0.36,  0.16, 0, Math.PI*2); ctx.stroke();

    // Glowing orange eyes
    ctx.fillStyle = '#ff6f00'; ctx.shadowColor = '#ff3d00'; ctx.shadowBlur = 12+7*pulse;
    ctx.beginPath(); ctx.arc(x - r*0.32, y - r*0.12, r*0.2, 0, Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.arc(x + r*0.32, y - r*0.12, r*0.2, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = '#ffd740'; ctx.shadowBlur = 3;
    ctx.beginPath(); ctx.arc(x - r*0.32, y - r*0.12, r*0.1, 0, Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.arc(x + r*0.32, y - r*0.12, r*0.1, 0, Math.PI*2); ctx.fill();
    ctx.shadowBlur = 0;

    // Battle scar
    ctx.strokeStyle = 'rgba(80,18,10,0.62)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(x - r*0.1, y - r*0.42); ctx.lineTo(x + r*0.24, y + r*0.1); ctx.stroke();
  }

  // =========================================================
  //  MAIN DRAW
  // =========================================================
  draw(ctx) {
    ctx.save();
    var x = this.x, y = this.y;

    // ── Air units: flat ground shadow + floating bob ──────────
    if (this.isAir) {
      var bob = Math.sin(this._animTime * 4) * 3;
      ctx.save();
      ctx.globalAlpha = 0.2;
      ctx.fillStyle = '#000';
      ctx.save();
      ctx.scale(1, 0.32);
      ctx.beginPath();
      ctx.arc(x, (y + this.radius*2.6) / 0.32, this.radius*0.92, 0, Math.PI*2);
      ctx.fill();
      ctx.restore();
      ctx.restore();
      ctx.translate(0, -10 + bob);
    }

    // ── Status effect rings ────────────────────────────────────
    if (this.burnTimer > 0) {
      var p1 = 0.6 + 0.4*Math.sin(this._animTime*12);
      ctx.strokeStyle = 'rgba(255,'+Math.round(80+100*p1)+',0,'+(0.7*p1)+')';
      ctx.lineWidth = 3; ctx.shadowColor = '#ff5722'; ctx.shadowBlur = 8;
      ctx.beginPath(); ctx.arc(x, y, this.radius+4, 0, Math.PI*2); ctx.stroke();
      ctx.shadowBlur = 0;
    }
    if (this.freezeTimer > 0) {
      ctx.fillStyle = 'rgba(200,240,255,0.38)';
      ctx.beginPath(); ctx.arc(x, y, this.radius+2, 0, Math.PI*2); ctx.fill();
      ctx.strokeStyle = '#e1f5fe'; ctx.lineWidth = 2.5;
      ctx.shadowColor = '#b3e5fc'; ctx.shadowBlur = 10;
      ctx.beginPath(); ctx.arc(x, y, this.radius+5, 0, Math.PI*2); ctx.stroke();
      ctx.shadowBlur = 0;
    }
    if (this.slowTimer > 0 && this.freezeTimer <= 0) {
      ctx.strokeStyle = 'rgba(179,157,219,0.8)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(x, y, this.radius+3, 0, Math.PI*2); ctx.stroke();
    }

    // ── 3D body ───────────────────────────────────────────────
    this._draw3DBody(ctx);

    // Frozen ice tint overlay
    if (this.freezeTimer > 0) {
      ctx.fillStyle = 'rgba(179,229,252,0.42)';
      ctx.beginPath(); ctx.arc(x, y, this.radius, 0, Math.PI*2); ctx.fill();
    }

    // ── Burn particles ─────────────────────────────────────────
    if (this.burnTimer > 0) {
      var ta = this._animTime;
      for (var i=0; i<3; i++) {
        var px = x + Math.cos(ta*3+i*2.1)*(this.radius*0.6);
        var py = y - this.radius - Math.sin(ta*4+i)*5 - 3;
        var sz = 3 + Math.sin(ta*5+i*1.7)*2;
        ctx.fillStyle = i%2===0 ? '#ff5722' : '#ffeb3b';
        ctx.beginPath(); ctx.arc(px, py, sz, 0, Math.PI*2); ctx.fill();
      }
    }

    ctx.restore();

    // ── HP bar (in original coordinate space) ─────────────────
    var barW = this.radius*2 + 4, barH = 4;
    var barY = this.isAir ? (this.y - this.radius - 20) : (this.y - this.radius - 10);
    var bx = this.x - barW/2;
    ctx.fillStyle = 'rgba(0,0,0,0.62)'; ctx.fillRect(bx, barY, barW, barH);
    var ratio = Math.max(0, this.hp/this.maxHp);
    ctx.fillStyle = ratio > 0.5 ? '#2ecc71' : ratio > 0.25 ? '#f39c12' : '#e74c3c';
    ctx.fillRect(bx, barY, barW*ratio, barH);
    if (this.type.regenRate && this.hp < this.maxHp) {
      ctx.fillStyle = '#ce93d8';
      ctx.fillRect(bx + barW*ratio - 2, barY, 3, barH);
    }
  }

  // Dispatcher — draw the right body type
  _draw3DBody(ctx) {
    switch (this.typeKey) {
      case 'orc':      this._bodyOrc(ctx);      break;
      case 'fast_orc': this._bodyFastOrc(ctx);  break;
      case 'orc_tank': this._bodyOrcTank(ctx);  break;
      case 'wizard':   this._bodyWizard(ctx);   break;
      case 'harpy':    this._bodyHarpy(ctx);    break;
      case 'orc_boss': this._bodyBoss(ctx);     break;
      default:
        this._dropShadow(ctx, this.x, this.y, this.radius);
        this._sphere(ctx, this.x, this.y, this.radius, this.color, this.color, '#000');
    }
  }
}
