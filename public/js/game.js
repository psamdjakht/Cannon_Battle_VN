'use strict';

const GAME_WIDTH = 960;
const GAME_HEIGHT = 540;
const TERRAIN_FLOOR = 490;
const GRAVITY = 350;
const MIN_POWER = 220;
const MAX_POWER = 720;
const SHOT_STEP = 1 / 60;
const CHARACTER_NAMES = [
  'Vịt Ninja Đỏ', 'Vịt Thiên Thần', 'Vịt Phi Công', 'Vịt Lá Xanh', 'Vịt Hiệp Sĩ Xanh',
  'Vịt Công Chúa Hồng', 'Vịt Ninja Đen', 'Vịt Võ Sĩ Cam', 'Vịt Siêu Tốc', 'Vịt Hải Tặc',
  'Vịt Pháp Sư', 'Vịt Thám Hiểm', 'Vịt Đầu Bếp', 'Vịt Cảnh Sát', 'Vịt Cứu Hỏa',
  'Vịt Bác Sĩ', 'Vịt Cao Bồi', 'Vịt Samurai', 'Vịt Vũ Trụ', 'Vịt Hoàng Gia',
  'Vịt Rừng Xanh', 'Vịt Sấm Sét'
];

const MAP_LABELS = {
  grass: 'Đồi cỏ',
  desert: 'Sa mạc',
  snow: 'Núi tuyết',
  volcano: 'Núi lửa'
};

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function escapeHtml(value) {
  return String(value).replace(/[&<>'"]/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
  })[char]);
}

function seededRandom(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

function flattenTerrain(terrain, centerX, radius) {
  const center = terrain[clamp(Math.round(centerX), 0, terrain.length - 1)];
  for (let x = Math.max(0, centerX - radius); x <= Math.min(terrain.length - 1, centerX + radius); x += 1) {
    const distance = Math.abs(x - centerX) / radius;
    const blend = Math.cos(distance * Math.PI / 2) ** 2;
    terrain[Math.round(x)] = Math.round(terrain[Math.round(x)] * (1 - blend) + center * blend);
  }
}

function generateTerrain(seed, style = 'grass') {
  const rand = seededRandom(seed);
  const anchors = [];
  const anchorStep = 48;
  const styleBase = { grass: 350, desert: 365, snow: 345, volcano: 375 }[style] || 350;
  const styleRoughness = { grass: 82, desert: 58, snow: 72, volcano: 105 }[style] || 82;

  for (let x = -anchorStep; x <= GAME_WIDTH + anchorStep; x += anchorStep) {
    const wave = Math.sin((x + seed % 500) / 115) * 26 + Math.sin((x + seed % 1300) / 47) * 13;
    anchors.push(clamp(styleBase + wave + (rand() - 0.5) * styleRoughness, 245, 445));
  }

  const terrain = new Array(GAME_WIDTH);
  for (let x = 0; x < GAME_WIDTH; x += 1) {
    const pos = (x + anchorStep) / anchorStep;
    const index = Math.floor(pos);
    const t = pos - index;
    const smooth = t * t * (3 - 2 * t);
    terrain[x] = Math.round(anchors[index] * (1 - smooth) + anchors[index + 1] * smooth);
  }
  flattenTerrain(terrain, 125, 62);
  flattenTerrain(terrain, GAME_WIDTH - 125, 62);
  return terrain;
}

function terrainY(terrain, x) {
  if (!terrain?.length) return TERRAIN_FLOOR;
  return terrain[clamp(Math.round(x), 0, terrain.length - 1)] ?? TERRAIN_FLOOR;
}

function nearestAliveOpponent(player, players) {
  let nearest = null;
  let best = Infinity;
  for (const candidate of players) {
    if (candidate.token === player.token || candidate.health <= 0) continue;
    const distance = Math.abs(candidate.x - player.x);
    if (distance < best) {
      nearest = candidate;
      best = distance;
    }
  }
  return nearest;
}

function facingFor(player, players) {
  const target = nearestAliveOpponent(player, players);
  if (!target) return player.x < GAME_WIDTH / 2 ? 1 : -1;
  return target.x >= player.x ? 1 : -1;
}

function canMoveTo(state, player, nextX) {
  if (nextX < 28 || nextX > GAME_WIDTH - 28) return false;
  const oldY = terrainY(state.terrain, player.x);
  const newY = terrainY(state.terrain, nextX);
  if (Math.abs(newY - oldY) > 14) return false;
  return !state.players.some((other) => other.token !== player.token && other.health > 0 && Math.abs(other.x - nextX) < 42);
}

function smoothCraterEdges(terrain, start, end) {
  const copy = terrain.slice();
  for (let x = Math.max(1, start); x < Math.min(terrain.length - 1, end); x += 1) {
    terrain[x] = Math.round(copy[x - 1] * 0.2 + copy[x] * 0.6 + copy[x + 1] * 0.2);
  }
}

function makeCrater(terrain, centerX, centerY, radius = 46) {
  const start = Math.max(0, Math.floor(centerX - radius));
  const end = Math.min(terrain.length - 1, Math.ceil(centerX + radius));
  for (let x = start; x <= end; x += 1) {
    const dx = x - centerX;
    const inside = radius * radius - dx * dx;
    if (inside <= 0) continue;
    const craterBottom = centerY + Math.sqrt(inside) * 0.82;
    if (terrain[x] < craterBottom) terrain[x] = Math.min(TERRAIN_FLOOR, Math.round(craterBottom));
  }
  smoothCraterEdges(terrain, start - 6, end + 6);
}

function simulateShotState(state, shooter, angle, power, mutate = true) {
  const players = mutate ? state.players : state.players.map((player) => ({ ...player }));
  const terrain = mutate ? state.terrain : state.terrain.slice();
  const facing = facingFor(shooter, players);
  const radians = angle * Math.PI / 180;
  let x = shooter.x + facing * 30;
  let y = terrainY(terrain, shooter.x) - 47;
  let vx = facing * Math.cos(radians) * power;
  let vy = -Math.sin(radians) * power;
  const points = [{ x: Math.round(x), y: Math.round(y) }];
  let impact = null;
  let hitToken = null;
  let elapsed = 0;
  let sampleCounter = 0;
  let minTargetDistance = Infinity;
  const target = nearestAliveOpponent(shooter, players);

  while (elapsed < 12) {
    elapsed += SHOT_STEP;
    vx += state.wind * 0.42 * SHOT_STEP;
    vy += GRAVITY * SHOT_STEP;
    x += vx * SHOT_STEP;
    y += vy * SHOT_STEP;
    sampleCounter += 1;
    if (sampleCounter % 2 === 0) points.push({ x: Math.round(x), y: Math.round(y) });

    if (target) {
      const targetY = terrainY(terrain, target.x) - 31;
      minTargetDistance = Math.min(minTargetDistance, Math.hypot(x - target.x, y - targetY));
    }

    if (x < -20 || x > GAME_WIDTH + 20 || y > GAME_HEIGHT + 40) {
      impact = { x: clamp(x, 0, GAME_WIDTH), y: clamp(y, 0, GAME_HEIGHT), type: 'out' };
      break;
    }

    if (elapsed > 0.22) {
      for (const player of players) {
        if (player.health <= 0) continue;
        const py = terrainY(terrain, player.x) - 31;
        if ((x - player.x) ** 2 + (y - py) ** 2 <= 26 ** 2) {
          impact = { x, y, type: 'player' };
          hitToken = player.token;
          break;
        }
      }
      if (impact) break;
    }

    if (x >= 0 && x < GAME_WIDTH && y >= terrainY(terrain, x)) {
      impact = { x, y: terrainY(terrain, x), type: 'terrain' };
      break;
    }
  }

  if (!impact) impact = { x: clamp(x, 0, GAME_WIDTH), y: clamp(y, 0, GAME_HEIGHT), type: 'out' };
  const damagedTokens = [];
  if (impact.type !== 'out') {
    for (const player of players) {
      if (player.health <= 0) continue;
      const py = terrainY(terrain, player.x) - 28;
      if (Math.hypot(player.x - impact.x, py - impact.y) <= 54 || player.token === hitToken) {
        player.health = Math.max(0, player.health - state.config.hitDamage);
        damagedTokens.push(player.token);
      }
    }
    makeCrater(terrain, impact.x, impact.y, 46);
  }

  return {
    id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    shooterToken: shooter.token,
    angle,
    power,
    facing,
    wind: state.wind,
    points,
    impact: { x: Math.round(impact.x), y: Math.round(impact.y), type: impact.type },
    damagedTokens,
    damage: state.config.hitDamage,
    terrain,
    players,
    minTargetDistance
  };
}

class SoundFx {
  constructor() {
    this.ctx = null;
  }

  ensure() {
    if (!this.ctx) this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    if (this.ctx.state === 'suspended') this.ctx.resume();
  }

  tone(frequency, duration, type = 'sine', volume = 0.06, delay = 0) {
    try {
      this.ensure();
      const now = this.ctx.currentTime + delay;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(frequency, now);
      gain.gain.setValueAtTime(volume, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
      osc.connect(gain).connect(this.ctx.destination);
      osc.start(now);
      osc.stop(now + duration);
    } catch (_error) {
      // Trình duyệt có thể chặn âm thanh; game vẫn hoạt động bình thường.
    }
  }

  shoot() {
    this.tone(130, 0.18, 'sawtooth', 0.08);
    this.tone(70, 0.22, 'square', 0.05, 0.02);
  }

  explosion() {
    this.tone(85, 0.38, 'sawtooth', 0.09);
    this.tone(42, 0.5, 'square', 0.05, 0.03);
  }

  move() {
    this.tone(240, 0.05, 'square', 0.018);
  }
}

class LocalMatch {
  constructor(app, config, profile, difficulty) {
    this.app = app;
    this.difficulty = difficulty;
    this.status = 'playing';
    this.config = { ...config, maxPlayers: 2 };
    this.terrain = generateTerrain(Math.floor(Math.random() * 0x7fffffff), config.mapStyle);
    this.players = [
      {
        token: 'local-human',
        name: profile.name,
        character: profile.character,
        color: '#22c55e',
        x: 125,
        angle: 45,
        health: config.startHealth,
        connected: true,
        isHost: true
      },
      {
        token: 'local-ai',
        name: difficulty === 'hard' ? 'Máy Cao Thủ' : difficulty === 'easy' ? 'Máy Tập Sự' : 'Máy Đối Thủ',
        character: `nv${String(((Number(profile.character.slice(2)) + 7) % 22) + 1).padStart(2, '0')}`,
        color: '#ef4444',
        x: GAME_WIDTH - 125,
        angle: 45,
        health: config.startHealth,
        connected: true,
        isHost: false
      }
    ];
    this.turnToken = 'local-human';
    this.turnEndsAt = Date.now() + config.turnSeconds * 1000;
    this.wind = this.randomWind();
    this.winnerTokens = [];
    this.shotInProgress = false;
    this.revision = 1;
    this.aiScheduled = false;
  }

  randomWind() {
    return Math.round((Math.random() * 2 - 1) * 55);
  }

  get publicState() {
    return {
      status: this.status,
      config: this.config,
      terrain: this.terrain,
      players: this.players,
      turnToken: this.turnToken,
      turnEndsAt: this.turnEndsAt,
      wind: this.wind,
      winnerTokens: this.winnerTokens,
      revision: this.revision,
      code: null
    };
  }

  canControl(token) {
    return this.status === 'playing' && !this.shotInProgress && this.turnToken === token;
  }

  human() {
    return this.players[0];
  }

  move(delta, token = this.turnToken) {
    const player = this.players.find((item) => item.token === token);
    if (!player || !this.canControl(token)) return false;
    const nextX = player.x + clamp(delta, -14, 14);
    if (!canMoveTo(this, player, nextX)) return false;
    player.x = Math.round(nextX * 10) / 10;
    this.revision += 1;
    this.app.renderer.markMoving(player.token);
    return true;
  }

  setAngle(angle, token = this.turnToken) {
    const player = this.players.find((item) => item.token === token);
    if (!player || !this.canControl(token)) return false;
    player.angle = Math.round(clamp(angle, 8, 86) * 10) / 10;
    this.revision += 1;
    return true;
  }

  fire(power, token = this.turnToken) {
    const shooter = this.players.find((item) => item.token === token);
    if (!shooter || !this.canControl(token)) return false;
    this.shotInProgress = true;
    this.turnEndsAt = null;
    const shot = simulateShotState(this, shooter, shooter.angle, clamp(power, MIN_POWER, MAX_POWER), false);
    this.app.handleShot(shot, () => {
      this.terrain = shot.terrain;
      this.players = shot.players;
      this.shotInProgress = false;
      this.checkEndAndAdvance();
    });
    return true;
  }

  skip() {
    if (!this.canControl(this.turnToken)) return;
    this.advanceTurn();
  }

  checkEndAndAdvance() {
    const alive = this.players.filter((player) => player.health > 0);
    if (alive.length <= 1) {
      this.status = 'ended';
      this.turnToken = null;
      this.turnEndsAt = null;
      this.winnerTokens = alive.map((player) => player.token);
      this.revision += 1;
      setTimeout(() => this.app.showResult(), 550);
      return;
    }
    this.advanceTurn();
  }

  advanceTurn() {
    const next = this.turnToken === 'local-human' ? 'local-ai' : 'local-human';
    this.turnToken = next;
    this.wind = this.randomWind();
    this.turnEndsAt = Date.now() + this.config.turnSeconds * 1000;
    this.aiScheduled = false;
    this.revision += 1;
    if (next === 'local-ai') this.scheduleAI();
  }

  update() {
    if (this.status !== 'playing' || this.shotInProgress) return;
    if (this.turnEndsAt && Date.now() >= this.turnEndsAt) {
      this.app.toast('Hết giờ, tự động bỏ lượt');
      this.advanceTurn();
      return;
    }
    if (this.turnToken === 'local-ai') this.scheduleAI();
  }

  scheduleAI() {
    if (this.aiScheduled || this.shotInProgress || this.turnToken !== 'local-ai') return;
    this.aiScheduled = true;
    setTimeout(() => {
      if (this.status !== 'playing' || this.turnToken !== 'local-ai' || this.shotInProgress) return;
      const ai = this.players[1];
      const target = this.players[0];
      const preferredDistance = Math.abs(target.x - ai.x);
      const moveDirection = preferredDistance < 240 ? Math.sign(ai.x - target.x) : (Math.random() > 0.55 ? Math.sign(target.x - ai.x) : 0);
      const moveSteps = Math.floor(Math.random() * 4);
      for (let index = 0; index < moveSteps; index += 1) this.move(moveDirection * 7, ai.token);
      const solution = this.findBestShot(ai);
      ai.angle = solution.angle;
      this.revision += 1;
      setTimeout(() => this.fire(solution.power, ai.token), 780);
    }, 850);
  }

  findBestShot(shooter) {
    let best = { angle: 45, power: 430, score: Infinity };
    for (let angle = 12; angle <= 84; angle += 3) {
      for (let power = 240; power <= 700; power += 22) {
        const test = simulateShotState(this, shooter, angle, power, false);
        let score = test.minTargetDistance;
        if (test.damagedTokens.includes('local-human')) score -= 300;
        if (test.damagedTokens.includes('local-ai')) score += 220;
        if (score < best.score) best = { angle, power, score };
      }
    }
    const error = {
      easy: { angle: 8, power: 75 },
      normal: { angle: 3, power: 28 },
      hard: { angle: 0.8, power: 9 }
    }[this.difficulty] || { angle: 3, power: 28 };
    return {
      angle: clamp(best.angle + (Math.random() * 2 - 1) * error.angle, 8, 86),
      power: clamp(best.power + (Math.random() * 2 - 1) * error.power, MIN_POWER, MAX_POWER)
    };
  }

  previewPath(power = 400) {
    const human = this.human();
    if (this.difficulty !== 'easy' || !this.canControl(human.token)) return [];
    return simulateShotState(this, human, human.angle, power, false).points.filter((_point, index) => index % 5 === 0);
  }
}

class CanvasRenderer {
  constructor(app, canvas) {
    this.app = app;
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.imageCache = new Map();
    this.movingUntil = new Map();
    this.projectile = null;
    this.explosion = null;
    this.particles = [];
    this.lastFrame = performance.now();
    this.clouds = [
      { x: 90, y: 82, s: 1.1 }, { x: 385, y: 120, s: 0.75 }, { x: 735, y: 72, s: 1.35 }
    ];
    this.loop = this.loop.bind(this);
    requestAnimationFrame(this.loop);
  }

  markMoving(token) {
    this.movingUntil.set(token, performance.now() + 420);
  }

  getImage(src) {
    if (!this.imageCache.has(src)) {
      const image = new Image();
      image.decoding = 'async';
      image.src = src;
      this.imageCache.set(src, image);
    }
    return this.imageCache.get(src);
  }

  animateShot(shot, done) {
    const duration = clamp(shot.points.length * 22, 900, 5200);
    this.projectile = {
      shot,
      start: performance.now(),
      duration,
      done,
      exploded: false
    };
    this.app.sound.shoot();
  }

  loop(now) {
    const dt = Math.min(0.05, (now - this.lastFrame) / 1000);
    this.lastFrame = now;
    this.app.update(now, dt);
    this.updateAnimation(now, dt);
    this.draw(now);
    requestAnimationFrame(this.loop);
  }

  updateAnimation(now, dt) {
    if (this.projectile) {
      const progress = clamp((now - this.projectile.start) / this.projectile.duration, 0, 1);
      const points = this.projectile.shot.points;
      const exact = progress * Math.max(0, points.length - 1);
      const index = Math.floor(exact);
      const nextIndex = Math.min(points.length - 1, index + 1);
      const t = exact - index;
      this.projectile.x = points[index].x * (1 - t) + points[nextIndex].x * t;
      this.projectile.y = points[index].y * (1 - t) + points[nextIndex].y * t;
      if (progress >= 1 && !this.projectile.exploded) {
        this.projectile.exploded = true;
        this.explosion = {
          x: this.projectile.shot.impact.x,
          y: this.projectile.shot.impact.y,
          start: now,
          duration: 780,
          shot: this.projectile.shot
        };
        this.spawnExplosionParticles(this.explosion.x, this.explosion.y);
        this.app.sound.explosion();
      }
      if (progress >= 1 && now - this.explosion.start >= this.explosion.duration) {
        const callback = this.projectile.done;
        this.projectile = null;
        this.explosion = null;
        callback?.();
      }
    }

    this.particles = this.particles.filter((particle) => {
      particle.life -= dt;
      particle.x += particle.vx * dt;
      particle.y += particle.vy * dt;
      particle.vy += 210 * dt;
      return particle.life > 0;
    });
  }

  spawnExplosionParticles(x, y) {
    for (let index = 0; index < 36; index += 1) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 60 + Math.random() * 210;
      this.particles.push({
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 80,
        life: 0.45 + Math.random() * 0.7,
        maxLife: 1.15,
        size: 2 + Math.random() * 6,
        warm: Math.random() > 0.32
      });
    }
  }

  draw(now) {
    const state = this.app.getGameState();
    const ctx = this.ctx;
    ctx.clearRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    if (!state?.terrain) {
      ctx.fillStyle = '#0b2b36';
      ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
      return;
    }
    this.drawSky(state, now);
    this.drawTerrain(state);
    this.drawTrajectoryPreview(state);
    this.drawPlayers(state, now);
    this.drawProjectile();
    this.drawExplosion(now);
    this.drawParticles();
    this.drawWindParticles(state, now);
  }

  drawSky(state, now) {
    const ctx = this.ctx;
    const palettes = {
      grass: ['#76c9f4', '#dff7ff'],
      desert: ['#f6b96f', '#fff1c8'],
      snow: ['#8ebbe1', '#eef9ff'],
      volcano: ['#3d273d', '#e06a4b']
    };
    const [top, bottom] = palettes[state.config.mapStyle] || palettes.grass;
    const gradient = ctx.createLinearGradient(0, 0, 0, GAME_HEIGHT);
    gradient.addColorStop(0, top);
    gradient.addColorStop(0.74, bottom);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

    ctx.save();
    ctx.globalAlpha = state.config.mapStyle === 'volcano' ? 0.45 : 0.8;
    ctx.fillStyle = state.config.mapStyle === 'volcano' ? '#ff8a54' : '#fff7bf';
    ctx.beginPath();
    ctx.arc(820, 82, 42, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    if (state.config.mapStyle !== 'volcano') {
      for (let index = 0; index < this.clouds.length; index += 1) {
        const cloud = this.clouds[index];
        const drift = ((now * 0.008 * (index + 1)) % 1100) - 70;
        this.drawCloud((cloud.x + drift) % 1060 - 40, cloud.y, cloud.s);
      }
    } else {
      ctx.save();
      for (let i = 0; i < 18; i += 1) {
        const x = (i * 83 + now * 0.02) % GAME_WIDTH;
        const y = 35 + (i * 47) % 210;
        ctx.fillStyle = `rgba(255, ${80 + i * 4}, 45, 0.28)`;
        ctx.fillRect(x, y, 2, 2);
      }
      ctx.restore();
    }
  }

  drawCloud(x, y, scale) {
    const ctx = this.ctx;
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(scale, scale);
    ctx.globalAlpha = 0.68;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(0, 5, 23, 0, Math.PI * 2);
    ctx.arc(26, -3, 29, 0, Math.PI * 2);
    ctx.arc(57, 7, 22, 0, Math.PI * 2);
    ctx.rect(-1, 5, 60, 24);
    ctx.fill();
    ctx.restore();
  }

  drawTerrain(state) {
    const ctx = this.ctx;
    const styles = {
      grass: { top: '#55b948', fill: '#4b8b3b', deep: '#2f5f31' },
      desert: { top: '#f0c45f', fill: '#cc8b3d', deep: '#97562e' },
      snow: { top: '#f4fbff', fill: '#8fb6cc', deep: '#5e8398' },
      volcano: { top: '#452d33', fill: '#2e2028', deep: '#160f19' }
    };
    const palette = styles[state.config.mapStyle] || styles.grass;

    const deepGradient = ctx.createLinearGradient(0, 250, 0, GAME_HEIGHT);
    deepGradient.addColorStop(0, palette.fill);
    deepGradient.addColorStop(1, palette.deep);
    ctx.beginPath();
    ctx.moveTo(0, state.terrain[0]);
    for (let x = 1; x < state.terrain.length; x += 2) ctx.lineTo(x, state.terrain[x]);
    ctx.lineTo(GAME_WIDTH, GAME_HEIGHT);
    ctx.lineTo(0, GAME_HEIGHT);
    ctx.closePath();
    ctx.fillStyle = deepGradient;
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(0, state.terrain[0]);
    for (let x = 1; x < state.terrain.length; x += 2) ctx.lineTo(x, state.terrain[x]);
    ctx.strokeStyle = palette.top;
    ctx.lineWidth = state.config.mapStyle === 'snow' ? 9 : 6;
    ctx.lineJoin = 'round';
    ctx.stroke();

    ctx.save();
    ctx.globalAlpha = 0.14;
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1;
    for (let x = 20; x < GAME_WIDTH; x += 34) {
      const y = terrainY(state.terrain, x) + 24 + (x % 4) * 8;
      ctx.beginPath();
      ctx.moveTo(x - 7, y);
      ctx.lineTo(x + 8, y + 5);
      ctx.stroke();
    }
    ctx.restore();
  }

  drawTrajectoryPreview(state) {
    const points = this.app.getPreviewPath();
    if (!points.length || this.projectile) return;
    const ctx = this.ctx;
    ctx.save();
    ctx.fillStyle = 'rgba(255,255,255,0.72)';
    points.forEach((point, index) => {
      const radius = index % 3 === 0 ? 3 : 2;
      ctx.beginPath();
      ctx.arc(point.x, point.y, radius, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.restore();
  }

  drawPlayers(state, now) {
    const sorted = [...state.players].sort((a, b) => a.x - b.x);
    for (const player of sorted) this.drawPlayer(state, player, now);
  }

  drawPlayer(state, player, now) {
    const ctx = this.ctx;
    const groundY = terrainY(state.terrain, player.x);
    const facing = facingFor(player, state.players);
    const isActive = state.turnToken === player.token && player.health > 0;
    const isMoving = (this.movingUntil.get(player.token) || 0) > now;
    const frame = isMoving ? Math.floor(now / 85) % 5 + 1 : 1;
    const sprite = this.getImage(`/assets/animals/${player.character}/frame${frame}.png`);

    ctx.save();
    ctx.globalAlpha = player.health > 0 ? 1 : 0.42;

    if (isActive) {
      ctx.strokeStyle = player.color || '#22c55e';
      ctx.lineWidth = 4;
      ctx.setLineDash([8, 6]);
      ctx.beginPath();
      ctx.ellipse(player.x, groundY - 7, 44, 13, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // Khẩu pháo được vẽ trước, sau đó nhân vật vẽ đè lên phía trước.
    const pivotX = player.x - facing * 8;
    const pivotY = groundY - 26;
    const radians = player.angle * Math.PI / 180;
    const barrelLength = 51;
    const muzzleX = pivotX + facing * Math.cos(radians) * barrelLength;
    const muzzleY = pivotY - Math.sin(radians) * barrelLength;

    ctx.lineCap = 'round';
    ctx.strokeStyle = '#243746';
    ctx.lineWidth = 14;
    ctx.beginPath();
    ctx.moveTo(pivotX, pivotY);
    ctx.lineTo(muzzleX, muzzleY);
    ctx.stroke();
    ctx.strokeStyle = '#5f7685';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(pivotX + facing * 3, pivotY - 2);
    ctx.lineTo(muzzleX, muzzleY);
    ctx.stroke();

    ctx.fillStyle = '#2b3e49';
    ctx.beginPath();
    ctx.roundRect(player.x - 25, groundY - 28, 50, 25, 8);
    ctx.fill();
    ctx.fillStyle = '#17242c';
    ctx.beginPath();
    ctx.arc(player.x - 18, groundY - 4, 10, 0, Math.PI * 2);
    ctx.arc(player.x + 18, groundY - 4, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#78909c';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(player.x - 18, groundY - 4, 6, 0, Math.PI * 2);
    ctx.arc(player.x + 18, groundY - 4, 6, 0, Math.PI * 2);
    ctx.stroke();

    // Nhân vật đồng bộ tọa độ với pháo và che phần thân/nòng phía sau.
    if (sprite.complete && sprite.naturalWidth > 0) {
      ctx.save();
      ctx.translate(player.x + facing * 2, groundY + 5);
      ctx.scale(facing, 1);
      const bob = isMoving ? Math.sin(now / 70) * 2 : 0;
      ctx.drawImage(sprite, -50, -101 + bob, 100, 100);
      ctx.restore();
    } else {
      ctx.fillStyle = player.color || '#22c55e';
      ctx.beginPath();
      ctx.arc(player.x, groundY - 45, 24, 0, Math.PI * 2);
      ctx.fill();
    }

    if (player.health <= 0) {
      ctx.strokeStyle = '#ef4444';
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.moveTo(player.x - 22, groundY - 70);
      ctx.lineTo(player.x + 22, groundY - 28);
      ctx.moveTo(player.x + 22, groundY - 70);
      ctx.lineTo(player.x - 22, groundY - 28);
      ctx.stroke();
    }

    this.drawPlayerLabel(state, player, groundY);
    ctx.restore();
  }

  drawPlayerLabel(state, player, groundY) {
    const ctx = this.ctx;
    const maxHealth = state.config.startHealth || 100;
    const healthRatio = clamp(player.health / maxHealth, 0, 1);
    const width = 86;
    const x = player.x - width / 2;
    const y = groundY - 115;

    ctx.font = '800 12px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.lineWidth = 4;
    ctx.strokeStyle = 'rgba(0,0,0,0.45)';
    ctx.strokeText(player.name, player.x, y - 7);
    ctx.fillStyle = '#ffffff';
    ctx.fillText(player.name, player.x, y - 7);

    ctx.fillStyle = 'rgba(6, 24, 30, 0.72)';
    ctx.beginPath();
    ctx.roundRect(x, y, width, 9, 4);
    ctx.fill();
    const healthGradient = ctx.createLinearGradient(x, 0, x + width, 0);
    healthGradient.addColorStop(0, healthRatio > 0.35 ? '#22c55e' : '#ef4444');
    healthGradient.addColorStop(1, healthRatio > 0.35 ? '#bef264' : '#fb923c');
    ctx.fillStyle = healthGradient;
    ctx.beginPath();
    ctx.roundRect(x + 1, y + 1, (width - 2) * healthRatio, 7, 3);
    ctx.fill();
  }

  drawProjectile() {
    if (!this.projectile || this.projectile.exploded) return;
    const ctx = this.ctx;
    const x = this.projectile.x;
    const y = this.projectile.y;
    ctx.save();
    const glow = ctx.createRadialGradient(x, y, 1, x, y, 14);
    glow.addColorStop(0, 'rgba(255,255,210,1)');
    glow.addColorStop(0.35, 'rgba(255,160,40,0.9)');
    glow.addColorStop(1, 'rgba(255,80,20,0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(x, y, 14, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#202a31';
    ctx.beginPath();
    ctx.arc(x, y, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  drawExplosion(now) {
    if (!this.explosion) return;
    const ctx = this.ctx;
    const progress = clamp((now - this.explosion.start) / this.explosion.duration, 0, 1);
    const radius = Math.sin(progress * Math.PI) * 72;
    const alpha = 1 - progress;
    ctx.save();
    ctx.globalAlpha = alpha;
    const gradient = ctx.createRadialGradient(this.explosion.x, this.explosion.y, 0, this.explosion.x, this.explosion.y, Math.max(1, radius));
    gradient.addColorStop(0, '#fffbd1');
    gradient.addColorStop(0.22, '#facc15');
    gradient.addColorStop(0.5, '#f97316');
    gradient.addColorStop(0.8, 'rgba(220,38,38,0.7)');
    gradient.addColorStop(1, 'rgba(70,20,10,0)');
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(this.explosion.x, this.explosion.y, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    if (this.explosion.shot.damagedTokens.length && progress < 0.65) {
      ctx.save();
      ctx.globalAlpha = 1 - progress;
      ctx.font = '950 26px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.strokeStyle = 'rgba(0,0,0,0.55)';
      ctx.lineWidth = 5;
      const text = `-${this.explosion.shot.damage} MÁU`;
      ctx.strokeText(text, this.explosion.x, this.explosion.y - 65 - progress * 35);
      ctx.fillStyle = '#ffef67';
      ctx.fillText(text, this.explosion.x, this.explosion.y - 65 - progress * 35);
      ctx.restore();
    }
  }

  drawParticles() {
    const ctx = this.ctx;
    ctx.save();
    for (const particle of this.particles) {
      ctx.globalAlpha = clamp(particle.life / particle.maxLife, 0, 1);
      ctx.fillStyle = particle.warm ? '#ff9b32' : '#4a332d';
      ctx.beginPath();
      ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  drawWindParticles(state, now) {
    const ctx = this.ctx;
    const wind = state.wind || 0;
    if (Math.abs(wind) < 5) return;
    ctx.save();
    ctx.globalAlpha = clamp(Math.abs(wind) / 100, 0.1, 0.45);
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    const direction = Math.sign(wind);
    for (let i = 0; i < 12; i += 1) {
      const base = (i * 101 + now * Math.abs(wind) * 0.018) % (GAME_WIDTH + 100);
      const x = direction > 0 ? base - 50 : GAME_WIDTH + 50 - base;
      const y = 65 + (i * 53) % 250;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + direction * (14 + Math.abs(wind) * 0.18), y);
      ctx.stroke();
    }
    ctx.restore();
  }
}

class CannonApp {
  constructor() {
    this.views = $$('.view');
    this.setupMode = 'single';
    this.selectedCharacter = localStorage.getItem('cannonCharacter') || 'nv01';
    this.onlineRoom = null;
    this.playerToken = localStorage.getItem('cannonPlayerToken') || '';
    this.localMatch = null;
    this.currentProfile = null;
    this.shotApplying = false;
    this.chargeStartedAt = null;
    this.chargePower = MIN_POWER;
    this.chargingSource = null;
    this.keys = new Set();
    this.lastMoveAt = 0;
    this.lastAimAt = 0;
    this.pointerGesture = null;
    this.toastTimer = null;
    this.sound = new SoundFx();
    this.socket = io({ autoConnect: true });
    this.renderer = new CanvasRenderer(this, $('#gameCanvas'));
    this.bindUI();
    this.bindSocket();
    this.buildCharacters();
    this.restoreName();
    this.openRoomFromUrl();
  }

  bindUI() {
    $('#singleModeBtn').addEventListener('click', () => this.openSetup('single'));
    $('#createModeBtn').addEventListener('click', () => this.openSetup('create'));
    $('#joinModeBtn').addEventListener('click', () => this.openSetup('join'));
    $$('.back-menu').forEach((button) => button.addEventListener('click', () => this.showView('menuView')));
    $('#setupSubmitBtn').addEventListener('click', () => this.submitSetup());
    $('#joinCode').addEventListener('input', (event) => { event.target.value = event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''); });
    $('#copyInviteBtn').addEventListener('click', () => this.copyInvite());
    $('#startRoomBtn').addEventListener('click', () => this.startOnlineRoom());
    $('#leaveLobbyBtn').addEventListener('click', () => this.leaveRoom());
    $('#exitGameBtn').addEventListener('click', () => this.exitGame());
    $('#helpBtn').addEventListener('click', () => $('#helpDialog').showModal());
    $('#closeHelpBtn').addEventListener('click', () => $('#helpDialog').close());
    $('#resultMenuBtn').addEventListener('click', () => this.returnToMenu());
    $('#playAgainBtn').addEventListener('click', () => this.playAgain());
    $('#skipTurnBtn').addEventListener('click', () => this.skipTurn());

    const canvas = $('#gameCanvas');
    canvas.addEventListener('pointerdown', (event) => this.onCanvasPointerDown(event));
    canvas.addEventListener('pointermove', (event) => this.onCanvasPointerMove(event));
    canvas.addEventListener('pointerup', (event) => this.onCanvasPointerUp(event));
    canvas.addEventListener('pointercancel', (event) => this.onCanvasPointerUp(event));
    canvas.addEventListener('contextmenu', (event) => event.preventDefault());

    const fire = $('#fireButton');
    fire.addEventListener('pointerdown', (event) => {
      event.preventDefault();
      fire.setPointerCapture?.(event.pointerId);
      this.startCharge('button');
    });
    ['pointerup', 'pointercancel'].forEach((type) => fire.addEventListener(type, (event) => {
      if (this.chargingSource === 'button') {
        event.preventDefault();
        this.releaseCharge();
      }
    }));
    fire.addEventListener('contextmenu', (event) => event.preventDefault());

    window.addEventListener('keydown', (event) => this.onKeyDown(event), { passive: false });
    window.addEventListener('keyup', (event) => this.onKeyUp(event), { passive: false });
    window.addEventListener('blur', () => {
      this.keys.clear();
      if (this.chargingSource === 'keyboard') this.cancelCharge();
    });
    window.addEventListener('beforeunload', () => {
      if (this.onlineRoom) this.socket.emit('leave-room');
    });
  }

  bindSocket() {
    this.socket.on('connect', () => {
      if (this.onlineRoom?.code && this.playerToken && this.onlineRoom.status !== 'ended') {
        this.socket.emit('join-room', {
          code: this.onlineRoom.code,
          token: this.playerToken,
          name: this.currentProfile?.name,
          character: this.currentProfile?.character,
          password: sessionStorage.getItem('cannonRoomPassword') || ''
        }, (response) => {
          if (!response?.ok) this.toast('Mất kết nối phòng, vui lòng vào lại');
        });
      }
    });

    this.socket.on('room-state', (room) => {
      const previousStatus = this.onlineRoom?.status;
      this.onlineRoom = room;
      if (room.status === 'lobby') {
        this.renderLobby();
        if (this.currentViewId() !== 'lobbyView') this.showView('lobbyView');
      } else if (room.status === 'playing') {
        if (previousStatus !== 'playing' && this.currentViewId() !== 'gameView') this.enterGameView();
        this.refreshHud();
      } else if (room.status === 'ended') {
        this.refreshHud();
        if (!this.renderer.projectile) setTimeout(() => this.showResult(), 450);
      }
    });

    this.socket.on('shot-fired', (shot) => {
      this.handleShot(shot, () => {
        if (!this.onlineRoom) return;
        this.onlineRoom.terrain = shot.terrain;
        this.onlineRoom.players = shot.players;
        this.refreshHud();
      });
    });

    this.socket.on('turn-skipped', (event) => {
      if (event?.reason === 'timeout') this.toast('Người chơi hết thời gian và bị bỏ lượt');
    });

    this.socket.on('disconnect', () => {
      if (this.onlineRoom) this.toast('Đang kết nối lại máy chủ…');
    });
  }

  buildCharacters() {
    const grid = $('#characterGrid');
    grid.innerHTML = '';
    for (let index = 1; index <= 22; index += 1) {
      const id = `nv${String(index).padStart(2, '0')}`;
      const button = document.createElement('button');
      button.type = 'button';
      button.className = `character-card${id === this.selectedCharacter ? ' selected' : ''}`;
      button.dataset.character = id;
      button.title = CHARACTER_NAMES[index - 1];
      button.innerHTML = `<img src="/assets/animals/${id}/thumb.png" alt="${escapeHtml(CHARACTER_NAMES[index - 1])}" loading="lazy">`;
      button.addEventListener('click', () => this.selectCharacter(id));
      grid.appendChild(button);
    }
    this.updateSelectedCharacterName();
  }

  selectCharacter(id) {
    this.selectedCharacter = id;
    localStorage.setItem('cannonCharacter', id);
    $$('.character-card').forEach((card) => card.classList.toggle('selected', card.dataset.character === id));
    this.updateSelectedCharacterName();
  }

  updateSelectedCharacterName() {
    const index = Number(this.selectedCharacter.slice(2)) - 1;
    $('#selectedCharacterName').textContent = CHARACTER_NAMES[index] || 'Nhân vật';
  }

  restoreName() {
    const name = localStorage.getItem('cannonPlayerName');
    if (name) $('#playerName').value = name;
  }

  openRoomFromUrl() {
    const code = new URLSearchParams(location.search).get('room');
    if (code) {
      $('#joinCode').value = code.toUpperCase().slice(0, 6);
      this.openSetup('join');
    }
  }

  showView(id) {
    this.views.forEach((view) => view.classList.toggle('active', view.id === id));
  }

  currentViewId() {
    return this.views.find((view) => view.classList.contains('active'))?.id;
  }

  openSetup(mode) {
    this.setupMode = mode;
    $('#setupError').textContent = '';
    $('#singleOptions').classList.toggle('hidden', mode !== 'single');
    $('#hostOptions').classList.toggle('hidden', mode !== 'create');
    $('#joinCodeGroup').classList.toggle('hidden', mode !== 'join');
    $('#passwordGroup').classList.toggle('hidden', mode === 'single');
    $('#ruleOptions').classList.toggle('hidden', mode === 'join');
    $('#turnTimeLabel').classList.toggle('hidden', mode === 'single');

    const copy = {
      single: ['Đấu với máy', 'Chọn nhân vật, máu và độ khó', 'Bắt đầu đấu máy'],
      create: ['Tạo phòng online', 'Thiết lập luật chung cho 2–6 người', 'Tạo phòng'],
      join: ['Vào phòng online', 'Nhập mã phòng do chủ phòng gửi', 'Vào phòng']
    }[mode];
    $('#setupTitle').textContent = copy[0];
    $('#setupSubtitle').textContent = copy[1];
    $('#setupSubmitBtn').textContent = copy[2];
    this.showView('setupView');
  }

  getProfile() {
    const name = ($('#playerName').value || 'Người chơi').trim().slice(0, 18);
    localStorage.setItem('cannonPlayerName', name);
    return { name, character: this.selectedCharacter };
  }

  getConfig() {
    return {
      maxPlayers: Number($('#maxPlayers').value),
      startHealth: Number($('#startHealth').value),
      hitDamage: Number($('#hitDamage').value),
      turnSeconds: this.setupMode === 'single' ? 60 : Number($('#turnSeconds').value),
      mapStyle: $('#mapStyle').value,
      password: $('#roomPassword').value
    };
  }

  submitSetup() {
    $('#setupError').textContent = '';
    const profile = this.getProfile();
    this.currentProfile = profile;
    if (!profile.name) return this.setSetupError('Vui lòng nhập tên người chơi');

    if (this.setupMode === 'single') {
      this.startSingle(profile);
      return;
    }

    if (!this.socket.connected) return this.setSetupError('Chưa kết nối được máy chủ, vui lòng thử lại');
    $('#setupSubmitBtn').disabled = true;
    const password = $('#roomPassword').value;
    sessionStorage.setItem('cannonRoomPassword', password);

    if (this.setupMode === 'create') {
      this.socket.emit('create-room', {
        name: profile.name,
        character: profile.character,
        token: this.playerToken || undefined,
        config: this.getConfig()
      }, (response) => this.handleRoomAck(response));
    } else {
      const code = $('#joinCode').value.trim().toUpperCase();
      if (code.length !== 6) {
        $('#setupSubmitBtn').disabled = false;
        return this.setSetupError('Mã phòng phải có 6 ký tự');
      }
      this.socket.emit('join-room', {
        code,
        password,
        name: profile.name,
        character: profile.character,
        token: this.playerToken || undefined
      }, (response) => this.handleRoomAck(response));
    }
  }

  handleRoomAck(response) {
    $('#setupSubmitBtn').disabled = false;
    if (!response?.ok) return this.setSetupError(response?.error || 'Không thể vào phòng');
    this.playerToken = response.token;
    localStorage.setItem('cannonPlayerToken', response.token);
    this.onlineRoom = response.room;
    history.replaceState(null, '', `${location.pathname}?room=${response.room.code}`);
    this.renderLobby();
    this.showView('lobbyView');
  }

  setSetupError(message) {
    $('#setupError').textContent = message;
  }

  startSingle(profile) {
    const config = this.getConfig();
    const difficulty = $('#aiDifficulty').value;
    this.onlineRoom = null;
    this.localMatch = new LocalMatch(this, config, profile, difficulty);
    this.enterGameView();
  }

  renderLobby() {
    const room = this.onlineRoom;
    if (!room) return;
    $('#lobbyRoomCode').textContent = room.code;
    $('#lobbyRules').innerHTML = [
      `${room.players.length}/${room.config.maxPlayers} người`,
      `${room.config.startHealth} máu`,
      `Trúng mất ${room.config.hitDamage}`,
      `${room.config.turnSeconds} giây/lượt`,
      MAP_LABELS[room.config.mapStyle],
      room.config.hasPassword ? 'Có mật khẩu' : 'Không mật khẩu'
    ].map((text) => `<span class="rule-chip">${escapeHtml(text)}</span>`).join('');

    $('#lobbyPlayers').innerHTML = room.players.map((player) => `
      <div class="lobby-player">
        <img src="/assets/animals/${player.character}/thumb.png" alt="">
        <div>
          <strong>${escapeHtml(player.name)}${player.token === this.playerToken ? ' (Bạn)' : ''}</strong>
          <span>${player.isHost ? 'Chủ phòng' : 'Người chơi'}${player.connected ? '' : ' • Mất kết nối'}</span>
        </div>
      </div>
    `).join('');

    const isHost = room.hostToken === this.playerToken;
    $('#startRoomBtn').classList.toggle('hidden', !isHost);
    $('#startRoomBtn').disabled = room.players.length < 2;
    $('#lobbyMessage').textContent = isHost
      ? room.players.length < 2 ? 'Cần thêm ít nhất 1 người để bắt đầu.' : 'Đã có thể bắt đầu trận đấu.'
      : 'Đang chờ chủ phòng bắt đầu…';
  }

  copyInvite() {
    if (!this.onlineRoom) return;
    const link = `${location.origin}${location.pathname}?room=${this.onlineRoom.code}`;
    navigator.clipboard?.writeText(link).then(() => this.toast('Đã sao chép link mời')).catch(() => {
      prompt('Sao chép đường dẫn này:', link);
    });
  }

  startOnlineRoom() {
    this.socket.emit('start-room', {}, (response) => {
      if (!response?.ok) this.toast(response?.error || 'Không thể bắt đầu');
    });
  }

  leaveRoom() {
    this.socket.emit('leave-room');
    this.onlineRoom = null;
    history.replaceState(null, '', location.pathname);
    this.showView('menuView');
  }

  enterGameView() {
    this.showView('gameView');
    $('#gameCanvas').focus({ preventScroll: true });
    $('#roomHud').classList.toggle('hidden', !this.onlineRoom);
    if (this.onlineRoom) $('#gameRoomCode').textContent = this.onlineRoom.code;
    this.refreshHud();
  }

  getGameState() {
    return this.localMatch?.publicState || this.onlineRoom;
  }

  getMyToken() {
    return this.localMatch ? 'local-human' : this.playerToken;
  }

  getMyPlayer() {
    const state = this.getGameState();
    return state?.players?.find((player) => player.token === this.getMyToken()) || null;
  }

  canControl() {
    const state = this.getGameState();
    return Boolean(state && state.status === 'playing' && !this.renderer.projectile && state.turnToken === this.getMyToken() && this.getMyPlayer()?.health > 0);
  }

  movePlayer(delta) {
    if (!this.canControl()) return false;
    if (this.localMatch) {
      const moved = this.localMatch.move(delta, 'local-human');
      if (moved) this.sound.move();
      return moved;
    }
    this.socket.emit('move-player', { delta });
    this.renderer.markMoving(this.playerToken);
    return true;
  }

  adjustAngle(delta) {
    if (!this.canControl()) return;
    const player = this.getMyPlayer();
    const angle = clamp(player.angle + delta, 8, 86);
    if (this.localMatch) this.localMatch.setAngle(angle, 'local-human');
    else this.socket.emit('set-angle', { angle });
  }

  skipTurn() {
    if (!this.canControl()) return;
    if (this.localMatch) this.localMatch.skip();
    else this.socket.emit('skip-turn');
  }

  startCharge(source) {
    if (!this.canControl() || this.chargeStartedAt) return;
    this.sound.ensure();
    this.chargeStartedAt = performance.now();
    this.chargingSource = source;
    this.chargePower = MIN_POWER;
    $('#fireButton').classList.add('charging');
    $('#chargeMeter').classList.remove('hidden');
  }

  releaseCharge() {
    if (!this.chargeStartedAt) return;
    this.updateCharge(performance.now());
    const power = this.chargePower;
    this.cancelCharge();
    if (!this.canControl()) return;
    if (this.localMatch) this.localMatch.fire(power, 'local-human');
    else this.socket.emit('fire', { power }, (response) => {
      if (!response?.ok) this.toast(response?.error || 'Chưa thể bắn');
    });
  }

  cancelCharge() {
    this.chargeStartedAt = null;
    this.chargingSource = null;
    this.chargePower = MIN_POWER;
    $('#fireButton').classList.remove('charging');
    $('#fireButton').style.setProperty('--charge', '0%');
    $('#chargeMeter').classList.add('hidden');
  }

  updateCharge(now) {
    if (!this.chargeStartedAt) return;
    const progress = clamp((now - this.chargeStartedAt) / 2300, 0, 1);
    this.chargePower = Math.round(MIN_POWER + (MAX_POWER - MIN_POWER) * progress);
    const percent = `${Math.round(progress * 100)}%`;
    $('#fireButton').style.setProperty('--charge', percent);
    $('#chargeFill').style.width = percent;
    $('#chargeValue').textContent = this.chargePower;
  }

  handleShot(shot, done) {
    this.cancelCharge();
    this.renderer.animateShot(shot, () => {
      done?.();
      if (shot.damagedTokens?.length) {
        const state = this.getGameState();
        const names = shot.damagedTokens.map((token) => state?.players?.find((player) => player.token === token)?.name).filter(Boolean);
        if (names.length) this.toast(`${names.join(', ')} mất ${shot.damage} máu`);
      }
    });
  }

  getPreviewPath() {
    if (!this.localMatch) return [];
    const power = this.chargeStartedAt ? this.chargePower : 390;
    return this.localMatch.previewPath(power);
  }

  update(now) {
    this.localMatch?.update();
    this.updateCharge(now);
    this.handleHeldKeys(now);
    this.refreshHudThrottled(now);
  }

  handleHeldKeys(now) {
    if (!this.canControl()) return;
    if (now - this.lastMoveAt >= 65) {
      if (this.keys.has('ArrowLeft')) this.movePlayer(-7);
      if (this.keys.has('ArrowRight')) this.movePlayer(7);
      this.lastMoveAt = now;
    }
    if (now - this.lastAimAt >= 45) {
      if (this.keys.has('ArrowUp')) this.adjustAngle(1.5);
      if (this.keys.has('ArrowDown')) this.adjustAngle(-1.5);
      this.lastAimAt = now;
    }
  }

  onKeyDown(event) {
    if (this.currentViewId() !== 'gameView') return;
    if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Space'].includes(event.code)) event.preventDefault();
    if (event.code === 'Space') {
      if (!event.repeat) this.startCharge('keyboard');
      return;
    }
    if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.code)) this.keys.add(event.code);
  }

  onKeyUp(event) {
    if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Space'].includes(event.code)) event.preventDefault();
    this.keys.delete(event.code);
    if (event.code === 'Space' && this.chargingSource === 'keyboard') this.releaseCharge();
  }

  onCanvasPointerDown(event) {
    if (!this.canControl()) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture?.(event.pointerId);
    this.pointerGesture = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      lastX: event.clientX,
      lastY: event.clientY,
      axis: null,
      moveRemainder: 0,
      aimRemainder: 0
    };
  }

  onCanvasPointerMove(event) {
    const gesture = this.pointerGesture;
    if (!gesture || gesture.pointerId !== event.pointerId || !this.canControl()) return;
    event.preventDefault();
    const totalX = event.clientX - gesture.startX;
    const totalY = event.clientY - gesture.startY;
    const dx = event.clientX - gesture.lastX;
    const dy = event.clientY - gesture.lastY;
    gesture.lastX = event.clientX;
    gesture.lastY = event.clientY;

    if (!gesture.axis && Math.hypot(totalX, totalY) > 7) {
      gesture.axis = Math.abs(totalX) > Math.abs(totalY) * 1.15 ? 'horizontal' : 'vertical';
    }
    if (gesture.axis === 'horizontal') {
      gesture.moveRemainder += dx * 0.9;
      while (Math.abs(gesture.moveRemainder) >= 4) {
        const step = Math.sign(gesture.moveRemainder) * Math.min(10, Math.abs(gesture.moveRemainder));
        this.movePlayer(step);
        gesture.moveRemainder -= step;
      }
    } else if (gesture.axis === 'vertical') {
      gesture.aimRemainder += -dy * 0.24;
      if (Math.abs(gesture.aimRemainder) >= 0.5) {
        this.adjustAngle(gesture.aimRemainder);
        gesture.aimRemainder = 0;
      }
    }
  }

  onCanvasPointerUp(event) {
    if (this.pointerGesture?.pointerId === event.pointerId) this.pointerGesture = null;
  }

  refreshHudThrottled(now) {
    if (!this.lastHudAt || now - this.lastHudAt > 150) {
      this.lastHudAt = now;
      this.refreshHud();
    }
  }

  refreshHud() {
    if (this.currentViewId() !== 'gameView') return;
    const state = this.getGameState();
    if (!state?.players) return;
    const active = state.players.find((player) => player.token === state.turnToken);
    const mine = this.getMyPlayer();
    const myTurn = state.turnToken === this.getMyToken();
    const seconds = state.turnEndsAt ? Math.max(0, Math.ceil((state.turnEndsAt - Date.now()) / 1000)) : '--';
    const windArrow = state.wind > 3 ? '→' : state.wind < -3 ? '←' : '•';
    $('#windValue').textContent = `${windArrow} ${Math.abs(state.wind || 0)}`;
    $('#angleValue').textContent = `${Math.round(mine?.angle || 0)}°`;
    $('#timeValue').textContent = seconds;
    $('#turnBanner').textContent = state.status === 'ended'
      ? 'Trận đấu đã kết thúc'
      : myTurn ? 'ĐẾN LƯỢT BẠN' : active ? `Lượt của ${active.name}` : 'Đang chờ…';
    $('#turnBanner').style.background = myTurn ? '#99f6e4' : '#fde68a';
    $('#fireButton').disabled = !this.canControl();
    $('#skipTurnBtn').disabled = !this.canControl();

    $('#playerHudList').innerHTML = state.players.map((player) => {
      const ratio = clamp(player.health / state.config.startHealth * 100, 0, 100);
      return `
        <div class="player-hud ${state.turnToken === player.token ? 'active-turn' : ''} ${player.health <= 0 ? 'dead' : ''}">
          <img src="/assets/animals/${player.character}/thumb.png" alt="">
          <div class="player-hud-name">
            <strong>${escapeHtml(player.name)}${player.token === this.getMyToken() ? ' • Bạn' : ''}</strong>
            <div class="health-track"><div class="health-fill" style="width:${ratio}%"></div></div>
          </div>
          <div class="player-hud-health">${player.health}/${state.config.startHealth}</div>
        </div>`;
    }).join('');
  }

  showResult() {
    const state = this.getGameState();
    if (!state || state.status !== 'ended') return;
    const winners = state.players.filter((player) => state.winnerTokens.includes(player.token));
    const iWon = state.winnerTokens.includes(this.getMyToken());
    $('#resultIcon').textContent = iWon ? '🏆' : '💥';
    $('#resultTitle').textContent = iWon ? 'Bạn chiến thắng!' : 'Trận đấu kết thúc';
    $('#resultText').textContent = winners.length
      ? `${winners.map((player) => player.name).join(', ')} là người sống sót cuối cùng.`
      : 'Không còn người chơi sống sót.';
    $('#playAgainBtn').textContent = this.localMatch ? 'Đấu lại với máy' : 'Tạo phòng mới';
    this.showView('resultView');
  }

  playAgain() {
    if (this.localMatch && this.currentProfile) {
      this.startSingle(this.currentProfile);
      return;
    }
    this.onlineRoom = null;
    history.replaceState(null, '', location.pathname);
    this.openSetup('create');
  }

  exitGame() {
    if (!confirm('Thoát trận đấu hiện tại?')) return;
    if (this.onlineRoom) this.socket.emit('leave-room');
    this.returnToMenu();
  }

  returnToMenu() {
    this.cancelCharge();
    this.keys.clear();
    this.localMatch = null;
    this.onlineRoom = null;
    history.replaceState(null, '', location.pathname);
    this.showView('menuView');
  }

  toast(message) {
    const toast = $('#gameToast');
    toast.textContent = message;
    toast.classList.remove('hidden');
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => toast.classList.add('hidden'), 2400);
  }
}

window.addEventListener('DOMContentLoaded', () => {
  window.cannonBattleApp = new CannonApp();
});
