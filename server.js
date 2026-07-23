'use strict';

const path = require('path');
const http = require('http');
const express = require('express');
const { Server } = require('socket.io');

const PORT = Number(process.env.PORT || 10000);
const APP_VERSION = '1.5.1';
const GAME_WIDTH = 1920;
const GAME_HEIGHT = 540;
const TERRAIN_FLOOR = 490;
const GRAVITY = 350;
const MAX_ROOMS = 500;
const ROOM_TTL_MS = 3 * 60 * 60 * 1000;
const PLAYER_RECONNECT_MS = 45 * 1000;
const LOBBY_RECONNECT_MS = 20 * 1000;
const SHOT_STEP = 1 / 60;
const SHOT_MAX_SECONDS = 16;
const NORMAL_BLAST_RADIUS = 60;
const TELEPORT_AMMO = 3;
const DEFAULT_CRITICAL_CHANCE_PERCENT = 15;
const DEFAULT_CRITICAL_DAMAGE_PERCENT = 150;
const DEFAULT_MAX_ARC_DAMAGE_PERCENT = 200;
const DEFAULT_ARC_ANGLE_TOLERANCE_DEGREES = 15;
const MAX_POWER = 1050;
const MAP_STYLES = ['grass', 'desert', 'snow', 'volcano', 'jungle', 'canyon', 'moon', 'crystal', 'storm', 'badlands', 'random'];
const RANDOM_THEMES = ['grass', 'desert', 'snow', 'volcano', 'jungle', 'canyon', 'moon', 'crystal', 'storm', 'badlands'];

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  serveClient: false,
  cors: { origin: true, credentials: false },
  transports: ['websocket', 'polling']
});

app.disable('x-powered-by');
app.use((req, res, next) => {
  res.setHeader('X-Cannon-Battle-Version', APP_VERSION);
  next();
});
app.use(express.static(path.join(__dirname, 'public'), {
  maxAge: '7d',
  etag: false,
  setHeaders(res, filePath) {
    if (/\.(?:html|js|css)$/i.test(filePath)) {
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
      res.removeHeader('ETag');
    }
  }
}));
app.get('/health', (_req, res) => res.status(200).json({ ok: true, rooms: rooms.size, version: APP_VERSION }));
app.get('/version', (_req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  res.status(200).json({ app: 'Cannon Battle VN', version: APP_VERSION });
});
app.use((_req, res) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const rooms = new Map();
const COLORS = ['#22c55e', '#38bdf8', '#f97316', '#a855f7', '#ef4444', '#eab308'];
const TEAM_COLORS = { A: '#2563eb', B: '#ef4444' };

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function sanitizeName(value) {
  const text = String(value || '').replace(/[<>\u0000-\u001F]/g, '').trim();
  return (text || 'Người chơi').slice(0, 18);
}

function sanitizeCharacter(value) {
  const match = /^nv(0[1-9]|1\d|2[0-2])$/.exec(String(value || ''));
  return match ? match[0] : 'nv01';
}

function sanitizeTeam(value) {
  const team = String(value || '').trim().toUpperCase();
  return team === 'A' || team === 'B' ? team : null;
}

function normalizeConfig(raw = {}) {
  return {
    maxPlayers: clamp(Math.round(Number(raw.maxPlayers) || 2), 2, 6),
    startHealth: clamp(Math.round(Number(raw.startHealth) || 100), 50, 500),
    hitDamage: clamp(Math.round(Number(raw.hitDamage) || 25), 5, 200),
    turnSeconds: clamp(Math.round(Number(raw.turnSeconds) || 30), 15, 90),
    mapStyle: MAP_STYLES.includes(raw.mapStyle) ? raw.mapStyle : 'grass',
    teamMode: raw.teamMode === 'teams' && clamp(Math.round(Number(raw.maxPlayers) || 2), 2, 6) % 2 === 0 ? 'teams' : 'solo',
    criticalEnabled: raw.criticalEnabled !== false,
    criticalChance: clamp(Math.round(Number(raw.criticalChance ?? DEFAULT_CRITICAL_CHANCE_PERCENT)), 0, 100),
    criticalDamagePercent: clamp(Math.round(Number(raw.criticalDamagePercent ?? DEFAULT_CRITICAL_DAMAGE_PERCENT)), 100, 250),
    arcDamageEnabled: raw.arcDamageEnabled !== false,
    maxArcDamagePercent: clamp(Math.round(Number(raw.maxArcDamagePercent ?? DEFAULT_MAX_ARC_DAMAGE_PERCENT)), 100, 250),
    arcAngleToleranceDegrees: clamp(Math.round(Number(raw.arcAngleToleranceDegrees ?? DEFAULT_ARC_ANGLE_TOLERANCE_DEGREES)), 1, 45),
    password: String(raw.password || '').slice(0, 20)
  };
}

function makeCode() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  for (let attempt = 0; attempt < 50; attempt += 1) {
    let code = '';
    for (let index = 0; index < 6; index += 1) code += alphabet[Math.floor(Math.random() * alphabet.length)];
    if (!rooms.has(code)) return code;
  }
  throw new Error('Không thể tạo mã phòng mới');
}

function makeToken() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
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
  const ix = clamp(Math.round(x), 0, terrain.length - 1);
  return terrain[ix] ?? TERRAIN_FLOOR;
}


function playerGroundY(room, player) {
  return terrainY(room.terrain, player.x);
}

function getSpawnPositions(count) {
  if (count === 2) return [180, GAME_WIDTH - 180];
  const margin = 70;
  const step = (GAME_WIDTH - margin * 2) / (count - 1);
  return Array.from({ length: count }, (_, index) => Math.round(margin + index * step));
}

function nearestAliveOpponent(player, players) {
  let nearest = null;
  let best = Infinity;
  for (const candidate of players) {
    if (candidate.token === player.token || candidate.health <= 0) continue;
    if (player.team && candidate.team === player.team) continue;
    const distance = Math.abs(candidate.x - player.x);
    if (distance < best) {
      best = distance;
      nearest = candidate;
    }
  }
  return nearest;
}

function facingFor(player, players) {
  if (player.facing === -1 || player.facing === 1) return player.facing;
  const target = nearestAliveOpponent(player, players);
  if (!target) return player.x < GAME_WIDTH / 2 ? 1 : -1;
  return target.x >= player.x ? 1 : -1;
}

function publicPlayer(player) {
  return {
    token: player.token,
    name: player.name,
    character: player.character,
    color: player.color,
    x: player.x,
    angle: player.angle,
    facing: player.facing === -1 ? -1 : 1,
    team: player.team || null,
    health: player.health,
    teleportAmmo: player.teleportAmmo ?? TELEPORT_AMMO,
    connected: player.connected,
    isHost: player.isHost
  };
}

function publicRoom(room) {
  return {
    code: room.code,
    status: room.status,
    hostToken: room.hostToken,
    config: {
      maxPlayers: room.config.maxPlayers,
      startHealth: room.config.startHealth,
      hitDamage: room.config.hitDamage,
      turnSeconds: room.config.turnSeconds,
      mapStyle: room.config.mapStyle,
      teamMode: room.config.teamMode || 'solo',
      criticalEnabled: room.config.criticalEnabled !== false,
      criticalChance: room.config.criticalChance,
      criticalDamagePercent: room.config.criticalDamagePercent,
      arcDamageEnabled: room.config.arcDamageEnabled !== false,
      maxArcDamagePercent: room.config.maxArcDamagePercent,
      arcAngleToleranceDegrees: room.config.arcAngleToleranceDegrees,
      hasPassword: Boolean(room.config.password)
    },
    activeMapStyle: room.activeMapStyle || room.config.mapStyle,
    players: room.players.map(publicPlayer),
    terrain: room.status === 'playing' || room.status === 'ended' ? room.terrain : null,
    turnToken: room.turnToken,
    turnEndsAt: room.turnEndsAt,
    wind: room.wind,
    winnerTokens: room.winnerTokens,
    winnerTeam: room.winnerTeam || null,
    shotInProgress: Boolean(room.shotInProgress),
    revision: room.revision,
    createdAt: room.createdAt
  };
}

function publicRoomList() {
  return [...rooms.values()]
    .filter((room) => room.status === 'lobby' && room.players.length < room.config.maxPlayers)
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(0, 40)
    .map((room) => ({
      code: room.code,
      hostName: room.players.find((player) => player.token === room.hostToken)?.name || 'Chủ phòng',
      playerCount: room.players.length,
      maxPlayers: room.config.maxPlayers,
      startHealth: room.config.startHealth,
      hitDamage: room.config.hitDamage,
      turnSeconds: room.config.turnSeconds,
      mapStyle: room.config.mapStyle,
      teamMode: room.config.teamMode || 'solo',
      teamAPlayers: room.players.filter((player) => player.team === 'A').length,
      teamBPlayers: room.players.filter((player) => player.team === 'B').length,
      teamCapacity: room.config.teamMode === 'teams' ? Math.floor(room.config.maxPlayers / 2) : 0,
      criticalEnabled: room.config.criticalEnabled !== false,
      criticalChance: room.config.criticalChance,
      criticalDamagePercent: room.config.criticalDamagePercent,
      arcDamageEnabled: room.config.arcDamageEnabled !== false,
      maxArcDamagePercent: room.config.maxArcDamagePercent,
      arcAngleToleranceDegrees: room.config.arcAngleToleranceDegrees,
      hasPassword: Boolean(room.config.password),
      createdAt: room.createdAt
    }));
}

function isTeamRoom(room) {
  return room?.config?.teamMode === 'teams';
}

function teamCapacity(room) {
  return isTeamRoom(room) ? Math.floor(room.config.maxPlayers / 2) : 0;
}

function countTeam(room, team, excludeToken = null) {
  return room.players.filter((player) => player.team === team && player.token !== excludeToken).length;
}

function ensureTeamAvailable(room, requestedTeam, excludeToken = null) {
  if (!isTeamRoom(room)) return null;
  const team = sanitizeTeam(requestedTeam);
  if (!team) throw new Error('Vui lòng chọn Phe Xanh hoặc Phe Đỏ trước khi vào phòng');
  if (countTeam(room, team, excludeToken) >= teamCapacity(room)) {
    throw new Error(team === 'A' ? 'Phe Xanh đã đủ người' : 'Phe Đỏ đã đủ người');
  }
  return team;
}

function refreshPlayerColors(room) {
  room.players.forEach((player, index) => {
    player.color = isTeamRoom(room)
      ? (TEAM_COLORS[player.team] || '#64748b')
      : COLORS[index % COLORS.length];
  });
}

function teamCounts(room) {
  return { A: countTeam(room, 'A'), B: countTeam(room, 'B') };
}

function teamsReady(room) {
  if (!isTeamRoom(room)) return true;
  const counts = teamCounts(room);
  return counts.A > 0 && counts.A === counts.B;
}

function broadcastRoomList() {
  io.emit('room-list', publicRoomList());
}

function findPlayer(room, token) {
  return room.players.find((player) => player.token === token);
}

function alivePlayers(room) {
  return room.players.filter((player) => player.health > 0);
}

function emitRoom(room) {
  room.revision += 1;
  room.updatedAt = Date.now();
  io.to(room.code).emit('room-state', publicRoom(room));
}

function beginTurn(room, token = null) {
  const alive = alivePlayers(room);
  const aliveTeams = isTeamRoom(room) ? [...new Set(alive.map((player) => player.team).filter(Boolean))] : [];
  if ((isTeamRoom(room) && aliveTeams.length <= 1) || (!isTeamRoom(room) && alive.length <= 1)) {
    room.status = 'ended';
    room.turnToken = null;
    room.turnEndsAt = null;
    room.shotInProgress = false;
    room.winnerTeam = isTeamRoom(room) ? (aliveTeams[0] || null) : null;
    room.winnerTokens = room.winnerTeam
      ? room.players.filter((player) => player.team === room.winnerTeam).map((player) => player.token)
      : alive.map((player) => player.token);
    emitRoom(room);
    return;
  }
  room.winnerTeam = null;
  let next = token ? findPlayer(room, token) : null;
  if (!next || next.health <= 0) next = alive[0];
  room.turnToken = next.token;
  room.turnEndsAt = Date.now() + room.config.turnSeconds * 1000;
  room.wind = Math.round((Math.random() * 2 - 1) * 62);
  room.shotInProgress = false;
  emitRoom(room);
}

function advanceTurn(room) {
  const alive = alivePlayers(room);
  if (alive.length <= 1) return beginTurn(room);
  const currentIndex = room.players.findIndex((player) => player.token === room.turnToken);
  for (let offset = 1; offset <= room.players.length; offset += 1) {
    const candidate = room.players[(currentIndex + offset + room.players.length) % room.players.length];
    if (candidate.health > 0) return beginTurn(room, candidate.token);
  }
  beginTurn(room);
}

function canControl(room, token) {
  return room.status === 'playing' && !room.shotInProgress && room.turnToken === token;
}

function canOccupy(room, player, nextX) {
  if (nextX < 28 || nextX > GAME_WIDTH - 28) return false;
  const oldY = terrainY(room.terrain, player.x);
  const newY = terrainY(room.terrain, nextX);
  if (Math.abs(newY - oldY) > 14) return false;
  for (const other of room.players) {
    if (other.token === player.token || other.health <= 0) continue;
    if (Math.abs(other.x - nextX) < 42) return false;
  }
  return true;
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

function canTeleportTo(room, shooter, nextX) {
  if (nextX < 28 || nextX > GAME_WIDTH - 28) return false;
  return !room.players.some((other) => other.token !== shooter.token && other.health > 0 && Math.abs(other.x - nextX) < 42);
}

function findSafeTeleport(room, shooter, impact) {
  if (impact.type === 'out') return null;
  let targetX = clamp(impact.x, 30, GAME_WIDTH - 30);
  if (impact.type === 'player' && impact.hitToken) {
    const hit = findPlayer(room, impact.hitToken);
    if (hit) targetX = hit.x + (shooter.x <= hit.x ? -52 : 52);
  }
  const offsets = [0, -30, 30, -52, 52, -76, 76, -104, 104, -138, 138, -176, 176];
  for (const offset of offsets) {
    const candidate = clamp(targetX + offset, 30, GAME_WIDTH - 30);
    if (canTeleportTo(room, shooter, candidate)) {
      return { x: Math.round(candidate * 10) / 10, y: Math.round(terrainY(room.terrain, candidate)) };
    }
  }
  return null;
}

function simulateShot(room, shooter, angle, power, shotType = 'normal') {
  const facing = facingFor(shooter, room.players);
  const radians = angle * Math.PI / 180;
  const ground = playerGroundY(room, shooter);
  const barrelLength = 78;
  let x = shooter.x - facing * 7 + facing * Math.cos(radians) * barrelLength;
  let y = ground - 28 - Math.sin(radians) * barrelLength;
  let vx = facing * Math.cos(radians) * power;
  let vy = -Math.sin(radians) * power;
  const points = [{ x: Math.round(x), y: Math.round(y) }];
  let impact = null;
  let impactVx = vx;
  let impactVy = vy;
  let elapsed = 0;
  let sampleCounter = 0;

  while (elapsed < SHOT_MAX_SECONDS) {
    elapsed += SHOT_STEP;
    vx += room.wind * 0.42 * SHOT_STEP;
    vy += GRAVITY * SHOT_STEP;
    x += vx * SHOT_STEP;
    y += vy * SHOT_STEP;
    sampleCounter += 1;
    if (sampleCounter % 2 === 0) points.push({ x: Math.round(x), y: Math.round(y) });

    if (x < -20 || x > GAME_WIDTH + 20 || y > GAME_HEIGHT + 40) {
      impact = { x: clamp(x, 0, GAME_WIDTH), y: clamp(y, 0, GAME_HEIGHT), type: 'out' };
      impactVx = vx;
      impactVy = vy;
      break;
    }

    if (elapsed > 0.22) {
      for (const player of room.players) {
        if (player.health <= 0) continue;
        const py = playerGroundY(room, player) - 34;
        if ((x - player.x) ** 2 + (y - py) ** 2 <= 26 ** 2) {
          impact = { x, y, type: 'player', hitToken: player.token };
          impactVx = vx;
          impactVy = vy;
          break;
        }
      }
      if (impact) break;
    }


    if (x >= 0 && x < GAME_WIDTH && y >= terrainY(room.terrain, x)) {
      impact = { x, y: terrainY(room.terrain, x), type: 'terrain' };
      impactVx = vx;
      impactVy = vy;
      break;
    }
  }

  if (!impact) impact = { x: clamp(x, 0, GAME_WIDTH), y: clamp(y, 0, GAME_HEIGHT), type: 'out' };
  const damagedTokens = [];
  let teleportTo = null;
  const baseDamage = room.config.hitDamage;
  const impactAngle = impactVy > 0
    ? Math.round(Math.atan2(impactVy, Math.max(1, Math.abs(impactVx))) * 180 / Math.PI * 10) / 10
    : 0;
  const launchAngle = Math.round(Number(angle) * 10) / 10;
  const maxArcMultiplier = room.config.maxArcDamagePercent / 100;
  // Góc siêu cao được xác định từ góc nòng khi người bắn khai hỏa,
  // không phụ thuộc vào góc viên đạn đi tới mục tiêu.
  const superHighAngle = shotType === 'normal' && room.config.arcDamageEnabled !== false
    && Math.abs(90 - launchAngle) <= room.config.arcAngleToleranceDegrees;
  const arcMultiplier = superHighAngle ? maxArcMultiplier : 1;
  const critical = shotType === 'normal' && room.config.criticalEnabled !== false
    && Math.random() < room.config.criticalChance / 100;
  const criticalMultiplier = critical ? room.config.criticalDamagePercent / 100 : 1;
  // Critical và góc siêu cao được phép nhân chồng: 150% × 200% = 300%.
  const damageMultiplier = Math.round(arcMultiplier * criticalMultiplier * 100) / 100;
  const finalDamage = Math.max(1, Math.round(baseDamage * damageMultiplier));

  if (shotType === 'teleport') {
    teleportTo = findSafeTeleport(room, shooter, impact);
  } else if (impact.type !== 'out') {
    for (const player of room.players) {
      if (player.health <= 0) continue;
      const py = playerGroundY(room, player) - 30;
      const distance = Math.hypot(player.x - impact.x, py - impact.y);
      if (distance <= NORMAL_BLAST_RADIUS || player.token === impact.hitToken) {
        const teammateProtected = isTeamRoom(room) && shooter.team && player.team === shooter.team && player.token !== shooter.token;
        if (!teammateProtected) {
          player.health = Math.max(0, player.health - finalDamage);
          damagedTokens.push(player.token);
        }
      }
    }
    if (impact.y >= terrainY(room.terrain, impact.x) - 4) {
      makeCrater(room.terrain, impact.x, impact.y, 50);
    }
  }

  return {
    id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    shooterToken: shooter.token,
    shotType,
    angle,
    power,
    facing,
    wind: room.wind,
    points,
    impact: { x: Math.round(impact.x), y: Math.round(impact.y), type: impact.type },
    teleportTo,
    damagedTokens,
    damage: finalDamage,
    baseDamage,
    critical,
    criticalChance: room.config.criticalChance / 100,
    criticalChancePercent: room.config.criticalChance,
    criticalDamagePercent: room.config.criticalDamagePercent,
    criticalMultiplier,
    arcDamageEnabled: room.config.arcDamageEnabled !== false,
    maxArcDamagePercent: room.config.maxArcDamagePercent,
    arcAngleToleranceDegrees: room.config.arcAngleToleranceDegrees,
    superHighAngle,
    arcMultiplier,
    impactAngle,
    launchAngle,
    damageMultiplier,
    blastRadius: NORMAL_BLAST_RADIUS,
    terrain: room.terrain,
    players: room.players.map(publicPlayer)
  };
}

function makePlayer({ token, socketId, name, character, color, startHealth, isHost, team = null }) {
  return {
    token,
    socketId,
    name: sanitizeName(name),
    character: sanitizeCharacter(character),
    color,
    x: 125,
    angle: 45,
    facing: isHost ? 1 : -1,
    team: sanitizeTeam(team),
    health: startHealth,
    teleportAmmo: TELEPORT_AMMO,
    connected: true,
    isHost,
    disconnectedAt: null
  };
}

function createRoom(socket, payload = {}) {
  if (rooms.size >= MAX_ROOMS) throw new Error('Máy chủ đang có quá nhiều phòng, vui lòng thử lại sau');
  const config = normalizeConfig(payload.config);
  const code = makeCode();
  const token = String(payload.token || makeToken()).slice(0, 64);
  const selectedTeam = config.teamMode === 'teams' ? sanitizeTeam(payload.team) : null;
  if (config.teamMode === 'teams' && !selectedTeam) throw new Error('Vui lòng chọn phe trước khi tạo phòng');
  const player = makePlayer({
    token, socketId: socket.id, name: payload.name, character: payload.character,
    color: selectedTeam ? TEAM_COLORS[selectedTeam] : COLORS[0], startHealth: config.startHealth,
    isHost: true, team: selectedTeam
  });
  const room = {
    code,
    config,
    activeMapStyle: config.mapStyle,
    hostToken: token,
    players: [player],
    status: 'lobby',
    terrain: null,
    turnToken: null,
    turnEndsAt: null,
    wind: 0,
    winnerTokens: [],
    winnerTeam: null,
    shotInProgress: false,
    shotId: null,
    shotUnlockAt: 0,
    activeShot: null,
    revision: 0,
    createdAt: Date.now(),
    updatedAt: Date.now()
  };
  refreshPlayerColors(room);
  rooms.set(code, room);
  socket.join(code);
  socket.data.roomCode = code;
  socket.data.playerToken = token;
  return { room, token };
}

function joinRoom(socket, payload = {}) {
  const code = String(payload.code || '').trim().toUpperCase();
  const room = rooms.get(code);
  if (!room) throw new Error('Không tìm thấy phòng');
  if (room.config.password && room.config.password !== String(payload.password || '')) throw new Error('Mật khẩu phòng không đúng');

  const requestedToken = String(payload.token || '').slice(0, 64);
  let player = requestedToken ? findPlayer(room, requestedToken) : null;
  if (player) {
    player.socketId = socket.id;
    player.connected = true;
    player.disconnectedAt = null;
    player.name = sanitizeName(payload.name || player.name);
    player.character = sanitizeCharacter(payload.character || player.character);
    if (isTeamRoom(room) && !player.team) player.team = ensureTeamAvailable(room, payload.team, player.token);
  } else {
    if (room.status !== 'lobby') throw new Error('Ván đấu đã bắt đầu');
    if (room.players.length >= room.config.maxPlayers) throw new Error('Phòng đã đủ người');
    const selectedTeam = isTeamRoom(room) ? ensureTeamAvailable(room, payload.team) : null;
    player = makePlayer({
      token: makeToken(), socketId: socket.id, name: payload.name, character: payload.character,
      color: selectedTeam ? TEAM_COLORS[selectedTeam] : COLORS[room.players.length % COLORS.length],
      startHealth: room.config.startHealth, isHost: false, team: selectedTeam
    });
    player.x = 0;
    room.players.push(player);
  }
  refreshPlayerColors(room);

  socket.join(code);
  socket.data.roomCode = code;
  socket.data.playerToken = player.token;
  return { room, token: player.token };
}

function removePlayer(room, token) {
  const index = room.players.findIndex((player) => player.token === token);
  if (index < 0) return;
  room.players.splice(index, 1);
  refreshPlayerColors(room);
  if (room.players.length === 0) {
    rooms.delete(room.code);
    broadcastRoomList();
    return;
  }
  if (room.hostToken === token) {
    room.hostToken = room.players[0].token;
    room.players.forEach((player) => { player.isHost = player.token === room.hostToken; });
  }
  refreshPlayerColors(room);
  emitRoom(room);
  broadcastRoomList();
}

function setupMatch(room, replay = false) {
  if (replay) room.players = room.players.filter((player) => player.connected);
  if (room.players.length < 2) throw new Error('Cần ít nhất 2 người còn trong phòng');
  if (isTeamRoom(room) && !teamsReady(room)) throw new Error('Hai phe phải có số người bằng nhau và mỗi phe có ít nhất 1 người');
  if (isTeamRoom(room)) {
    const teamA = room.players.filter((player) => player.team === 'A');
    const teamB = room.players.filter((player) => player.team === 'B');
    room.players = teamA.flatMap((player, index) => [player, teamB[index]]);
  }
  refreshPlayerColors(room);
  const seed = Math.floor(Math.random() * 0x7fffffff);
  room.activeMapStyle = resolveMapStyle(room.config.mapStyle, seed);
  room.terrain = generateTerrain(seed, room.activeMapStyle);

  let spawns = getSpawnPositions(room.players.length);
  if (isTeamRoom(room)) {
    const perTeam = room.players.length / 2;
    const left = Array.from({ length: perTeam }, (_, index) => perTeam === 1 ? 180 : Math.round(110 + index * (520 / (perTeam - 1))));
    const right = Array.from({ length: perTeam }, (_, index) => perTeam === 1 ? GAME_WIDTH - 180 : Math.round(GAME_WIDTH - 110 - index * (520 / (perTeam - 1))));
    let aIndex = 0;
    let bIndex = 0;
    spawns = room.players.map((player) => player.team === 'A' ? left[aIndex++] : right[bIndex++]);
  }

  spawns.forEach((spawnX) => flattenTerrain(room.terrain, spawnX, 50));
  room.players.forEach((player, index) => {
    player.x = spawns[index];
    player.angle = 45;
    player.facing = isTeamRoom(room) ? (player.team === 'A' ? 1 : -1) : (player.x < GAME_WIDTH / 2 ? 1 : -1);
    player.health = room.config.startHealth;
    player.teleportAmmo = TELEPORT_AMMO;
    player.connected = true;
    player.disconnectedAt = null;
  });
  room.status = 'playing';
  room.winnerTokens = [];
  room.winnerTeam = null;
  room.shotInProgress = false;
  room.shotId = null;
  room.shotUnlockAt = 0;
  room.activeShot = null;
}

function finishShot(room, shotId = null) {
  if (!room || room.status !== 'playing' || !room.shotInProgress) return false;
  const active = room.activeShot;
  if (!active || active.finished) return false;
  if (shotId && active.id !== shotId) return false;
  active.finished = true;
  if (active.type === 'teleport' && active.destination) {
    const shooter = findPlayer(room, active.shooterToken);
    if (shooter && shooter.health > 0) {
      shooter.x = active.destination.x;
    }
  }
  room.shotInProgress = false;
  room.shotId = null;
  room.shotUnlockAt = 0;
  room.activeShot = null;
  advanceTurn(room);
  return true;
}

io.on('connection', (socket) => {
  socket.emit('room-list', publicRoomList());

  socket.on('list-rooms', (_payload, ack = () => {}) => ack({ ok: true, rooms: publicRoomList() }));

  socket.on('create-room', (payload, ack = () => {}) => {
    try {
      const { room, token } = createRoom(socket, payload);
      ack({ ok: true, token, room: publicRoom(room) });
      emitRoom(room);
      broadcastRoomList();
    } catch (error) {
      ack({ ok: false, error: error.message || 'Không thể tạo phòng' });
    }
  });

  socket.on('join-room', (payload, ack = () => {}) => {
    try {
      const { room, token } = joinRoom(socket, payload);
      ack({ ok: true, token, room: publicRoom(room) });
      emitRoom(room);
      broadcastRoomList();
    } catch (error) {
      ack({ ok: false, error: error.message || 'Không thể vào phòng' });
    }
  });

  socket.on('update-profile', (payload, ack = () => {}) => {
    const room = rooms.get(socket.data.roomCode);
    const player = room && findPlayer(room, socket.data.playerToken);
    if (!room || !player || room.status !== 'lobby') return ack({ ok: false, error: 'Không thể cập nhật lúc này' });
    player.name = sanitizeName(payload?.name || player.name);
    player.character = sanitizeCharacter(payload?.character || player.character);
    if (isTeamRoom(room) && payload?.team && sanitizeTeam(payload.team) !== player.team) {
      player.team = ensureTeamAvailable(room, payload.team, player.token);
      refreshPlayerColors(room);
    }
    emitRoom(room);
    broadcastRoomList();
    ack({ ok: true });
  });

  socket.on('start-room', (_payload, ack = () => {}) => {
    const room = rooms.get(socket.data.roomCode);
    try {
      if (!room) throw new Error('Phòng không còn tồn tại');
      if (room.hostToken !== socket.data.playerToken) throw new Error('Chỉ chủ phòng được bắt đầu');
      if (room.status !== 'lobby') throw new Error('Ván đấu đã bắt đầu');
      setupMatch(room, false);
      ack({ ok: true });
      broadcastRoomList();
      beginTurn(room, room.players[0].token);
    } catch (error) {
      ack({ ok: false, error: error.message || 'Không thể bắt đầu' });
    }
  });

  socket.on('restart-room', (_payload, ack = () => {}) => {
    const room = rooms.get(socket.data.roomCode);
    try {
      if (!room) throw new Error('Phòng không còn tồn tại');
      if (room.hostToken !== socket.data.playerToken) throw new Error('Chỉ chủ phòng được mở ván mới');
      if (room.status !== 'ended') throw new Error('Ván hiện tại chưa kết thúc');
      setupMatch(room, true);
      ack({ ok: true });
      beginTurn(room, room.players[0].token);
    } catch (error) {
      ack({ ok: false, error: error.message || 'Không thể chơi lại' });
    }
  });

  socket.on('move-player', (payload) => {
    const room = rooms.get(socket.data.roomCode);
    const player = room && findPlayer(room, socket.data.playerToken);
    if (!room || !player || !canControl(room, player.token)) return;
    const delta = clamp(Number(payload?.delta) || 0, -16, 16);
    const nextX = player.x + delta;
    if (!canOccupy(room, player, nextX)) return;
    player.x = Math.round(nextX * 10) / 10;
    if (delta) player.facing = delta < 0 ? -1 : 1;
    emitRoom(room);
  });

  socket.on('set-angle', (payload, ack = () => {}) => {
    const room = rooms.get(socket.data.roomCode);
    const player = room && findPlayer(room, socket.data.playerToken);
    if (!room || !player || !canControl(room, player.token)) return ack({ ok: false });
    player.angle = Math.round(clamp(Number(payload?.angle) || player.angle, 2, 89) * 2) / 2;
    emitRoom(room);
    ack({ ok: true, angle: player.angle });
  });

  socket.on('set-facing', (payload, ack = () => {}) => {
    const room = rooms.get(socket.data.roomCode);
    const player = room && findPlayer(room, socket.data.playerToken);
    if (!room || !player || !canControl(room, player.token)) return ack({ ok: false, error: 'Chưa thể xoay nòng' });
    player.facing = Number(payload?.facing) < 0 ? -1 : 1;
    emitRoom(room);
    ack({ ok: true, facing: player.facing });
  });

  socket.on('fire', (payload, ack = () => {}) => {
    const room = rooms.get(socket.data.roomCode);
    const player = room && findPlayer(room, socket.data.playerToken);
    if (!room || !player || !canControl(room, player.token)) return ack({ ok: false, error: 'Chưa đến lượt bắn' });
    const power = clamp(Math.round(Number(payload?.power) || 280), 220, MAX_POWER);
    const requestedType = payload?.shotType === 'teleport' ? 'teleport' : 'normal';
    if (requestedType === 'teleport' && player.teleportAmmo <= 0) return ack({ ok: false, error: 'Đã hết đạn dịch chuyển' });
    if (requestedType === 'teleport') player.teleportAmmo -= 1;

    room.shotInProgress = true;
    room.turnEndsAt = null;
    const shot = simulateShot(room, player, player.angle, power, requestedType);
    const destination = requestedType === 'teleport' && shot.teleportTo
      ? { x: shot.teleportTo.x, y: shot.teleportTo.y }
      : null;
    const flightMs = clamp(shot.points.length * 22, 900, 7200);
    const effectMs = requestedType === 'teleport' ? 900 : 1180;
    const unlockAt = Date.now() + flightMs + effectMs + 300;

    room.shotId = shot.id;
    room.shotUnlockAt = unlockAt;
    room.activeShot = {
      id: shot.id, shooterToken: player.token, type: requestedType, destination, finished: false
    };

    // Payload sau va chạm để mọi máy hiển thị nhân vật ở đúng điểm đạn rơi.
    if (requestedType === 'teleport' && destination) {
      const payloadShooter = shot.players.find((item) => item.token === player.token);
      if (payloadShooter) {
        payloadShooter.x = destination.x;
      }
    }

    io.to(room.code).emit('shot-fired', shot);
    emitRoom(room);
    ack({ ok: true, shotId: shot.id, teleportTo: destination });

    // Máy chủ là nguồn quyết định duy nhất; không chờ callback hoạt ảnh từ điện thoại.
    setTimeout(() => finishShot(rooms.get(room.code), shot.id), Math.max(500, unlockAt - Date.now()));
  });

  socket.on('shot-animation-complete', (_payload) => {
    // Chỉ nhận để tương thích bản client cũ; máy chủ tự hoàn tất theo shotId và timer.
  });

  socket.on('skip-turn', () => {
    const room = rooms.get(socket.data.roomCode);
    if (!room || !canControl(room, socket.data.playerToken)) return;
    advanceTurn(room);
  });

  socket.on('leave-room', () => {
    const room = rooms.get(socket.data.roomCode);
    if (!room) return;
    socket.leave(room.code);
    if (room.status === 'lobby' || room.status === 'ended') {
      removePlayer(room, socket.data.playerToken);
    } else {
      const player = findPlayer(room, socket.data.playerToken);
      if (player) {
        const wasCurrent = room.turnToken === player.token;
        player.connected = false;
        player.disconnectedAt = Date.now();
        player.health = 0;
        if (wasCurrent) advanceTurn(room);
        else beginTurn(room, room.turnToken);
      }
    }
    socket.data.roomCode = null;
    socket.data.playerToken = null;
  });

  socket.on('disconnect', () => {
    const room = rooms.get(socket.data.roomCode);
    if (!room) return;
    const player = findPlayer(room, socket.data.playerToken);
    if (!player) return;
    player.connected = false;
    player.disconnectedAt = Date.now();
    emitRoom(room);
    if (room.status === 'lobby') broadcastRoomList();
  });
});

setInterval(() => {
  const now = Date.now();
  for (const room of [...rooms.values()]) {
    if (now - room.updatedAt > ROOM_TTL_MS) {
      rooms.delete(room.code);
      broadcastRoomList();
      continue;
    }
    if (room.status === 'playing' && room.shotInProgress && room.shotUnlockAt && now >= room.shotUnlockAt) {
      finishShot(room, room.shotId);
    }
    if (room.status === 'playing' && !room.shotInProgress && room.turnEndsAt && now >= room.turnEndsAt) {
      io.to(room.code).emit('turn-skipped', { token: room.turnToken, reason: 'timeout' });
      advanceTurn(room);
    }
    if (room.status === 'lobby') {
      for (const player of [...room.players]) {
        if (!player.connected && player.disconnectedAt && now - player.disconnectedAt > LOBBY_RECONNECT_MS) removePlayer(room, player.token);
      }
    } else {
      let stateChanged = false;
      let currentEliminated = false;
      for (const player of room.players) {
        if (player.health > 0 && !player.connected && player.disconnectedAt && now - player.disconnectedAt > PLAYER_RECONNECT_MS) {
          player.health = 0;
          stateChanged = true;
          if (room.turnToken === player.token) currentEliminated = true;
        }
      }
      if (stateChanged && room.status === 'playing') {
        if (currentEliminated) advanceTurn(room);
        else beginTurn(room, room.turnToken);
      }
    }
  }
}, 1000).unref();

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Cannon Battle VN v1.5.1 đang chạy tại cổng ${PORT}`);
});
