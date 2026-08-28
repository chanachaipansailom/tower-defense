// ============================================================
// sound.js — เสียงยิงของหอคอย สังเคราะห์สดด้วย Web Audio API
// (ไม่ใช้ไฟล์เสียงภายนอก)
// ============================================================
const Sound = {
  ctx: null,
  enabled: true,
  _lastPlay: {},

  _ensureCtx() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AC();
    }
    if (this.ctx.state === "suspended") this.ctx.resume();
    return this.ctx;
  },

  // ต้องเรียกจาก user gesture (คลิก/กดปุ่ม) ครั้งแรก เพื่อให้เบราว์เซอร์อนุญาตเล่นเสียง
  unlock() {
    this._ensureCtx();
  },

  playFire(typeKey) {
    if (!this.enabled) return;
    // กันเสียงถี่เกินไปตอนหอคอยยิงไว (เช่น Torch) ไม่ให้หูอื้อ
    const now = performance.now();
    const minGap = { torch: 55 }[typeKey] || 0;
    if (minGap && this._lastPlay[typeKey] && now - this._lastPlay[typeKey] < minGap) return;
    this._lastPlay[typeKey] = now;

    const ctx = this._ensureCtx();
    const t0 = ctx.currentTime;
    const master = ctx.createGain();
    master.gain.value = 0.16;
    master.connect(ctx.destination);

    switch (typeKey) {
      case "ballista":   this._twang(ctx, t0, master); break;
      case "torch":      this._whoosh(ctx, t0, master); break;
      case "cannon":     this._boom(ctx, t0, master); break;
      case "timewarper": this._zap(ctx, t0, master); break;
      default:           this._twang(ctx, t0, master);
    }
  },

  // Ballista: สายธนูดีด — เสียงสั้นแหลม pitch ร่วงเร็ว
  _twang(ctx, t0, out) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "triangle";
    osc.frequency.setValueAtTime(900, t0);
    osc.frequency.exponentialRampToValueAtTime(220, t0 + 0.09);
    gain.gain.setValueAtTime(0.9, t0);
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + 0.1);
    osc.connect(gain); gain.connect(out);
    osc.start(t0); osc.stop(t0 + 0.11);
  },

  // Torch: เสียงพ่นไฟ — white noise สั้นๆ กรองผ่าน bandpass
  _whoosh(ctx, t0, out) {
    const dur = 0.08;
    const buffer = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * dur), ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
    const noise = ctx.createBufferSource();
    noise.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.value = 2200;
    filter.Q.value = 0.7;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.7, t0);
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    noise.connect(filter); filter.connect(gain); gain.connect(out);
    noise.start(t0);
  },

  // Cannon: เสียงปืนใหญ่ — เบสกระแทก + crack
  _boom(ctx, t0, out) {
    const osc = ctx.createOscillator();
    const oGain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(140, t0);
    osc.frequency.exponentialRampToValueAtTime(40, t0 + 0.22);
    oGain.gain.setValueAtTime(1, t0);
    oGain.gain.exponentialRampToValueAtTime(0.001, t0 + 0.25);
    osc.connect(oGain); oGain.connect(out);
    osc.start(t0); osc.stop(t0 + 0.26);

    const dur = 0.05;
    const buffer = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * dur), ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    const noise = ctx.createBufferSource();
    noise.buffer = buffer;
    const nGain = ctx.createGain();
    nGain.gain.setValueAtTime(0.5, t0);
    nGain.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    noise.connect(nGain); nGain.connect(out);
    noise.start(t0);
  },

  // Timewarper: เสียงคลื่นชะลอเวลา — pitch ไต่ขึ้นแล้วหาย
  _zap(ctx, t0, out) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(260, t0);
    osc.frequency.linearRampToValueAtTime(520, t0 + 0.15);
    gain.gain.setValueAtTime(0.35, t0);
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + 0.18);
    osc.connect(gain); gain.connect(out);
    osc.start(t0); osc.stop(t0 + 0.19);
  },
};
