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

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: true, credentials: false },
  transports: ['websocket', 'polling']
});

app.disable('x-powered-by');
app.use(express.static(path.join(__dirname, 'public'), {
  maxAge: '1h',
  etag: true
}));
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
    mapStyle: ['grass', 'desert', 'snow', 'volcano'].includes(raw.mapStyle) ? raw.mapStyle : 'grass',
    password: String(raw.password || '').slice(0, 20)
  };
}

function makeCode() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  for (let attempt = 0; attempt < 50; attempt += 1) {
    let code = '';
    for (let i = 0; i < 6; i += 1) code += alphabet[Math.floor(Math.random() * alphabet.length)];
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

function generateTerrain(seed, style = 'grass') {
  const rand = seededRandom(seed);
  const anchors = [];
  const anchorStep = 48;
  const styleBase = {
    grass: 350,
    desert: 365,
    snow: 345,
    volcano: 375
  }[style] || 350;
  const styleRoughness = {
    grass: 82,
    desert: 58,
    snow: 72,
    volcano: 105
  }[style] || 82;

  for (let x = -anchorStep; x <= GAME_WIDTH + anchorStep; x += anchorStep) {
    const wave = Math.sin((x + seed % 500) / 115) * 26 + Math.sin((x + seed % 1300) / 47) * 13;
    anchors.push(clamp(styleBase + wave + (rand() - 0.5) * styleRoughness, 245, 445));
  }

  const terrain = new Array(GAME_WIDTH);
  for (let x = 0; x < GAME_WIDTH; x += 1) {
    const pos = (x + anchorStep) / anchorStep;
    const i = Math.floor(pos);
    const t = pos - i;
    const smooth = t * t * (3 - 2 * t);
    terrain[x] = Math.round(anchors[i] * (1 - smooth) + anchors[i + 1] * smooth);
  }

  // Tạo hai vùng tương đối bằng để người chơi đầu tiên không bị kẹt.
  flattenTerrain(terrain, 120, 62);
  flattenTerrain(terrain, GAME_WIDTH - 120, 62);
  return terrain;
}

function flattenTerrain(terrain, centerX, radius) {
  const center = terrain[clamp(Math.round(centerX), 0, terrain.length - 1)];
  for (let x = Math.max(0, centerX - radius); x <= Math.min(terrain.length - 1, centerX + radius); x += 1) {
    const distance = Math.abs(x - centerX) / radius;
    const blend = Math.cos(distance * Math.PI / 2) ** 2;
    terrain[Math.round(x)] = Math.round(terrain[Math.round(x)] * (1 - blend) + center * blend);
  }
}

function terrainY(terrain, x) {
  const ix = clamp(Math.round(x), 0, terrain.length - 1);
  return terrain[ix] ?? TERRAIN_FLOOR;
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
    const distance = Math.abs(candidate.x - player.x);
    if (distance < best) {
      best = distance;
      nearest = candidate;
    }
  }
  return nearest;
}

function facingFor(player, players) {
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
    health: player.health,
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
      hasPassword: Boolean(room.config.password)
    },
    players: room.players.map(publicPlayer),
    terrain: room.status === 'playing' || room.status === 'ended' ? room.terrain : null,
    turnToken: room.turnToken,
    turnEndsAt: room.turnEndsAt,
    wind: room.wind,
    winnerTokens: room.winnerTokens,
    revision: room.revision,
    createdAt: room.createdAt
  };
}

function findPlayer(room, token) {
  return room.players.find((player) => player.token === token);
}

function currentPlayer(room) {
  return room.players.find((player) => player.token === room.turnToken) || null;
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
  if (alive.length <= 1) {
    room.status = 'ended';
    room.turnToken = null;
    room.turnEndsAt = null;
    room.winnerTokens = alive.map((player) => player.token);
    emitRoom(room);
    return;
  }

  let next = token ? findPlayer(room, token) : null;
  if (!next || next.health <= 0) next = alive[0];
  room.turnToken = next.token;
  room.turnEndsAt = Date.now() + room.config.turnSeconds * 1000;
  room.wind = Math.round((Math.random() * 2 - 1) * 55);
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

function canMoveTo(room, player, nextX) {
  if (nextX < 28 || nextX > GAME_WIDTH - 28) return false;
  const oldY = terrainY(room.terrain, player.x);
  const newY = terrainY(room.terrain, nextX);
  if (Math.abs(newY - oldY) > 14) return false;
  for (const other of room.players) {
    if (other.token !== player.token && other.health > 0 && Math.abs(other.x - nextX) < 42) return false;
  }
  return true;
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

function smoothCraterEdges(terrain, start, end) {
  const copy = terrain.slice();
  for (let x = Math.max(1, start); x < Math.min(terrain.length - 1, end); x += 1) {
    terrain[x] = Math.round(copy[x - 1] * 0.2 + copy[x] * 0.6 + copy[x + 1] * 0.2);
  }
}

function simulateShot(room, shooter, angle, power) {
  const facing = facingFor(shooter, room.players);
  const radians = angle * Math.PI / 180;
  const ground = terrainY(room.terrain, shooter.x);
  let x = shooter.x + facing * 30;
  let y = ground - 47;
  let vx = facing * Math.cos(radians) * power;
  let vy = -Math.sin(radians) * power;
  const points = [{ x: Math.round(x), y: Math.round(y) }];
  let impact = null;
  let hitToken = null;
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
        const py = terrainY(room.terrain, player.x) - 31;
        const dx = x - player.x;
        const dy = y - py;
        if (dx * dx + dy * dy <= 26 * 26) {
          impact = { x, y, type: 'player' };
          hitToken = player.token;
          break;
        }
      }
      if (impact) break;
    }

    if (x >= 0 && x < GAME_WIDTH && y >= terrainY(room.terrain, x)) {
      impact = { x, y: terrainY(room.terrain, x), type: 'terrain' };
      break;
    }
  }

  if (!impact) impact = { x: clamp(x, 0, GAME_WIDTH), y: clamp(y, 0, GAME_HEIGHT), type: 'out' };
  const damagedTokens = [];
  if (impact.type !== 'out') {
    for (const player of room.players) {
      if (player.health <= 0) continue;
      const px = player.x;
      const py = terrainY(room.terrain, px) - 28;
      const distance = Math.hypot(px - impact.x, py - impact.y);
      if (distance <= 54 || player.token === hitToken) {
        player.health = Math.max(0, player.health - room.config.hitDamage);
        damagedTokens.push(player.token);
      }
    }
    makeCrater(room.terrain, impact.x, impact.y, 46);
  }

  return {
    id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    shooterToken: shooter.token,
    angle,
    power,
    facing,
    wind: room.wind,
    points,
    impact: { x: Math.round(impact.x), y: Math.round(impact.y), type: impact.type },
    damagedTokens,
    damage: room.config.hitDamage,
    terrain: room.terrain,
    players: room.players.map(publicPlayer)
  };
}

function createRoom(socket, payload = {}) {
  if (rooms.size >= MAX_ROOMS) throw new Error('Máy chủ đang có quá nhiều phòng, vui lòng thử lại sau');
  const config = normalizeConfig(payload.config);
  const code = makeCode();
  const token = String(payload.token || makeToken()).slice(0, 64);
  const player = {
    token,
    socketId: socket.id,
    name: sanitizeName(payload.name),
    character: sanitizeCharacter(payload.character),
    color: COLORS[0],
    x: 125,
    angle: 45,
    health: config.startHealth,
    connected: true,
    isHost: true,
    disconnectedAt: null
  };
  const room = {
    code,
    config,
    hostToken: token,
    players: [player],
    status: 'lobby',
    terrain: null,
    turnToken: null,
    turnEndsAt: null,
    wind: 0,
    winnerTokens: [],
    shotInProgress: false,
    revision: 0,
    createdAt: Date.now(),
    updatedAt: Date.now()
  };
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
    const token = makeToken();
    player = {
      token,
      socketId: socket.id,
      name: sanitizeName(payload.name),
      character: sanitizeCharacter(payload.character),
      color: COLORS[room.players.length % COLORS.length],
      x: 0,
      angle: 45,
      health: room.config.startHealth,
      connected: true,
      isHost: false,
      disconnectedAt: null
    };
    room.players.push(player);
  }

  socket.join(code);
  socket.data.roomCode = code;
  socket.data.playerToken = player.token;
  return { room, token: player.token };
}

function removePlayerFromLobby(room, token) {
  const index = room.players.findIndex((player) => player.token === token);
  if (index < 0) return;
  room.players.splice(index, 1);
  room.players.forEach((player, idx) => {
    player.color = COLORS[idx % COLORS.length];
  });
  if (room.players.length === 0) {
    rooms.delete(room.code);
    return;
  }
  if (room.hostToken === token) {
    room.hostToken = room.players[0].token;
    room.players.forEach((player) => { player.isHost = player.token === room.hostToken; });
  }
  emitRoom(room);
}

io.on('connection', (socket) => {
  socket.on('create-room', (payload, ack = () => {}) => {
    try {
      const { room, token } = createRoom(socket, payload);
      ack({ ok: true, token, room: publicRoom(room) });
      emitRoom(room);
    } catch (error) {
      ack({ ok: false, error: error.message || 'Không thể tạo phòng' });
    }
  });

  socket.on('join-room', (payload, ack = () => {}) => {
    try {
      const { room, token } = joinRoom(socket, payload);
      ack({ ok: true, token, room: publicRoom(room) });
      emitRoom(room);
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
    ack({ ok: true });
  });

  socket.on('start-room', (_payload, ack = () => {}) => {
    const room = rooms.get(socket.data.roomCode);
    if (!room) return ack({ ok: false, error: 'Phòng không còn tồn tại' });
    if (room.hostToken !== socket.data.playerToken) return ack({ ok: false, error: 'Chỉ chủ phòng được bắt đầu' });
    if (room.status !== 'lobby') return ack({ ok: false, error: 'Ván đấu đã bắt đầu' });
    if (room.players.length < 2) return ack({ ok: false, error: 'Cần ít nhất 2 người chơi' });

    const seed = Math.floor(Math.random() * 0x7fffffff);
    room.terrain = generateTerrain(seed, room.config.mapStyle);
    const spawns = getSpawnPositions(room.players.length);
    spawns.forEach((spawnX) => flattenTerrain(room.terrain, spawnX, 44));
    room.players.forEach((player, index) => {
      player.x = spawns[index];
      player.angle = 45;
      player.health = room.config.startHealth;
    });
    room.status = 'playing';
    room.winnerTokens = [];
    ack({ ok: true });
    beginTurn(room, room.players[0].token);
  });

  socket.on('move-player', (payload) => {
    const room = rooms.get(socket.data.roomCode);
    const player = room && findPlayer(room, socket.data.playerToken);
    if (!room || !player || !canControl(room, player.token)) return;
    const delta = clamp(Number(payload?.delta) || 0, -14, 14);
    const nextX = player.x + delta;
    if (!canMoveTo(room, player, nextX)) return;
    player.x = Math.round(nextX * 10) / 10;
    emitRoom(room);
  });

  socket.on('set-angle', (payload) => {
    const room = rooms.get(socket.data.roomCode);
    const player = room && findPlayer(room, socket.data.playerToken);
    if (!room || !player || !canControl(room, player.token)) return;
    player.angle = Math.round(clamp(Number(payload?.angle) || player.angle, 8, 86) * 10) / 10;
    emitRoom(room);
  });

  socket.on('fire', (payload, ack = () => {}) => {
    const room = rooms.get(socket.data.roomCode);
    const player = room && findPlayer(room, socket.data.playerToken);
    if (!room || !player || !canControl(room, player.token)) return ack({ ok: false, error: 'Chưa đến lượt bắn' });
    const power = clamp(Math.round(Number(payload?.power) || 280), 220, 720);
    room.shotInProgress = true;
    room.turnEndsAt = null;
    const shot = simulateShot(room, player, player.angle, power);
    io.to(room.code).emit('shot-fired', shot);
    ack({ ok: true, shotId: shot.id });
    const animationMs = clamp(shot.points.length * 22, 900, 5200) + 850;
    setTimeout(() => {
      const current = rooms.get(room.code);
      if (!current || current.status !== 'playing') return;
      current.shotInProgress = false;
      advanceTurn(current);
    }, animationMs);
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
    if (room.status === 'lobby') {
      removePlayerFromLobby(room, socket.data.playerToken);
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
  });
});

setInterval(() => {
  const now = Date.now();
  for (const room of rooms.values()) {
    if (now - room.updatedAt > ROOM_TTL_MS) {
      rooms.delete(room.code);
      continue;
    }
    if (room.status === 'playing' && !room.shotInProgress && room.turnEndsAt && now >= room.turnEndsAt) {
      io.to(room.code).emit('turn-skipped', { token: room.turnToken, reason: 'timeout' });
      advanceTurn(room);
    }
    if (room.status === 'lobby') {
      for (const player of [...room.players]) {
        if (!player.connected && player.disconnectedAt && now - player.disconnectedAt > LOBBY_RECONNECT_MS) {
          removePlayerFromLobby(room, player.token);
        }
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
      if (stateChanged) {
        if (currentEliminated) advanceTurn(room);
        else beginTurn(room, room.turnToken);
      }
    }
  }
}, 1000).unref();

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Cannon Battle VN đang chạy tại cổng ${PORT}`);
});
