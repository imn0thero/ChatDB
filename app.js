const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const fs = require('fs').promises;
const path = require('path');
const bcrypt = require('bcrypt');
const session = require('express-session');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));
app.use(session({
    secret: 'private-chat-secret-key',
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false }
}));

const DATA_FILE = 'chat_data.json';

// Initialize data structure
const initData = {
    users: {},
    messages: []
};

// Load data from JSON file
async function loadData() {
    try {
        const data = await fs.readFile(DATA_FILE, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        await saveData(initData);
        return initData;
    }
}

// Save data to JSON file
async function saveData(data) {
    await fs.writeFile(DATA_FILE, JSON.stringify(data, null, 2));
}

// Clean messages older than 24 hours
async function cleanOldMessages() {
    const data = await loadData();
    const twentyFourHoursAgo = Date.now() - (24 * 60 * 60 * 1000);
    data.messages = data.messages.filter(msg => msg.timestamp > twentyFourHoursAgo);
    await saveData(data);
}

// Run cleanup every hour
setInterval(cleanOldMessages, 60 * 60 * 1000);

// Authentication middleware
function requireAuth(req, res, next) {
    if (req.session.userId) {
        next();
    } else {
        res.redirect('/login');
    }
}

// Routes
app.get('/', requireAuth, (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'chat.html'));
});

app.get('/login', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

app.get('/signup', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'signup.html'));
});

// API Routes
app.post('/api/signup', async (req, res) => {
    try {
        const { username, password } = req.body;
        const data = await loadData();

        if (data.users[username]) {
            return res.json({ success: false, message: 'Username sudah digunakan' });
        }

        if (Object.keys(data.users).length >= 2) {
            return res.json({ success: false, message: 'Maksimal hanya 2 pengguna yang diizinkan' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        data.users[username] = {
            password: hashedPassword,
            isOnline: false,
            lastSeen: Date.now()
        };

        await saveData(data);
        res.json({ success: true, message: 'Akun berhasil dibuat' });
    } catch (error) {
        res.json({ success: false, message: 'Terjadi kesalahan' });
    }
});

app.post('/api/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        const data = await loadData();

        if (!data.users[username]) {
            return res.json({ success: false, message: 'Username tidak ditemukan' });
        }

        const isValid = await bcrypt.compare(password, data.users[username].password);
        if (isValid) {
            req.session.userId = username;
            data.users[username].isOnline = true;
            data.users[username].lastSeen = Date.now();
            await saveData(data);
            res.json({ success: true });
        } else {
            res.json({ success: false, message: 'Password salah' });
        }
    } catch (error) {
        res.json({ success: false, message: 'Terjadi kesalahan' });
    }
});

app.post('/api/logout', async (req, res) => {
    if (req.session.userId) {
        const data = await loadData();
        data.users[req.session.userId].isOnline = false;
        data.users[req.session.userId].lastSeen = Date.now();
        await saveData(data);
        req.session.destroy();
    }
    res.json({ success: true });
});

app.get('/api/user', requireAuth, async (req, res) => {
    const data = await loadData();
    const currentUser = req.session.userId;
    const otherUser = Object.keys(data.users).find(u => u !== currentUser);
    
    res.json({
        currentUser,
        otherUser: otherUser ? {
            username: otherUser,
            isOnline: data.users[otherUser].isOnline,
            lastSeen: data.users[otherUser].lastSeen
        } : null
    });
});

app.get('/api/messages', requireAuth, async (req, res) => {
    const data = await loadData();
    res.json(data.messages);
});

app.delete('/api/messages', requireAuth, async (req, res) => {
    const data = await loadData();
    data.messages = [];
    await saveData(data);
    res.json({ success: true });
});

// Socket.IO
io.on('connection', async (socket) => {
    socket.on('join', async (username) => {
        socket.username = username;
        const data = await loadData();
        data.users[username].isOnline = true;
        data.users[username].lastSeen = Date.now();
        await saveData(data);
        
        socket.broadcast.emit('userStatusChanged', {
            username,
            isOnline: true,
            lastSeen: Date.now()
        });
    });

    socket.on('sendMessage', async (messageData) => {
        const data = await loadData();
        const message = {
            id: Date.now() + Math.random(),
            sender: messageData.sender,
            text: messageData.text,
            timestamp: Date.now()
        };
        
        data.messages.push(message);
        await saveData(data);
        
        io.emit('newMessage', message);
    });

    socket.on('disconnect', async () => {
        if (socket.username) {
            const data = await loadData();
            data.users[socket.username].isOnline = false;
            data.users[socket.username].lastSeen = Date.now();
            await saveData(data);
            
            socket.broadcast.emit('userStatusChanged', {
                username: socket.username,
                isOnline: false,
                lastSeen: Date.now()
            });
        }
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server berjalan di port ${PORT}`);
});

// Initial cleanup
cleanOldMessages();
