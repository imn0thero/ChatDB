const express = require('express');
const app = express();
const http = require('http').createServer(app);
const session = require('express-session');
const io = require('socket.io')(http);
const bodyParser = require('body-parser');
const multer = require('multer');
const fs = require('fs');
const path = require('path');

const users = {
  user1: 'password1',
  user2: 'password2'
};

const messages = [];

const onlineUsers = {};

app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static('public'));
app.use('/uploads', express.static('uploads'));

app.use(session({
  secret: 'rahasia',
  resave: false,
  saveUninitialized: false
}));

const upload = multer({ dest: 'uploads/' });

function isAuthenticated(req, res, next) {
  if (req.session.user) return next();
  return res.redirect('/');
}

app.get('/', (req, res) => {
  res.sendFile(__dirname + '/public/index.html');
});

app.post('/login', (req, res) => {
  const { username, password } = req.body;
  if (users[username] && users[username] === password) {
    req.session.user = username;
    return res.redirect('/chat');
  }
  return res.redirect('/?error=1');
});

app.get('/chat', isAuthenticated, (req, res) => {
  res.sendFile(__dirname + '/public/chat.html');
});

app.get('/logout', (req, res) => {
  req.session.destroy(() => res.redirect('/'));
});

// Auto-delete messages older than 7 days
setInterval(() => {
  const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].timestamp < weekAgo) {
      if (messages[i].file) {
        fs.unlink(path.join(__dirname, messages[i].file), () => {});
      }
      messages.splice(i, 1);
    }
  }
}, 60 * 1000); // cek tiap 1 menit

io.on('connection', (socket) => {
  let user = null;

  socket.on('login', (username) => {
    user = username;
    onlineUsers[username] = true;
    io.emit('user-status', onlineUsers);
    socket.emit('load-messages', messages);
  });

  socket.on('message', (msg) => {
    const message = {
      id: Date.now(),
      from: user,
      text: msg.text,
      file: msg.file || null,
      read: false,
      timestamp: Date.now()
    };
    messages.push(message);
    io.emit('message', message);
  });

  socket.on('edit-message', ({ id, text }) => {
    const msg = messages.find(m => m.id === id && m.from === user);
    if (msg) {
      msg.text = text + ' (edited)';
      io.emit('update-message', msg);
    }
  });

  socket.on('delete-message', (id) => {
    const index = messages.findIndex(m => m.id === id && m.from === user);
    if (index !== -1) {
      if (messages[index].file) fs.unlink(path.join(__dirname, messages[index].file), () => {});
      messages.splice(index, 1);
      io.emit('delete-message', id);
    }
  });

  socket.on('mark-read', (id) => {
    const msg = messages.find(m => m.id === id);
    if (msg) {
      msg.read = true;
      io.emit('update-message', msg);
    }
  });

  socket.on('disconnect', () => {
    if (user) {
      delete onlineUsers[user];
      io.emit('user-status', onlineUsers);
    }
  });
});
http.listen(process.env.PORT || 3000, () => {
  console.log('Server jalan...');
});
