'use strict';

const CLIENT_VERSION = '1.5.1';
console.log(`Cannon Battle VN client v${CLIENT_VERSION} loaded`);

const VIEW_WIDTH = 960;
const VIEW_HEIGHT = 540;
const GAME_WIDTH = 1920;
const GAME_HEIGHT = 540;
const TERRAIN_FLOOR = 490;
const GRAVITY = 350;
const MIN_POWER = 220;
const MAX_POWER = 1050;
const MIN_ANGLE = 2;
const MAX_ANGLE = 89;
const BLAST_RADIUS = 60;
const TELEPORT_AMMO = 3;
const DEFAULT_CRITICAL_ENABLED = true;
const DEFAULT_CRITICAL_CHANCE_PERCENT = 15;
const DEFAULT_CRITICAL_DAMAGE_PERCENT = 150;
const DEFAULT_ARC_DAMAGE_ENABLED = true;
const DEFAULT_MAX_ARC_DAMAGE_PERCENT = 200;
const DEFAULT_ARC_ANGLE_TOLERANCE_DEGREES = 15;
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
  volcano: 'Núi lửa',
  jungle: 'Rừng rậm',
  canyon: 'Hẻm núi',
  moon: 'Mặt trăng',
  crystal: 'Thung lũng pha lê',
  storm: 'Bão giông',
  badlands: 'Đất đỏ hiểm trở',
  random: 'Bản đồ ngẫu nhiên'
};
const RANDOM_THEMES = ['grass', 'desert', 'snow', 'volcano', 'jungle', 'canyon', 'moon', 'crystal', 'storm', 'badlands'];
const TEAM_LABELS = { A: 'Phe Xanh', B: 'Phe Đỏ' };
const TEAM_COLORS = { A: '#2563eb', B: '#ef4444' };

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function resolveCombatRules(config = {}) {
  return {
    criticalEnabled: config.criticalEnabled !== false,
    criticalChancePercent: clamp(Number(config.criticalChance ?? DEFAULT_CRITICAL_CHANCE_PERCENT), 0, 100),
    criticalDamagePercent: clamp(Number(config.criticalDamagePercent ?? DEFAULT_CRITICAL_DAMAGE_PERCENT), 100, 250),
    arcDamageEnabled: config.arcDamageEnabled !== false,
    maxArcDamagePercent: clamp(Number(config.maxArcDamagePercent ?? DEFAULT_MAX_ARC_DAMAGE_PERCENT), 100, 250),
    arcAngleToleranceDegrees: clamp(Number(config.arcAngleToleranceDegrees ?? DEFAULT_ARC_ANGLE_TOLERANCE_DEGREES), 1, 45)
  };
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

function resolveMapStyle(requested, seed) {
  if (requested !== 'random') return requested;
  return RANDOM_THEMES[Math.abs(seed) % RANDOM_THEMES.length];
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
  const profiles = {
    grass: { base: 350, rough: 82, wave1: 26, wave2: 13, wave3: 6, min: 255, max: 448 },
    desert: { base: 365, rough: 58, wave1: 20, wave2: 9, wave3: 4, min: 275, max: 452 },
    snow: { base: 345, rough: 72, wave1: 25, wave2: 12, wave3: 8, min: 248, max: 442 },
    volcano: { base: 375, rough: 105, wave1: 38, wave2: 18, wave3: 10, min: 245, max: 465 },
    jungle: { base: 342, rough: 92, wave1: 31, wave2: 17, wave3: 9, min: 242, max: 450 },
    canyon: { base: 388, rough: 122, wave1: 46, wave2: 23, wave3: 12, min: 235, max: 470 },
    moon: { base: 374, rough: 66, wave1: 18, wave2: 16, wave3: 10, min: 285, max: 452 },
    crystal: { base: 356, rough: 94, wave1: 29, wave2: 18, wave3: 12, min: 245, max: 455 },
    storm: { base: 365, rough: 90, wave1: 32, wave2: 20, wave3: 8, min: 250, max: 462 },
    badlands: { base: 384, rough: 112, wave1: 41, wave2: 20, wave3: 11, min: 240, max: 468 }
  };
  const profile = profiles[style] || profiles.grass;
  for (let x = -anchorStep; x <= GAME_WIDTH + anchorStep; x += anchorStep) {
    const wave = Math.sin((x + seed % 500) / 115) * profile.wave1
      + Math.sin((x + seed % 1300) / 47) * profile.wave2
      + Math.sin((x + seed % 830) / 27) * profile.wave3;
    anchors.push(clamp(profile.base + wave + (rand() - 0.5) * profile.rough, profile.min, profile.max));
  }
  const terrain = new Array(GAME_WIDTH);
  for (let x = 0; x < GAME_WIDTH; x += 1) {
    const pos = (x + anchorStep) / anchorStep;
    const index = Math.floor(pos);
    const t = pos - index;
    const smooth = t * t * (3 - 2 * t);
    terrain[x] = Math.round(anchors[index] * (1 - smooth) + anchors[index + 1] * smooth);
  }
  return terrain;
}

function terrainY(terrain, x) {
  if (!terrain?.length) return TERRAIN_FLOOR;
  return terrain[clamp(Math.round(x), 0, terrain.length - 1)] ?? TERRAIN_FLOOR;
}


function playerGroundY(state, player) {
  return terrainY(state.terrain, player.x);
}

function nearestAliveOpponent(player, players) {
  let nearest = null;
  let best = Infinity;
  for (const candidate of players) {
    if (candidate.token === player.token || candidate.health <= 0) continue;
    if (player.team && candidate.team === player.team) continue;
    const distance = Math.abs(candidate.x - player.x);
    if (distance < best) {
      nearest = candidate;
      best = distance;
    }
  }
  return nearest;
}

function facingFor(player, players) {
  if (player?.facing === -1 || player?.facing === 1) return player.facing;
  const target = nearestAliveOpponent(player, players);
  if (!target) return player.x < GAME_WIDTH / 2 ? 1 : -1;
  return target.x >= player.x ? 1 : -1;
}

function canOccupy(state, player, nextX) {
  if (nextX < 28 || nextX > GAME_WIDTH - 28) return false;
  const oldY = terrainY(state.terrain, player.x);
  const newY = terrainY(state.terrain, nextX);
  if (Math.abs(newY - oldY) > 14) return false;
  return !state.players.some((other) => other.token !== player.token && other.health > 0 && Math.abs(other.x - nextX) < 42);
}

function makeCrater(terrain, centerX, centerY, radius = 50) {
  const start = Math.max(0, Math.floor(centerX - radius));
  const end = Math.min(terrain.length - 1, Math.ceil(centerX + radius));
  for (let x = start; x <= end; x += 1) {
    const dx = x - centerX;
    const inside = radius * radius - dx * dx;
    if (inside <= 0) continue;
    const craterBottom = centerY + Math.sqrt(inside) * 0.82;
    if (terrain[x] < craterBottom) terrain[x] = Math.min(TERRAIN_FLOOR, Math.round(craterBottom));
  }
  const copy = terrain.slice();
  for (let x = Math.max(1, start - 6); x < Math.min(terrain.length - 1, end + 6); x += 1) {
    terrain[x] = Math.round(copy[x - 1] * 0.2 + copy[x] * 0.6 + copy[x + 1] * 0.2);
  }
}

function canTeleportTo(state, shooter, nextX) {
  if (nextX < 28 || nextX > GAME_WIDTH - 28) return false;
  return !state.players.some((other) => other.token !== shooter.token && other.health > 0 && Math.abs(other.x - nextX) < 42);
}

function findSafeTeleport(state, shooter, impact) {
  if (impact.type === 'out') return null;
  let targetX = clamp(impact.x, 30, GAME_WIDTH - 30);
  if (impact.type === 'player' && impact.hitToken) {
    const hit = state.players.find((player) => player.token === impact.hitToken);
    if (hit) targetX = hit.x + (shooter.x <= hit.x ? -52 : 52);
  }
  for (const offset of [0, -30, 30, -52, 52, -76, 76, -104, 104, -138, 138, -176, 176]) {
    const candidate = clamp(targetX + offset, 30, GAME_WIDTH - 30);
    if (canTeleportTo(state, shooter, candidate)) {
      return { x: Math.round(candidate * 10) / 10, y: Math.round(terrainY(state.terrain, candidate)) };
    }
  }
  return null;
}

function simulateShotState(state, shooter, angle, power, mutate = true, shotType = 'normal', combatMeta = {}) {
  const players = mutate ? state.players : state.players.map((player) => ({ ...player }));
  const terrain = mutate ? state.terrain : state.terrain.slice();
  const simState = { ...state, players, terrain };
  const localShooter = players.find((player) => player.token === shooter.token) || shooter;
  const facing = facingFor(localShooter, players);
  const radians = angle * Math.PI / 180;
  const ground = playerGroundY(simState, localShooter);
  const barrelLength = 78;
  let x = localShooter.x - facing * 7 + facing * Math.cos(radians) * barrelLength;
  let y = ground - 28 - Math.sin(radians) * barrelLength;
  let vx = facing * Math.cos(radians) * power;
  let vy = -Math.sin(radians) * power;
  const points = [{ x: Math.round(x), y: Math.round(y) }];
  let impact = null;
  let impactVx = vx;
  let impactVy = vy;
  let elapsed = 0;
  let sampleCounter = 0;
  let minTargetDistance = Infinity;
  const target = nearestAliveOpponent(localShooter, players);

  while (elapsed < 12) {
    elapsed += SHOT_STEP;
    vx += state.wind * 0.42 * SHOT_STEP;
    vy += GRAVITY * SHOT_STEP;
    x += vx * SHOT_STEP;
    y += vy * SHOT_STEP;
    sampleCounter += 1;
    if (sampleCounter % 2 === 0) points.push({ x: Math.round(x), y: Math.round(y) });

    if (target) {
      const targetY = playerGroundY(simState, target) - 31;
      minTargetDistance = Math.min(minTargetDistance, Math.hypot(x - target.x, y - targetY));
    }

    if (x < -20 || x > GAME_WIDTH + 20 || y > GAME_HEIGHT + 40) {
      impact = { x: clamp(x, 0, GAME_WIDTH), y: clamp(y, 0, GAME_HEIGHT), type: 'out' };
      impactVx = vx;
      impactVy = vy;
      break;
    }

    if (elapsed > 0.22) {
      for (const player of players) {
        if (player.health <= 0) continue;
        const py = playerGroundY(simState, player) - 34;
        if ((x - player.x) ** 2 + (y - py) ** 2 <= 26 ** 2) {
          impact = { x, y, type: 'player', hitToken: player.token };
          impactVx = vx;
          impactVy = vy;
          break;
        }
      }
      if (impact) break;
    }


    if (x >= 0 && x < GAME_WIDTH && y >= terrainY(terrain, x)) {
      impact = { x, y: terrainY(terrain, x), type: 'terrain' };
      impactVx = vx;
      impactVy = vy;
      break;
    }
  }

  if (!impact) impact = { x: clamp(x, 0, GAME_WIDTH), y: clamp(y, 0, GAME_HEIGHT), type: 'out' };
  const damagedTokens = [];
  let teleportTo = null;
  const baseDamage = Number(state.config.hitDamage) || 25;
  const impactAngle = impactVy > 0
    ? Math.round(Math.atan2(impactVy, Math.max(1, Math.abs(impactVx))) * 180 / Math.PI * 10) / 10
    : 0;
  const launchAngle = Math.round(Number(angle) * 10) / 10;
  const combatRules = resolveCombatRules(state.config);
  const maxArcMultiplier = combatRules.maxArcDamagePercent / 100;
  // Góc siêu cao được xác định tại thời điểm khai hỏa, theo nòng pháo của người bắn.
  // 90° là hướng thẳng đứng lên; với biên độ ±15°, mọi góc phóng từ 75° đến 89°
  // đều được tính là góc siêu cao ở cả hướng trái và hướng phải.
  const superHighAngle = shotType === 'normal' && combatRules.arcDamageEnabled
    && Math.abs(90 - launchAngle) <= combatRules.arcAngleToleranceDegrees;
  const arcMultiplier = superHighAngle ? maxArcMultiplier : 1;
  const critical = shotType === 'normal' && combatRules.criticalEnabled && Boolean(combatMeta.critical);
  const criticalMultiplier = critical ? combatRules.criticalDamagePercent / 100 : 1;
  // Critical và góc siêu cao được phép nhân chồng: 150% × 200% = 300%.
  const damageMultiplier = Math.round(arcMultiplier * criticalMultiplier * 100) / 100;
  const finalDamage = Math.max(1, Math.round(baseDamage * damageMultiplier));

  if (shotType === 'teleport') {
    teleportTo = findSafeTeleport(simState, localShooter, impact);
    if (teleportTo) {
      localShooter.x = teleportTo.x;
    }
  } else if (impact.type !== 'out') {
    for (const player of players) {
      if (player.health <= 0) continue;
      const py = playerGroundY(simState, player) - 30;
      if (Math.hypot(player.x - impact.x, py - impact.y) <= BLAST_RADIUS || player.token === impact.hitToken) {
        const teammateProtected = state.config?.teamMode === 'teams' && localShooter.team
          && player.team === localShooter.team && player.token !== localShooter.token;
        if (!teammateProtected) {
          player.health = Math.max(0, player.health - finalDamage);
          damagedTokens.push(player.token);
        }
      }
    }
    if (impact.y >= terrainY(terrain, impact.x) - 4) {
      makeCrater(terrain, impact.x, impact.y, 50);
    }
  }

  return {
    id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    shooterToken: localShooter.token,
    shotType,
    angle,
    power,
    facing,
    wind: state.wind,
    points,
    impact: { x: Math.round(impact.x), y: Math.round(impact.y), type: impact.type },
    teleportTo,
    damagedTokens,
    damage: finalDamage,
    baseDamage,
    critical,
    criticalChance: combatRules.criticalChancePercent / 100,
    criticalChancePercent: combatRules.criticalChancePercent,
    criticalDamagePercent: combatRules.criticalDamagePercent,
    criticalMultiplier,
    arcDamageEnabled: combatRules.arcDamageEnabled,
    maxArcDamagePercent: combatRules.maxArcDamagePercent,
    arcAngleToleranceDegrees: combatRules.arcAngleToleranceDegrees,
    superHighAngle,
    arcMultiplier,
    impactAngle,
    launchAngle,
    damageMultiplier,
    blastRadius: BLAST_RADIUS,
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
    this.config = { ...config, maxPlayers: 2, teamMode: 'solo' };
    const seed = Math.floor(Math.random() * 0x7fffffff);
    this.activeMapStyle = resolveMapStyle(config.mapStyle, seed);
    this.terrain = generateTerrain(seed, this.activeMapStyle);
    flattenTerrain(this.terrain, 170, 64);
    flattenTerrain(this.terrain, GAME_WIDTH - 170, 64);
    this.players = [
      {
        token: 'local-human', name: profile.name, character: profile.character, color: '#22c55e',
        x: 170, angle: 45, facing: 1, team: null,
        health: config.startHealth, teleportAmmo: TELEPORT_AMMO, connected: true, isHost: true
      },
      {
        token: 'local-ai',
        name: difficulty === 'hard' ? 'Máy Cao Thủ' : difficulty === 'easy' ? 'Máy Tập Sự' : 'Máy Đối Thủ',
        character: `nv${String(((Number(profile.character.slice(2)) + 7) % 22) + 1).padStart(2, '0')}`,
        color: '#ef4444', x: GAME_WIDTH - 170, angle: 45, facing: -1, team: null,
        health: config.startHealth, teleportAmmo: TELEPORT_AMMO, connected: true, isHost: false
      }
    ];
    this.turnToken = 'local-human';
    this.turnEndsAt = Date.now() + config.turnSeconds * 1000;
    this.wind = this.randomWind();
    this.winnerTokens = [];
    this.shotInProgress = false;
    this.revision = 1;
    this.aiScheduled = false;
    this.aiActionDeadline = 0;
    this.aiThinkTimer = null;
    this.aiFireTimer = null;
  }

  randomWind() {
    return Math.round((Math.random() * 2 - 1) * 62);
  }

  get publicState() {
    return {
      status: this.status,
      config: this.config,
      activeMapStyle: this.activeMapStyle,
      terrain: this.terrain,
      players: this.players,
      turnToken: this.turnToken,
      turnEndsAt: this.turnEndsAt,
      wind: this.wind,
      winnerTokens: this.winnerTokens,
      shotInProgress: this.shotInProgress,
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
    const nextX = player.x + clamp(delta, -16, 16);
    if (!canOccupy(this, player, nextX)) return false;
    player.x = Math.round(nextX * 10) / 10;
    if (delta) player.facing = delta < 0 ? -1 : 1;
    this.revision += 1;
    this.app.renderer.markMoving(player.token);
    return true;
  }

  setAngle(angle, token = this.turnToken) {
    const player = this.players.find((item) => item.token === token);
    if (!player || !this.canControl(token)) return false;
    player.angle = Math.round(clamp(angle, MIN_ANGLE, MAX_ANGLE) * 10) / 10;
    this.revision += 1;
    return true;
  }

  setFacing(facing, token = this.turnToken) {
    const player = this.players.find((item) => item.token === token);
    if (!player || !this.canControl(token)) return false;
    player.facing = facing < 0 ? -1 : 1;
    this.revision += 1;
    return true;
  }

  fire(power, token = this.turnToken, shotType = 'normal') {
    const shooter = this.players.find((item) => item.token === token);
    if (!shooter || !this.canControl(token)) return false;
    const resolvedType = shotType === 'teleport' && shooter.teleportAmmo > 0 ? 'teleport' : 'normal';
    if (resolvedType === 'teleport') shooter.teleportAmmo -= 1;
    this.shotInProgress = true;
    this.turnEndsAt = null;
    let shot;
    try {
      const combatRules = resolveCombatRules(this.config);
      const critical = resolvedType === 'normal' && combatRules.criticalEnabled && Math.random() < combatRules.criticalChancePercent / 100;
      shot = simulateShotState(this, shooter, shooter.angle, clamp(power, MIN_POWER, MAX_POWER), false, resolvedType, { critical });
    } catch (error) {
      console.error('Không thể mô phỏng cú bắn:', error);
      this.shotInProgress = false;
      if (resolvedType === 'teleport') shooter.teleportAmmo += 1;
      this.aiScheduled = false;
      this.aiActionDeadline = 0;
      return false;
    }
    const flightMs = clamp(shot.points.length * 22, 900, 7200);
    const effectMs = resolvedType === 'teleport' ? 900 : 1180;
    let impactApplied = false;
    let finished = false;

    const applyImpact = () => {
      if (impactApplied) return;
      impactApplied = true;
      this.terrain = shot.terrain;
      this.players = shot.players;
      this.revision += 1;
    };

    const finish = () => {
      if (finished) return;
      finished = true;
      clearTimeout(this.activeImpactTimer);
      clearTimeout(this.activeShotTimer);
      this.activeImpactTimer = null;
      this.activeShotTimer = null;
      applyImpact();
      this.shotInProgress = false;
      this.activeShotRecovery = null;
      if (this.app.renderer.projectile?.shot?.id === shot.id) this.app.renderer.cancelProjectile(false);
      this.checkEndAndAdvance();
    };

    this.activeShotRecovery = { shotId: shot.id, applyImpact, finish, deadline: Date.now() + flightMs + effectMs + 1400 };
    this.activeImpactTimer = setTimeout(applyImpact, flightMs + 80);
    this.activeShotTimer = setTimeout(finish, flightMs + effectMs + 450);
    this.app.handleShot(shot, finish, applyImpact);
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
      setTimeout(() => this.app.showResult(), 650);
      return;
    }
    this.advanceTurn();
  }

  advanceTurn() {
    const next = this.turnToken === 'local-human' ? 'local-ai' : 'local-human';
    clearTimeout(this.aiThinkTimer);
    clearTimeout(this.aiFireTimer);
    this.aiThinkTimer = null;
    this.aiFireTimer = null;
    this.aiActionDeadline = 0;
    this.turnToken = next;
    this.wind = this.randomWind();
    this.turnEndsAt = Date.now() + this.config.turnSeconds * 1000;
    this.aiScheduled = false;
    this.revision += 1;
    this.app.setShotMode('normal');
    if (next === 'local-ai') this.scheduleAI();
  }

  update() {
    if (this.status !== 'playing') return;
    if (this.shotInProgress) {
      if (this.activeShotRecovery && Date.now() >= this.activeShotRecovery.deadline) {
        console.warn('Khôi phục lượt sau cú bắn bị quá hạn', this.activeShotRecovery.shotId);
        this.activeShotRecovery.finish();
      }
      return;
    }
    if (this.turnEndsAt && Date.now() >= this.turnEndsAt) {
      this.app.toast('Hết giờ, tự động bỏ lượt');
      this.advanceTurn();
      return;
    }
    if (this.turnToken === 'local-ai') {
      // Nếu callback suy nghĩ/bắn của AI bị trình duyệt hủy hoặc phát sinh lỗi,
      // tự giải phóng khóa lập lịch và thử lại thay vì treo vĩnh viễn ở lượt máy.
      if (this.aiScheduled && this.aiActionDeadline && Date.now() >= this.aiActionDeadline) {
        console.warn('Watchdog khôi phục lượt AI bị kẹt');
        clearTimeout(this.aiThinkTimer);
        clearTimeout(this.aiFireTimer);
        this.aiThinkTimer = null;
        this.aiFireTimer = null;
        this.aiScheduled = false;
        this.aiActionDeadline = 0;
      }
      this.scheduleAI();
    }
  }

  scheduleAI() {
    if (this.aiScheduled || this.shotInProgress || this.turnToken !== 'local-ai') return;
    this.aiScheduled = true;
    this.aiActionDeadline = Date.now() + 7000;
    this.aiThinkTimer = setTimeout(() => {
      this.aiThinkTimer = null;
      if (this.status !== 'playing' || this.turnToken !== 'local-ai' || this.shotInProgress) {
        this.aiScheduled = false;
        this.aiActionDeadline = 0;
        return;
      }
      try {
        const ai = this.players[1];
        const target = this.players[0];
        const distance = Math.abs(target.x - ai.x);
        const moveDirection = distance < 240 ? Math.sign(ai.x - target.x) : (Math.random() > 0.62 ? Math.sign(target.x - ai.x) : 0);
        const moveSteps = Math.floor(Math.random() * 4);
        for (let index = 0; index < moveSteps; index += 1) this.move(moveDirection * 7, ai.token);

        ai.facing = target.x >= ai.x ? 1 : -1;
        const useTeleport = this.shouldUseTeleport(ai, target);
        let solution;
        try {
          solution = useTeleport ? this.findBestTeleportShot(ai, target) : this.findBestShot(ai);
        } catch (error) {
          console.error('AI lỗi khi tìm góc bắn, chuyển sang đạn thường dự phòng:', error);
          solution = { angle: 45, power: 520, shotType: 'normal' };
        }
        ai.angle = clamp(Number(solution.angle) || 45, MIN_ANGLE, MAX_ANGLE);
        this.revision += 1;
        this.aiActionDeadline = Date.now() + 3500;
        this.aiFireTimer = setTimeout(() => {
          this.aiFireTimer = null;
          if (this.status !== 'playing' || this.turnToken !== 'local-ai' || this.shotInProgress) {
            this.aiScheduled = false;
            this.aiActionDeadline = 0;
            return;
          }
          const fired = this.fire(solution.power, ai.token, solution.shotType || 'normal');
          if (!fired) {
            console.warn('AI không thể khai hỏa, tự bỏ lượt để tránh treo');
            this.aiScheduled = false;
            this.aiActionDeadline = 0;
            this.advanceTurn();
          }
        }, 780);
      } catch (error) {
        console.error('Lỗi điều khiển lượt AI:', error);
        this.aiScheduled = false;
        this.aiActionDeadline = 0;
        if (this.status === 'playing' && this.turnToken === 'local-ai' && !this.shotInProgress) this.advanceTurn();
      }
    }, 850);
  }

  shouldUseTeleport(ai, target) {
    if (ai.teleportAmmo <= 0) return false;
    const farAway = Math.abs(target.x - ai.x) > 820;
    const lowHealth = ai.health <= this.config.startHealth * 0.45;
    const chance = this.difficulty === 'hard' ? 0.38 : this.difficulty === 'normal' ? 0.26 : 0.16;
    return farAway || lowHealth || Math.random() < chance;
  }

  findBestTeleportShot(shooter, target) {
    const groundX = clamp(target.x + (target.x < GAME_WIDTH / 2 ? 420 : -420), 90, GAME_WIDTH - 90);
    const destinations = [{ x: groundX, priority: 0 }];

    let best = { angle: 48, power: 430, shotType: 'teleport', score: Infinity };
    for (let angle = 6; angle <= 88; angle += 4) {
      for (let power = 250; power <= 1020; power += 34) {
        const test = simulateShotState(this, shooter, angle, power, false, 'teleport');
        if (!test.teleportTo) continue;
        for (const destination of destinations) {
          const targetSpacing = Math.abs(test.teleportTo.x - target.x);
          const unsafePenalty = targetSpacing < 85 ? 160 : 0;
          const score = Math.abs(test.teleportTo.x - destination.x) + unsafePenalty + destination.priority;
          if (score < best.score) best = { angle, power, shotType: 'teleport', score };
        }
      }
    }
    if (!Number.isFinite(best.score)) return { ...this.findBestShot(shooter), shotType: 'normal' };
    const error = this.difficulty === 'easy' ? { angle: 5, power: 50 } : this.difficulty === 'normal' ? { angle: 2, power: 20 } : { angle: 0.5, power: 7 };
    return {
      angle: clamp(best.angle + (Math.random() * 2 - 1) * error.angle, MIN_ANGLE, MAX_ANGLE),
      power: clamp(best.power + (Math.random() * 2 - 1) * error.power, MIN_POWER, MAX_POWER),
      shotType: 'teleport'
    };
  }

  findBestShot(shooter) {
    let best = { angle: 45, power: 430, score: Infinity, shotType: 'normal' };
    for (let angle = 5; angle <= 88; angle += 3) {
      for (let power = 250; power <= 1020; power += 30) {
        const test = simulateShotState(this, shooter, angle, power, false, 'normal');
        let score = test.minTargetDistance;
        if (test.damagedTokens.includes('local-human')) score -= 310 + (test.arcMultiplier - 1) * 85;
        if (test.damagedTokens.includes('local-ai')) score += 240;
        if (score < best.score) best = { angle, power, score, shotType: 'normal' };
      }
    }
    const error = {
      easy: { angle: 8, power: 75 },
      normal: { angle: 3, power: 28 },
      hard: { angle: 0.8, power: 9 }
    }[this.difficulty] || { angle: 3, power: 28 };
    return {
      angle: clamp(best.angle + (Math.random() * 2 - 1) * error.angle, MIN_ANGLE, MAX_ANGLE),
      power: clamp(best.power + (Math.random() * 2 - 1) * error.power, MIN_POWER, MAX_POWER),
      shotType: 'normal'
    };
  }

  previewPath(power = 400) {
    const human = this.human();
    if (this.difficulty !== 'easy' || !this.canControl(human.token)) return [];
    return simulateShotState(this, human, human.angle, power, false, this.app.shotMode).points.filter((_point, index) => index % 5 === 0);
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
    this.camera = { x: VIEW_WIDTH / 2, zoom: 1, targetX: VIEW_WIDTH / 2, targetZoom: 1 };
    this.overviewHeld = false;
    this.clouds = [
      { x: 90, y: 82, s: 1.1 }, { x: 385, y: 120, s: 0.75 }, { x: 735, y: 72, s: 1.35 },
      { x: 1080, y: 104, s: 0.9 }, { x: 1420, y: 64, s: 1.25 }, { x: 1760, y: 128, s: 0.72 }
    ];
    this.loop = this.loop.bind(this);
    requestAnimationFrame(this.loop);
  }

  setOverviewHeld(held) {
    this.overviewHeld = Boolean(held);
  }

  updateCamera(state, dt) {
    const fitZoom = Math.min(VIEW_WIDTH / GAME_WIDTH, VIEW_HEIGHT / GAME_HEIGHT);
    let targetZoom = this.overviewHeld ? fitZoom : 1;
    let targetX = GAME_WIDTH / 2;
    if (!this.overviewHeld) {
      if (this.projectile && !this.projectile.exploded && Number.isFinite(this.projectile.x)) {
        targetX = this.projectile.x;
      } else {
        const active = state?.players?.find((player) => player.token === state.turnToken) || this.app.getMyPlayer();
        if (active) targetX = active.x;
      }
    }
    const visibleHalf = VIEW_WIDTH / (2 * targetZoom);
    targetX = clamp(targetX, visibleHalf, GAME_WIDTH - visibleHalf);
    this.camera.targetX = targetX;
    this.camera.targetZoom = targetZoom;
    const positionEase = 1 - Math.exp(-Math.max(0.001, dt) * (this.overviewHeld ? 4.2 : 7.2));
    const zoomEase = 1 - Math.exp(-Math.max(0.001, dt) * 4.8);
    this.camera.x += (this.camera.targetX - this.camera.x) * positionEase;
    this.camera.zoom += (this.camera.targetZoom - this.camera.zoom) * zoomEase;
    const currentHalf = VIEW_WIDTH / (2 * this.camera.zoom);
    this.camera.x = clamp(this.camera.x, currentHalf, GAME_WIDTH - currentHalf);
  }

  applyWorldTransform() {
    const ctx = this.ctx;
    ctx.translate(VIEW_WIDTH / 2, VIEW_HEIGHT / 2);
    ctx.scale(this.camera.zoom, this.camera.zoom);
    ctx.translate(-this.camera.x, -GAME_HEIGHT / 2);
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

  animateShot(shot, done, onImpact) {
    const points = Array.isArray(shot.points) && shot.points.length ? shot.points : [shot.impact || { x: 0, y: 0 }];
    const duration = clamp(points.length * 22, 900, 7200);
    this.projectile = {
      shot: { ...shot, points }, start: performance.now(), duration, done, onImpact,
      exploded: false, impactApplied: false, doneCalled: false, x: points[0]?.x || 0, y: points[0]?.y || 0
    };
    this.app.sound.shoot();
  }

  cancelProjectile(invokeDone = false) {
    if (!this.projectile) return;
    const projectile = this.projectile;
    this.projectile = null;
    this.explosion = null;
    if (invokeDone && !projectile.doneCalled) {
      projectile.doneCalled = true;
      projectile.onImpact?.();
      projectile.done?.();
    }
  }

  loop(now) {
    const dt = Math.min(0.05, Math.max(0.001, (now - this.lastFrame) / 1000));
    this.lastFrame = now;
    try {
      this.app.update(now, dt);
      this.updateAnimation(now, dt);
      this.updateCamera(this.app.getGameState(), dt);
      this.draw(now);
    } catch (error) {
      console.error('Lỗi khung hình game:', error);
      this.app.recoverShotAfterRenderError?.();
    } finally {
      requestAnimationFrame(this.loop);
    }
  }

  updateAnimation(now, dt) {
    if (this.projectile) {
      const projectile = this.projectile;
      const progress = clamp((now - projectile.start) / projectile.duration, 0, 1);
      const points = projectile.shot.points;
      const exact = progress * Math.max(0, points.length - 1);
      const index = clamp(Math.floor(exact), 0, points.length - 1);
      const nextIndex = Math.min(points.length - 1, index + 1);
      const t = exact - index;
      projectile.x = points[index].x * (1 - t) + points[nextIndex].x * t;
      projectile.y = points[index].y * (1 - t) + points[nextIndex].y * t;
      if (progress >= 1 && !projectile.impactApplied) {
        projectile.impactApplied = true;
        try { projectile.onImpact?.(); } catch (error) { console.error('Lỗi áp dụng điểm đạn rơi:', error); }
      }
      if (progress >= 1 && !projectile.exploded) {
        projectile.exploded = true;
        const teleport = projectile.shot.shotType === 'teleport';
        this.explosion = {
          x: projectile.shot.impact.x,
          y: projectile.shot.impact.y,
          start: now,
          duration: teleport ? 900 : 1180,
          shot: projectile.shot,
          kind: teleport ? 'teleport' : 'normal'
        };
        if (teleport) this.spawnTeleportParticles(this.explosion.x, this.explosion.y);
        else this.spawnExplosionParticles(this.explosion.x, this.explosion.y);
        this.app.sound.explosion();
      }
      if (progress >= 1 && this.explosion && now - this.explosion.start >= this.explosion.duration) {
        const finishedProjectile = this.projectile;
        this.projectile = null;
        this.explosion = null;
        if (finishedProjectile && !finishedProjectile.doneCalled) {
          finishedProjectile.doneCalled = true;
          try { finishedProjectile.done?.(); } catch (error) { console.error('Lỗi hoàn tất cú bắn:', error); }
        }
      }
    }

    this.particles = this.particles.filter((particle) => {
      particle.life -= dt;
      particle.x += particle.vx * dt;
      particle.y += particle.vy * dt;
      particle.vy += particle.gravity * dt;
      return particle.life > 0;
    });
  }

  spawnExplosionParticles(x, y) {
    for (let index = 0; index < 68; index += 1) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 70 + Math.random() * 260;
      this.particles.push({
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 95,
        gravity: 220,
        life: 0.5 + Math.random() * 0.85,
        maxLife: 1.35,
        size: 2 + Math.random() * 7,
        kind: Math.random() > 0.28 ? 'fire' : 'smoke'
      });
    }
  }

  spawnTeleportParticles(x, y) {
    for (let index = 0; index < 52; index += 1) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 45 + Math.random() * 150;
      this.particles.push({
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        gravity: -8,
        life: 0.65 + Math.random() * 0.7,
        maxLife: 1.35,
        size: 2 + Math.random() * 5,
        kind: Math.random() > 0.45 ? 'portalA' : 'portalB'
      });
    }
  }

  activeStyle(state) {
    return state.activeMapStyle || state.config.mapStyle || 'grass';
  }

  draw(now) {
    const state = this.app.getGameState();
    const ctx = this.ctx;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, VIEW_WIDTH, VIEW_HEIGHT);
    if (!state?.terrain) {
      ctx.fillStyle = '#0b2b36';
      ctx.fillRect(0, 0, VIEW_WIDTH, VIEW_HEIGHT);
      return;
    }
    ctx.save();
    this.applyWorldTransform();
    this.drawSky(state, now);
    this.drawTerrain(state);
    this.drawTrajectoryPreview();
    this.drawPlayers(state, now);
    this.drawProjectile();
    this.drawExplosion(now);
    this.drawParticles();
    this.drawWindParticles(state, now);
    ctx.restore();
    this.drawMapHud(state);
  }

  drawSky(state, now) {
    const ctx = this.ctx;
    const style = this.activeStyle(state);
    const palettes = {
      grass: ['#76c9f4', '#dff7ff'], desert: ['#f6b96f', '#fff1c8'],
      snow: ['#8ebbe1', '#eef9ff'], volcano: ['#3d273d', '#e06a4b'], sky: ['#467fc9', '#d8f3ff'],
      jungle: ['#2f9e78', '#d9f7d4'], canyon: ['#d98248', '#ffe0b2'], moon: ['#252b45', '#9aa6bd'],
      crystal: ['#5b4cc4', '#d9f8ff'], storm: ['#26384d', '#8bb2c5'], archipelago: ['#3b82c4', '#dff8ff'],
      badlands: ['#a84d35', '#f3b27b']
    };
    const [top, bottom] = palettes[style] || palettes.grass;
    const gradient = ctx.createLinearGradient(0, 0, 0, GAME_HEIGHT);
    gradient.addColorStop(0, top);
    gradient.addColorStop(0.74, bottom);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

    ctx.save();
    ctx.globalAlpha = style === 'volcano' || style === 'storm' ? 0.42 : 0.82;
    ctx.fillStyle = style === 'volcano' ? '#ff8a54' : style === 'moon' ? '#dbeafe' : style === 'storm' ? '#d7e4ea' : '#fff7bf';
    ctx.beginPath();
    ctx.arc(GAME_WIDTH - 140, 82, 42, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    if (style !== 'volcano' && style !== 'storm') {
      for (let index = 0; index < this.clouds.length; index += 1) {
        const cloud = this.clouds[index];
        const drift = ((now * 0.008 * (index + 1)) % (GAME_WIDTH + 180)) - 90;
        this.drawCloud((cloud.x + drift) % (GAME_WIDTH + 160) - 60, cloud.y, cloud.s);
      }
    } else {
      ctx.save();
      for (let index = 0; index < 18; index += 1) {
        const x = (index * 83 + now * 0.02) % GAME_WIDTH;
        const y = 35 + (index * 47) % 210;
        ctx.fillStyle = style === 'storm' ? 'rgba(210,235,245,.34)' : `rgba(255, ${80 + index * 4}, 45, 0.28)`;
        if (style === 'storm') ctx.fillRect(x, y, 2, 18);
        else ctx.fillRect(x, y, 2, 2);
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

  terrainPalette(style) {
    return {
      grass: { top: '#55b948', fill: '#4b8b3b', deep: '#2f5f31' },
      desert: { top: '#f0c45f', fill: '#cc8b3d', deep: '#97562e' },
      snow: { top: '#f4fbff', fill: '#8fb6cc', deep: '#5e8398' },
      volcano: { top: '#6b3940', fill: '#2e2028', deep: '#160f19' },
      jungle: { top: '#66d45a', fill: '#26734d', deep: '#123d32' },
      canyon: { top: '#f0a35f', fill: '#b95f3c', deep: '#6d332c' },
      moon: { top: '#d9dde6', fill: '#778195', deep: '#3f4658' },
      crystal: { top: '#8ff7ff', fill: '#7367d8', deep: '#302b72' },
      storm: { top: '#9cc7d2', fill: '#436879', deep: '#203846' },
      badlands: { top: '#f08b57', fill: '#a74634', deep: '#5c2928' }
    }[style] || { top: '#55b948', fill: '#4b8b3b', deep: '#2f5f31' };
  }

  drawTerrain(state) {
    const ctx = this.ctx;
    const style = this.activeStyle(state);
    const palette = this.terrainPalette(style);
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
    ctx.lineWidth = style === 'snow' ? 9 : 6;
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

  drawTrajectoryPreview() {
    const points = this.app.getPreviewPath();
    if (!points.length || this.projectile) return;
    const ctx = this.ctx;
    ctx.save();
    ctx.fillStyle = this.app.shotMode === 'teleport' ? 'rgba(103,232,249,.82)' : 'rgba(255,255,255,0.72)';
    points.forEach((point, index) => {
      const radius = index % 3 === 0 ? 3 : 2;
      ctx.beginPath();
      ctx.arc(point.x, point.y, radius, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.restore();
  }

  drawPlayers(state, now) {
    const sorted = [...state.players].sort((a, b) => playerGroundY(state, a) - playerGroundY(state, b));
    for (const player of sorted) this.drawPlayer(state, player, now);
  }

  drawPlayer(state, player, now) {
    const ctx = this.ctx;
    const groundY = playerGroundY(state, player);
    const facing = facingFor(player, state.players);
    const isActive = state.turnToken === player.token && player.health > 0;
    const isMoving = (this.movingUntil.get(player.token) || 0) > now;
    const frame = isMoving ? Math.floor(now / 85) % 5 + 1 : 1;
    const sprite = this.getImage(`/assets/animals/${player.character}/frame${frame}.png`);

    ctx.save();
    ctx.globalAlpha = player.health > 0 ? 1 : 0.42;
    if (player.team) {
      ctx.strokeStyle = TEAM_COLORS[player.team] || player.color || '#64748b';
      ctx.lineWidth = 6;
      ctx.globalAlpha = player.health > 0 ? 0.95 : 0.4;
      ctx.beginPath();
      ctx.ellipse(player.x, groundY - 7, 45, 14, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = player.health > 0 ? 1 : 0.42;
    }
    if (isActive) {
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 3;
      ctx.setLineDash([8, 6]);
      ctx.beginPath();
      ctx.ellipse(player.x, groundY - 7, 53, 19, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    const pivotX = player.x - facing * 9;
    const pivotY = groundY - 27;
    const radians = player.angle * Math.PI / 180;
    const barrelLength = 78;
    const muzzleX = pivotX + facing * Math.cos(radians) * barrelLength;
    const muzzleY = pivotY - Math.sin(radians) * barrelLength;

    // Nòng pháo dài được vẽ trước; họng và vạch ngắm được vẽ lại sau nhân vật để luôn nhìn thấy.
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#172832';
    ctx.lineWidth = 16;
    ctx.beginPath();
    ctx.moveTo(pivotX, pivotY);
    ctx.lineTo(muzzleX, muzzleY);
    ctx.stroke();
    ctx.strokeStyle = '#718b9b';
    ctx.lineWidth = 7;
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

    // Họng súng luôn nằm phía trước sprite, giúp nhân vật lớn không che mất hướng bắn.
    ctx.fillStyle = isActive ? '#fff7b2' : '#a8c1cc';
    ctx.strokeStyle = '#15252e';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(muzzleX, muzzleY, isActive ? 7 : 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    if (isActive && !this.projectile) {
      const guideLength = 42;
      const guideX = muzzleX + facing * Math.cos(radians) * guideLength;
      const guideY = muzzleY - Math.sin(radians) * guideLength;
      ctx.save();
      ctx.strokeStyle = this.app.shotMode === 'teleport' ? '#67e8f9' : '#fff4a3';
      ctx.lineWidth = 3;
      ctx.setLineDash([7, 6]);
      ctx.beginPath();
      ctx.moveTo(muzzleX, muzzleY);
      ctx.lineTo(guideX, guideY);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = this.app.shotMode === 'teleport' ? '#67e8f9' : '#fff4a3';
      ctx.beginPath();
      ctx.arc(guideX, guideY, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      this.drawAimBadge(player, muzzleX, muzzleY, groundY);
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

  drawAimBadge(player, muzzleX, muzzleY, groundY) {
    const ctx = this.ctx;
    const myTurn = player.token === this.app.getMyToken();
    const power = myTurn ? (this.app.chargeStartedAt ? this.app.chargePower : MIN_POWER) : null;
    const text = `${Math.round(player.angle)}°${power ? ` • lực ${power}` : ''}${this.app.shotMode === 'teleport' && myTurn ? ' • 🌀' : ''}`;
    const x = clamp(muzzleX, 78, GAME_WIDTH - 78);
    const y = clamp(Math.min(muzzleY - 19, groundY - 120), 72, GAME_HEIGHT - 30);
    ctx.save();
    ctx.font = '900 13px system-ui, sans-serif';
    const width = ctx.measureText(text).width + 18;
    ctx.fillStyle = 'rgba(3,25,34,.76)';
    ctx.beginPath();
    ctx.roundRect(x - width / 2, y - 17, width, 25, 9);
    ctx.fill();
    ctx.fillStyle = this.app.shotMode === 'teleport' && myTurn ? '#8be9ff' : '#fffbd1';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, x, y - 4);
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
    if (player.team) {
      const teamText = TEAM_LABELS[player.team] || '';
      ctx.font = '900 9px system-ui, sans-serif';
      ctx.textBaseline = 'top';
      ctx.strokeStyle = 'rgba(0,0,0,.55)';
      ctx.lineWidth = 3;
      ctx.strokeText(teamText, player.x, y + 12);
      ctx.fillStyle = TEAM_COLORS[player.team] || player.color || '#ffffff';
      ctx.fillText(teamText, player.x, y + 12);
      ctx.textBaseline = 'bottom';
    }
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
    const teleport = this.projectile.shot.shotType === 'teleport';
    const critical = !teleport && Boolean(this.projectile.shot.critical);
    ctx.save();
    const glowRadius = teleport ? 18 : critical ? 30 : 15;
    const glow = ctx.createRadialGradient(x, y, 1, x, y, glowRadius);
    if (teleport) {
      glow.addColorStop(0, 'rgba(255,255,255,1)');
      glow.addColorStop(0.28, 'rgba(103,232,249,.95)');
      glow.addColorStop(0.65, 'rgba(139,92,246,.78)');
      glow.addColorStop(1, 'rgba(37,99,235,0)');
    } else if (critical) {
      glow.addColorStop(0, 'rgba(255,255,255,1)');
      glow.addColorStop(0.18, 'rgba(255,245,130,1)');
      glow.addColorStop(0.42, 'rgba(255,122,20,.98)');
      glow.addColorStop(0.72, 'rgba(220,38,38,.78)');
      glow.addColorStop(1, 'rgba(127,29,29,0)');
    } else {
      glow.addColorStop(0, 'rgba(255,255,210,1)');
      glow.addColorStop(0.35, 'rgba(255,160,40,0.95)');
      glow.addColorStop(1, 'rgba(255,80,20,0)');
    }
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(x, y, glowRadius, 0, Math.PI * 2);
    ctx.fill();

    if (critical) {
      const spin = performance.now() * 0.012;
      ctx.translate(x, y);
      ctx.rotate(spin);
      ctx.strokeStyle = 'rgba(255,245,150,.92)';
      ctx.lineWidth = 3;
      for (let ray = 0; ray < 8; ray += 1) {
        ctx.rotate(Math.PI / 4);
        ctx.beginPath();
        ctx.moveTo(9, 0);
        ctx.lineTo(21 + (ray % 2) * 5, 0);
        ctx.stroke();
      }
      ctx.rotate(-spin);
      ctx.translate(-x, -y);
    }

    ctx.fillStyle = teleport ? '#5b21b6' : critical ? '#7f1d1d' : '#202a31';
    ctx.beginPath();
    ctx.arc(x, y, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  drawExplosion(now) {
    if (!this.explosion) return;
    if (this.explosion.kind === 'teleport') return this.drawTeleportEffect(now);
    const ctx = this.ctx;
    const progress = clamp((now - this.explosion.start) / this.explosion.duration, 0, 1);
    const blastRadius = this.explosion.shot.blastRadius || BLAST_RADIUS;
    const pulse = Math.sin(Math.min(1, progress * 1.45) * Math.PI / 2);
    const radius = blastRadius * (0.38 + pulse * 0.95);
    const alpha = 1 - progress;
    ctx.save();

    // Vòng bán kính nổ giữ đủ lâu để người chơi đọc được vùng sát thương.
    if (progress < 0.72) {
      ctx.globalAlpha = 0.85 * (1 - progress / 0.72);
      ctx.strokeStyle = '#fff3a3';
      ctx.lineWidth = 4;
      ctx.setLineDash([10, 7]);
      ctx.beginPath();
      ctx.arc(this.explosion.x, this.explosion.y, blastRadius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    const gradient = ctx.createRadialGradient(this.explosion.x, this.explosion.y, 0, this.explosion.x, this.explosion.y, Math.max(1, radius));
    gradient.addColorStop(0, '#ffffff');
    gradient.addColorStop(0.12, '#fff6a6');
    gradient.addColorStop(0.3, '#facc15');
    gradient.addColorStop(0.53, '#f97316');
    gradient.addColorStop(0.75, 'rgba(220,38,38,.92)');
    gradient.addColorStop(1, 'rgba(60,15,8,0)');
    ctx.globalAlpha = alpha;
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(this.explosion.x, this.explosion.y, radius, 0, Math.PI * 2);
    ctx.fill();

    // Sóng xung kích trắng và lửa nhỏ tạo cảm giác vụ nổ rõ hơn.
    ctx.globalAlpha = Math.max(0, 0.8 - progress);
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.arc(this.explosion.x, this.explosion.y, blastRadius * clamp(progress * 1.45, 0.1, 1.45), 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();

    if (this.explosion.shot.damagedTokens.length && progress < 0.76) {
      const shot = this.explosion.shot;
      ctx.save();
      ctx.globalAlpha = 1 - progress;
      ctx.textAlign = 'center';
      ctx.strokeStyle = 'rgba(0,0,0,0.68)';
      ctx.lineWidth = 6;
      const baseY = this.explosion.y - 67 - progress * 38;
      ctx.font = '950 27px system-ui, sans-serif';
      const text = `-${shot.damage} MÁU`;
      ctx.strokeText(text, this.explosion.x, baseY);
      ctx.fillStyle = shot.critical ? '#ffd166' : '#fff176';
      ctx.fillText(text, this.explosion.x, baseY);

      const labels = [];
      if (shot.critical) labels.push(`🔥 CRITICAL ${Math.round(Number(shot.criticalDamagePercent || shot.criticalMultiplier * 100 || 150))}%`);
      if (shot.superHighAngle || (shot.arcMultiplier || 1) > 1.01) labels.push(`☄️ GÓC SIÊU CAO ${Math.round(Number(shot.maxArcDamagePercent || shot.arcMultiplier * 100 || 200))}%`);
      if (labels.length) {
        ctx.font = '900 17px system-ui, sans-serif';
        const bonus = labels.join('  •  ');
        ctx.strokeText(bonus, this.explosion.x, baseY - 31);
        ctx.fillStyle = shot.critical ? '#ff8a3d' : '#b8f7ff';
        ctx.fillText(bonus, this.explosion.x, baseY - 31);
      }
      ctx.restore();
    }
  }

  drawTeleportEffect(now) {
    const ctx = this.ctx;
    const progress = clamp((now - this.explosion.start) / this.explosion.duration, 0, 1);
    const radius = 18 + progress * 74;
    ctx.save();
    ctx.globalAlpha = 1 - progress;
    for (let ring = 0; ring < 3; ring += 1) {
      // Ở các frame đầu, radius - ring*15 từng có thể âm (-12px),
      // khiến Safari/iPhone ném IndexSizeError và dừng luồng hoạt ảnh dịch chuyển.
      const ringRadius = radius - ring * 15;
      if (ringRadius <= 0.5) continue;
      ctx.strokeStyle = ring % 2 ? '#a78bfa' : '#67e8f9';
      ctx.lineWidth = Math.max(1, 7 - ring * 1.5);
      ctx.beginPath();
      ctx.arc(this.explosion.x, this.explosion.y, ringRadius, 0, Math.PI * 2);
      ctx.stroke();
    }
    const gradient = ctx.createRadialGradient(this.explosion.x, this.explosion.y, 0, this.explosion.x, this.explosion.y, radius);
    gradient.addColorStop(0, 'rgba(255,255,255,.9)');
    gradient.addColorStop(.25, 'rgba(103,232,249,.75)');
    gradient.addColorStop(.65, 'rgba(124,58,237,.55)');
    gradient.addColorStop(1, 'rgba(30,64,175,0)');
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(this.explosion.x, this.explosion.y, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.font = '950 20px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.strokeStyle = 'rgba(0,0,0,.55)';
    ctx.lineWidth = 5;
    const text = this.explosion.shot.teleportTo ? 'DỊCH CHUYỂN!' : 'KHÔNG CÓ ĐIỂM ĐÁP';
    ctx.strokeText(text, this.explosion.x, this.explosion.y - 62 - progress * 22);
    ctx.fillStyle = '#d9faff';
    ctx.fillText(text, this.explosion.x, this.explosion.y - 62 - progress * 22);
    ctx.restore();
  }

  drawParticles() {
    const ctx = this.ctx;
    ctx.save();
    for (const particle of this.particles) {
      ctx.globalAlpha = clamp(particle.life / particle.maxLife, 0, 1);
      ctx.fillStyle = {
        fire: Math.random() > 0.45 ? '#ffb02e' : '#ff5b20',
        smoke: '#4a332d',
        portalA: '#67e8f9',
        portalB: '#a78bfa'
      }[particle.kind] || '#ff9b32';
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
    ctx.globalAlpha = clamp(Math.abs(wind) / 100, 0.1, 0.42);
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    const direction = Math.sign(wind);
    for (let index = 0; index < 12; index += 1) {
      const base = (index * 101 + now * Math.abs(wind) * 0.018) % (GAME_WIDTH + 100);
      const x = direction > 0 ? base - 50 : GAME_WIDTH + 50 - base;
      const y = 65 + (index * 53) % 250;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + direction * (14 + Math.abs(wind) * 0.18), y);
      ctx.stroke();
    }
    ctx.restore();
  }

  drawMapHud(state) {
    const ctx = this.ctx;
    const wind = state.wind || 0;
    const arrow = wind > 3 ? '→' : wind < -3 ? '←' : '•';
    const seconds = state.turnEndsAt ? Math.max(0, Math.ceil((state.turnEndsAt - Date.now()) / 1000)) : '--';
    const active = state.players.find((player) => player.token === state.turnToken);
    ctx.save();

    const windText = `GIÓ ${arrow} ${Math.abs(wind)}   •   ${seconds}s`;
    ctx.font = '950 14px system-ui, sans-serif';
    const windWidth = ctx.measureText(windText).width + 28;
    ctx.fillStyle = 'rgba(3,27,36,.68)';
    ctx.beginPath();
    ctx.roundRect(VIEW_WIDTH / 2 - windWidth / 2, 43, windWidth, 30, 13);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(windText, VIEW_WIDTH / 2, 58);

    ctx.globalAlpha = 0.5;
    ctx.textAlign = 'left';
    ctx.font = '800 11px system-ui, sans-serif';
    ctx.fillStyle = '#ffffff';
    const tip = matchMedia('(pointer: coarse)').matches
      ? 'TIP: vuốt đi/ngắm • giữ 🔭 để xem toàn cảnh • có thể giữ 🔭 và BẮN cùng lúc'
      : 'TIP: ← → đi • ↑ ↓ chỉnh góc • Q/E quay nòng • giữ/thả Space để bắn';
    ctx.fillText(tip, 16, VIEW_HEIGHT - 16);
    if (active) {
      ctx.textAlign = 'right';
      ctx.fillText(`${this.overviewHeld ? 'TOÀN CẢNH • ' : ''}Lượt: ${active.name}`, VIEW_WIDTH - 16, VIEW_HEIGHT - 16);
    }
    ctx.restore();
  }
}

class CannonApp {
  constructor() {
    this.views = $$('.view');
    this.setupMode = 'single';
    this.selectedCharacter = localStorage.getItem('cannonCharacter') || 'nv01';
    this.selectedTeam = ['A', 'B'].includes(localStorage.getItem('cannonPreferredTeam'))
      ? localStorage.getItem('cannonPreferredTeam') : 'A';
    this.selectedRoomCode = '';
    this.availableRooms = [];
    this.onlineRoom = null;
    this.playerToken = localStorage.getItem('cannonPlayerToken') || '';
    this.localMatch = null;
    this.currentProfile = null;
    this.shotMode = 'normal';
    this.chargeStartedAt = null;
    this.chargePower = MIN_POWER;
    this.chargingSource = null;
    this.keys = new Set();
    this.lastMoveAt = 0;
    this.lastAimAt = 0;
    this.lastTurnToken = null;
    this.pointerGesture = null;
    this.pendingAimAngle = null;
    this.lastAimNetworkAt = 0;
    // Mỗi con trỏ bắt đầu trên nút chức năng được tách khỏi vùng vuốt bản đồ.
    // Điều này ngăn thao tác giữ Zoom/Bắn/Đạn dịch chuyển làm thay đổi góc nòng trên iOS.
    this.functionPointerIds = new Set();
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
    $('#refreshRoomsBtn').addEventListener('click', () => this.refreshRooms());
    $$('.back-menu').forEach((button) => button.addEventListener('click', () => this.showView('menuView')));
    $('#setupSubmitBtn').addEventListener('click', () => this.submitSetup());
    $('#joinCode').addEventListener('input', (event) => {
      event.target.value = event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
      if (event.target.value.length === 6) {
        this.selectedRoomCode = event.target.value;
        this.renderSelectedRoomSummary();
        this.syncTeamChoiceVisibility();
      }
    });
    $('#copyInviteBtn').addEventListener('click', () => this.copyInvite());
    $('#startRoomBtn').addEventListener('click', () => this.startOnlineRoom());
    $('#leaveLobbyBtn').addEventListener('click', () => this.leaveRoom());
    $('#exitGameBtn').addEventListener('click', () => this.exitGame());
    ['helpBtn', 'setupHelpBtn', 'menuHelpBtn'].forEach((id) => {
      $(`#${id}`)?.addEventListener('click', () => $('#helpDialog').showModal());
    });
    $('#closeHelpBtn').addEventListener('click', () => $('#helpDialog').close());
    $('#technicalSettingsBtn')?.addEventListener('click', () => $('#technicalDialog').showModal());
    $('#closeTechnicalBtn')?.addEventListener('click', () => $('#technicalDialog').close());
    $('#resultMenuBtn').addEventListener('click', () => {
      if (this.onlineRoom) this.socket.emit('leave-room');
      this.returnToMenu();
    });
    $('#playAgainBtn').addEventListener('click', () => this.playAgain());
    $('#skipTurnBtn').addEventListener('click', () => this.skipTurn());
    $('#teleportButton').addEventListener('click', () => this.toggleTeleportMode());
    $('#faceLeftButton').addEventListener('click', () => this.setFacing(-1));
    $('#faceRightButton').addEventListener('click', () => this.setFacing(1));
    $('#maxPlayers').addEventListener('change', () => {
      this.syncTeamModeAvailability();
      this.syncTeamChoiceVisibility();
    });
    $('#teamMode').addEventListener('change', () => this.syncTeamChoiceVisibility());
    $$('input[name="preferredTeam"]').forEach((input) => {
      input.addEventListener('change', () => {
        if (!input.checked) return;
        this.selectedTeam = input.value;
        localStorage.setItem('cannonPreferredTeam', this.selectedTeam);
        this.updateTeamChoiceCards();
      });
    });
    $('#criticalEnabled').addEventListener('change', () => this.syncCombatRuleControls());
    $('#arcDamageEnabled').addEventListener('change', () => this.syncCombatRuleControls());
    $('#resetCombatDefaults').addEventListener('click', () => this.resetCombatDefaults());
    ['criticalChance', 'criticalDamagePercent', 'maxArcDamagePercent', 'arcAngleToleranceDegrees'].forEach((id) => {
      $(`#${id}`)?.addEventListener('input', () => this.updateTechnicalSummary());
      $(`#${id}`)?.addEventListener('change', () => this.updateTechnicalSummary());
    });
    this.syncCombatRuleControls();

    // Chặn chọn văn bản, kéo nội dung, menu Copy/Dịch/Tra cứu và callout khi giữ nút chức năng.
    // Dùng capture để chặn trước khi Safari xử lý nhấn giữ; không áp dụng cho input/textarea/select.
    const protectedSelector = 'button, [role="button"], .function-control, #overviewButton, #fireButton';
    const findProtectedControl = (event) => event.target?.closest?.(protectedSelector);
    ['selectstart', 'dragstart', 'contextmenu'].forEach((type) => {
      document.addEventListener(type, (event) => {
        if (!findProtectedControl(event)) return;
        event.preventDefault();
        event.stopPropagation();
        window.getSelection?.()?.removeAllRanges?.();
      }, true);
    });
    // Hai nút giữ lâu dùng Pointer Events, vì vậy có thể hủy touchstart để Safari không mở callout.
    ['#overviewButton', '#fireButton'].forEach((selector) => {
      const control = $(selector);
      control?.addEventListener('touchstart', (event) => {
        event.preventDefault();
        event.stopPropagation();
        window.getSelection?.()?.removeAllRanges?.();
      }, { passive: false, capture: true });
      control?.addEventListener('touchmove', (event) => {
        event.preventDefault();
        event.stopPropagation();
      }, { passive: false, capture: true });
    });
    document.addEventListener('selectionchange', () => {
      if (!document.body.classList.contains('game-active')) return;
      const selection = window.getSelection?.();
      if (selection && !selection.isCollapsed) selection.removeAllRanges();
    });

    // Cô lập toàn bộ nút chức năng khỏi bộ nhận diện vuốt trên canvas.
    // Vẫn cho phép đa chạm: một ngón giữ TOÀN CẢNH/BẮN, ngón khác vuốt bản đồ.
    $$('#gameView button, #technicalDialog button, #helpDialog button').forEach((control) => {
      control.addEventListener('pointerdown', (event) => this.markFunctionPointer(event));
      control.addEventListener('pointermove', (event) => event.stopPropagation());
      ['pointerup', 'pointercancel', 'lostpointercapture'].forEach((type) => {
        control.addEventListener(type, (event) => this.releaseFunctionPointer(event));
      });
    });

    const overview = $('#overviewButton');
    const stopOverview = (event) => {
      event?.preventDefault?.();
      this.renderer.setOverviewHeld(false);
      overview?.classList.remove('active');
    };
    overview?.addEventListener('pointerdown', (event) => {
      event.preventDefault();
      overview.setPointerCapture?.(event.pointerId);
      this.renderer.setOverviewHeld(true);
      overview.classList.add('active');
    });
    ['pointerup', 'pointercancel', 'lostpointercapture'].forEach((type) => overview?.addEventListener(type, stopOverview));
    overview?.addEventListener('contextmenu', (event) => event.preventDefault());

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
    window.addEventListener('touchmove', (event) => {
      if (document.body.classList.contains('game-active')) event.preventDefault();
    }, { passive: false });
    window.addEventListener('blur', () => {
      this.keys.clear();
      this.pointerGesture = null;
      this.functionPointerIds.clear();
      this.renderer.setOverviewHeld(false);
      $('#overviewButton')?.classList.remove('active');
      if (this.chargingSource === 'keyboard') this.cancelCharge();
    });
    window.addEventListener('beforeunload', () => {
      if (this.onlineRoom) this.socket.emit('leave-room');
    });
  }

  bindSocket() {
    this.socket.on('connect', () => {
      this.refreshRooms();
      if (this.onlineRoom?.code && this.playerToken) {
        this.socket.emit('join-room', {
          code: this.onlineRoom.code,
          token: this.playerToken,
          name: this.currentProfile?.name,
          character: this.currentProfile?.character,
          team: this.onlineRoom?.players?.find((player) => player.token === this.playerToken)?.team || this.selectedTeam,
          password: sessionStorage.getItem('cannonRoomPassword') || ''
        }, (response) => {
          if (!response?.ok) this.toast('Mất kết nối phòng, vui lòng vào lại');
        });
      }
    });

    this.socket.on('room-list', (rooms) => {
      this.availableRooms = Array.isArray(rooms) ? rooms : [];
      this.renderRoomList();
      this.renderSelectedRoomSummary();
      this.syncTeamChoiceVisibility();
    });

    this.socket.on('room-state', (room) => {
      const previousStatus = this.onlineRoom?.status;
      const previousTurn = this.onlineRoom?.turnToken;
      this.onlineRoom = room;
      if (this.pendingAimAngle !== null && room.status === 'playing' && !room.shotInProgress && room.turnToken === this.playerToken) {
        const mine = room.players?.find((player) => player.token === this.playerToken);
        if (mine) mine.angle = this.pendingAimAngle;
      }
      if (room.turnToken !== previousTurn) {
        this.pendingAimAngle = null;
        this.setShotMode('normal');
        this.cancelCharge();
        if (this.renderer.projectile) this.renderer.cancelProjectile(false);
      }
      if (room.status === 'lobby') {
        this.renderLobby();
        if (this.currentViewId() !== 'lobbyView') this.showView('lobbyView');
      } else if (room.status === 'playing') {
        if (previousStatus !== 'playing' || this.currentViewId() !== 'gameView') this.enterGameView();
        this.refreshHud();
      } else if (room.status === 'ended') {
        this.refreshHud();
        if (!this.renderer.projectile) setTimeout(() => this.showResult(), 500);
      }
    });

    this.socket.on('shot-fired', (shot) => {
      if (shot.shooterToken === this.getMyToken()) this.setShotMode('normal');
      const applyImpact = () => {
        if (!this.onlineRoom) return;
        this.onlineRoom.terrain = shot.terrain;
        this.onlineRoom.players = shot.players;
        this.refreshHud();
      };
      this.handleShot(shot, () => {
        applyImpact();
      }, applyImpact);
    });

    this.socket.on('turn-skipped', (event) => {
      this.setShotMode('normal');
      if (event?.reason === 'timeout') this.toast('Người chơi hết thời gian và bị bỏ lượt');
    });

    this.socket.on('disconnect', () => {
      if (this.onlineRoom) this.toast('Đang kết nối lại máy chủ…');
    });
  }

  refreshRooms() {
    if (!this.socket.connected) return;
    this.socket.emit('list-rooms', {}, (response) => {
      if (response?.ok) {
        this.availableRooms = response.rooms || [];
        this.renderRoomList();
        this.renderSelectedRoomSummary();
        this.syncTeamChoiceVisibility();
      }
    });
  }

  renderRoomList() {
    const list = $('#publicRoomList');
    if (!list) return;
    if (!this.availableRooms.length) {
      list.innerHTML = '<div class="room-empty">Chưa có phòng trống. Bạn có thể tạo phòng mới.</div>';
      return;
    }
    list.innerHTML = this.availableRooms.map((room) => `
      <button class="public-room-card" type="button" data-room-code="${room.code}">
        <span>
          <strong>${escapeHtml(room.hostName)} • ${room.playerCount}/${room.maxPlayers} người ${room.hasPassword ? '🔒' : ''}</strong>
          <span>${escapeHtml(MAP_LABELS[room.mapStyle] || room.mapStyle)} • ${room.teamMode === 'teams' ? `Phe Xanh ${room.teamAPlayers || 0}/${room.teamCapacity || room.maxPlayers / 2} • Phe Đỏ ${room.teamBPlayers || 0}/${room.teamCapacity || room.maxPlayers / 2}` : 'tự do'} • ${room.startHealth} máu • trúng -${room.hitDamage} • Crit ${room.criticalEnabled === false ? 'tắt' : `${room.criticalChance}%`} • Phóng cao ${room.arcDamageEnabled === false ? 'tắt' : `±${room.arcAngleToleranceDegrees ?? DEFAULT_ARC_ANGLE_TOLERANCE_DEGREES}°/${room.maxArcDamagePercent}%`}</span>
          <small>Mã ${room.code} • ${room.turnSeconds}s/lượt</small>
        </span>
        <b>VÀO</b>
      </button>`).join('');
    list.querySelectorAll('[data-room-code]').forEach((button) => {
      button.addEventListener('click', () => this.selectPublicRoom(button.dataset.roomCode));
    });
  }

  selectPublicRoom(code) {
    this.selectedRoomCode = String(code || '').toUpperCase();
    $('#joinCode').value = this.selectedRoomCode;
    this.openSetup('join');
    this.syncTeamChoiceVisibility();
  }

  renderSelectedRoomSummary() {
    const target = $('#selectedRoomSummary');
    if (!target) return;
    const room = this.availableRooms.find((item) => item.code === this.selectedRoomCode);
    if (room) {
      const teamText = room.teamMode === 'teams'
        ? `Phe Xanh ${room.teamAPlayers || 0}/${room.teamCapacity || room.maxPlayers / 2} • Phe Đỏ ${room.teamBPlayers || 0}/${room.teamCapacity || room.maxPlayers / 2}`
        : 'Đấu tự do';
      target.textContent = `${room.hostName} • ${room.playerCount}/${room.maxPlayers} người • ${teamText} • ${MAP_LABELS[room.mapStyle] || room.mapStyle} • Crit ${room.criticalEnabled === false ? 'tắt' : `${room.criticalChance}%`} • Phóng cao ${room.arcDamageEnabled === false ? 'tắt' : `±${room.arcAngleToleranceDegrees ?? DEFAULT_ARC_ANGLE_TOLERANCE_DEGREES}°/${room.maxArcDamagePercent}%`}${room.hasPassword ? ' • Có mật khẩu' : ''}`;
    } else if (this.selectedRoomCode) {
      target.textContent = `Mã phòng ${this.selectedRoomCode}`;
    } else {
      target.textContent = 'Chưa chọn phòng. Quay lại menu để chọn phòng đang mở hoặc nhập mã bên dưới.';
    }
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
      this.selectedRoomCode = code.toUpperCase().slice(0, 6);
      $('#joinCode').value = this.selectedRoomCode;
      this.openSetup('join');
    }
  }

  showView(id) {
    this.views.forEach((view) => view.classList.toggle('active', view.id === id));
    document.body.classList.toggle('game-active', id === 'gameView');
    if (id === 'menuView') this.refreshRooms();
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
    this.syncTeamModeAvailability();
    if (mode === 'join' && !this.selectedRoomCode && this.availableRooms.length) {
      this.selectedRoomCode = this.availableRooms[0].code;
      $('#joinCode').value = this.selectedRoomCode;
    }
    const copy = {
      single: ['Đấu với máy', 'Chọn nhân vật, máu, bản đồ và độ khó', 'Bắt đầu đấu máy'],
      create: ['Tạo phòng online', 'Thiết lập luật chung cho 2–6 người', 'Tạo phòng'],
      join: ['Vào phòng online', 'Phòng đang mở đã được chọn sẵn; chỉ cần chọn nhân vật', 'Vào phòng']
    }[mode];
    $('#setupTitle').textContent = copy[0];
    $('#setupSubtitle').textContent = copy[1];
    $('#setupSubmitBtn').textContent = copy[2];
    this.renderSelectedRoomSummary();
    this.syncTeamChoiceVisibility();
    this.showView('setupView');
  }

  getProfile() {
    const name = ($('#playerName').value || 'Người chơi').trim().slice(0, 18);
    localStorage.setItem('cannonPlayerName', name);
    return { name, character: this.selectedCharacter };
  }

  syncTeamModeAvailability() {
    const maxPlayers = Number($('#maxPlayers').value);
    const select = $('#teamMode');
    const teamOption = select?.querySelector('option[value="teams"]');
    if (!select || !teamOption) return;
    const allowed = maxPlayers % 2 === 0;
    teamOption.disabled = !allowed;
    if (!allowed && select.value === 'teams') select.value = 'solo';
  }

  getSelectedRoomInfo() {
    return this.availableRooms.find((room) => room.code === this.selectedRoomCode) || null;
  }

  getPreferredTeam() {
    const checked = $('input[name="preferredTeam"]:checked');
    return checked && ['A', 'B'].includes(checked.value) ? checked.value : this.selectedTeam;
  }

  updateTeamChoiceCards() {
    $$('.team-choice-card').forEach((card) => {
      const input = card.querySelector('input[name="preferredTeam"]');
      card.classList.toggle('selected', Boolean(input?.checked));
      card.classList.toggle('full', Boolean(input?.disabled));
    });
  }

  syncTeamChoiceVisibility() {
    const group = $('#teamChoiceGroup');
    if (!group) return;
    let enabled = false;
    let capacity = 0;
    let countA = 0;
    let countB = 0;
    let note = 'Mỗi phe có số chỗ bằng nhau. Phe đã đủ người sẽ tự khóa.';

    if (this.setupMode === 'create') {
      enabled = $('#teamMode')?.value === 'teams';
      capacity = Math.floor(Number($('#maxPlayers')?.value || 2) / 2);
      note = `Chủ phòng cũng phải chọn phe. Mỗi phe tối đa ${capacity} người.`;
    } else if (this.setupMode === 'join') {
      const room = this.getSelectedRoomInfo();
      if (room) {
        enabled = room.teamMode === 'teams';
        capacity = Number(room.teamCapacity || Math.floor(room.maxPlayers / 2));
        countA = Number(room.teamAPlayers || 0);
        countB = Number(room.teamBPlayers || 0);
        note = enabled
          ? 'Chọn phe trước khi vào phòng. Phe đủ người sẽ không thể chọn.'
          : 'Phòng này sử dụng chế độ đấu tự do.';
      } else if (this.selectedRoomCode || $('#joinCode')?.value) {
        enabled = true;
        capacity = 3;
        note = 'Mã phòng nhập thủ công chưa có dữ liệu. Lựa chọn phe chỉ được áp dụng nếu phòng sử dụng chế độ hai phe.';
      }
    }

    group.classList.toggle('hidden', !enabled);
    const inputA = $('input[name="preferredTeam"][value="A"]');
    const inputB = $('input[name="preferredTeam"][value="B"]');
    if (!enabled) {
      if (inputA) inputA.disabled = false;
      if (inputB) inputB.disabled = false;
      return;
    }

    const fullA = capacity > 0 && countA >= capacity;
    const fullB = capacity > 0 && countB >= capacity;
    if (inputA) inputA.disabled = fullA;
    if (inputB) inputB.disabled = fullB;
    $('#teamACount').textContent = capacity ? `${countA}/${capacity} người${fullA ? ' • Đã đủ' : ''}` : 'Còn chỗ';
    $('#teamBCount').textContent = capacity ? `${countB}/${capacity} người${fullB ? ' • Đã đủ' : ''}` : 'Còn chỗ';
    $('#teamChoiceNote').textContent = note;

    let preferred = ['A', 'B'].includes(this.selectedTeam) ? this.selectedTeam : 'A';
    if ((preferred === 'A' && fullA) || (preferred === 'B' && fullB)) preferred = fullA && !fullB ? 'B' : 'A';
    const selectedInput = $(`input[name="preferredTeam"][value="${preferred}"]`);
    if (selectedInput && !selectedInput.disabled) selectedInput.checked = true;
    this.selectedTeam = preferred;
    localStorage.setItem('cannonPreferredTeam', preferred);
    this.updateTeamChoiceCards();
  }

  syncCombatRuleControls() {
    const criticalOn = $('#criticalEnabled')?.checked !== false;
    const arcOn = $('#arcDamageEnabled')?.checked !== false;
    $('#criticalRuleRow')?.classList.toggle('disabled', !criticalOn);
    $('#arcRuleRow')?.classList.toggle('disabled', !arcOn);
    ['criticalChance', 'criticalDamagePercent'].forEach((id) => { if ($(`#${id}`)) $(`#${id}`).disabled = !criticalOn; });
    ['maxArcDamagePercent', 'arcAngleToleranceDegrees'].forEach((id) => { if ($(`#${id}`)) $(`#${id}`).disabled = !arcOn; });
    this.updateTechnicalSummary();
  }

  updateTechnicalSummary() {
    const target = $('#technicalSummary');
    if (!target) return;
    const crit = $('#criticalEnabled')?.checked
      ? `Critical ${clamp(Number($('#criticalChance')?.value) || 0, 0, 100)}% × ${clamp(Number($('#criticalDamagePercent')?.value) || DEFAULT_CRITICAL_DAMAGE_PERCENT, 100, 250)}%`
      : 'Critical tắt';
    const arc = $('#arcDamageEnabled')?.checked
      ? `Góc phóng 90° ±${clamp(Number($('#arcAngleToleranceDegrees')?.value) || DEFAULT_ARC_ANGLE_TOLERANCE_DEGREES, 1, 45)}° × ${clamp(Number($('#maxArcDamagePercent')?.value) || DEFAULT_MAX_ARC_DAMAGE_PERCENT, 100, 250)}%`
      : 'Góc siêu cao tắt';
    target.textContent = `${crit} • ${arc}`;
  }

  resetCombatDefaults() {
    $('#criticalEnabled').checked = DEFAULT_CRITICAL_ENABLED;
    $('#criticalChance').value = DEFAULT_CRITICAL_CHANCE_PERCENT;
    $('#criticalDamagePercent').value = DEFAULT_CRITICAL_DAMAGE_PERCENT;
    $('#arcDamageEnabled').checked = DEFAULT_ARC_DAMAGE_ENABLED;
    $('#maxArcDamagePercent').value = DEFAULT_MAX_ARC_DAMAGE_PERCENT;
    $('#arcAngleToleranceDegrees').value = DEFAULT_ARC_ANGLE_TOLERANCE_DEGREES;
    this.syncCombatRuleControls();
    this.toast('Đã khôi phục thông số kỹ thuật mặc định');
  }

  getConfig() {
    return {
      maxPlayers: Number($('#maxPlayers').value),
      startHealth: Number($('#startHealth').value),
      hitDamage: Number($('#hitDamage').value),
      turnSeconds: this.setupMode === 'single' ? 60 : Number($('#turnSeconds').value),
      mapStyle: $('#mapStyle').value,
      teamMode: this.setupMode === 'single' ? 'solo' : $('#teamMode').value,
      criticalEnabled: $('#criticalEnabled').checked,
      criticalChance: clamp(Number($('#criticalChance').value) || 0, 0, 100),
      criticalDamagePercent: clamp(Number($('#criticalDamagePercent').value) || DEFAULT_CRITICAL_DAMAGE_PERCENT, 100, 250),
      arcDamageEnabled: $('#arcDamageEnabled').checked,
      maxArcDamagePercent: clamp(Number($('#maxArcDamagePercent').value) || DEFAULT_MAX_ARC_DAMAGE_PERCENT, 100, 250),
      arcAngleToleranceDegrees: clamp(Number($('#arcAngleToleranceDegrees').value) || DEFAULT_ARC_ANGLE_TOLERANCE_DEGREES, 1, 45),
      password: $('#roomPassword').value
    };
  }

  submitSetup() {
    $('#setupError').textContent = '';
    const profile = this.getProfile();
    this.currentProfile = profile;
    if (!profile.name) return this.setSetupError('Vui lòng nhập tên người chơi');
    if (this.setupMode === 'single') return this.startSingle(profile);
    if (!this.socket.connected) return this.setSetupError('Chưa kết nối được máy chủ, vui lòng thử lại');

    $('#setupSubmitBtn').disabled = true;
    const password = $('#roomPassword').value;
    sessionStorage.setItem('cannonRoomPassword', password);
    if (this.setupMode === 'create') {
      const config = this.getConfig();
      const team = config.teamMode === 'teams' ? this.getPreferredTeam() : null;
      if (config.teamMode === 'teams' && !team) {
        $('#setupSubmitBtn').disabled = false;
        return this.setSetupError('Vui lòng chọn Phe Xanh hoặc Phe Đỏ');
      }
      this.socket.emit('create-room', {
        name: profile.name,
        character: profile.character,
        team,
        token: this.playerToken || undefined,
        config
      }, (response) => this.handleRoomAck(response));
    } else {
      const code = (this.selectedRoomCode || $('#joinCode').value).trim().toUpperCase();
      if (code.length !== 6) {
        $('#setupSubmitBtn').disabled = false;
        return this.setSetupError('Hãy chọn một phòng đang mở hoặc nhập mã phòng 6 ký tự');
      }
      const selectedRoom = this.getSelectedRoomInfo();
      const team = selectedRoom?.teamMode === 'solo' ? null : this.getPreferredTeam();
      if (selectedRoom?.teamMode === 'teams' && !team) {
        $('#setupSubmitBtn').disabled = false;
        return this.setSetupError('Vui lòng chọn phe trước khi vào phòng');
      }
      this.socket.emit('join-room', {
        code, password, name: profile.name, character: profile.character,
        team, token: this.playerToken || undefined
      }, (response) => this.handleRoomAck(response));
    }
  }

  handleRoomAck(response) {
    $('#setupSubmitBtn').disabled = false;
    if (!response?.ok) return this.setSetupError(response?.error || 'Không thể vào phòng');
    this.playerToken = response.token;
    localStorage.setItem('cannonPlayerToken', response.token);
    this.onlineRoom = response.room;
    this.selectedRoomCode = response.room.code;
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
    this.setShotMode('normal');
    this.localMatch = new LocalMatch(this, config, profile, difficulty);
    this.enterGameView();
  }

  renderLobby() {
    const room = this.onlineRoom;
    if (!room) return;
    $('#lobbyRoomCode').textContent = room.code;
    $('#lobbyRules').innerHTML = [
      `${room.players.length}/${room.config.maxPlayers} người`, `${room.config.startHealth} máu`,
      `Trúng mất ${room.config.hitDamage}`, `${room.config.turnSeconds} giây/lượt`,
      MAP_LABELS[room.config.mapStyle],
      room.config.teamMode === 'teams' ? 'Hai phe • không sát thương đồng đội' : 'Đấu tự do',
      room.config.criticalEnabled === false ? 'Critical: Tắt' : `Critical ${room.config.criticalChance}% • ${room.config.criticalDamagePercent}% damage`,
      room.config.arcDamageEnabled === false ? 'Góc siêu cao: Tắt' : `Góc phóng siêu cao 90° ±${room.config.arcAngleToleranceDegrees ?? DEFAULT_ARC_ANGLE_TOLERANCE_DEGREES}° • ${room.config.maxArcDamagePercent}% damage`,
      'Critical × góc siêu cao được cộng dồn theo phép nhân',
      room.config.hasPassword ? 'Có mật khẩu' : 'Không mật khẩu',
      'Mỗi người 3 đạn dịch chuyển'
    ].map((text) => `<span class="rule-chip">${escapeHtml(text)}</span>`).join('');
    const renderLobbyPlayer = (player) => `
      <div class="lobby-player ${player.team ? `team-${player.team.toLowerCase()}` : ''}" style="--team-color:${player.team ? TEAM_COLORS[player.team] : player.color}">
        <img src="/assets/animals/${player.character}/thumb.png" alt="">
        <div><strong>${escapeHtml(player.name)}${player.token === this.playerToken ? ' (Bạn)' : ''}</strong>
        <span>${player.isHost ? 'Chủ phòng' : 'Người chơi'}${player.team ? ` • ${TEAM_LABELS[player.team]}` : ''}${player.connected ? '' : ' • Mất kết nối'}</span></div>
      </div>`;
    const teamAPlayers = room.players.filter((player) => player.team === 'A');
    const teamBPlayers = room.players.filter((player) => player.team === 'B');
    if (room.config.teamMode === 'teams') {
      const capacity = Math.floor(room.config.maxPlayers / 2);
      $('#lobbyPlayers').innerHTML = `
        <div class="team-lobby-column team-a">
          <div class="team-lobby-title"><span></span><strong>Phe Xanh</strong><b>${teamAPlayers.length}/${capacity}</b></div>
          <div class="team-lobby-list">${teamAPlayers.map(renderLobbyPlayer).join('') || '<div class="team-empty">Chưa có người chơi</div>'}</div>
        </div>
        <div class="team-lobby-column team-b">
          <div class="team-lobby-title"><span></span><strong>Phe Đỏ</strong><b>${teamBPlayers.length}/${capacity}</b></div>
          <div class="team-lobby-list">${teamBPlayers.map(renderLobbyPlayer).join('') || '<div class="team-empty">Chưa có người chơi</div>'}</div>
        </div>`;
    } else {
      $('#lobbyPlayers').innerHTML = room.players.map(renderLobbyPlayer).join('');
    }
    const isHost = room.hostToken === this.playerToken;
    $('#startRoomBtn').classList.toggle('hidden', !isHost);
    const invalidTeamBalance = room.config.teamMode === 'teams'
      && (teamAPlayers.length === 0 || teamAPlayers.length !== teamBPlayers.length);
    $('#startRoomBtn').disabled = room.players.length < 2 || invalidTeamBalance;
    $('#lobbyMessage').textContent = isHost
      ? room.players.length < 2
        ? 'Cần thêm ít nhất 1 người để bắt đầu.'
        : invalidTeamBalance
          ? `Hai phe phải có số người bằng nhau. Hiện tại: Xanh ${teamAPlayers.length} • Đỏ ${teamBPlayers.length}.`
          : 'Hai phe đã cân bằng. Có thể bắt đầu trận đấu.'
      : room.config.teamMode === 'teams'
        ? `Đang chờ chủ phòng bắt đầu • Xanh ${teamAPlayers.length} • Đỏ ${teamBPlayers.length}`
        : 'Đang chờ chủ phòng bắt đầu…';
  }

  copyInvite() {
    if (!this.onlineRoom) return;
    const link = `${location.origin}${location.pathname}?room=${this.onlineRoom.code}`;
    navigator.clipboard?.writeText(link).then(() => this.toast('Đã sao chép link mời')).catch(() => prompt('Sao chép đường dẫn này:', link));
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
    this.setShotMode('normal');
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
    return Boolean(state && state.status === 'playing' && !state.shotInProgress && !this.renderer.projectile && state.turnToken === this.getMyToken() && this.getMyPlayer()?.health > 0);
  }

  movePlayer(delta) {
    if (!this.canControl()) return false;
    if (delta) this.setFacing(delta < 0 ? -1 : 1, false);
    if (this.localMatch) {
      const moved = this.localMatch.move(delta, 'local-human');
      if (moved) this.sound.move();
      return moved;
    }
    this.socket.emit('move-player', { delta });
    this.renderer.markMoving(this.playerToken);
    return true;
  }

  setAngleAbsolute(value, sendNetwork = true) {
    if (!this.canControl()) return false;
    const player = this.getMyPlayer();
    if (!player) return false;
    const angle = Math.round(clamp(Number(value), MIN_ANGLE, MAX_ANGLE) * 2) / 2;
    if (Math.abs(Number(player.angle) - angle) < 0.24) return false;
    if (this.localMatch) {
      this.localMatch.setAngle(angle, 'local-human');
    } else {
      player.angle = angle;
      this.pendingAimAngle = angle;
      if (sendNetwork) this.socket.emit('set-angle', { angle });
    }
    this.refreshHud();
    return true;
  }

  adjustAngle(delta) {
    const player = this.getMyPlayer();
    if (!player) return;
    this.setAngleAbsolute(Number(player.angle) + Number(delta || 0));
  }

  setFacing(facing, notifyServer = true) {
    if (!this.canControl()) return false;
    const direction = facing < 0 ? -1 : 1;
    const player = this.getMyPlayer();
    if (!player) return false;
    player.facing = direction;
    if (this.localMatch) {
      this.localMatch.setFacing(direction, 'local-human');
    } else if (notifyServer) {
      this.socket.emit('set-facing', { facing: direction });
    } else {
      this.socket.emit('set-facing', { facing: direction });
    }
    this.refreshHud();
    return true;
  }

  setShotMode(mode) {
    const mine = this.getMyPlayer();
    const resolved = mode === 'teleport' && (mine?.teleportAmmo || 0) > 0 ? 'teleport' : 'normal';
    this.shotMode = resolved;
    const button = $('#teleportButton');
    button?.classList.toggle('active', resolved === 'teleport');
    this.refreshTeleportButton();
  }

  toggleTeleportMode() {
    if (!this.canControl()) return;
    const mine = this.getMyPlayer();
    if (!mine?.teleportAmmo) return this.toast('Bạn đã hết đạn dịch chuyển');
    this.setShotMode(this.shotMode === 'teleport' ? 'normal' : 'teleport');
    this.toast(this.shotMode === 'teleport' ? 'Cú bắn kế tiếp sẽ dịch chuyển, không gây sát thương' : 'Đã trở lại đạn thường');
  }

  refreshTeleportButton() {
    const mine = this.getMyPlayer();
    const ammo = mine?.teleportAmmo ?? TELEPORT_AMMO;
    $('#teleportAmmoText').textContent = `Còn ${ammo} viên • ${this.shotMode === 'teleport' ? 'ĐANG BẬT' : 'bắn kế tiếp'}`;
    $('#teleportButton').disabled = !this.canControl() || ammo <= 0;
  }

  skipTurn() {
    if (!this.canControl()) return;
    this.setShotMode('normal');
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
    const shotType = this.shotMode;
    this.cancelCharge();
    if (!this.canControl()) return;
    if (this.localMatch) {
      this.localMatch.fire(power, 'local-human', shotType);
      this.setShotMode('normal');
    } else {
      this.socket.emit('fire', { power, shotType }, (response) => {
        if (!response?.ok) this.toast(response?.error || 'Chưa thể bắn');
        else this.setShotMode('normal');
      });
    }
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
    const progress = clamp((now - this.chargeStartedAt) / 2600, 0, 1);
    this.chargePower = Math.round(MIN_POWER + (MAX_POWER - MIN_POWER) * progress);
    const percent = `${Math.round(progress * 100)}%`;
    $('#fireButton').style.setProperty('--charge', percent);
    $('#chargeFill').style.width = percent;
    $('#chargeValue').textContent = this.chargePower;
  }

  handleShot(shot, done, onImpact) {
    this.cancelCharge();
    this.renderer.animateShot(shot, () => {
      done?.();
      if (shot.shotType === 'teleport') {
        this.toast(shot.teleportTo ? 'Đã dịch chuyển đúng tới điểm đạn rơi' : 'Đạn bay ra ngoài nên không thể dịch chuyển');
      } else if (shot.damagedTokens?.length) {
        const state = this.getGameState();
        const names = shot.damagedTokens.map((token) => state?.players?.find((player) => player.token === token)?.name).filter(Boolean);
        const bonuses = [];
        if (shot.critical) bonuses.push(`CRITICAL ${Math.round(Number(shot.criticalDamagePercent || shot.criticalMultiplier * 100 || 150))}%`);
        if (shot.superHighAngle || (shot.arcMultiplier || 1) > 1.01) bonuses.push(`góc siêu cao ${Math.round(Number(shot.maxArcDamagePercent || shot.arcMultiplier * 100 || 200))}%`);
        if (names.length) this.toast(`${names.join(', ')} mất ${shot.damage} máu${bonuses.length ? ` • ${bonuses.join(' • ')}` : ''}`);
      }
    }, onImpact);
  }

  recoverShotAfterRenderError() {
    if (this.renderer.projectile) this.renderer.cancelProjectile(false);
    if (this.localMatch?.shotInProgress && this.localMatch.activeShotRecovery) {
      this.localMatch.activeShotRecovery.finish();
    }
  }

  getPreviewPath() {
    if (!this.localMatch) return [];
    const power = this.chargeStartedAt ? this.chargePower : 520;
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
    if (now - this.lastMoveAt >= 60) {
      if (this.keys.has('ArrowLeft')) this.movePlayer(-8);
      if (this.keys.has('ArrowRight')) this.movePlayer(8);
      this.lastMoveAt = now;
    }
    if (now - this.lastAimAt >= 36) {
      if (this.keys.has('ArrowUp')) this.adjustAngle(2.6);
      if (this.keys.has('ArrowDown')) this.adjustAngle(-2.6);
      this.lastAimAt = now;
    }
  }

  onKeyDown(event) {
    if (this.currentViewId() !== 'gameView') return;
    if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Space', 'KeyQ', 'KeyE', 'KeyV'].includes(event.code)) event.preventDefault();
    if (event.code === 'KeyT' && !event.repeat) return this.toggleTeleportMode();
    if (event.code === 'KeyV') { this.renderer.setOverviewHeld(true); $('#overviewButton')?.classList.add('active'); return; }
    if (event.code === 'KeyQ' && !event.repeat) return this.setFacing(-1);
    if (event.code === 'KeyE' && !event.repeat) return this.setFacing(1);
    if (event.code === 'Space') {
      if (!event.repeat) this.startCharge('keyboard');
      return;
    }
    if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.code)) this.keys.add(event.code);
  }

  onKeyUp(event) {
    if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Space', 'KeyV'].includes(event.code)) event.preventDefault();
    this.keys.delete(event.code);
    if (event.code === 'KeyV') { this.renderer.setOverviewHeld(false); $('#overviewButton')?.classList.remove('active'); }
    if (event.code === 'Space' && this.chargingSource === 'keyboard') this.releaseCharge();
  }

  markFunctionPointer(event) {
    event.stopPropagation();
    this.functionPointerIds.add(event.pointerId);
    // Safari đôi khi tái sử dụng pointerId sau một thao tác bị hủy.
    // Xóa gesture cũ cùng pointerId để nút chức năng không tiếp tục điều hướng nòng.
    if (this.pointerGesture?.pointerId === event.pointerId) this.pointerGesture = null;
  }

  releaseFunctionPointer(event) {
    event.stopPropagation();
    this.functionPointerIds.delete(event.pointerId);
    if (this.pointerGesture?.pointerId === event.pointerId) this.pointerGesture = null;
  }

  isFunctionControlEvent(event) {
    if (this.functionPointerIds.has(event.pointerId)) return true;
    return Boolean(event.target?.closest?.('button, input, select, label, dialog, .hud-panel, .game-header, .charge-meter'));
  }

  onCanvasPointerDown(event) {
    if (this.isFunctionControlEvent(event) || !this.canControl()) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture?.(event.pointerId);
    this.pointerGesture = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      lastX: event.clientX,
      lastY: event.clientY,
      startAngle: Number(this.getMyPlayer()?.angle || 45),
      axis: null,
      moveRemainder: 0,
      filteredY: event.clientY,
      stableY: event.clientY,
      verticalDirection: 0,
      reversalAnchorY: null,
      lastAppliedAngle: Number(this.getMyPlayer()?.angle || 45)
    };
  }

  onCanvasPointerMove(event) {
    const gesture = this.pointerGesture;
    if (this.isFunctionControlEvent(event) || !gesture || gesture.pointerId !== event.pointerId || !this.canControl()) return;
    event.preventDefault();
    const totalX = event.clientX - gesture.startX;
    const totalY = event.clientY - gesture.startY;
    const dx = event.clientX - gesture.lastX;
    gesture.lastX = event.clientX;
    gesture.lastY = event.clientY;

    // Chỉ khóa hướng sau khi ngón tay đi đủ xa. Trục đã khóa không đổi giữa chừng.
    if (!gesture.axis && Math.hypot(totalX, totalY) >= 14) {
      gesture.axis = Math.abs(totalX) > Math.abs(totalY) * 1.25 ? 'horizontal' : 'vertical';
      if (gesture.axis === 'vertical') {
        gesture.filteredY = event.clientY;
        gesture.stableY = event.clientY;
      }
    }
    if (gesture.axis === 'horizontal') {
      gesture.moveRemainder += dx * 0.95;
      while (Math.abs(gesture.moveRemainder) >= 5) {
        const step = Math.sign(gesture.moveRemainder) * Math.min(10, Math.abs(gesture.moveRemainder));
        this.movePlayer(step);
        gesture.moveRemainder -= step;
      }
      return;
    }
    if (gesture.axis === 'vertical') {
      // Làm mượt vị trí ngón tay rồi đổi góc theo từng nấc 1°. Các rung nhỏ dưới 3 px bị bỏ qua.
      // Khi đổi chiều vuốt, cần vượt vùng trễ 8 px nên nòng không giật lên/xuống do nhiễu cảm ứng.
      gesture.filteredY += (event.clientY - gesture.filteredY) * 0.34;
      const deltaY = gesture.filteredY - gesture.stableY;
      if (Math.abs(deltaY) < 3) return;
      const direction = Math.sign(deltaY);
      if (gesture.verticalDirection && direction !== gesture.verticalDirection) {
        if (gesture.reversalAnchorY === null) gesture.reversalAnchorY = gesture.filteredY;
        if (Math.abs(gesture.filteredY - gesture.reversalAnchorY) < 8) return;
        gesture.verticalDirection = direction;
        gesture.stableY = gesture.filteredY;
        gesture.reversalAnchorY = null;
        return;
      }
      gesture.verticalDirection = direction;
      gesture.reversalAnchorY = null;

      const sensitivity = 0.18;
      const angleSteps = Math.trunc((-deltaY * sensitivity) / 1);
      if (!angleSteps) return;
      const targetAngle = Math.round(clamp(gesture.lastAppliedAngle + angleSteps, MIN_ANGLE, MAX_ANGLE));
      if (targetAngle === gesture.lastAppliedAngle) {
        gesture.stableY = gesture.filteredY;
        return;
      }
      const appliedSteps = targetAngle - gesture.lastAppliedAngle;
      gesture.lastAppliedAngle = targetAngle;
      gesture.stableY += -appliedSteps / sensitivity;
      const now = performance.now();
      const sendNetwork = this.localMatch || now - this.lastAimNetworkAt >= 80;
      if (this.setAngleAbsolute(targetAngle, sendNetwork) && !this.localMatch && sendNetwork) this.lastAimNetworkAt = now;
    }
  }

  onCanvasPointerUp(event) {
    if (this.functionPointerIds.has(event.pointerId)) return;
    const gesture = this.pointerGesture;
    if (!gesture || gesture.pointerId !== event.pointerId) return;
    if (gesture.axis === 'vertical' && !this.localMatch && this.pendingAimAngle !== null) {
      const finalAngle = this.pendingAimAngle;
      this.socket.emit('set-angle', { angle: finalAngle }, (response) => {
        if (response?.ok && Math.abs(Number(response.angle) - finalAngle) < 0.25) this.pendingAimAngle = null;
      });
    }
    this.pointerGesture = null;
  }

  refreshHudThrottled(now) {
    if (!this.lastHudAt || now - this.lastHudAt > 140) {
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
    const activeTeamColor = active?.team ? TEAM_COLORS[active.team] : null;
    $('#turnBanner').style.background = activeTeamColor || (myTurn ? '#99f6e4' : '#fde68a');
    $('#turnBanner').style.color = activeTeamColor ? '#ffffff' : '#052f2c';
    $('#fireButton').disabled = !this.canControl();
    $('#skipTurnBtn').disabled = !this.canControl();
    $('#faceLeftButton').disabled = !this.canControl();
    $('#faceRightButton').disabled = !this.canControl();
    this.refreshTeleportButton();

    $('#playerHudList').innerHTML = state.players.map((player) => {
      const ratio = clamp(player.health / state.config.startHealth * 100, 0, 100);
      return `
        <div class="player-hud ${player.team ? `team-${player.team.toLowerCase()}` : ''} ${state.turnToken === player.token ? 'active-turn' : ''} ${player.health <= 0 ? 'dead' : ''}" style="--team-color:${player.team ? TEAM_COLORS[player.team] : player.color}">
          <img src="/assets/animals/${player.character}/thumb.png" alt="">
          <div class="player-hud-name">
            <strong>${escapeHtml(player.name)}${player.token === this.getMyToken() ? ' • Bạn' : ''}${player.team ? ` • ${TEAM_LABELS[player.team]}` : ''} • 🌀${player.teleportAmmo ?? 0}</strong>
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
    $('#resultText').textContent = state.config.teamMode === 'teams' && state.winnerTeam
      ? `${TEAM_LABELS[state.winnerTeam]} chiến thắng.`
      : winners.length
        ? `${winners.map((player) => player.name).join(', ')} là người sống sót cuối cùng.`
        : 'Không còn người chơi sống sót.';
    const button = $('#playAgainBtn');
    const wait = $('#resultWaitText');
    if (this.localMatch) {
      button.classList.remove('hidden');
      button.textContent = 'Đấu lại với máy';
      wait.classList.add('hidden');
    } else {
      const isHost = state.hostToken === this.playerToken;
      button.classList.toggle('hidden', !isHost);
      button.textContent = 'Chơi ván mới cùng phòng';
      wait.classList.toggle('hidden', isHost);
    }
    this.showView('resultView');
  }

  playAgain() {
    if (this.localMatch && this.currentProfile) return this.startSingle(this.currentProfile);
    if (!this.onlineRoom || this.onlineRoom.hostToken !== this.playerToken) return;
    $('#playAgainBtn').disabled = true;
    this.socket.emit('restart-room', {}, (response) => {
      $('#playAgainBtn').disabled = false;
      if (!response?.ok) this.toast(response?.error || 'Không thể mở ván mới');
    });
  }

  exitGame() {
    if (!confirm('Thoát trận đấu hiện tại?')) return;
    if (this.onlineRoom) this.socket.emit('leave-room');
    this.returnToMenu();
  }

  returnToMenu() {
    this.cancelCharge();
    this.setShotMode('normal');
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
    this.toastTimer = setTimeout(() => toast.classList.add('hidden'), 2600);
  }
}

window.addEventListener('DOMContentLoaded', () => {
  window.cannonBattleApp = new CannonApp();
});
