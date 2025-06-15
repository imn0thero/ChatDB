const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);
const path = require('path');
const mysql = require('mysql');
const bcrypt = require('bcrypt');
const { v4: uuidv4 } = require('uuid');

const PORT = process.env.PORT || 3000;
const SALT_ROUNDS = 10;

// Koneksi database MySQL
const db = mysql.createConnection({
  host: 'localhost', // ubah sesuai config DomCloud
  user: 'username',  // ganti sesuai database
  password: 'password',
  database: 'dbname'
});

db.connect(err => {
  if (err) {
    console.error('Gagal konek ke database:', err);
    process.exit(1);
  }
  console.log('Terhubung ke database');
});

// Middleware
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

let onlineUsers = {};

// Hapus pesan lebih dari 24 jam setiap menit
setInterval(() => {
  const satuHariLalu = Date.now() - 24 * 60 * 60 * 1000;
  db.query('DELETE FROM messages WHERE time < ?', [satuHariLalu]);
}, 60 * 1000);

// Socket.IO
io.on('connection', socket => {
  let currentUser = null;

  // SIGNUP
  socket.on('signup', data => {
    if (!data.username || !data.password) {
      socket.emit('signupResult', { success: false, message: 'Username dan password wajib diisi' });
      return;
    }

    bcrypt.hash(data.password, SALT_ROUNDS, (err, hash) => {
      if (err) {
        console.error(err);
        socket.emit('signupResult', { success: false, message: 'Kesalahan server' });
        return;
      }

      db.query('INSERT INTO users (username, password) VALUES (?, ?)', [data.username, hash], (err) => {
        if (err) {
          if (err.code === 'ER_DUP_ENTRY') {
            socket.emit('signupResult', { success: false, message: 'Username sudah dipakai' });
          } else {
            console.error(err);
            socket.emit('signupResult', { success: false, message: 'Gagal menyimpan user' });
          }
          return;
        }

        socket.emit('signupResult', { success: true });
      });
    });
  });

  // LOGIN
  socket.on('login', data => {
    if (!data.username || !data.password) {
      socket.emit('loginResult', { success: false, message: 'Username dan password wajib diisi' });
      return;
    }

    db.query('SELECT * FROM users WHERE username = ?', [data.username], (err, results) => {
      if (err) {
        console.error(err);
        socket.emit('loginResult', { success: false, message: 'Kesalahan server' });
        return;
      }

      if (results.length === 0) {
        socket.emit('loginResult', { success: false, message: 'Username tidak ditemukan' });
        return;
      }

      const user = results[0];
      bcrypt.compare(data.password, user.password, (err, result) => {
        if (err || !result) {
          socket.emit('loginResult', { success: false, message: 'Password salah' });
          return;
        }

        currentUser = data.username;
        onlineUsers[currentUser] = true;

        // Ambil semua pesan dari database
        db.query('SELECT * FROM messages ORDER BY time ASC', (err, msgResults) => {
          if (err) {
            console.error(err);
            socket.emit('loginResult', { success: false, message: 'Gagal memuat pesan' });
            return;
          }

          socket.emit('loginResult', { success: true, user: currentUser, messages: msgResults });
          io.emit('userList', Object.keys(onlineUsers));
        });
      });
    });
  });

  // KIRIM PESAN
  socket.on('message', data => {
    if (!currentUser || !data.text || data.text.trim() === "") return;

    const messageData = {
      id: uuidv4(),
      user: currentUser,
      text: data.text.trim(),
      time: Date.now()
    };

    db.query('INSERT INTO messages (id, user, text, time) VALUES (?, ?, ?, ?)', 
      [messageData.id, messageData.user, messageData.text, messageData.time], (err) => {
        if (err) {
          console.error('Gagal menyimpan pesan:', err);
          return;
        }

        io.emit('message', messageData);
    });
  });

  // LOGOUT
  socket.on('logout', () => {
    if (currentUser) {
      delete onlineUsers[currentUser];
      io.emit('userList', Object.keys(onlineUsers));
      currentUser = null;
    }
  });

  // DISCONNECT
  socket.on('disconnect', () => {
    if (currentUser) {
      delete onlineUsers[currentUser];
      io.emit('userList', Object.keys(onlineUsers));
      currentUser = null;
    }
  });
});

http.listen(PORT, () => {
  console.log(`Server berjalan di port ${PORT}`);
});
