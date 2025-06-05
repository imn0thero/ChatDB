const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);
const path = require('path');

app.use(express.static(path.join(__dirname, 'public')));

const PORT = process.env.PORT || 3000;

const users = {
  user1: 'pass1',
  user2: 'pass2'
};

let onlineUsers = {};
let messages = [];

setInterval(() => {
  const now = Date.now();
  messages = messages.filter(m => now - m.time < 7 * 24 * 60 * 60 * 1000); // 7 hari
}, 60 * 1000); // tiap 1 menit

io.on('connection', socket => {
  let currentUser = null;

  socket.on('login', data => {
    if (users[data.username] && users[data.username] === data.password) {
      currentUser = data.username;
      onlineUsers[currentUser] = true;
      socket.emit('loginResult', { success: true, user: currentUser });
      io.emit('userStatus', true);
      socket.emit('loadMessages', messages);
    } else {
      socket.emit('loginResult', { success: false, message: 'Login gagal' });
    }
  });

  socket.on('chatMessage', msg => {
    const full = { ...msg, time: Date.now() };
    messages.push(full);
    io.emit('chatMessage', full);
  });

  socket.on('mediaMessage', file => {
    const media = {
      user: file.user,
      type: file.type,
      data: file.data,
      name: file.name,
      time: Date.now()
    };
    messages.push(media);
    io.emit('mediaMessage', media);
  });

  socket.on('disconnect', () => {
    if (currentUser) {
      delete onlineUsers[currentUser];
      io.emit('userStatus', false);
    }
  });
});

http.listen(PORT, () => console.log('Server jalan di port', PORT));
