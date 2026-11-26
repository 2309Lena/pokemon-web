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

  setMap(mapData, spawn) {
    this.mapData = mapData;
    this.playerX = spawn.x;
    this.playerY = spawn.y;
    this.targetX = spawn.x;
    this.targetY = spawn.y;
    this.camX = Math.max(0, spawn.x * 44 - 400);
    this.camY = Math.max(0, spawn.y * 44 - 280);
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
    for (let i = 0; i < 48; i++) {
      this.weather.push({
        x: Math.random() * 800,
        y: Math.random() * 560,
        speed: 1 + Math.random() * 2.5,
        r: 1.5 + Math.random() * 2.2,
        phase: Math.random() * Math.PI * 2,
      });
    }
  }

  obstacleKeyForZone(weather, biome) {
    if (weather === "snow") return "pine_snow";
    if (weather === "sandstorm") return "cactus_desert";
    if (weather === "storm") return "rock_mountain";
    if (weather === "rain") return biome === "coast" ? "palm_coast" : "tree_forest";
    if (biome === "desert") return "cactus_desert";
    if (biome === "glacier" || biome === "taiga") return "pine_snow";
    if (biome === "coast" || biome === "savanna") return "palm_coast";
    if (biome === "mountain") return "rock_mountain";
    return "tree_forest";
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
    const TILE = 44;
    const worldW = m.width * TILE;
    const worldH = m.height * TILE;

    // Smooth walk interpolation
    const dx = this.targetX - this.playerX;
    const dy = this.targetY - this.playerY;
    const moving = Math.abs(dx) > 0.02 || Math.abs(dy) > 0.02;
    this.playerX = moving ? this.playerX + dx * 0.30 : this.targetX;
    this.playerY = moving ? this.playerY + dy * 0.30 : this.targetY;

    // Nintendo-style smooth scrolling camera centered on Player Trainer
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

    // 1. Ground tiles inside visible camera viewport
    for (let y = minRow; y <= maxRow; y++) {
      for (let x = minCol; x <= maxCol; x++) {
        const px = Math.floor(x * TILE - this.camX);
        const py = Math.floor(y * TILE - this.camY);
        const tile = m.grid[y][x];
        const zIdx = m.zone_grid ? (m.zone_grid[y]?.[x] ?? 0) : 0;
        const zone = m.zones?.[zIdx] || { groundA: m.palette.tileA, groundB: m.palette.tileB, weather: "sunny" };

        if (tile === 5) {
          const wave = Math.sin(t * 2.2 + x * 0.65 + y * 0.5);
          ctx.fillStyle = wave > 0.25 ? "#1b5e96" : wave < -0.35 ? "#12426e" : "#164f82";
          ctx.fillRect(px, py, TILE, TILE);
          const shift = Math.floor((t * 10 + y * 7) % (TILE - 10));
          ctx.fillStyle = "rgba(186, 230, 253, 0.55)";
          ctx.fillRect(px + shift, py + 12, 10, 3);
          ctx.fillRect(px + ((shift + 18) % (TILE - 8)), py + 28, 7, 2);
          if (y > 0 && m.grid[y - 1][x] !== 5) {
            ctx.fillStyle = "rgba(224, 242, 254, 0.72)";
            ctx.fillRect(px, py, TILE, 4);
          }
          continue;
        }

        ctx.fillStyle = (x + y) % 2 === 0 ? zone.groundA : zone.groundB;
        ctx.fillRect(px, py, TILE, TILE);

        if (tile === 6) {
          ctx.fillStyle = (x + y) % 2 === 0 ? "#dfc07d" : "#d4b26a";
          ctx.fillRect(px, py, TILE, TILE);
          ctx.fillStyle = "#b89550";
          ctx.fillRect(px + 9, py + 14, 4, 3);
          ctx.fillRect(px + 26, py + 30, 3, 3);
        } else if (tile === 7) {
          // Nintendo cobble route
          ctx.fillStyle = "#c9b382";
          ctx.fillRect(px, py, TILE, TILE);
          ctx.fillStyle = "#e0cd9f";
          ctx.fillRect(px + 6, py + 6, 12, 8);
          ctx.fillRect(px + 23, py + 22, 13, 9);
          ctx.fillStyle = "#a68e5b";
          ctx.fillRect(px + 24, py + 8, 9, 7);
        } else if (tile === 9) {
          ctx.fillStyle = "#164f82";
          ctx.fillRect(px, py, TILE, TILE);
          ctx.fillStyle = "#854d0e";
          ctx.fillRect(px + 1, py + 3, TILE - 2, TILE - 6);
          ctx.fillStyle = "#b45309";
          for (let b = 4; b < TILE - 6; b += 8) {
            ctx.fillRect(px + b, py + 5, 6, TILE - 10);
          }
          ctx.fillStyle = "#451a03";
          ctx.fillRect(px + 1, py + 3, TILE - 2, 3);
          ctx.fillRect(px + 1, py + TILE - 6, TILE - 2, 3);
        } else {
          const h = (x * 73 + y * 139) % 13;
          if (h < 4) {
            ctx.fillStyle = "rgba(255,255,255,0.1)";
            ctx.fillRect(px + (h + 2) * 5, py + ((h * 7) % 22) + 6, 4, 3);
          }
          if (tile === 8) {
            const sway = Math.sin(t * 3 + x) > 0 ? 1 : 0;
            ctx.fillStyle = "#16a34a";
            ctx.fillRect(px + 10, py + 15, 7, 4);
            ctx.fillRect(px + 25, py + 28, 7, 4);
            ctx.fillStyle = (x + y) % 2 === 0 ? "#fde047" : "#f472b6";
            ctx.fillRect(px + 11 + sway, py + 12, 5, 4);
            ctx.fillStyle = "#fff";
            ctx.fillRect(px + 26 - sway, py + 25, 4, 4);
          }
        }
      }
    }

    // 2. Depth-sorted objects + Player Sprite inside camera viewport
    const grassSprite = this.sprites.tall_grass;
    const centerSprite = this.sprites.pokecenter;
    const npcSprite = this.sprites.npc_trainer;
    const playerTileY = Math.round(this.playerY);

    for (let y = minRow; y <= maxRow; y++) {
      for (let x = minCol; x <= maxCol; x++) {
        const tile = m.grid[y][x];
        const px = Math.floor(x * TILE - this.camX);
        const py = Math.floor(y * TILE - this.camY);
        const zIdx = m.zone_grid ? (m.zone_grid[y]?.[x] ?? 0) : 0;
        const zone = m.zones?.[zIdx] || { weather: "sunny" };
        const obsSprite = this.sprites[this.obstacleKeyForZone(zone.weather, m.biome)];

        if (tile === 1) {
          const sway = Math.sin(t * 2.5 + x * 0.7 + y) * 1.4;
          if (grassSprite && grassSprite.complete) {
            ctx.drawImage(grassSprite, px + 2 + sway, py + 2, TILE - 4, TILE - 4);
          }
        } else if (tile === 2) {
          ctx.fillStyle = "rgba(0,0,0,0.28)";
          ctx.beginPath();
          ctx.ellipse(px + TILE / 2, py + TILE - 6, TILE * 0.34, 6, 0, 0, Math.PI * 2);
          ctx.fill();
          if (obsSprite && obsSprite.complete) {
            ctx.drawImage(obsSprite, px - 2, py - 8, TILE + 4, TILE + 6);
          }
        } else if (tile === 3) {
          const glow = 0.25 + 0.15 * Math.sin(t * 3);
          ctx.fillStyle = `rgba(236, 72, 153, ${glow})`;
          ctx.beginPath();
          ctx.ellipse(px + TILE / 2, py + TILE - 4, TILE * 0.52, 10, 0, 0, Math.PI * 2);
          ctx.fill();
          if (centerSprite && centerSprite.complete) {
            ctx.drawImage(centerSprite, px - 10, py - 18, TILE + 20, TILE + 18);
          }
        } else if (tile === 4) {
          ctx.fillStyle = "rgba(0,0,0,0.3)";
          ctx.beginPath();
          ctx.ellipse(px + TILE / 2, py + TILE - 6, TILE * 0.28, 5, 0, 0, Math.PI * 2);
          ctx.fill();
          if (npcSprite && npcSprite.complete) {
            ctx.drawImage(npcSprite, px + 2, py - 4, TILE - 4, TILE);
          }
          const bob = Math.sin(t * 5) * 2.5;
          ctx.fillStyle = "#f59e0b";
          ctx.strokeStyle = "#111";
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.roundRect(px + TILE / 2 - 9, py - 18 + bob, 18, 16, 4);
          ctx.fill();
          ctx.stroke();
          ctx.fillStyle = "#111";
          ctx.font = "bold 12px sans-serif";
          ctx.textAlign = "center";
          ctx.fillText("!", px + TILE / 2, py - 6 + bob);
        } else if (tile === 10) {
          // Landmark Wooden Signpost
          ctx.fillStyle = "#5c3a1e";
          ctx.fillRect(px + TILE / 2 - 3, py + TILE / 2, 6, 16);
          ctx.fillStyle = "#b45309";
          ctx.strokeStyle = "#291809";
          ctx.lineWidth = 2;
          ctx.fillRect(px + 9, py + 10, TILE - 18, 15);
          ctx.strokeRect(px + 9, py + 10, TILE - 18, 15);
          ctx.fillStyle = "#fef3c7";
          ctx.fillRect(px + 13, py + 14, TILE - 26, 2);
          ctx.fillRect(px + 13, py + 19, TILE - 30, 2);
        }
      }

      if (y === playerTileY) {
        const ppx = Math.floor(this.playerX * TILE - this.camX);
        const ppy = Math.floor(this.playerY * TILE - this.camY);
        const walkBob = moving ? Math.abs(Math.sin(t * 18)) * 4 : Math.sin(t * 2.5) * 0.8;
        ctx.fillStyle = "rgba(0,0,0,0.34)";
        ctx.beginPath();
        ctx.ellipse(ppx + TILE / 2, ppy + TILE - 6, TILE * 0.28, 5.5, 0, 0, Math.PI * 2);
        ctx.fill();
        const pSprite = this.sprites[`trainer_${this.dir}`] || this.sprites.trainer_down;
        if (pSprite && pSprite.complete) {
          ctx.drawImage(pSprite, ppx + 2, ppy - 6 - walkBob, TILE - 4, TILE);
        }
      }
    }

    // 3. Dynamic Current-Zone Weather Overlay
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
        ctx.fillStyle = cw === "mist" ? "rgba(216, 180, 254, 0.45)" : "rgba(254, 240, 138, 0.35)";
        ctx.beginPath();
        ctx.arc(w.x, w.y, w.r, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // 4. Nintendo-style Location & Weather HUD Banner (top-left)
    ctx.save();
    ctx.fillStyle = "rgba(11, 17, 32, 0.82)";
    ctx.strokeStyle = "#38bdf8";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(12, 12, 290, 44, 10);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#f8fafc";
    ctx.font = "bold 13px sans-serif";
    ctx.textAlign = "left";
    ctx.fillText(`📍 ${curZone.name}`, 24, 31);
    ctx.fillStyle = "#fde047";
    ctx.font = "12px sans-serif";
    ctx.fillText(`${curZone.weather_label} · Map ${m.width}×${m.height}`, 24, 48);
    ctx.restore();

    // 5. Live Corner Minimap (top-right) showing entire giant connected map!
    const mw = 128;
    const mh = Math.round((mw * m.height) / m.width);
    const mx0 = canvas.width - mw - 12;
    const my0 = 12;
    ctx.save();
    ctx.fillStyle = "rgba(8, 13, 25, 0.85)";
    ctx.strokeStyle = "#64748b";
    ctx.lineWidth = 1.5;
    ctx.fillRect(mx0 - 2, my0 - 2, mw + 4, mh + 4);
    ctx.strokeRect(mx0 - 2, my0 - 2, mw + 4, mh + 4);
    const sx = mw / m.width;
    const sy = mh / m.height;
    for (let y = 0; y < m.height; y++) {
      for (let x = 0; x < m.width; x++) {
        const v = m.grid[y][x];
        if (v === 5) ctx.fillStyle = "#0ea5e9";
        else if (v === 7 || v === 9) ctx.fillStyle = "#d4b483";
        else if (v === 1) ctx.fillStyle = "#22c55e";
        else if (v === 2) ctx.fillStyle = "#1e293b";
        else ctx.fillStyle = "#475569";
        ctx.fillRect(mx0 + x * sx, my0 + y * sy, Math.ceil(sx), Math.ceil(sy));
      }
    }
    // Landmarks & Player dots on Minimap
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

