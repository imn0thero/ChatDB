const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcrypt');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// Middleware
app.use(express.json());
app.use(express.static('public'));

// File paths untuk JSON storage
const USERS_FILE = path.join(__dirname, 'data', 'users.json');
const MESSAGES_FILE = path.join(__dirname, 'data', 'messages.json');

// Pastikan folder data exists
if (!fs.existsSync(path.join(__dirname, 'data'))) {
    fs.mkdirSync(path.join(__dirname, 'data'));
}

// Helper functions untuk read/write JSON
function readJSON(filePath, defaultValue = []) {
    try {
        if (fs.existsSync(filePath)) {
            const data = fs.readFileSync(filePath, 'utf8');
            return JSON.parse(data);
        }
        return defaultValue;
    } catch (error) {
        console.error('Error reading JSON:', error);
        return defaultValue;
    }
}

function writeJSON(filePath, data) {
    try {
        fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
        return true;
    } catch (error) {
        console.error('Error writing JSON:', error);
        return false;
    }
}

// Load initial data
let users = readJSON(USERS_FILE, []);
let messages = readJSON(MESSAGES_FILE, []);

// Fungsi untuk hapus pesan otomatis setelah 24 jam
function autoDeleteMessages() {
    const now = new Date();
    const cutoffTime = now.getTime() - (24 * 60 * 60 * 1000); // 24 jam yang lalu
    
    const originalLength = messages.length;
    messages = messages.filter(message => {
        return new Date(message.timestamp).getTime() > cutoffTime;
    });
    
    if (messages.length !== originalLength) {
        writeJSON(MESSAGES_FILE, messages);
        console.log(`Auto-deleted ${originalLength - messages.length} old messages`);
        io.emit('messagesUpdated', messages);
    }
}

// Jalankan auto delete setiap 1 jam
setInterval(autoDeleteMessages, 60 * 60 * 1000);

// Jalankan auto delete saat server start
autoDeleteMessages();

// Routes
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

app.get('/chat', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'chat.html'));
});

// Register endpoint
app.post('/register', async (req, res) => {
    const { username, password } = req.body;
    
    if (!username || !password) {
        return res.status(400).json({ error: 'Username dan password diperlukan' });
    }
    
    // Batasi hanya 2 user
    if (users.length >= 2) {
        return res.status(400).json({ error: 'Maksimal hanya 2 user yang diperbolehkan' });
    }
    
    // Cek apakah username sudah ada
    if (users.find(user => user.username === username)) {
        return res.status(400).json({ error: 'Username sudah digunakan' });
    }
    
    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        const newUser = {
            id: Date.now().toString(),
            username,
            password: hashedPassword,
            isOnline: false,
            lastSeen: new Date().toISOString()
        };
        
        users.push(newUser);
        writeJSON(USERS_FILE, users);
        
        res.json({ success: true, message: 'User berhasil didaftarkan' });
    } catch (error) {
        res.status(500).json({ error: 'Gagal mendaftarkan user' });
    }
});

// Login endpoint
app.post('/login', async (req, res) => {
    const { username, password } = req.body;
    
    const user = users.find(u => u.username === username);
    if (!user) {
        return res.status(400).json({ error: 'Username tidak ditemukan' });
    }
    
    try {
        const isValidPassword = await bcrypt.compare(password, user.password);
        if (!isValidPassword) {
            return res.status(400).json({ error: 'Password salah' });
        }
        
        // Update status online
        user.isOnline = true;
        user.lastSeen = new Date().toISOString();
        writeJSON(USERS_FILE, users);
        
        res.json({ 
            success: true, 
            user: { 
                id: user.id, 
                username: user.username 
            } 
        });
    } catch (error) {
        res.status(500).json({ error: 'Gagal login' });
    }
});

// Get messages endpoint
app.get('/messages', (req, res) => {
    res.json(messages);
});

// Delete all messages endpoint
app.delete('/messages', (req, res) => {
    messages = [];
    writeJSON(MESSAGES_FILE, messages);
    io.emit('messagesCleared');
    res.json({ success: true });
});

// Get users status endpoint
app.get('/users-status', (req, res) => {
    const usersStatus = users.map(user => ({
        id: user.id,
        username: user.username,
        isOnline: user.isOnline,
        lastSeen: user.lastSeen
    }));
    res.json(usersStatus);
});

// Socket.IO connection handling
io.on('connection', (socket) => {
    console.log('User connected:', socket.id);
    
    // User join
    socket.on('userJoin', (userData) => {
        socket.userId = userData.id;
        socket.username = userData.username;
        
        // Update user status
        const user = users.find(u => u.id === userData.id);
        if (user) {
            user.isOnline = true;
            user.lastSeen = new Date().toISOString();
            writeJSON(USERS_FILE, users);
        }
        
        // Broadcast user status update
        io.emit('userStatusUpdate', {
            users: users.map(u => ({
                id: u.id,
                username: u.username,
                isOnline: u.isOnline,
                lastSeen: u.lastSeen
            }))
        });
        
        // Send existing messages
        socket.emit('loadMessages', messages);
    });
    
    // Handle new message
    socket.on('newMessage', (messageData) => {
        const message = {
            id: Date.now().toString(),
            userId: socket.userId,
            username: socket.username,
            text: messageData.text,
            timestamp: new Date().toISOString()
        };
        
        messages.push(message);
        writeJSON(MESSAGES_FILE, messages);
        
        // Broadcast to all clients
        io.emit('messageReceived', message);
    });
    
    // Handle disconnect
    socket.on('disconnect', () => {
        console.log('User disconnected:', socket.id);
        
        if (socket.userId) {
            const user = users.find(u => u.id === socket.userId);
            if (user) {
                user.isOnline = false;
                user.lastSeen = new Date().toISOString();
                writeJSON(USERS_FILE, users);
                
                // Broadcast user status update
                io.emit('userStatusUpdate', {
                    users: users.map(u => ({
                        id: u.id,
                        username: u.username,
                        isOnline: u.isOnline,
                        lastSeen: u.lastSeen
                    }))
                });
            }
        }
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Open http://localhost:${PORT} in your browser`);
});
