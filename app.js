const express = require('express');
const fs = require('fs');
const http = require('http');
const socketio = require('socket.io');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const app = express();
const server = http.createServer(app);
const io = socketio(server);
const PORT = 3000;

const SECRET = 'chat-secret';

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

let users = loadJSON('users.json');
let messages = loadJSON('messages.json');
let lastOnline = loadJSON('lastOnline.json');

// Load JSON helper
function loadJSON(path) {
  return fs.existsSync(path) ? JSON.parse(fs.readFileSync(path)) : {};
}

function saveJSON(path, data) {
  fs.writeFileSync(path, JSON.stringify(data, null, 2));
}

// Signup
app.post('/signup', async (req, res) => {
  const { username, password } = req.body;
  if (Object.keys(users).length >= 2 || users[username]) return res.status(400).json({ msg: 'Hanya 2 user diizinkan atau nama sudah ada' });
  const hashed = await bcrypt.hash(password, 10);
  users[username] = { password: hashed };
  saveJSON('users.json', users);
  res.json({ msg: 'Akun dibuat' });
});

// Login
app.post('/login', async (req, res) => {
  const { username, password } = req.body;
  const user = users[username];
  if (!user || !(await bcrypt.compare(password, user.password))) return res.status(401).json({ msg: 'Login gagal' });
  const token = jwt.sign({ username }, SECRET, { expiresIn: '1d' });
  res.json({ token });
});

// Auth Middleware
function auth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.sendStatus(401);
  try {
    const payload = jwt.verify(authHeader.split(' ')[1], SECRET);
    req.user = payload;
    next();
  } catch {
    res.sendStatus(401);
  }
}

// Dapatkan pesan
app.get('/messages', auth, (req, res) => {
  const now = Date.now();
  messages = messages.filter(m => now - m.timestamp < 86400000); // 24 jam
  saveJSON('messages.json', messages);
  res.json(messages);
});

// Hapus semua pesan
app.delete('/messages', auth, (req, res) => {
  messages = [];
  saveJSON('messages.json', messages);
  res.json({ msg: 'Semua pesan dihapus' });
});

// Status online
io.on('connection', (socket) => {
  let username = null;

  socket.on('login', (user) => {
    username = user;
    socket.broadcast.emit('status', { user: username, online: true });
  });

  socket.on('message', (msg) => {
    const data = {
      user: msg.user,
      text: msg.text,
      timestamp: Date.now()
    };
    messages.push(data);
    saveJSON('messages.json', messages);
    io.emit('message', data);
  });

  socket.on('disconnect', () => {
    if (username) {
      lastOnline[username] = Date.now();
      saveJSON('lastOnline.json', lastOnline);
      socket.broadcast.emit('status', { user: username, online: false, lastOnline: lastOnline[username] });
    }
  });
});

app.get('/status', (req, res) => {
  res.json(lastOnline);
});

server.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
