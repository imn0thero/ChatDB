const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcrypt');
const session = require('express-session');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));
app.use(session({
    secret: 'your-secret-key',
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false }
}));

// Data files
const USERS_FILE = 'users.json';
const MESSAGES_FILE = 'messages.json';

// Initialize data files
function initializeDataFiles() {
    if (!fs.existsSync(USERS_FILE)) {
        fs.writeFileSync(USERS_FILE, JSON.stringify([]));
    }
    if (!fs.existsSync(MESSAGES_FILE)) {
        fs.writeFileSync(MESSAGES_FILE, JSON.stringify([]));
    }
}

// Helper functions
function readUsers() {
    try {
        return JSON.parse(fs.readFileSync(USERS_FILE, 'utf8'));
    } catch (error) {
        return [];
    }
}

function writeUsers(users) {
    fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
}

function readMessages() {
    try {
        return JSON.parse(fs.readFileSync(MESSAGES_FILE, 'utf8'));
    } catch (error) {
        return [];
    }
}

function writeMessages(messages) {
    fs.writeFileSync(MESSAGES_FILE, JSON.stringify(messages, null, 2));
}

// Auto delete messages after 24 hours
function cleanupOldMessages() {
    const messages = readMessages();
    const now = Date.now();
    const filteredMessages = messages.filter(msg => {
        return (now - msg.timestamp) < (24 * 60 * 60 * 1000); // 24 hours
    });
    writeMessages(filteredMessages);
}

// Clean up old messages every hour
setInterval(cleanupOldMessages, 60 * 60 * 1000);

// Initialize
initializeDataFiles();

// Routes
app.get('/', (req, res) => {
    if (req.session.userId) {
        res.sendFile(path.join(__dirname, 'public', 'chat.html'));
    } else {
        res.redirect('/login');
    }
});

app.get('/login', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

app.get('/signup', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'signup.html'));
});

// Authentication endpoints
app.post('/signup', async (req, res) => {
    const { username, password } = req.body;
    const users = readUsers();
    
    if (users.find(u => u.username === username)) {
        return res.status(400).json({ error: 'Username already exists' });
    }
    
    if (users.length >= 2) {
        return res.status(400).json({ error: 'Maximum 2 users allowed' });
    }
    
    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = {
        id: Date.now().toString(),
        username,
        password: hashedPassword,
        isOnline: false,
        lastSeen: null
    };
    
    users.push(newUser);
    writeUsers(users);
    
    res.json({ success: true });
});

app.post('/login', async (req, res) => {
    const { username, password } = req.body;
    const users = readUsers();
    
    const user = users.find(u => u.username === username);
    if (!user || !await bcrypt.compare(password, user.password)) {
        return res.status(400).json({ error: 'Invalid credentials' });
    }
    
    req.session.userId = user.id;
    req.session.username = user.username;
    
    // Update user online status
    user.isOnline = true;
    user.lastSeen = Date.now();
    writeUsers(users);
    
    res.json({ success: true });
});

app.post('/logout', (req, res) => {
    if (req.session.userId) {
        const users = readUsers();
        const user = users.find(u => u.id === req.session.userId);
        if (user) {
            user.isOnline = false;
            user.lastSeen = Date.now();
            writeUsers(users);
        }
    }
    
    req.session.destroy();
    res.json({ success: true });
});

// Chat endpoints
app.get('/api/messages', (req, res) => {
    if (!req.session.userId) {
        return res.status(401).json({ error: 'Not authenticated' });
    }
    
    cleanupOldMessages();
    const messages = readMessages();
    res.json(messages);
});

app.delete('/api/messages', (req, res) => {
    if (!req.session.userId) {
        return res.status(401).json({ error: 'Not authenticated' });
    }
    
    writeMessages([]);
    io.emit('messagesCleared');
    res.json({ success: true });
});

app.get('/api/users', (req, res) => {
    if (!req.session.userId) {
        return res.status(401).json({ error: 'Not authenticated' });
    }
    
    const users = readUsers();
    const safeUsers = users.map(u => ({
        id: u.id,
        username: u.username,
        isOnline: u.isOnline,
        lastSeen: u.lastSeen
    }));
    
    res.json(safeUsers);
});

app.get('/api/current-user', (req, res) => {
    if (!req.session.userId) {
        return res.status(401).json({ error: 'Not authenticated' });
    }
    
    res.json({
        id: req.session.userId,
        username: req.session.username
    });
});

// Socket.io connection handling
io.on('connection', (socket) => {
    console.log('User connected');
    
    socket.on('join', (userData) => {
        socket.userId = userData.userId;
        socket.username = userData.username;
        
        // Update user online status
        const users = readUsers();
        const user = users.find(u => u.id === userData.userId);
        if (user) {
            user.isOnline = true;
            user.lastSeen = Date.now();
            writeUsers(users);
        }
        
        // Broadcast user status
        io.emit('userStatusUpdate', {
            userId: userData.userId,
            isOnline: true,
            lastSeen: Date.now()
        });
    });
    
    socket.on('sendMessage', (messageData) => {
        const messages = readMessages();
        const newMessage = {
            id: Date.now().toString(),
            senderId: socket.userId,
            senderName: socket.username,
            message: messageData.message,
            timestamp: Date.now()
        };
        
        messages.push(newMessage);
        writeMessages(messages);
        
        io.emit('newMessage', newMessage);
    });
    
    socket.on('disconnect', () => {
        console.log('User disconnected');
        
        if (socket.userId) {
            // Update user offline status
            const users = readUsers();
            const user = users.find(u => u.id === socket.userId);
            if (user) {
                user.isOnline = false;
                user.lastSeen = Date.now();
                writeUsers(users);
            }
            
            // Broadcast user status
            io.emit('userStatusUpdate', {
                userId: socket.userId,
                isOnline: false,
                lastSeen: Date.now()
            });
        }
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
