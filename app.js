const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);
const path = require('path');
const { v4: uuidv4 } = require('uuid');

app.use(express.static(path.join(__dirname, 'public')));

const PORT = process.env.PORT || 3000;

// Auth user sederhana
const users = {
  user1: 'pass1',
  user2: 'pass2'
};

let onlineUsers = {};
let messages = [];

// Hapus otomatis pesan > 24 jam setiap menit
setInterval(() => {
  const now = Date.now();
  messages = messages.filter(m => now - m.time < 24 * 60 * 60 * 1000); // 24 jam
}, 60 * 1000);

io.on('connection', socket => {
  let currentUser = null;

  // Proses login
  socket.on('login', data => {
    if (users[data.username] && users[data.username] === data.password) {
      currentUser = data.username;
      onlineUsers[currentUser] = true;

      socket.emit('loginResult', { success: true, user: currentUser });
      io.emit('userList', Object.keys(onlineUsers));
      socket.emit('loadMessages', messages);
    } else {
      socket.emit('loginResult', { success: false, message: 'Login gagal' });
    }
  });

  // Kirim pesan teks
  socket.on('chatMessage', msg => {
    const message = {
      id: uuidv4(),
      user: currentUser,
      text: msg.text,
      time: Date.now()
    };
    messages.push(message);
    io.emit('chatMessage', message);
  });

  // Edit pesan
  socket.on('editMessage', data => {
    const msg = messages.find(m => m.id === data.id && m.user === currentUser);
    if (msg) {
      msg.text = data.text;
      io.emit('messageEdited', { id: msg.id, text: msg.text });
    }
  });

  // Hapus pesan
  socket.on('deleteMessage', id => {
    const index = messages.findIndex(m => m.id === id && m.user === currentUser);
    if (index !== -1) {
      messages.splice(index, 1);
      io.emit('messageDeleted', id);
    }
  });

  // Kirim media
  socket.on('mediaMessage', file => {
    const media = {
      id: uuidv4(),
      user: currentUser,
      type: file.type,
      data: file.data,
      name: file.name,
      time: Date.now()
    };
    messages.push(media);
    io.emit('mediaMessage', media);
  });

  // Logout / Disconnect
  socket.on('logout', () => {
    if (currentUser) {
      delete onlineUsers[currentUser];
      io.emit('userList', Object.keys(onlineUsers));
    }
    socket.disconnect();
  });

  socket.on('disconnect', () => {
    if (currentUser) {
      delete onlineUsers[currentUser];
      io.emit('userList', Object.keys(onlineUsers));
    }
  });
});

http.listen(PORT, () => console.log('Server jalan di port', PORT));
