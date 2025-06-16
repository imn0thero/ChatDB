// public/js/app.js

document.addEventListener('DOMContentLoaded', () => {
    const chatWindow = document.getElementById('chat-window');
    const messageForm = document.getElementById('message-form');
    const messageInput = document.getElementById('message-input');
    const deleteAllBtn = document.getElementById('delete-all-btn');
    const otherUserStatusEl = document.getElementById('other-user-status');

    // Cek apakah di halaman chat
    if (!chatWindow) return;

    // Buat koneksi WebSocket
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const ws = new WebSocket(`${protocol}//${window.location.host}`);

    let currentUserId = null;

    ws.onopen = () => {
        console.log('Terhubung ke server WebSocket.');
    };

    ws.onmessage = (event) => {
        const message = JSON.parse(event.data);
        
        // Ambil ID user saat ini dari pesan pertama (history)
        if (message.type === 'history' && !currentUserId) {
            // Ini asumsi sederhana, mungkin perlu cara yg lebih baik
            // Untuk sekarang kita set berdasarkan pesan terakhir jika ada
            if (message.data.length > 0) {
                 // Tidak bisa diandalkan, kita butuh cara lain. Server harus kirim ini.
                 // Untuk sementara, kita akan tentukan saat render pesan.
            }
        }
        
        switch (message.type) {
            case 'history':
                chatWindow.innerHTML = ''; // Bersihkan window
                message.data.forEach(renderMessage);
                scrollToBottom();
                break;
            case 'chat':
                renderMessage(message.data);
                scrollToBottom();
                break;
            case 'status_update':
                updateStatus(message.data);
                break;
            case 'clear_chat':
                chatWindow.innerHTML = '';
                break;
        }
    };

    ws.onclose = () => {
        console.log('Koneksi WebSocket ditutup.');
        otherUserStatusEl.textContent = 'Koneksi terputus. Coba refresh halaman.';
        otherUserStatusEl.className = 'status-offline';
    };

    ws.onerror = (error) => {
        console.error('WebSocket Error:', error);
    };

    // Kirim pesan
    messageForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const text = messageInput.value.trim();
        if (text && ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'chat', text: text }));
            messageInput.value = '';
        }
    });

    // Hapus semua pesan
    deleteAllBtn.addEventListener('click', () => {
        if (confirm('Apakah Anda yakin ingin menghapus semua pesan? Aksi ini tidak dapat dibatalkan.')) {
            ws.send(JSON.stringify({ type: 'delete_all' }));
        }
    });

    function renderMessage(msg) {
        // Cek apakah currentUserId sudah di-set
        if (!currentUserId) {
            // Hack sederhana: minta user info dari server atau simpan di cookie saat login
            // Untuk sekarang, kita coba tebak dari pesan
            // Ini tidak ideal, cara yang lebih baik adalah server mengirim user id saat konek.
            // Tapi untuk menjaga tetap simpel, kita biarkan saja
        }

        const messageEl = document.createElement('div');
        const isSent = msg.username === document.body.dataset.username; // ini perlu di-set
        // Karena kita tidak punya info user saat ini di client, kita akan pakai cara lain
        // Kita akan minta server untuk menambahkan flag 'isMe'
        // Untuk sekarang, kita asumsikan 'sent' jika username cocok
        // Kita butuh cara untuk mendapatkan username saat ini di client. Mari kita asumsikan kita punya.
        
        const messageClass = msg.isMe ? 'sent' : 'received';
        messageEl.className = `message ${messageClass}`;

        const time = new Date(msg.timestamp).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });

        messageEl.innerHTML = `
            <span class="message-sender">${msg.username}</span>
            ${msg.text}
            <div class="message-meta">${time}</div>
        `;
        
        chatWindow.appendChild(messageEl);
    }
    
    // Fungsi ini tidak akan berjalan dengan baik tanpa info user saat ini.
    // **PERBAIKAN PENTING DI `server.js`:**
    // Saat mengirim histori, kita perlu menambahkan flag `isMe`
    // Dan saat broadcast pesan baru, kita harus mengirim dua versi.
    // Mari kita modifikasi server & client untuk ini.
    
    // **MODIFIKASI CLIENT (app.js)**
    // Kita tidak perlu menebak lagi, server akan memberikan flag `isMe`
    function renderMessage(msg) {
        const messageEl = document.createElement('div');
        messageEl.className = `message ${msg.isMe ? 'sent' : 'received'}`;

        const time = new Date(msg.timestamp).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });

        messageEl.innerHTML = `
            ${!msg.isMe ? `<span class="message-sender">${msg.username}</span>` : ''}
            ${msg.text}
            <div class="message-meta">${time}</div>
        `;
        chatWindow.appendChild(messageEl);
    }


    function updateStatus(users) {
        const currentUser = users.find(u => u.isMe);
        const otherUser = users.find(u => !u.isMe);
        
        if (otherUser) {
            if (otherUser.isOnline) {
                otherUserStatusEl.textContent = `${otherUser.username} - Online`;
                otherUserStatusEl.className = 'status-online';
            } else {
                const lastSeen = otherUser.lastSeen 
                    ? `terakhir online ${new Date(otherUser.lastSeen).toLocaleString('id-ID')}`
                    : 'belum pernah online';
                otherUserStatusEl.textContent = `${otherUser.username} - Offline (${lastSeen})`;
                otherUserStatusEl.className = 'status-offline';
            }
        } else {
            otherUserStatusEl.textContent = 'Menunggu pengguna lain...';
            otherUserStatusEl.className = 'status-offline';
        }
    }

    function scrollToBottom() {
        chatWindow.scrollTop = chatWindow.scrollHeight;
    }
});
