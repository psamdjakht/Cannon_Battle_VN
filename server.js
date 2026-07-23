'use strict';

const path = require('path');
const http = require('http');
const express = require('express');
const { Server } = require('socket.io');

const PORT = Number(process.env.PORT || 10000);
const GAME_WIDTH = 960;
const GAME_HEIGHT = 540;
const TERRAIN_FLOOR = 490;
const GRAVITY = 350;
const MAX_ROOMS = 500;
const ROOM_TTL_MS = 3 * 60 * 60 * 1000;
const PLAYER_RECONNECT_MS = 45 * 1000;
const LOBBY_RECONNECT_MS = 20 * 1000;
const SHOT_STEP = 1 / 60;
const SHOT_MAX_SECONDS = 12;
const NORMAL_BLAST_RADIUS = 60;
const TELEPORT_AMMO = 3;
const MAP_STYLES = ['grass', 'desert', 'snow', 'volcano', 'sky', 'random'];
const RANDOM_THEMES = ['grass', 'desert', 'snow', 'volcano', 'sky'];

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  serveClient: false,
  cors: { origin: true, credentials: false },
  transports: ['websocket', 'polling']
});

app.disable('x-powered-by');
app.use(express.static(path.join(__dirname, 'public'), { maxAge: '1h', etag: true }));
app.get('/health', (_req, res) => res.status(200).json({ ok: true, rooms: rooms.size }));
app.use((_req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

const rooms = new Map();
const COLORS = ['#22c55e', '#38bdf8', '#f97316', '#a855f7', '#ef4444', '#eab308'];

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

function normalizeConfig(raw = {}) {
  return {
    maxPlayers: clamp(Math.round(Number(raw.maxPlayers) || 2), 2, 6),
    startHealth: clamp(Math.round(Number(raw.startHealth) || 100), 50, 500),
    hitDamage: clamp(Math.round(Number(raw.hitDamage) || 25), 5, 200),
    turnSeconds: clamp(Math.round(Number(raw.turnSeconds) || 30), 15, 90),
    mapStyle: MAP_STYLES.includes(raw.mapStyle) ? raw.mapStyle : 'grass',
    teamMode: raw.teamMode === 'teams' && clamp(Math.round(Number(raw.maxPlayers) || 2), 2, 6) % 2 === 0 ? 'teams' : 'solo',
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
  const styleBase = { grass: 350, desert: 365, snow: 345, volcano: 375, sky: 402 }[style] || 350;
  const styleRoughness = { grass: 82, desert: 58, snow: 72, volcano: 105, sky: 48 }[style] || 82;

  for (let x = -anchorStep; x <= GAME_WIDTH + anchorStep; x += anchorStep) {
    const wave = Math.sin((x + seed % 500) / 115) * 26 + Math.sin((x + seed % 1300) / 47) * 13;
    anchors.push(clamp(styleBase + wave + (rand() - 0.5) * styleRoughness, 255, 448));
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

function generatePlatforms(seed, style) {
  const rand = seededRandom(seed ^ 0x5f3759df);
  const platforms = [];
  const count = style === 'sky' ? 4 : (rand() > 0.54 ? 2 + Math.floor(rand() * 2) : 0);
  const slots = [175, 375, 585, 790];
  for (let index = 0; index < count; index += 1) {
    const width = Math.round(115 + rand() * 60);
    const x = clamp(slots[index % slots.length] + (rand() - 0.5) * 70, 75 + width / 2, GAME_WIDTH - 75 - width / 2);
    const y = Math.round(155 + rand() * 115 + (index % 2) * 28);
    platforms.push({
      id: `island-${index + 1}`,
      x: Math.round(x),
      y,
      width,
      height: Math.round(28 + rand() * 18)
    });
  }
  return platforms;
}

function terrainY(terrain, x) {
  const ix = clamp(Math.round(x), 0, terrain.length - 1);
  return terrain[ix] ?? TERRAIN_FLOOR;
}

function platformTopY(platform, x) {
  const half = platform.width / 2;
  const normalized = clamp((x - platform.x) / half, -1, 1);
  return platform.y + normalized * normalized * 13;
}

function getPlatform(room, id) {
  return id ? room.platforms?.find((platform) => platform.id === id) || null : null;
}

function surfaceY(room, surfaceId, x) {
  const platform = getPlatform(room, surfaceId);
  return platform ? platformTopY(platform, x) : terrainY(room.terrain, x);
}

function playerGroundY(room, player) {
  return surfaceY(room, player.surfaceId, player.x);
}

function pointHitsPlatform(platform, x, y) {
  if (x < platform.x - platform.width / 2 || x > platform.x + platform.width / 2) return false;
  const top = platformTopY(platform, x);
  return y >= top && y <= platform.y + platform.height;
}

function getSpawnPositions(count) {
  if (count === 2) return [125, GAME_WIDTH - 125];
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
    surfaceId: player.surfaceId || null,
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
      hasPassword: Boolean(room.config.password)
    },
    activeMapStyle: room.activeMapStyle || room.config.mapStyle,
    players: room.players.map(publicPlayer),
    terrain: room.status === 'playing' || room.status === 'ended' ? room.terrain : null,
    platforms: room.status === 'playing' || room.status === 'ended' ? room.platforms : [],
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
      hasPassword: Boolean(room.config.password),
      createdAt: room.createdAt
    }));
}

function isTeamRoom(room) {
  return room?.config?.teamMode === 'teams';
}

function rebalanceTeams(room) {
  if (!room?.players) return;
  room.players.forEach((player, index) => {
    player.team = isTeamRoom(room) ? (index % 2 === 0 ? 'A' : 'B') : null;
  });
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

function canOccupy(room, player, nextX, surfaceId = player.surfaceId) {
  if (nextX < 28 || nextX > GAME_WIDTH - 28) return false;
  const platform = getPlatform(room, surfaceId);
  if (platform) {
    if (nextX < platform.x - platform.width / 2 + 24 || nextX > platform.x + platform.width / 2 - 24) return false;
  } else {
    const oldY = surfaceY(room, null, player.x);
    const newY = surfaceY(room, null, nextX);
    if (Math.abs(newY - oldY) > 14) return false;
  }
  for (const other of room.players) {
    if (other.token === player.token || other.health <= 0 || (other.surfaceId || null) !== (surfaceId || null)) continue;
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

function findSafeTeleport(room, shooter, impact) {
  if (impact.type === 'out') return null;
  let surfaceId = impact.platformId || null;
  let targetX = clamp(impact.x, 30, GAME_WIDTH - 30);
  if (impact.type === 'player' && impact.hitToken) {
    const hit = findPlayer(room, impact.hitToken);
    if (hit) {
      surfaceId = hit.surfaceId || null;
      targetX = hit.x + (shooter.x <= hit.x ? -52 : 52);
    }
  }
  const offsets = [0, -38, 38, -70, 70, -105, 105];
  for (const offset of offsets) {
    const candidate = targetX + offset;
    if (canOccupy(room, shooter, candidate, surfaceId)) {
      return { x: Math.round(candidate * 10) / 10, surfaceId, y: Math.round(surfaceY(room, surfaceId, candidate)) };
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
      break;
    }

    if (elapsed > 0.22) {
      for (const player of room.players) {
        if (player.health <= 0) continue;
        const py = playerGroundY(room, player) - 34;
        if ((x - player.x) ** 2 + (y - py) ** 2 <= 26 ** 2) {
          impact = { x, y, type: 'player', hitToken: player.token, platformId: player.surfaceId || null };
          break;
        }
      }
      if (impact) break;
    }

    for (const platform of room.platforms || []) {
      if (pointHitsPlatform(platform, x, y)) {
        impact = { x, y: platformTopY(platform, x), type: 'platform', platformId: platform.id };
        break;
      }
    }
    if (impact) break;

    if (x >= 0 && x < GAME_WIDTH && y >= terrainY(room.terrain, x)) {
      impact = { x, y: terrainY(room.terrain, x), type: 'terrain', platformId: null };
      break;
    }
  }

  if (!impact) impact = { x: clamp(x, 0, GAME_WIDTH), y: clamp(y, 0, GAME_HEIGHT), type: 'out' };
  const damagedTokens = [];
  let teleportTo = null;

  if (shotType === 'teleport') {
    teleportTo = findSafeTeleport(room, shooter, impact);
    if (teleportTo) {
      shooter.x = teleportTo.x;
      shooter.surfaceId = teleportTo.surfaceId;
    }
  } else if (impact.type !== 'out') {
    for (const player of room.players) {
      if (player.health <= 0) continue;
      const py = playerGroundY(room, player) - 30;
      const distance = Math.hypot(player.x - impact.x, py - impact.y);
      if (distance <= NORMAL_BLAST_RADIUS || player.token === impact.hitToken) {
        const teammateProtected = isTeamRoom(room) && shooter.team && player.team === shooter.team && player.token !== shooter.token;
        if (!teammateProtected) {
          player.health = Math.max(0, player.health - room.config.hitDamage);
          damagedTokens.push(player.token);
        }
      }
    }
    if (!impact.platformId && impact.y >= terrainY(room.terrain, impact.x) - 4) makeCrater(room.terrain, impact.x, impact.y, 50);
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
    impact: {
      x: Math.round(impact.x),
      y: Math.round(impact.y),
      type: impact.type,
      platformId: impact.platformId || null
    },
    teleportTo,
    damagedTokens,
    damage: room.config.hitDamage,
    blastRadius: NORMAL_BLAST_RADIUS,
    terrain: room.terrain,
    platforms: room.platforms,
    players: room.players.map(publicPlayer)
  };
}

function makePlayer({ token, socketId, name, character, color, startHealth, isHost }) {
  return {
    token,
    socketId,
    name: sanitizeName(name),
    character: sanitizeCharacter(character),
    color,
    x: 125,
    surfaceId: null,
    angle: 45,
    facing: isHost ? 1 : -1,
    team: null,
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
  const player = makePlayer({ token, socketId: socket.id, name: payload.name, character: payload.character, color: COLORS[0], startHealth: config.startHealth, isHost: true });
  const room = {
    code,
    config,
    activeMapStyle: config.mapStyle,
    hostToken: token,
    players: [player],
    status: 'lobby',
    terrain: null,
    platforms: [],
    turnToken: null,
    turnEndsAt: null,
    wind: 0,
    winnerTokens: [],
    winnerTeam: null,
    shotInProgress: false,
    shotId: null,
    shotUnlockAt: 0,
    revision: 0,
    createdAt: Date.now(),
    updatedAt: Date.now()
  };
  rebalanceTeams(room);
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
  } else {
    if (room.status !== 'lobby') throw new Error('Ván đấu đã bắt đầu');
    if (room.players.length >= room.config.maxPlayers) throw new Error('Phòng đã đủ người');
    player = makePlayer({
      token: makeToken(), socketId: socket.id, name: payload.name, character: payload.character,
      color: COLORS[room.players.length % COLORS.length], startHealth: room.config.startHealth, isHost: false
    });
    player.x = 0;
    room.players.push(player);
  }
  rebalanceTeams(room);

  socket.join(code);
  socket.data.roomCode = code;
  socket.data.playerToken = player.token;
  return { room, token: player.token };
}

function removePlayer(room, token) {
  const index = room.players.findIndex((player) => player.token === token);
  if (index < 0) return;
  room.players.splice(index, 1);
  room.players.forEach((player, idx) => { player.color = COLORS[idx % COLORS.length]; });
  if (room.players.length === 0) {
    rooms.delete(room.code);
    broadcastRoomList();
    return;
  }
  if (room.hostToken === token) {
    room.hostToken = room.players[0].token;
    room.players.forEach((player) => { player.isHost = player.token === room.hostToken; });
  }
  rebalanceTeams(room);
  emitRoom(room);
  broadcastRoomList();
}

function setupMatch(room, replay = false) {
  if (replay) room.players = room.players.filter((player) => player.connected);
  if (room.players.length < 2) throw new Error('Cần ít nhất 2 người còn trong phòng');
  if (isTeamRoom(room) && room.players.length % 2 !== 0) throw new Error('Chế độ 2 đội cần số người chẵn để bắt đầu');
  rebalanceTeams(room);
  const seed = Math.floor(Math.random() * 0x7fffffff);
  room.activeMapStyle = resolveMapStyle(room.config.mapStyle, seed);
  room.terrain = generateTerrain(seed, room.activeMapStyle);
  room.platforms = generatePlatforms(seed, room.activeMapStyle);

  let spawns = getSpawnPositions(room.players.length);
  if (isTeamRoom(room)) {
    const perTeam = room.players.length / 2;
    const left = Array.from({ length: perTeam }, (_, index) => perTeam === 1 ? 145 : Math.round(85 + index * (285 / (perTeam - 1))));
    const right = Array.from({ length: perTeam }, (_, index) => perTeam === 1 ? GAME_WIDTH - 145 : Math.round(GAME_WIDTH - 85 - index * (285 / (perTeam - 1))));
    let aIndex = 0;
    let bIndex = 0;
    spawns = room.players.map((player) => player.team === 'A' ? left[aIndex++] : right[bIndex++]);
  }

  spawns.forEach((spawnX) => flattenTerrain(room.terrain, spawnX, 50));
  room.players.forEach((player, index) => {
    player.x = spawns[index];
    player.surfaceId = null;
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
}

function finishShot(room, shotId = null) {
  if (!room || room.status !== 'playing' || !room.shotInProgress) return false;
  if (shotId && room.shotId && shotId !== room.shotId) return false;
  room.shotInProgress = false;
  room.shotId = null;
  room.shotUnlockAt = 0;
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

  socket.on('set-angle', (payload) => {
    const room = rooms.get(socket.data.roomCode);
    const player = room && findPlayer(room, socket.data.playerToken);
    if (!room || !player || !canControl(room, player.token)) return;
    player.angle = Math.round(clamp(Number(payload?.angle) || player.angle, 2, 89) * 10) / 10;
    emitRoom(room);
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
    const power = clamp(Math.round(Number(payload?.power) || 280), 220, 720);
    const requestedType = payload?.shotType === 'teleport' ? 'teleport' : 'normal';
    if (requestedType === 'teleport' && player.teleportAmmo <= 0) return ack({ ok: false, error: 'Đã hết đạn dịch chuyển' });
    if (requestedType === 'teleport') player.teleportAmmo -= 1;
    room.shotInProgress = true;
    room.turnEndsAt = null;
    const shot = simulateShot(room, player, player.angle, power, requestedType);
    const animationMs = clamp(shot.points.length * 22, 900, 5200) + 1150;
    room.shotId = shot.id;
    room.shotUnlockAt = Date.now() + animationMs + 1000;
    io.to(room.code).emit('shot-fired', shot);
    ack({ ok: true, shotId: shot.id });
    setTimeout(() => finishShot(rooms.get(room.code), shot.id), animationMs);
  });

  socket.on('shot-animation-complete', (payload) => {
    const room = rooms.get(socket.data.roomCode);
    finishShot(room, payload?.shotId || null);
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
  console.log(`Cannon Battle VN đang chạy tại cổng ${PORT}`);
});
