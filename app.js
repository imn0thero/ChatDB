const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const db = require('./db');
const bcrypt = require('bcrypt');
const SALT_ROUNDS = 10;


const PORT = process.env.PORT || 3000;
const onlineUsers = {};

// Middleware
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

// Fungsi bantu
function signupUser(username, password, callback) {
  const query = 'INSERT INTO users (username, password) VALUES (?, ?)';
  db.query(query, [username, password], (err, result) => {
    if (err) return callback(err);
    callback(null);
  });
}

function loginUser(username, password, callback) {
  const query = 'SELECT * FROM users WHERE username = ? AND password = ?';
  db.query(query, [username, password], (err, results) => {
    if (err) return callback(err);
    callback(null, results.length > 0);
  });
}

function loadMessages(callback) {
  const query = 'SELECT * FROM messages ORDER BY time ASC';
  db.query(query, (err, results) => {
    if (err) return callback(err, []);
    callback(null, results);
  });
}

function saveMessage(messageData, callback) {
  const { id, user, text, time } = messageData;
  const query = 'INSERT INTO messages (id, user, text, time) VALUES (?, ?, ?, ?)';
  db.query(query, [id, user, text, time], callback);
}

// Hapus pesan lama setiap menit
setInterval(() => {
  const timeLimit = Date.now() - 24 * 60 * 60 * 1000;
  db.query('DELETE FROM messages WHERE time < ?', [timeLimit]);
}, 60 * 1000);

// Socket.IO
io.on('connection', socket => {
  let currentUser = null;

  socket.on('signup', data => {
    if (!data.username || !data.password) {
      socket.emit('signupResult', { success: false, message: 'Username dan password wajib diisi' });
      return;
    }

    // Cek apakah username sudah digunakan
    db.query('SELECT * FROM users WHERE username = ?', [data.username], (err, results) => {
      if (err) {
        socket.emit('signupResult', { success: false, message: 'Terjadi kesalahan server' });
        return;
      }

      if (results.length > 0) {
        socket.emit('signupResult', { success: false, message: 'Username sudah dipakai' });
      } else {
        signupUser(data.username, data.password, err => {
          if (err) {
            socket.emit('signupResult', { success: false, message: 'Gagal mendaftar' });
          } else {
            socket.emit('signupResult', { success: true });
          }
        });
      }
    });
  });

  socket.on('login', data => {
    if (!data.username || !data.password) {
      socket.emit('loginResult', { success: false, message: 'Username dan password wajib diisi' });
      return;
    }

    loginUser(data.username, data.password, (err, success) => {
      if (err || !success) {
        socket.emit('loginResult', { success: false, message: 'Username atau password salah' });
      } else {
        currentUser = data.username;
        onlineUsers[currentUser] = true;

        loadMessages((err, msgs) => {
          if (err) {
            socket.emit('loginResult', { success: false, message: 'Gagal memuat pesan' });
          } else {
            socket.emit('loginResult', { success: true, user: currentUser, messages: msgs });
            io.emit('userList', Object.keys(onlineUsers));
          }
        });
      }
    });
  });

  socket.on('message', data => {
    if (!currentUser || !data.text || data.text.trim() === '') return;

    const messageData = {
      id: uuidv4(),
      user: currentUser,
      text: data.text.trim(),
      time: Date.now()
    };

    saveMessage(messageData, err => {
      if (!err) {
        io.emit('message', messageData);
      }
    });
  });

  socket.on('logout', () => {
    if (currentUser) {
      delete onlineUsers[currentUser];
      io.emit('userList', Object.keys(onlineUsers));
      currentUser = null;
    }
  });

  socket.on('disconnect', () => {
    if (currentUser) {
      delete onlineUsers[currentUser];
      io.emit('userList', Object.keys(onlineUsers));
      currentUser = null;
    }
  });
});

http.listen(PORT, () => {
  console.log(`🚀 Server berjalan di port ${PORT}`);
});
