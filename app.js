const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const bodyParser = require('body-parser');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

const PORT = process.env.PORT || 3000;

// Data login manual
const users = {
  user1: 'pass1',
  user2: 'pass2'
};

// Simpan pesan dan pengguna online
let messages = [];
let onlineUsers = [];

// Middleware
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));

// Login endpoint
app.post('/login', (req, res) => {
  const { username, password } = req.body;
  if (users[username] && users[username] === password) {
    res.json({ success: true });
  } else {
    res.json({ success: false });
  }
});

// Socket.io
io.on('connection', socket => {
  let currentUser = null;

  // Kirim semua pesan saat user terhubung
  socket.emit('loadMessages', messages);

  socket.on('userOnline', username => {
    currentUser = username;
    if (!onlineUsers.includes(username)) {
      onlineUsers.push(username);
      io.emit('updateOnlineUsers', onlineUsers);
    }
  });

  socket.on('userOffline', username => {
    onlineUsers = onlineUsers.filter(user => user !== username);
    io.emit('updateOnlineUsers', onlineUsers);
  });

  socket.on('disconnect', () => {
    if (currentUser) {
      onlineUsers = onlineUsers.filter(user => user !== currentUser);
      io.emit('updateOnlineUsers', onlineUsers);
    }
  });

  socket.on('chatMessage', msg => {
    const newMsg = {
      user: msg.user,
      text: msg.text,
      time: Date.now()
    };
    messages.push(newMsg);
    io.emit('chatMessage', newMsg);
  });
});

// Hapus pesan lebih dari 7 hari
setInterval(() => {
  const now = Date.now();
  const sevenDays = 7 * 24 * 60 * 60 * 1000;
  messages = messages.filter(msg => now - msg.time < sevenDays);
}, 60 * 60 * 1000); // per jam

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
