import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { AccessToken, RoomServiceClient } from 'livekit-server-sdk';
import { v4 as uuidv4 } from 'uuid';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import db from './db.js';

const app = express();
const http = createServer(app);
const io = new Server(http, {
  cors: { origin: '*' }
});

app.use(cors());
app.use(express.json());

const LIVEKIT_URL = process.env.LIVEKIT_URL || 'wss://your-project.livekit.cloud';
const LIVEKIT_API_KEY = process.env.LIVEKIT_API_KEY || '';
const LIVEKIT_API_SECRET = process.env.LIVEKIT_API_SECRET || '';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';
const PORT = process.env.PORT || 3001;

function generateCode() {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

// ============ API: Σύνδεση με προσωπικό κωδικό ============
app.post('/api/join', async (req, res) => {
  try {
    const { joinCode } = req.body;
    if (!joinCode) {
      return res.status(400).json({ error: 'Εισάγετε τον κωδικό σας' });
    }

    const user = db.getUserByJoinCode(joinCode.trim().toUpperCase());
    if (!user) {
      return res.status(404).json({ error: 'Λάθος κωδικός. Δοκιμάστε ξανά.' });
    }

    if (!user.room_code) {
      return res.status(400).json({ error: 'Δεν έχετε ανατεθεί σε κλήση ακόμα.' });
    }

    const room = db.getRoomByCode(user.room_code);
    if (!room) {
      return res.status(404).json({ error: 'Η κλήση δεν βρέθηκε.' });
    }

    const isHost = room.host_id === user.id;

    const at = new AccessToken(LIVEKIT_API_KEY, LIVEKIT_API_SECRET, {
      identity: user.id,
      name: `${user.first_name} ${user.last_name}`,
      ttl: '24h',
      metadata: JSON.stringify({ firstName: user.first_name, lastName: user.last_name, isHost })
    });

    at.addGrant({
      roomJoin: true,
      room: room.id,
      canPublish: true,
      canSubscribe: true,
      canPublishData: true,
    });

    const token = await at.toJwt();
    res.json({
      token,
      roomId: room.id,
      roomCode: room.code,
      wsUrl: LIVEKIT_URL,
      user: { id: user.id, firstName: user.first_name, lastName: user.last_name },
      isHost,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Σφάλμα σύνδεσης' });
  }
});

// ============ API: Rooms ============
app.post('/api/rooms', (req, res) => {
  const { adminPassword, hostId } = req.body;
  if (adminPassword !== ADMIN_PASSWORD) {
    return res.status(403).json({ error: 'Μη εξουσιοδοτημένο' });
  }

  let code;
  do {
    code = generateCode();
  } while (db.getRoomByCode(code));

  const roomId = `room-${uuidv4()}`;
  db.addRoom({ id: roomId, code, host_id: hostId || null });

  // Ανάθεση όλων των χρηστών σε αυτή την κλήση
  const users = db.getUsers();
  for (const u of users) {
    db.updateUser(u.id, { room_code: code });
  }

  res.json({ roomId, code });
});

app.get('/api/rooms', (req, res) => {
  if (req.query.adminPassword !== ADMIN_PASSWORD) return res.status(403).json({ error: 'Μη εξουσιοδοτημένο' });
  res.json(db.getRooms());
});

app.get('/api/rooms/:code', (req, res) => {
  const room = db.getRoomByCode(req.params.code.toUpperCase());
  if (!room) return res.status(404).json({ error: 'Δεν βρέθηκε κλήση' });
  res.json(room);
});

app.delete('/api/rooms/:code', (req, res) => {
  if (req.query.adminPassword !== ADMIN_PASSWORD) return res.status(403).json({ error: 'Μη εξουσιοδοτημένο' });
  const code = req.params.code.toUpperCase();
  io.to(`room-${code}`).emit('room-closed');
  db.deleteRoom(code);
  res.json({ ok: true });
});

// ============ API: Users ============
app.get('/api/users', (req, res) => {
  if (req.query.adminPassword !== ADMIN_PASSWORD) {
    return res.status(403).json({ error: 'Μη εξουσιοδοτημένο' });
  }
  res.json(db.getUsers());
});

app.get('/api/users/list', (req, res) => {
  const users = db.getUsers().map((u) => ({ id: u.id, first_name: u.first_name, last_name: u.last_name }));
  users.sort((a, b) => (a.last_name + a.first_name).localeCompare(b.last_name + b.first_name));
  res.json(users);
});

app.post('/api/users', (req, res) => {
  if (req.body.adminPassword !== ADMIN_PASSWORD) {
    return res.status(403).json({ error: 'Μη εξουσιοδοτημένο' });
  }
  const { firstName, lastName } = req.body;
  if (!firstName || !lastName) {
    return res.status(400).json({ error: 'Λείπουν όνομα ή επώνυμο' });
  }
  const id = uuidv4();
  let joinCode;
  do {
    joinCode = generateCode();
  } while (db.getUserByJoinCode(joinCode));
  db.addUser({ id, first_name: firstName, last_name: lastName, join_code: joinCode, room_code: null });
  res.json({ id, firstName, lastName, joinCode });
});

app.patch('/api/users/:id', (req, res) => {
  if (req.body.adminPassword !== ADMIN_PASSWORD) {
    return res.status(403).json({ error: 'Μη εξουσιοδοτημένο' });
  }
  const updates = {};
  if (req.body.firstName) updates.first_name = req.body.firstName;
  if (req.body.lastName) updates.last_name = req.body.lastName;
  const user = db.updateUser(req.params.id, updates);
  res.json(user);
});

app.delete('/api/users/:id', (req, res) => {
  if (req.query.adminPassword !== ADMIN_PASSWORD) {
    return res.status(403).json({ error: 'Μη εξουσιοδοτημένο' });
  }
  db.deleteUser(req.params.id);
  res.json({ ok: true });
});

// ============ API: Polls ============
app.post('/api/polls', (req, res) => {
  if (req.body.adminPassword !== ADMIN_PASSWORD) {
    return res.status(403).json({ error: 'Μη εξουσιοδοτημένο' });
  }
  const { roomCode, question, options } = req.body;
  if (!roomCode || !question || !Array.isArray(options)) {
    return res.status(400).json({ error: 'Λείπουν δεδομένα poll' });
  }
  const id = uuidv4();
  db.addPoll({ id, room_code: roomCode, question, options });
  io.to(`room-${roomCode}`).emit('poll', { id, question, options });
  res.json({ id, question, options });
});

app.post('/api/polls/:id/vote', (req, res) => {
  const { participantId, optionIndex } = req.body;
  db.votePoll(req.params.id, participantId, optionIndex);
  io.emit('poll-vote', { pollId: req.params.id, participantId, optionIndex });
  res.json({ ok: true });
});

app.get('/api/polls', (req, res) => {
  if (req.query.adminPassword !== ADMIN_PASSWORD) return res.status(403).json({ error: 'Μη εξουσιοδοτημένο' });
  const roomCode = req.query.roomCode;
  if (!roomCode) return res.json([]);
  const polls = db.getPollsByRoom(roomCode);
  const users = db.getUsers();
  const result = polls.map((p) => {
    const voteCounts = {};
    p.options.forEach((_, i) => { voteCounts[i] = 0; });
    const voterNames = {};
    if (p.votes) {
      for (const [userId, optIdx] of Object.entries(p.votes)) {
        voteCounts[optIdx] = (voteCounts[optIdx] || 0) + 1;
        const u = users.find((x) => x.id === userId);
        const name = u ? `${u.first_name} ${u.last_name}` : userId;
        if (!voterNames[optIdx]) voterNames[optIdx] = [];
        voterNames[optIdx].push(name);
      }
    }
    return {
      id: p.id,
      question: p.question,
      options: p.options,
      voteCounts,
      voterNames,
      totalVotes: Object.values(p.votes || {}).length,
    };
  });
  res.json(result);
});

// ============ API: Admin socket actions ============
app.post('/api/socket-alert', (req, res) => {
  if (req.body.adminPassword !== ADMIN_PASSWORD) return res.status(403).json({ error: 'Μη εξουσιοδοτημένο' });
  const { roomCode, message } = req.body;
  if (roomCode && message) io.to(`room-${roomCode}`).emit('admin-alert', { message });
  res.json({ ok: true });
});

app.post('/api/socket-mute-all', (req, res) => {
  if (req.body.adminPassword !== ADMIN_PASSWORD) return res.status(403).json({ error: 'Μη εξουσιοδοτημένο' });
  const { roomCode } = req.body;
  if (roomCode) io.to(`room-${roomCode}`).emit('admin-mute-all');
  res.json({ ok: true });
});

app.post('/api/socket-mute', (req, res) => {
  if (req.body.adminPassword !== ADMIN_PASSWORD) return res.status(403).json({ error: 'Μη εξουσιοδοτημένο' });
  const { roomCode, participantId, mute } = req.body;
  if (roomCode) io.to(`room-${roomCode}`).emit('admin-mute', { participantId, mute });
  res.json({ ok: true });
});

app.get('/api/rooms/:roomId/participants', async (req, res) => {
  if (req.query.adminPassword !== ADMIN_PASSWORD) return res.status(403).json({ error: 'Μη εξουσιοδοτημένο' });
  if (!LIVEKIT_API_KEY) return res.json([]);
  try {
    const svc = new RoomServiceClient(LIVEKIT_URL.replace('wss', 'https').replace('ws', 'http'), LIVEKIT_API_KEY, LIVEKIT_API_SECRET);
    const room = db.getRoomById(req.params.roomId);
    if (!room) return res.json([]);
    const participants = await svc.listParticipants(room.id);
    res.json(participants.map((p) => ({ identity: p.identity, name: p.name })));
  } catch {
    res.json([]);
  }
});

// ============ Socket.IO ============
io.on('connection', (socket) => {
  socket.on('join-room', (roomCode) => {
    if (roomCode) socket.join(`room-${roomCode}`);
  });

  socket.on('admin-mute', ({ roomCode, participantId, mute }) => {
    if (roomCode) io.to(`room-${roomCode}`).emit('admin-mute', { participantId, mute });
  });

  socket.on('admin-alert', ({ roomCode, message }) => {
    if (roomCode) io.to(`room-${roomCode}`).emit('admin-alert', { message });
  });

  socket.on('admin-mute-all', ({ roomCode }) => {
    if (roomCode) io.to(`room-${roomCode}`).emit('admin-mute-all');
  });
});

// ============ Static frontend ============
const __dirname = dirname(fileURLToPath(import.meta.url));
app.use(express.static(join(__dirname, '../frontend/dist')));

app.get('*', (req, res) => {
  res.sendFile(join(__dirname, '../frontend/dist/index.html'));
});

http.listen(PORT, () => {
  console.log(`Server: http://localhost:${PORT}`);
  if (!LIVEKIT_API_KEY) console.warn('ΠΡΟΣΟΧΗ: Ορίστε LIVEKIT_API_KEY και LIVEKIT_API_SECRET στο .env');
});
