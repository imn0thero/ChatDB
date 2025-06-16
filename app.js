const express = require('express');
const fs = require('fs');
const path = require('path');
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');
const { v4: uuidv4 } = require('uuid');

const app = express();
const PORT = 3000;

app.use(express.static('public'));
app.use(bodyParser.json());
app.use(cookieParser());

// Fungsi baca/tulis JSON
function readJSON(file) {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function writeJSON(file, data) {
    fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

// Middleware autentikasi
function isAuthenticated(req, res, next) {
    const userId = req.cookies.userId;
    if (!userId) return res.redirect('/login.html');
    const users = readJSON('users.json');
    const user = users.find(u => u.id === userId);
    if (!user) return res.redirect('/login.html');
    req.user = user;
    next();
}

// API Login
app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    const users = readJSON('users.json');
    const user = users.find(u => u.username === username && u.password === password);

    if (!user) return res.status(400).send({ error: 'Invalid credentials' });

    res.cookie('userId', user.id, { maxAge: 900000 });
    res.send({ success: true });
});

// API Signup
app.post('/api/signup', (req, res) => {
    const { username, password } = req.body;
    let users = readJSON('users.json');

    if (users.some(u => u.username === username)) {
        return res.status(400).send({ error: 'Username already exists' });
    }

    const newUser = {
        id: uuidv4(),
        username,
        password,
        online: false,
        lastOnline: new Date().toISOString()
    };

    users.push(newUser);
    writeJSON('users.json', users);

    res.cookie('userId', newUser.id, { maxAge: 900000 });
    res.send({ success: true });
});

// API Logout
app.get('/api/logout', (req, res) => {
    const userId = req.cookies.userId;
    let users = readJSON('users.json');
    users = users.map(u =>
        u.id === userId ? { ...u, online: false, lastOnline: new Date().toISOString() } : u
    );
    writeJSON('users.json', users);
    res.clearCookie('userId');
    res.redirect('/login.html');
});

// API Get User Info
app.get('/api/user', isAuthenticated, (req, res) => {
    const users = readJSON('users.json').filter(u => u.id !== req.user.id);
    res.send(users[0]);
});

// API Update Online Status
app.post('/api/online', isAuthenticated, (req, res) => {
    const userId = req.user.id;
    let users = readJSON('users.json');
    users = users.map(u =>
        u.id === userId ? { ...u, online: true } : u
    );
    writeJSON('users.json', users);
    res.send({ success: true });
});

// API Get Messages
app.get('/api/messages', isAuthenticated, (req, res) => {
    const messages = readJSON('messages.json');
    res.send(messages);
});

// API Send Message
app.post('/api/send', isAuthenticated, (req, res) => {
    const { text } = req.body;
    const message = {
        id: uuidv4(),
        sender: req.user.id,
        text,
        timestamp: new Date().toISOString()
    };
    let messages = readJSON('messages.json');
    messages.push(message);
    writeJSON('messages.json', messages);
    res.send({ success: true });
});

// API Delete All Messages
app.post('/api/delete-all', isAuthenticated, (req, res) => {
    writeJSON('messages.json', []);
    res.send({ success: true });
});

// Jalankan server
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});

// Bersihkan pesan lebih dari 24 jam
setInterval(() => {
    let messages = readJSON('messages.json');
    const now = new Date();
    messages = messages.filter(m => {
        const msgTime = new Date(m.timestamp);
        return (now - msgTime) < 24 * 60 * 60 * 1000; // 24 jam
    });
    writeJSON('messages.json', messages);
}, 60 * 60 * 1000); // Setiap 1 jam cek
