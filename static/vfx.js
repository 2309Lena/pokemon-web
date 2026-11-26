const TYPE_COLORS = {
  normal: "#cbd5e1",
  fire: "#f97316",
  water: "#38bdf8",
  electric: "#facc15",
  grass: "#4ade80",
  ice: "#bae6fd",
  fighting: "#fb7185",
  poison: "#c084fc",
  ground: "#d97706",
  flying: "#a5b4fc",
  psychic: "#f472b6",
  bug: "#a3e635",
  rock: "#a8a29e",
  ghost: "#8b5cf6",
  dragon: "#6366f1",
  dark: "#64748b",
  steel: "#94a3b8",
  fairy: "#f9a8d4",
};

class PokeAudioEngine {
  constructor() {
    const saved = JSON.parse(localStorage.getItem("pokeworld_audio") || "{}");
    this.cryEnabled = saved.cryEnabled ?? true;
    this.sfxEnabled = saved.sfxEnabled ?? true;
    this.bgmEnabled = saved.bgmEnabled ?? false;
    this.cryVolume = saved.cryVolume ?? 0.6;
    this.sfxVolume = saved.sfxVolume ?? 0.7;
    this.bgmVolume = saved.bgmVolume ?? 0.35;
    this.ctx = null;
    this.bgmTimer = null;
    this.bgmStep = 0;
  }

  get enabled() {
    return this.sfxEnabled || this.cryEnabled;
  }

  saveSettings() {
    localStorage.setItem(
      "pokeworld_audio",
      JSON.stringify({
        cryEnabled: this.cryEnabled,
        sfxEnabled: this.sfxEnabled,
        bgmEnabled: this.bgmEnabled,
        cryVolume: this.cryVolume,
        sfxVolume: this.sfxVolume,
        bgmVolume: this.bgmVolume,
      })
    );
    if (this.bgmEnabled) this.startBgm();
    else this.stopBgm();
  }

  ensureCtx() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (AC) this.ctx = new AC();
    }
    if (this.ctx && this.ctx.state === "suspended") {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  tone(freq, dur = 0.12, type = "triangle", baseVol = 0.14, delay = 0, isBgm = false) {
    if (isBgm && !this.bgmEnabled) return;
    if (!isBgm && !this.sfxEnabled) return;
    const scale = isBgm ? this.bgmVolume : this.sfxVolume;
    if (scale <= 0.01) return;
    const ctx = this.ensureCtx();
    if (!ctx) return;
    const now = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);
    gain.gain.setValueAtTime(baseVol * scale, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + dur);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + dur);
  }

  startBgm() {
    if (this.bgmTimer) return;
    const notes = [262, 330, 392, 523, 392, 330, 294, 349, 440, 392, 330, 294];
    this.bgmTimer = setInterval(() => {
      if (!this.bgmEnabled || this.bgmVolume <= 0.01) return;
      const f = notes[this.bgmStep % notes.length];
      this.tone(f, 0.22, "triangle", 0.08, 0, true);
      this.bgmStep += 1;
    }, 320);
  }

  stopBgm() {
    if (this.bgmTimer) {
      clearInterval(this.bgmTimer);
      this.bgmTimer = null;
    }
  }

  playAttack(moveType) {
    if (!this.sfxEnabled) return;
    if (moveType === "electric") {
      this.tone(880, 0.08, "sawtooth", 0.14, 0);
      this.tone(1180, 0.1, "square", 0.12, 0.06);
    } else if (moveType === "fire") {
      this.tone(240, 0.15, "sawtooth", 0.16, 0);
      this.tone(360, 0.12, "triangle", 0.12, 0.05);
    } else if (moveType === "water" || moveType === "ice") {
      this.tone(520, 0.12, "sine", 0.15, 0);
      this.tone(760, 0.14, "sine", 0.1, 0.07);
    } else {
      this.tone(320, 0.09, "square", 0.13, 0);
      this.tone(180, 0.12, "triangle", 0.12, 0.05);
    }
  }

  playCatchSuccess() {
    this.tone(523, 0.11, "triangle", 0.14, 0);
    this.tone(659, 0.11, "triangle", 0.14, 0.11);
    this.tone(784, 0.11, "triangle", 0.14, 0.22);
    this.tone(1046, 0.28, "triangle", 0.18, 0.33);
  }

  playPackOpen() {
    [440, 554, 659, 880, 1108].forEach((f, i) => {
      this.tone(f, 0.14, "sine", 0.13, i * 0.07);
    });
  }

  playCry(speciesId) {
    if (!this.cryEnabled || !speciesId || this.cryVolume <= 0.01) return;
    const audio = new Audio(
      `https://raw.githubusercontent.com/PokeAPI/cries/main/cries/pokemon/latest/${speciesId}.ogg`
    );
    audio.volume = Math.max(0, Math.min(1, this.cryVolume));
    audio.play().catch(() => {
      this.tone(440, 0.12, "sine", 0.08, 0);
    });
  }
}

window.PokeAudio = new PokeAudioEngine();

class BattleVFXRenderer {
  constructor(canvasId) {
    this.canvas = document.getElementById(canvasId);
    this.particles = [];
    this.popups = [];
    this.rings = [];
    this.attacks = [];
    this.ballAnim = null;
    this.running = false;
    this.ballSprites = {};
    this.vfxSprites = {};
    for (const k of ["poke-ball", "great-ball", "ultra-ball", "master-ball"]) {
      const img = new Image();
      img.src = `/static/assets/items/${k}.png`;
      this.ballSprites[k] = img;
    }
    for (const v of ["fire", "water", "electric", "grass", "ice", "psychic", "ghost", "slash"]) {
      const img = new Image();
      img.src = `/static/assets/vfx/vfx_${v}.png`;
      this.vfxSprites[v] = img;
    }
  }

  vfxKeyForType(moveType) {
    if (moveType === "fire") return "fire";
    if (moveType === "water") return "water";
    if (moveType === "electric") return "electric";
    if (moveType === "grass" || moveType === "bug" || moveType === "poison") return "grass";
    if (moveType === "ice") return "ice";
    if (moveType === "psychic" || moveType === "fairy") return "psychic";
    if (moveType === "ghost" || moveType === "dark") return "ghost";
    return "slash";
  }

  anchorPos(side) {
    const W = this.canvas?.width || 960;
    const H = this.canvas?.height || 420;
    return side === "enemy" ? { x: W * 0.72, y: H * 0.50 } : { x: W * 0.355, y: H * 0.71 };
  }

  playAttack(actorSide, moveType, dmg, eff, crit) {
    if (!this.canvas) this.canvas = document.getElementById("battle-vfx-canvas");
    if (!this.canvas) return;
    const targetSide = actorSide === "player" ? "enemy" : "player";
    const start = this.anchorPos(actorSide);
    const end = this.anchorPos(targetSide);
    const color = TYPE_COLORS[moveType] || "#ffffff";
    const spriteKey = this.vfxKeyForType(moveType);
    const isDrop = moveType === "electric" || moveType === "ice" || moveType === "psychic";

    this.attacks.push({
      t: 0,
      maxT: 38,
      sx: isDrop ? end.x : start.x,
      sy: isDrop ? 20 : start.y,
      ex: end.x,
      ey: end.y,
      spriteKey,
      color,
      targetSide,
      dmg,
      eff,
      crit,
      exploded: false,
    });
    this._startLoop();
  }

  burst(targetSide, moveType) {
    if (!this.canvas) this.canvas = document.getElementById("battle-vfx-canvas");
    if (!this.canvas) return;
    const pos = this.anchorPos(targetSide);
    const color = TYPE_COLORS[moveType] || "#ffffff";
    this.rings.push({ x: pos.x, y: pos.y, r: 10, maxR: 88, alpha: 0.9, color });
    for (let i = 0; i < 36; i++) {
      const angle = Math.random() * Math.PI * 2;
      const spd = 2.5 + Math.random() * 7;
      this.particles.push({
        x: pos.x,
        y: pos.y,
        vx: Math.cos(angle) * spd,
        vy: Math.sin(angle) * spd,
        r: 3 + Math.random() * 6,
        alpha: 1,
        color,
      });
    }
    this._startLoop();
  }

  throwBall(shakes, caught, ballKey = "poke_ball") {
    if (!this.canvas) this.canvas = document.getElementById("battle-vfx-canvas");
    if (!this.canvas) return;
    this.ballAnim = {
      t: 0,
      maxT: 52 + shakes * 20,
      shakes,
      caught,
      ballSpriteKey: String(ballKey).replace("_", "-"),
    };
    this._startLoop();
  }

  _startLoop() {
    if (this.running) return;
    this.running = true;
    const step = () => {
      const ctx = this.canvas.getContext("2d");
      ctx.imageSmoothingEnabled = false;
      ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

      // 1. Choreographed Spell Projectiles + Impact Explosions
      this.attacks = this.attacks.filter((a) => a.t < a.maxT);
      for (const a of this.attacks) {
        a.t += 1;
        const flyP = Math.min(1, a.t / 18);
        const cx = a.sx + (a.ex - a.sx) * flyP;
        const cy = a.sy + (a.ey - a.sy) * flyP;
        const vImg = this.vfxSprites[a.spriteKey];

        // Trail sparks during flight
        if (a.t <= 18) {
          this.particles.push({
            x: cx + (Math.random() - 0.5) * 16,
            y: cy + (Math.random() - 0.5) * 16,
            vx: (Math.random() - 0.5) * 2,
            vy: (Math.random() - 0.5) * 2,
            r: 4 + Math.random() * 4,
            alpha: 0.9,
            color: a.color,
          });
        }

        // Trigger impact burst & damage popup at t == 18
        if (a.t === 18 && !a.exploded) {
          a.exploded = true;
          this.rings.push({ x: a.ex, y: a.ey, r: 12, maxR: 110, alpha: 0.95, color: a.color });
          for (let i = 0; i < 36; i++) {
            const ang = Math.random() * Math.PI * 2;
            const sp = 2 + Math.random() * 8;
            this.particles.push({
              x: a.ex,
              y: a.ey,
              vx: Math.cos(ang) * sp,
              vy: Math.sin(ang) * sp,
              r: 3 + Math.random() * 6,
              alpha: 1,
              color: i % 4 === 0 ? "#ffffff" : a.color,
            });
          }
          if (a.dmg !== undefined) {
            let tag = `-${a.dmg}`;
            if (a.crit) tag = `CRIT! ${tag}`;
            else if (a.eff >= 2) tag = `SUPER! ${tag}`;
            this.popups.push({
              x: a.ex,
              y: a.ey - 28,
              vy: -1.6,
              alpha: 1.0,
              text: tag,
              color: a.crit ? "#facc15" : a.eff >= 2 ? "#4ade80" : "#ffffff",
            });
          }
        }

        // Draw crisp glowing pixel VFX sprite (flying -> expanding/fading impact)
        ctx.save();
        if (a.t <= 18) {
          const sz = 76 + flyP * 30;
          ctx.translate(cx, cy);
          if (a.spriteKey === "grass" || a.spriteKey === "water") ctx.rotate(a.t * 0.25);
          if (vImg && vImg.complete) ctx.drawImage(vImg, -sz / 2, -sz / 2, sz, sz);
        } else {
          const expP = (a.t - 18) / (a.maxT - 18);
          const sz = 110 + expP * 55;
          ctx.globalAlpha = Math.max(0, 1 - expP);
          ctx.translate(a.ex, a.ey);
          if (a.spriteKey === "grass" || a.spriteKey === "psychic") ctx.rotate(a.t * 0.16);
          if (vImg && vImg.complete) ctx.drawImage(vImg, -sz / 2, -sz / 2, sz, sz);
        }
        ctx.restore();
      }

      // 2. Shockwave Rings
      this.rings = this.rings.filter((r) => r.alpha > 0.04);
      for (const r of this.rings) {
        r.r += (r.maxR - r.r) * 0.22;
        r.alpha *= 0.86;
        ctx.save();
        ctx.globalAlpha = r.alpha;
        ctx.strokeStyle = r.color;
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(r.x, r.y, r.r, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }

      // 3. Sparks
      this.particles = this.particles.filter((p) => p.alpha > 0.03);
      for (const p of this.particles) {
        p.x += p.vx;
        p.y += p.vy;
        p.alpha *= 0.91;
        ctx.save();
        ctx.globalAlpha = p.alpha;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      // 4. Floating Pixel Damage Numbers
      this.popups = this.popups.filter((d) => d.alpha > 0.04);
      for (const d of this.popups) {
        d.y += d.vy;
        d.alpha *= 0.955;
        ctx.save();
        ctx.globalAlpha = d.alpha;
        ctx.font = 'bold 20px "Press Start 2P", "Pixelify Sans", monospace';
        ctx.textAlign = "center";
        ctx.lineWidth = 5;
        ctx.strokeStyle = "#090e1c";
        ctx.strokeText(d.text, d.x, d.y);
        ctx.fillStyle = d.color;
        ctx.fillText(d.text, d.x, d.y);
        ctx.restore();
      }

      if (this.ballAnim) {
        const b = this.ballAnim;
        b.t += 1;
        const progress = Math.min(1, b.t / 30);
        const start = this.anchorPos("player");
        const end = this.anchorPos("enemy");
        let bx = start.x + (end.x - start.x) * progress;
        let by = start.y + (end.y - start.y) * progress - Math.sin(progress * Math.PI) * 130;
        let rot = progress * 6;
        if (b.t > 30) {
          bx = end.x;
          by = end.y;
          rot = Math.sin((b.t - 30) * 0.45) * 0.55;
        }
        ctx.save();
        ctx.translate(bx, by);
        ctx.rotate(rot);
        const bImg = this.ballSprites[b.ballSpriteKey] || this.ballSprites["poke-ball"];
        if (bImg && bImg.complete) {
          ctx.drawImage(bImg, -22, -22, 44, 44);
        }
        ctx.restore();

        if (b.t >= b.maxT) {
          if (b.caught) {
            this.burst("enemy", "electric");
          }
          this.ballAnim = null;
        }
      }

      if (this.particles.length > 0 || this.attacks.length > 0 || this.rings.length > 0 || this.popups.length > 0 || this.ballAnim) {
        requestAnimationFrame(step);
      } else {
        this.running = false;
      }
    };
    requestAnimationFrame(step);
  }
}

window.BattleVFX = new BattleVFXRenderer("battle-vfx-canvas");

class RPGRenderer {
  constructor(canvasId) {
    this.canvasId = canvasId;
    this.sprites = {};
    this.pokeSprites = {};
    this.tileAtlas = {};
    this.loaded = false;
    this.mapData = null;
    this.playerX = 7;
    this.playerY = 8;
    this.targetX = 7;
    this.targetY = 8;
    this.dir = "down";
    this.stepPhase = 0;
    this.weather = [];
    this.loopStarted = false;
    this.preload();
    this._buildPixelAtlas();
  }

  preload() {
    const names = [
      "trainer_down",
      "trainer_up",
      "trainer_left",
      "trainer_right",
      "npc_trainer",
      "pokecenter",
      "tall_grass",
      "tree_forest",
      "cactus_desert",
      "pine_snow",
      "palm_coast",
      "rock_mountain",
    ];
    let left = names.length;
    for (const n of names) {
      const img = new Image();
      img.onload = () => {
        left -= 1;
        if (left === 0) this.loaded = true;
      };
      img.src = `/static/assets/rpg/${n}.png`;
      this.sprites[n] = img;
    }
  }

  _pxCanvas(w, h, drawFn) {
    const c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    const g = c.getContext("2d");
    g.imageSmoothingEnabled = false;
    drawFn(g);
    return c;
  }

  _buildPixelAtlas() {
    // 1. Nintendo DS Gen-4/5 Layered Emerald Canopy Tree (24x32 native pixel grid -> drawn crisp 48x64)
    this.tileAtlas.nintendo_tree = this._pxCanvas(24, 32, (g) => {
      // Trunk
      g.fillStyle = "#452310";
      g.fillRect(9, 23, 6, 8);
      g.fillStyle = "#7c431f";
      g.fillRect(10, 23, 4, 7);
      g.fillStyle = "#9c592d";
      g.fillRect(11, 24, 1, 5);
      // Lower shadow foliage skirt
      const tiers = [
        { y: 15, rx: 10, ry: 6, dark: "#174b1e", mid: "#2d7e2b", hi: "#4eb43c", top: "#78e051" },
        { y: 9, rx: 8, ry: 5, dark: "#1b5922", mid: "#369432", hi: "#5dc747", top: "#8cf062" },
        { y: 4, rx: 5, ry: 4, dark: "#1e6625", mid: "#45ab3d", hi: "#74da58", top: "#a6f77b" },
      ];
      for (const tr of tiers) {
        for (let dy = -tr.ry; dy <= tr.ry; dy++) {
          for (let dx = -tr.rx; dx <= tr.rx; dx++) {
            const d = (dx * dx) / (tr.rx * tr.rx) + (dy * dy) / (tr.ry * tr.ry);
            if (d > 1.0) continue;
            const px = 12 + dx;
            const py = tr.y + dy;
            if (d > 0.78 || dy === tr.ry) g.fillStyle = tr.dark;
            else if (dy > 1) g.fillStyle = tr.mid;
            else if (dy > -2) g.fillStyle = tr.hi;
            else g.fillStyle = tr.top;
            g.fillRect(px, py, 1, 1);
          }
        }
      }
      // Crisp pixel dither highlights
      g.fillStyle = "#c4fca0";
      g.fillRect(10, 2, 2, 1);
      g.fillRect(8, 7, 2, 1);
      g.fillRect(14, 12, 2, 1);
    });

    // 2. Tall Wild Grass Clump (20x20 crisp layered DS blades)
    this.tileAtlas.tall_grass = this._pxCanvas(20, 20, (g) => {
      g.fillStyle = "#185923";
      g.fillRect(2, 13, 16, 5);
      const blades = [3, 6, 9, 12, 15];
      for (const bx of blades) {
        g.fillStyle = "#165220";
        g.fillRect(bx, 6, 2, 11);
        g.fillStyle = "#298c35";
        g.fillRect(bx, 5, 2, 8);
        g.fillStyle = "#5ad454";
        g.fillRect(bx, 4, 1, 5);
        g.fillStyle = "#9cf57a";
        g.fillRect(bx, 3, 1, 2);
      }
      g.fillStyle = "#34a13f";
      g.fillRect(4, 11, 12, 4);
      g.fillStyle = "#6ee663";
      g.fillRect(5, 9, 2, 3);
      g.fillRect(11, 8, 2, 3);
      g.fillRect(14, 10, 2, 2);
    });

    // 3. Conical-Roof Park Gazebo (26x32 native pixel grid)
    this.tileAtlas.gazebo = this._pxCanvas(26, 32, (g) => {
      // Raised stone floor & steps
      g.fillStyle = "#64748b";
      g.fillRect(1, 22, 24, 9);
      g.fillStyle = "#cbd5e1";
      g.fillRect(2, 21, 22, 7);
      g.fillStyle = "#e2e8f0";
      g.fillRect(3, 22, 20, 4);
      // Red park bench trim
      g.fillStyle = "#b91c1c";
      g.fillRect(5, 25, 6, 2);
      g.fillRect(15, 25, 6, 2);
      // Timber pillars
      g.fillStyle = "#451a03";
      g.fillRect(4, 13, 2, 10);
      g.fillRect(20, 13, 2, 10);
      g.fillRect(12, 14, 2, 7);
      // Conical tiled gray slate roof
      for (let ry = 0; ry < 12; ry++) {
        const w = Math.min(24, 2 + ry * 2);
        const rx = 13 - Math.floor(w / 2);
        g.fillStyle = ry < 3 ? "#cbd5e1" : ry < 7 ? "#94a3b8" : "#64748b";
        g.fillRect(rx, 4 + ry, w, 1);
        g.fillStyle = "#334155";
        g.fillRect(rx, 4 + ry, 1, 1);
        g.fillRect(rx + w - 1, 4 + ry, 1, 1);
      }
      g.fillStyle = "#334155";
      g.fillRect(1, 15, 24, 2);
      // Spire finial
      g.fillStyle = "#475569";
      g.fillRect(12, 1, 2, 3);
      g.fillStyle = "#f1f5f9";
      g.fillRect(12, 1, 1, 1);
    });

    // 4. Mossy Fallen Log / Stump (20x20)
    this.tileAtlas.log = this._pxCanvas(20, 20, (g) => {
      g.fillStyle = "#3e1f0d";
      g.fillRect(2, 9, 16, 8);
      g.fillStyle = "#784421";
      g.fillRect(3, 10, 13, 6);
      g.fillStyle = "#9a5b30";
      g.fillRect(4, 10, 10, 2);
      // Cut end rings
      g.fillStyle = "#eab364";
      g.fillRect(15, 10, 3, 6);
      g.fillStyle = "#b87a3d";
      g.fillRect(16, 12, 1, 2);
      // Moss patches
      g.fillStyle = "#4ade80";
      g.fillRect(5, 9, 4, 2);
      g.fillRect(10, 11, 3, 1);
    });

    // Re-attach 5. Park Streetlamp & 6. Terrain 16x16 Atlases cleanly
    this.tileAtlas.lamp = this._pxCanvas(20, 26, (g) => {
      g.fillStyle = "#1e293b";
      g.fillRect(8, 20, 4, 5);
      g.fillStyle = "#334155";
      g.fillRect(9, 7, 2, 14);
      g.fillStyle = "#0f172a";
      g.fillRect(7, 2, 6, 6);
      g.fillStyle = "#fde047";
      g.fillRect(8, 4, 4, 3);
      g.fillStyle = "#fef9c3";
      g.fillRect(9, 4, 2, 2);
      g.fillStyle = "#475569";
      g.fillRect(8, 1, 4, 1);
    });

    // 6. Crisp 16x16 Pre-Baked Pixel Terrain Tiles (Zero Flat 2D Look!)
    const makeGrassTile = (base, mid, dark, hi, seedOffset) =>
      this._pxCanvas(16, 16, (g) => {
        g.fillStyle = base;
        g.fillRect(0, 0, 16, 16);
        for (let py = 0; py < 16; py++) {
          for (let px = 0; px < 16; px++) {
            const n = ((px * 37 + py * 91 + seedOffset * 53) ^ (px * 13)) & 15;
            if (n < 3) {
              g.fillStyle = mid;
              g.fillRect(px, py, 1, 1);
            } else if (n === 7) {
              g.fillStyle = dark;
              g.fillRect(px, py, 1, 2);
            } else if (n === 14) {
              g.fillStyle = hi;
              g.fillRect(px, py, 1, 1);
            }
          }
        }
        // Subtle 3-pixel clover/blade cluster
        g.fillStyle = dark;
        g.fillRect(3 + (seedOffset % 5), 4, 1, 2);
        g.fillRect(4 + (seedOffset % 5), 5, 1, 1);
        g.fillStyle = hi;
        g.fillRect(10, 10 - (seedOffset % 3), 1, 1);
        g.fillRect(11, 11 - (seedOffset % 3), 1, 1);
      });

    this.tileAtlas.grass_sunny_0 = makeGrassTile("#62c74f", "#57b945", "#439935", "#7ce063", 1);
    this.tileAtlas.grass_sunny_1 = makeGrassTile("#5ec24b", "#52b241", "#3e9231", "#78dc5e", 4);
    this.tileAtlas.grass_snow_0 = makeGrassTile("#95d0e8", "#83c0d9", "#69a5bf", "#c4ecfa", 2);
    this.tileAtlas.grass_snow_1 = makeGrassTile("#8ecae2", "#7bb9d3", "#619db8", "#bfe7f8", 5);
    this.tileAtlas.grass_desert_0 = makeGrassTile("#d9b368", "#caa256", "#ab8339", "#ebd08e", 3);
    this.tileAtlas.grass_desert_1 = makeGrassTile("#d2ab60", "#c29a4f", "#a37c33", "#e6c985", 6);
    this.tileAtlas.grass_rain_0 = makeGrassTile("#4db857", "#40a349", "#2f8538", "#6ed46d", 7);
    this.tileAtlas.grass_rain_1 = makeGrassTile("#48b252", "#3b9d44", "#2b7e34", "#68ce68", 8);

    this.tileAtlas.road_16 = this._pxCanvas(16, 16, (g) => {
      g.fillStyle = "#d9c17e";
      g.fillRect(0, 0, 16, 16);
      for (let py = 0; py < 16; py++) {
        for (let px = 0; px < 16; px++) {
          const n = (px * 41 + py * 73) & 15;
          if (n === 2 || n === 9) {
            g.fillStyle = "#c4a761";
            g.fillRect(px, py, 2, 1);
          } else if (n === 13) {
            g.fillStyle = "#efe0ab";
            g.fillRect(px, py, 1, 1);
          }
        }
      }
      g.fillStyle = "#b5954c";
      g.fillRect(3, 11, 2, 2);
      g.fillRect(11, 4, 2, 1);
    });

    this.tileAtlas.cliff_16 = this._pxCanvas(16, 16, (g) => {
      // Grass overhang + dark rim
      g.fillStyle = "#75d95c";
      g.fillRect(0, 0, 16, 3);
      g.fillStyle = "#48aa3b";
      g.fillRect(0, 3, 16, 1);
      g.fillStyle = "#2b5e22";
      g.fillRect(0, 4, 16, 1);
      // 3D Striated Terracotta Cliff Face
      g.fillStyle = "#9b6438";
      g.fillRect(0, 5, 16, 11);
      g.fillStyle = "#744522";
      g.fillRect(0, 13, 16, 3);
      for (let cx = 2; cx < 16; cx += 5) {
        g.fillStyle = "#5c3416";
        g.fillRect(cx, 6, 1, 8);
        g.fillStyle = "#bd8151";
        g.fillRect(cx + 1, 6, 1, 6);
      }
    });
  }

  _getPokeMini(speciesId) {
    if (this.pokeSprites[speciesId]) return this.pokeSprites[speciesId];
    const img = new Image();
    img.src = `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${speciesId}.png`;
    this.pokeSprites[speciesId] = img;
    return img;
  }

  setMap(mapData, spawn) {
    this.mapData = mapData;
    this.playerX = spawn.x;
    this.playerY = spawn.y;
    this.targetX = spawn.x;
    this.targetY = spawn.y;
    this.camX = Math.max(0, spawn.x * 32 - 400);
    this.camY = Math.max(0, spawn.y * 32 - 280);
    this.dir = "down";
    this.initWeather();
    this.startLoop();
  }

  moveTo(nx, ny, dir) {
    this.dir = dir || this.dir;
    this.targetX = nx;
    this.targetY = ny;
    this.stepPhase += 1;
  }

  initWeather() {
    this.weather = [];
    for (let i = 0; i < 42; i++) {
      this.weather.push({
        x: Math.random() * 800,
        y: Math.random() * 560,
        speed: 1 + Math.random() * 2.2,
        r: 1.5 + Math.random() * 2.0,
        phase: Math.random() * Math.PI * 2,
      });
    }
  }

  _isRoadLike(t) {
    return t === 7 || t === 9 || t === 11;
  }

  _isWaterLike(t) {
    return t === 5 || t === 18;
  }

  _grassColors(weather, biome) {
    if (weather === "snow" || biome === "glacier" || biome === "taiga") {
      return { base: "#92cde6", tuft: "#6db4d4", light: "#cfeefa", cliffA: "#58728c", cliffB: "#3e556e", cliffTop: "#d6f2ff" };
    }
    if (weather === "sandstorm" || biome === "desert") {
      return { base: "#d6b064", tuft: "#bc9348", light: "#ebd08d", cliffA: "#a36a39", cliffB: "#7a4a22", cliffTop: "#dfc077" };
    }
    if (weather === "mist") {
      return { base: "#4ea85f", tuft: "#3c8b4e", light: "#6ec477", cliffA: "#7b5a44", cliffB: "#5a3d2b", cliffTop: "#64be6e" };
    }
    if (weather === "rain") {
      return { base: "#4cb551", tuft: "#3b9840", light: "#6fd16d", cliffA: "#8a5a36", cliffB: "#633c20", cliffTop: "#63cc61" };
    }
    // Signature Nintendo DS Spring/Emerald HGSS palette matching screenshot!
    return { base: "#62c74f", tuft: "#48aa3b", light: "#82df6b", cliffA: "#9b6438", cliffB: "#744522", cliffTop: "#75d95c" };
  }

  obstacleKeyForZone(weather, biome) {
    if (weather === "snow" || biome === "glacier" || biome === "taiga") return "pine_snow";
    if (weather === "sandstorm" || biome === "desert") return "cactus_desert";
    if (weather === "storm" || biome === "mountain") return "rock_mountain";
    if (biome === "coast" || biome === "savanna") return "palm_coast";
    return "nintendo_tree";
  }

  startLoop() {
    if (this.loopStarted) return;
    this.loopStarted = true;
    const tick = (ts) => {
      this.render(ts * 0.001);
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }

  render(t) {
    const panel = document.getElementById("panel-explore");
    if (panel && !panel.classList.contains("active")) return;
    const canvas = document.getElementById(this.canvasId);
    if (!canvas || !this.mapData) return;
    const ctx = canvas.getContext("2d");
    ctx.imageSmoothingEnabled = false;

    const m = this.mapData;
    const TILE = 32;
    const worldW = m.width * TILE;
    const worldH = m.height * TILE;
    const grassKeyPrefix = (weather, biome) => {
      if (weather === "snow" || biome === "glacier" || biome === "taiga") return "snow";
      if (weather === "sandstorm" || biome === "desert") return "desert";
      if (weather === "rain" || weather === "mist") return "rain";
      return "sunny";
    };
    const elevAt = (x, y) => (m.elev_grid && m.elev_grid[y]?.[x] !== undefined ? m.elev_grid[y][x] : 0);
    const tileAt = (x, y) => (y >= 0 && y < m.height && x >= 0 && x < m.width ? m.grid[y][x] : 2);

    // Smooth walk interpolation
    const dx = this.targetX - this.playerX;
    const dy = this.targetY - this.playerY;
    const moving = Math.abs(dx) > 0.02 || Math.abs(dy) > 0.02;
    this.playerX = moving ? this.playerX + dx * 0.30 : this.targetX;
    this.playerY = moving ? this.playerY + dy * 0.30 : this.targetY;

    const goalCamX = Math.max(0, Math.min(worldW - canvas.width, (this.playerX + 0.5) * TILE - canvas.width / 2));
    const goalCamY = Math.max(0, Math.min(worldH - canvas.height, (this.playerY + 0.5) * TILE - canvas.height / 2));
    this.camX = this.camX === undefined ? goalCamX : this.camX + (goalCamX - this.camX) * 0.18;
    this.camY = this.camY === undefined ? goalCamY : this.camY + (goalCamY - this.camY) * 0.18;

    const minCol = Math.max(0, Math.floor(this.camX / TILE) - 1);
    const maxCol = Math.min(m.width - 1, Math.ceil((this.camX + canvas.width) / TILE) + 1);
    const minRow = Math.max(0, Math.floor(this.camY / TILE) - 1);
    const maxRow = Math.min(m.height - 1, Math.ceil((this.camY + canvas.height) / TILE) + 1);

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const curTx = Math.max(0, Math.min(m.width - 1, Math.round(this.playerX)));
    const curTy = Math.max(0, Math.min(m.height - 1, Math.round(this.playerY)));
    const curZIdx = m.zone_grid ? (m.zone_grid[curTy]?.[curTx] ?? 0) : 0;
    const curZone = m.zones?.[curZIdx] || { name: "Region", weather: "sunny", weather_label: "☀️ Nắng Ấm" };

    // PASS 1: Crisp Terrain, Auto-Tiled Roads, Layered Water & Waterfalls, Terraced Cliffs & Stairs
    for (let y = minRow; y <= maxRow; y++) {
      for (let x = minCol; x <= maxCol; x++) {
        const px = Math.floor(x * TILE - this.camX);
        const py = Math.floor(y * TILE - this.camY);
        const tile = m.grid[y][x];
        const zIdx = m.zone_grid ? (m.zone_grid[y]?.[x] ?? 0) : 0;
        const zone = m.zones?.[zIdx] || { weather: "sunny" };
        const pal = this._grassColors(zone.weather, m.biome);
        const el = elevAt(x, y);
        const elUp = elevAt(x, y - 1);

        // Water & Animated Cascading Waterfalls
        if (this._isWaterLike(tile) || tile === 9) {
          const isFall = y > 0 && this._isWaterLike(tileAt(x, y - 1)) && elUp > el && tile !== 9;
          if (isFall) {
            // Cascading white/blue Nintendo DS waterfall!
            ctx.fillStyle = "#2d7ec2";
            ctx.fillRect(px, py, TILE, TILE);
            const flow = Math.floor(t * 28) % TILE;
            for (let sx = 3; sx < TILE - 4; sx += 7) {
              ctx.fillStyle = "#bae6fd";
              ctx.fillRect(px + sx, py + flow, 4, 14);
              ctx.fillRect(px + sx, py + ((flow + 20) % TILE), 4, 12);
              ctx.fillStyle = "#ffffff";
              ctx.fillRect(px + sx + 1, py + ((flow + 4) % TILE), 2, 8);
            }
            // Top lip & bottom churning splash foam
            ctx.fillStyle = "#ffffff";
            ctx.fillRect(px, py, TILE, 5);
            const splash = Math.sin(t * 9 + x) * 2;
            ctx.fillStyle = "rgba(255,255,255,0.9)";
            ctx.fillRect(px + 2, py + TILE - 8 + splash * 0.4, TILE - 4, 6);
          } else {
            // Stepped DS River Shading + Animated Ripples
            ctx.fillStyle = "#3688c9";
            ctx.fillRect(px, py, TILE, TILE);
            ctx.fillStyle = "#489ce0";
            ctx.fillRect(px, py + 4, TILE, TILE - 8);
            const shift = Math.floor((t * 14 + x * 11 + y * 5) % (TILE - 12));
            ctx.fillStyle = "rgba(186, 230, 253, 0.55)";
            ctx.fillRect(px + shift, py + 11, 10, 2);
            ctx.fillRect(px + ((shift + 17) % (TILE - 10)), py + 27, 8, 2);
            // Shoreline banks & foam rims
            if (!this._isWaterLike(tileAt(x - 1, y)) && tileAt(x - 1, y) !== 9) {
              ctx.fillStyle = "#d8be7d";
              ctx.fillRect(px, py, 4, TILE);
              ctx.fillStyle = "#1f5a8c";
              ctx.fillRect(px + 4, py, 2, TILE);
            }
            if (!this._isWaterLike(tileAt(x + 1, y)) && tileAt(x + 1, y) !== 9) {
              ctx.fillStyle = "#d8be7d";
              ctx.fillRect(px + TILE - 4, py, 4, TILE);
              ctx.fillStyle = "#1f5a8c";
              ctx.fillRect(px + TILE - 6, py, 2, TILE);
            }
            if (!this._isWaterLike(tileAt(x, y - 1)) && tileAt(x, y - 1) !== 9) {
              ctx.fillStyle = "#1f5a8c";
              ctx.fillRect(px, py, TILE, 4);
              ctx.fillStyle = "rgba(224, 242, 254, 0.72)";
              ctx.fillRect(px, py + 4, TILE, 3);
            }
          }

          // Water rocks & lilypads (tile 18)
          if (tile === 18) {
            if ((x + y) % 2 === 0) {
              // Mossy River Boulder with ripple ring
              ctx.fillStyle = "rgba(255,255,255,0.45)";
              ctx.fillRect(px + 6, py + 24, 28, 8);
              ctx.fillStyle = "#475569";
              ctx.fillRect(px + 9, py + 11, 22, 16);
              ctx.fillStyle = "#94a3b8";
              ctx.fillRect(px + 11, py + 12, 16, 10);
              ctx.fillStyle = "#4ade80";
              ctx.fillRect(px + 13, py + 11, 9, 4);
            } else {
              // Floating Lilypad & Pink Lotus
              ctx.fillStyle = "#166534";
              ctx.fillRect(px + 9, py + 14, 18, 13);
              ctx.fillStyle = "#4ade80";
              ctx.fillRect(px + 10, py + 13, 16, 11);
              ctx.fillStyle = "#3688c9";
              ctx.fillRect(px + 22, py + 17, 5, 3);
              ctx.fillStyle = "#f472b6";
              ctx.fillRect(px + 14, py + 15, 5, 4);
            }
          }

          // Wide Timber Bridge over river (tile 9)
          if (tile === 9) {
            ctx.fillStyle = "rgba(10, 22, 46, 0.42)";
            ctx.fillRect(px, py + TILE - 6, TILE, 6);
            ctx.fillStyle = "#6e3b17";
            ctx.fillRect(px, py + 2, TILE, TILE - 6);
            for (let b = 2; b < TILE - 2; b += 8) {
              ctx.fillStyle = b % 16 === 2 ? "#a86936" : "#965a2c";
              ctx.fillRect(px + b, py + 4, 6, TILE - 10);
              ctx.fillStyle = "#45210a";
              ctx.fillRect(px + b + 6, py + 4, 2, TILE - 10);
            }
            // Top & bottom bridge guardrails
            ctx.fillStyle = "#d99a5b";
            ctx.fillRect(px, py + 2, TILE, 3);
            ctx.fillRect(px, py + TILE - 8, TILE, 3);
            ctx.fillStyle = "#45210a";
            ctx.fillRect(px + 1, py + 1, 5, 5);
            ctx.fillRect(px + TILE - 6, py + 1, 5, 5);
          }
          continue;
        }

        // Base 16x16 Baked Pixel Meadow Grass Texture (scaled crisp 2x!)
        const gk = grassKeyPrefix(zone.weather, m.biome);
        const gTile = this.tileAtlas[`grass_${gk}_${(x + y) & 1}`] || this.tileAtlas.grass_sunny_0;
        ctx.drawImage(gTile, px, py, TILE, TILE);
        const seed = (x * 73856093 ^ y * 19349663) >>> 0;

        // Auto-Tiled 16x16 Dirt Road (tile 7) with Jagged Grass Borders & Staircase (tile 11)
        if (tile === 7 || tile === 11) {
          ctx.drawImage(this.tileAtlas.road_16, px, py, TILE, TILE);
          if (!this._isRoadLike(tileAt(x - 1, y))) {
            ctx.fillStyle = pal.cliffTop;
            ctx.fillRect(px, py, 2, TILE);
          }
          if (!this._isRoadLike(tileAt(x + 1, y))) {
            ctx.fillStyle = pal.cliffTop;
            ctx.fillRect(px + TILE - 2, py, 2, TILE);
          }
          if (!this._isRoadLike(tileAt(x, y - 1))) {
            ctx.fillStyle = pal.cliffTop;
            ctx.fillRect(px, py, TILE, 2);
          }
          if (!this._isRoadLike(tileAt(x, y + 1))) {
            ctx.fillStyle = pal.tuft;
            ctx.fillRect(px, py + TILE - 2, TILE, 2);
          }

          if (tile === 11) {
            ctx.fillStyle = "#57534e";
            ctx.fillRect(px + 2, py, TILE - 4, TILE);
            for (let sy = 2; sy < TILE; sy += 7) {
              ctx.fillStyle = "#d6d3d1";
              ctx.fillRect(px + 4, py + sy, TILE - 8, 4);
              ctx.fillStyle = "#78716c";
              ctx.fillRect(px + 4, py + sy + 4, TILE - 8, 3);
            }
          }
          continue;
        }

        // 3D South Cliff Wall (tile 12) & Cave Door (tile 15) from baked pixel cliff sprite
        if (tile === 12 || tile === 15) {
          ctx.drawImage(this.tileAtlas.cliff_16, px, py, TILE, TILE);
          if (tile === 15) {
            ctx.fillStyle = "#292524";
            ctx.fillRect(px + 6, py + 11, TILE - 12, TILE - 11);
            ctx.fillStyle = "#090d16";
            ctx.fillRect(px + 9, py + 14, TILE - 18, TILE - 14);
            ctx.fillStyle = "#78716c";
            ctx.fillRect(px + 5, py + 9, 3, TILE - 9);
            ctx.fillRect(px + TILE - 8, py + 9, 3, TILE - 9);
          }
          continue;
        }

        // Auto Elevation Side Bevels for raised ridges (left/right edges where elev drops)
        if (el > elevAt(x - 1, y)) {
          ctx.fillStyle = pal.cliffB;
          ctx.fillRect(px, py, 4, TILE);
        }
        if (el > elevAt(x + 1, y)) {
          ctx.fillStyle = pal.cliffB;
          ctx.fillRect(px + TILE - 4, py, 4, TILE);
        }
        if (el > elevAt(x, y - 1)) {
          ctx.fillStyle = pal.cliffB;
          ctx.fillRect(px, py, TILE, 3);
        }

        // Colorful Flower Clusters & Red Toadstool Mushrooms (tile 8)
        if (tile === 8) {
          const sway = Math.sin(t * 2.8 + x * 0.9) > 0 ? 1 : 0;
          const colors = ["#ef4444", "#fde047", "#38bdf8", "#f472b6"];
          const c1 = colors[(x + y) % colors.length];
          const c2 = colors[(x * 2 + y + 1) % colors.length];
          ctx.fillStyle = "#166534";
          ctx.fillRect(px + 8, py + 12, 8, 5);
          ctx.fillRect(px + 22, py + 24, 8, 5);
          ctx.fillStyle = c1;
          ctx.fillRect(px + 9 + sway, py + 9, 6, 5);
          ctx.fillStyle = c2;
          ctx.fillRect(px + 23 - sway, py + 21, 6, 5);
          ctx.fillStyle = "#ffffff";
          ctx.fillRect(px + 11 + sway, py + 11, 2, 2);
          ctx.fillRect(px + 25 - sway, py + 23, 2, 2);
          if (seed % 3 === 0) {
            // Tiny spotted mushroom
            ctx.fillStyle = "#fef3c7";
            ctx.fillRect(px + 10, py + 28, 3, 4);
            ctx.fillStyle = "#dc2626";
            ctx.fillRect(px + 8, py + 25, 7, 4);
            ctx.fillStyle = "#ffffff";
            ctx.fillRect(px + 9, py + 26, 2, 1);
          }
        }
      }
    }

    // PASS 2: Depth-Sorted Overlapping Trees, Tall Grass, Fences, Gazebos, Overworld Pokemon & Trainer!
    const centerSprite = this.sprites.pokecenter;
    const npcSprite = this.sprites.npc_trainer;
    const playerTileY = Math.round(this.playerY);
    const overPokes = m.overworld_pokemon || [];

    for (let y = minRow; y <= maxRow; y++) {
      for (let x = minCol; x <= maxCol; x++) {
        const tile = m.grid[y][x];
        const px = Math.floor(x * TILE - this.camX);
        const py = Math.floor(y * TILE - this.camY);
        const zIdx = m.zone_grid ? (m.zone_grid[y]?.[x] ?? 0) : 0;
        const zone = m.zones?.[zIdx] || { weather: "sunny" };

        if (tile === 1) {
          // Layered animated Nintendo Tall Grass
          const rustle = Math.abs(x - curTx) <= 0 && Math.abs(y - curTy) <= 0 ? Math.sin(t * 20) * 2 : Math.sin(t * 2.4 + x * 0.6 + y) * 1.1;
          ctx.drawImage(this.tileAtlas.tall_grass, px + rustle, py + 2, TILE, TILE - 2);
        } else if (tile === 2) {
          // Dense Overlapping Nintendo Canopy Tree (or Snow/Desert/Coast variant)
          const obsKey = this.obstacleKeyForZone(zone.weather, m.biome);
          ctx.fillStyle = "rgba(0,0,0,0.28)";
          ctx.beginPath();
          ctx.ellipse(px + TILE / 2, py + TILE - 4, TILE * 0.42, 6, 0, 0, Math.PI * 2);
          ctx.fill();
          if (obsKey === "nintendo_tree") {
            ctx.drawImage(this.tileAtlas.nintendo_tree, px - 4, py - 18, TILE + 8, TILE + 18);
          } else if (this.sprites[obsKey]?.complete) {
            ctx.drawImage(this.sprites[obsKey], px - 3, py - 10, TILE + 6, TILE + 10);
          }
        } else if (tile === 3) {
          const glow = 0.25 + 0.14 * Math.sin(t * 3);
          ctx.fillStyle = `rgba(236, 72, 153, ${glow})`;
          ctx.beginPath();
          ctx.ellipse(px + TILE / 2, py + TILE - 2, TILE * 0.62, 10, 0, 0, Math.PI * 2);
          ctx.fill();
          if (centerSprite && centerSprite.complete) {
            ctx.drawImage(centerSprite, px - 12, py - 24, TILE + 24, TILE + 24);
          }
        } else if (tile === 4) {
          ctx.fillStyle = "rgba(0,0,0,0.32)";
          ctx.beginPath();
          ctx.ellipse(px + TILE / 2, py + TILE - 5, TILE * 0.3, 5, 0, 0, Math.PI * 2);
          ctx.fill();
          if (npcSprite && npcSprite.complete) {
            ctx.drawImage(npcSprite, px + 2, py - 6, TILE - 4, TILE + 2);
          }
          const bob = Math.sin(t * 5) * 2.5;
          ctx.fillStyle = "#f59e0b";
          ctx.strokeStyle = "#111";
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.roundRect(px + TILE / 2 - 9, py - 20 + bob, 18, 16, 4);
          ctx.fill();
          ctx.stroke();
          ctx.fillStyle = "#111";
          ctx.font = "bold 12px sans-serif";
          ctx.textAlign = "center";
          ctx.fillText("!", px + TILE / 2, py - 8 + bob);
        } else if (tile === 10) {
          ctx.fillStyle = "rgba(0,0,0,0.28)";
          ctx.fillRect(px + 12, py + TILE - 7, 16, 4);
          ctx.fillStyle = "#5c3a1e";
          ctx.fillRect(px + TILE / 2 - 3, py + TILE / 2, 6, 15);
          ctx.fillStyle = "#b45309";
          ctx.strokeStyle = "#291809";
          ctx.lineWidth = 2;
          ctx.fillRect(px + 7, py + 8, TILE - 14, 15);
          ctx.strokeRect(px + 7, py + 8, TILE - 14, 15);
          ctx.fillStyle = "#fef3c7";
          ctx.fillRect(px + 11, py + 12, TILE - 22, 2);
          ctx.fillRect(px + 11, py + 17, TILE - 26, 2);
        } else if (tile === 13) {
          // Conical Slate Gazebo Rest Hut
          ctx.fillStyle = "rgba(0,0,0,0.28)";
          ctx.fillRect(px - 2, py + TILE - 6, TILE + 4, 6);
          ctx.drawImage(this.tileAtlas.gazebo, px - 6, py - 22, TILE + 12, TILE + 22);
        } else if (tile === 14) {
          // Auto-Connected Wrought-Iron & Brick Park Fence
          ctx.fillStyle = "rgba(0,0,0,0.25)";
          ctx.fillRect(px, py + TILE - 7, TILE, 5);
          ctx.fillStyle = "#475569";
          ctx.fillRect(px, py + 18, TILE, 3);
          ctx.fillRect(px, py + 26, TILE, 3);
          for (let fx = 4; fx < TILE; fx += 7) {
            ctx.fillStyle = "#94a3b8";
            ctx.fillRect(px + fx, py + 13, 3, 21);
          }
          // Brick pillar end-posts
          if (tileAt(x - 1, y) !== 14 || tileAt(x + 1, y) !== 14) {
            ctx.fillStyle = "#92400e";
            ctx.fillRect(px + 14, py + 10, 12, 26);
            ctx.fillStyle = "#e2e8f0";
            ctx.fillRect(px + 13, py + 9, 14, 4);
          }
        } else if (tile === 16) {
          ctx.drawImage(this.tileAtlas.log, px + 2, py + 4, TILE - 4, TILE - 4);
        } else if (tile === 17) {
          // Warm glowing streetlamp
          ctx.fillStyle = "rgba(253, 224, 71, 0.14)";
          ctx.beginPath();
          ctx.arc(px + TILE / 2, py + 6, 22 + Math.sin(t * 3) * 2, 0, Math.PI * 2);
          ctx.fill();
          ctx.drawImage(this.tileAtlas.lamp, px + 4, py - 12, TILE - 8, TILE + 8);
        }
      }

      // Draw Live Roaming Wild Pokémon on row y
      for (const op of overPokes) {
        if (op.y !== y) continue;
        const hopX = Math.sin(t * 1.4 + op.x * 3) * 4;
        const hopY = Math.abs(Math.sin(t * 4.2 + op.y * 2)) * 3;
        const opx = Math.floor(op.x * TILE - this.camX + hopX);
        const opy = Math.floor(op.y * TILE - this.camY);
        ctx.fillStyle = "rgba(0,0,0,0.28)";
        ctx.beginPath();
        ctx.ellipse(opx + TILE / 2, opy + TILE - 6, 11, 4, 0, 0, Math.PI * 2);
        ctx.fill();
        const pImg = this._getPokeMini(op.species_id);
        if (pImg && pImg.complete) {
          ctx.drawImage(pImg, opx - 2, opy - 10 - hopY, TILE + 4, TILE + 4);
        }
      }

      // Draw Player Trainer Sprite on row playerTileY
      if (y === playerTileY) {
        const ppx = Math.floor(this.playerX * TILE - this.camX);
        const ppy = Math.floor(this.playerY * TILE - this.camY);
        const walkBob = moving ? Math.abs(Math.sin(t * 18)) * 4 : Math.sin(t * 2.5) * 0.8;
        ctx.fillStyle = "rgba(0,0,0,0.36)";
        ctx.beginPath();
        ctx.ellipse(ppx + TILE / 2, ppy + TILE - 5, TILE * 0.3, 5.5, 0, 0, Math.PI * 2);
        ctx.fill();
        const pSprite = this.sprites[`trainer_${this.dir}`] || this.sprites.trainer_down;
        if (pSprite && pSprite.complete) {
          ctx.drawImage(pSprite, ppx + 1, ppy - 8 - walkBob, TILE - 2, TILE + 2);
        }
      }
    }

    // PASS 3: Dynamic Weather Overlay
    const cw = curZone.weather || "sunny";
    if (cw === "mist") {
      ctx.fillStyle = "rgba(180, 195, 240, 0.14)";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    } else if (cw === "sandstorm") {
      ctx.fillStyle = "rgba(217, 160, 75, 0.14)";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    } else if (cw === "storm" && Math.sin(t * 11) > 0.96) {
      ctx.fillStyle = "rgba(255, 255, 255, 0.16)";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    for (const w of this.weather) {
      if (cw === "rain" || cw === "storm") {
        w.x = (w.x - w.speed * 1.4 + canvas.width) % canvas.width;
        w.y = (w.y + w.speed * 4.5) % canvas.height;
        ctx.strokeStyle = cw === "storm" ? "rgba(186, 230, 253, 0.65)" : "rgba(125, 211, 252, 0.5)";
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(w.x, w.y);
        ctx.lineTo(w.x - 4, w.y + 12);
        ctx.stroke();
      } else if (cw === "snow") {
        w.x = (w.x + Math.sin(t + w.phase) * 0.6 + canvas.width) % canvas.width;
        w.y = (w.y + w.speed * 0.9) % canvas.height;
        ctx.fillStyle = "rgba(255, 255, 255, 0.85)";
        ctx.beginPath();
        ctx.arc(w.x, w.y, w.r, 0, Math.PI * 2);
        ctx.fill();
      } else if (cw === "sandstorm") {
        w.x = (w.x + w.speed * 3.8) % canvas.width;
        w.y = (w.y + w.speed * 0.6) % canvas.height;
        ctx.fillStyle = "rgba(253, 224, 155, 0.55)";
        ctx.fillRect(w.x, w.y, 7, 2);
      } else {
        w.x = (w.x + Math.cos(w.phase) * 0.35 + canvas.width) % canvas.width;
        w.y = (w.y + w.speed * 0.25) % canvas.height;
        w.phase += 0.03;
        ctx.fillStyle = cw === "mist" ? "rgba(216, 180, 254, 0.45)" : "rgba(254, 240, 138, 0.32)";
        ctx.beginPath();
        ctx.arc(w.x, w.y, w.r, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // PASS 4: Location & Weather HUD Banner
    ctx.save();
    ctx.fillStyle = "rgba(11, 17, 32, 0.84)";
    ctx.strokeStyle = "#38bdf8";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(12, 12, 300, 44, 8);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#f8fafc";
    ctx.font = 'bold 13px "Pixelify Sans", sans-serif';
    ctx.textAlign = "left";
    ctx.fillText(`📍 ${curZone.name}`, 22, 31);
    ctx.fillStyle = "#fde047";
    ctx.font = '12px "Pixelify Sans", sans-serif';
    ctx.fillText(`${curZone.weather_label} · ${m.width}×${m.height} Nintendo Route`, 22, 48);
    ctx.restore();

    // PASS 5: Corner Minimap
    const mw = 132;
    const mh = Math.round((mw * m.height) / m.width);
    const mx0 = canvas.width - mw - 12;
    const my0 = 12;
    ctx.save();
    ctx.fillStyle = "rgba(8, 13, 25, 0.88)";
    ctx.strokeStyle = "#64748b";
    ctx.lineWidth = 2;
    ctx.fillRect(mx0 - 2, my0 - 2, mw + 4, mh + 4);
    ctx.strokeRect(mx0 - 2, my0 - 2, mw + 4, mh + 4);
    const sx = mw / m.width;
    const sy = mh / m.height;
    for (let y = 0; y < m.height; y++) {
      for (let x = 0; x < m.width; x++) {
        const v = m.grid[y][x];
        if (v === 5 || v === 18) ctx.fillStyle = "#38bdf8";
        else if (v === 7 || v === 9 || v === 11) ctx.fillStyle = "#e0c482";
        else if (v === 1) ctx.fillStyle = "#22c55e";
        else if (v === 12 || v === 15) ctx.fillStyle = "#925b31";
        else if (v === 2) ctx.fillStyle = "#166534";
        else ctx.fillStyle = "#4ade80";
        ctx.fillRect(mx0 + x * sx, my0 + y * sy, Math.ceil(sx), Math.ceil(sy));
      }
    }
    for (const z of m.zones || []) {
      ctx.fillStyle = z.is_signature ? "#fbbf24" : "#f8fafc";
      ctx.fillRect(mx0 + z.cx * sx - 1, my0 + z.cy * sy - 1, 3, 3);
    }
    ctx.fillStyle = "#ec4899";
    ctx.fillRect(mx0 + m.heal_pos.x * sx - 2, my0 + m.heal_pos.y * sy - 2, 4, 4);
    ctx.fillStyle = "#ef4444";
    ctx.beginPath();
    ctx.arc(mx0 + (this.playerX + 0.5) * sx, my0 + (this.playerY + 0.5) * sy, 3.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

window.RPGRenderer = new RPGRenderer("rpg-canvas");

