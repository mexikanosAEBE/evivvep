import { readFileSync, writeFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const DB_PATH = join(__dirname, 'data.json');

function load() {
  if (!existsSync(DB_PATH)) return { users: [], rooms: [], polls: [] };
  try {
    return JSON.parse(readFileSync(DB_PATH, 'utf-8'));
  } catch {
    return { users: [], rooms: [], polls: [] };
  }
}

function save(data) {
  writeFileSync(DB_PATH, JSON.stringify(data, null, 2), 'utf-8');
}

const db = {
  getUsers() {
    return load().users;
  },
  getUserById(id) {
    return load().users.find((u) => u.id === id) || null;
  },
  getUserByJoinCode(joinCode) {
    return load().users.find((u) => u.join_code === joinCode) || null;
  },
  addUser(user) {
    const data = load();
    data.users.push({ ...user, created_at: Date.now() });
    save(data);
  },
  updateUser(id, updates) {
    const data = load();
    const idx = data.users.findIndex((u) => u.id === id);
    if (idx === -1) return null;
    Object.assign(data.users[idx], updates);
    save(data);
    return data.users[idx];
  },
  deleteUser(id) {
    const data = load();
    data.users = data.users.filter((u) => u.id !== id);
    save(data);
  },

  getRooms() {
    return load().rooms;
  },
  getRoomByCode(code) {
    return load().rooms.find((r) => r.code === code) || null;
  },
  getRoomById(id) {
    return load().rooms.find((r) => r.id === id) || null;
  },
  addRoom(room) {
    const data = load();
    data.rooms.push({ ...room, created_at: Date.now() });
    save(data);
  },
  deleteRoom(code) {
    const data = load();
    data.rooms = data.rooms.filter((r) => r.code !== code);
    data.users.forEach((u) => {
      if (u.room_code === code) u.room_code = null;
    });
    save(data);
  },

  addPoll(poll) {
    const data = load();
    data.polls.push({ ...poll, votes: {}, created_at: Date.now() });
    save(data);
  },
  votePoll(pollId, participantId, optionIndex) {
    const data = load();
    const poll = data.polls.find((p) => p.id === pollId);
    if (!poll) return null;
    if (!poll.votes) poll.votes = {};
    poll.votes[participantId] = optionIndex;
    save(data);
    return poll;
  },
  getPollsByRoom(roomCode) {
    return load().polls.filter((p) => p.room_code === roomCode);
  },
};

export default db;
