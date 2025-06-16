// server.js

const express = require('express');
const http = require('http');
const path = require('path');
const { WebSocketServer } = require('ws');
const session = require('express-session');
const bcrypt = require('bcrypt');
const fs = require('fs').promises;

// --- Konfigurasi Awal ---
const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ noServer: true });

const PORT = process.env.PORT || 3000;
const USER_DATA_PATH = path.join(__dirname, 'data', 'users.json');
const MESSAGE_DATA_PATH = path.join(__dirname, 'data', 'messages.json');
const SALT_ROUNDS = 10;
const MAX_USERS = 2;

// --- Helper Functions untuk Data JSON ---
const readData = async (path) => {
    try {
        const data = await fs.readFile(path, 'utf-8');
        return JSON.parse(data);
    } catch (error) {
        if (error.code === 'ENOENT') return [];
        throw error;
    }
};

const writeData = async (path, data) => {
    await fs.writeFile(path, JSON.stringify(data, null, 2), 'utf-8');
};

// --- Konfigurasi Session ---
const sessionParser = session({
    secret: 'ganti-dengan-secret-key-yang-aman',
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 24 * 60 * 60 * 1000 } // 1 hari
});

// --- Middleware ---
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
app.use(sessionParser);

// --- Rute Otentikasi (HTTP) ---
app.post('/signup', async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) {
        return res.status(400).send('Username dan password dibutuhkan.');
    }

    const users = await readData(USER_DATA_PATH);
    if (users.length >= MAX_USERS) {
        return res.status(403).send('Pendaftaran sudah penuh, hanya untuk 2 pengguna.');
    }
    if (users.find(u => u.username === username)) {
        return res.status(409).send('Username sudah digunakan.');
    }

    const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);
    const newUser = {
        id: Date.now(),
        username,
        password: hashedPassword,
        isOnline: false,
        lastSeen: null
    };
    users.push(newUser);
    await writeData(USER_DATA_PATH, users);
    res.redirect('/login.html');
});

app.post('/login', async (req, res) => {
    const { username, password } = req.body;
    const users = await readData(USER_DATA_PATH);
    const user = users.find(u => u.username === username);

    if (user && await bcrypt.compare(password, user.password)) {
        req.session.userId = user.id;
        req.session.username = user.username;
        res.redirect('/');
    } else {
        res.status(401).send('Username atau password salah.');
    }
});

app.post('/logout', (req, res) => {
    req.session.destroy(() => {
        res.redirect('/login.html');
    });
});

app.get('/', (req, res) => {
    if (req.session.userId) {
        res.sendFile(path.join(__dirname, 'public', 'index.html'));
    } else {
        res.redirect('/login.html');
    }
});

// --- Logika WebSocket yang Diperbarui ---
const clients = new Map(); // Menyimpan koneksi: userId -> WebSocket instance

wss.on('connection', async (ws, req) => {
    const userId = req.session.userId;
    const username = req.session.username;
    if (!userId) {
        ws.close();
        return;
    }

    clients.set(userId, ws);
    console.log(`User ${username} connected.`);

    await updateUserStatus(userId, true);
    await broadcastUserStatus();

    // Kirim histori pesan ke user yang baru connect, dengan flag 'isMe'
    const messages = await readData(MESSAGE_DATA_PATH);
    const messagesWithMeFlag = messages.map(m => ({ ...m, isMe: m.userId === userId }));
    ws.send(JSON.stringify({ type: 'history', data: messagesWithMeFlag }));

    ws.on('message', async (message) => {
        const parsedMessage = JSON.parse(message);

        if (parsedMessage.type === 'chat') {
            const newMessage = {
                id: Date.now(),
                userId: userId,
                username: username,
                text: parsedMessage.text,
                timestamp: Date.now()
            };

            const messages = await readData(MESSAGE_DATA_PATH);
            messages.push(newMessage);
            await writeData(MESSAGE_DATA_PATH, messages);
            broadcastMessage(newMessage);
        }

        if (parsedMessage.type === 'delete_all') {
            await writeData(MESSAGE_DATA_PATH, []);
            for (const clientWs of clients.values()) {
                clientWs.send(JSON.stringify({ type: 'clear_chat' }));
            }
        }
    });

    ws.on('close', async () => {
        clients.delete(userId);
        console.log(`User ${username} disconnected.`);
        await updateUserStatus(userId, false, Date.now());
        await broadcastUserStatus();
    });
});

// --- Fungsi Helper WebSocket yang Diperbarui ---
const broadcastMessage = (message) => {
    for (const [id, clientWs] of clients.entries()) {
        if (clientWs.readyState === clientWs.OPEN) {
            const messageWithMeFlag = { ...message, isMe: message.userId === id };
            clientWs.send(JSON.stringify({ type: 'chat', data: messageWithMeFlag }));
        }
    }
};

const broadcastUserStatus = async () => {
    const users = await readData(USER_DATA_PATH);
    for (const [id, clientWs] of clients.entries()) {
        if (clientWs.readyState === clientWs.OPEN) {
            // Tambahkan flag 'isMe' dan hapus password sebelum mengirim
            const usersWithMeFlag = users.map(u => ({
                id: u.id,
                username: u.username,
                isOnline: u.isOnline,
                lastSeen: u.lastSeen,
                isMe: u.id === id
            }));
            clientWs.send(JSON.stringify({ type: 'status_update', data: usersWithMeFlag }));
        }
    }
};

const updateUserStatus = async (userId, isOnline, lastSeen = null) => {
    const users = await readData(USER_DATA_PATH);
    const userIndex = users.findIndex(u => u.id === userId);
    if (userIndex !== -1) {
        users[userIndex].isOnline = isOnline;
        if (!isOnline && lastSeen) {
            users[userIndex].lastSeen = lastSeen;
        }
        await writeData(USER_DATA_PATH, users);
    }
};

// --- Proses Otomatis Hapus Pesan Lama ---
const cleanupOldMessages = async () => {
    console.log('Menjalankan proses pembersihan pesan lama...');
    const messages = await readData(MESSAGE_DATA_PATH);
    const twentyFourHoursAgo = Date.now() - (24 * 60 * 60 * 1000);

    const recentMessages = messages.filter(msg => msg.timestamp > twentyFourHoursAgo);

    if (recentMessages.length < messages.length) {
        console.log(`Menghapus ${messages.length - recentMessages.length} pesan lama.`);
        await writeData(MESSAGE_DATA_PATH, recentMessages);
        
        // Beri tahu klien yang terhubung untuk memuat ulang history mereka
        for (const [id, clientWs] of clients.entries()) {
            if (clientWs.readyState === clientWs.OPEN) {
                const messagesWithMeFlag = recentMessages.map(m => ({ ...m, isMe: m.userId === id }));
                clientWs.send(JSON.stringify({ type: 'history', data: messagesWithMeFlag }));
            }
        }
    } else {
        console.log('Tidak ada pesan lama untuk dihapus.');
    }
};

// Jalankan pembersihan setiap jam
setInterval(cleanupOldMessages, 60 * 60 * 1000);

// --- Upgrade HTTP ke WebSocket ---
server.on('upgrade', (request, socket, head) => {
    sessionParser(request, {}, () => {
        if (!request.session.userId) {
            socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
            socket.destroy();
            return;
        }
        wss.handleUpgrade(request, socket, head, (ws) => {
            wss.emit('connection', ws, request);
        });
    });
});

// --- Menjalankan Server ---
server.listen(PORT, () => {
    console.log(`Server berjalan di http://localhost:${PORT}`);
    cleanupOldMessages(); // Jalankan sekali saat startup untuk jaga-jaga
});
