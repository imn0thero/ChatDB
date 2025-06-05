const socket = io();
let currentUser = null;

const loginContainer = document.getElementById('login-container');
const chatContainer = document.getElementById('chat-container');
const loginBtn = document.getElementById('login-btn');
const logoutBtn = document.getElementById('logout-btn');
const usernameInput = document.getElementById('username');
const passwordInput = document.getElementById('password');
const messageInput = document.getElementById('message-input');
const sendBtn = document.getElementById('send-btn');
const messagesDiv = document.getElementById('messages');
const onlineUsersSpan = document.getElementById('online-users');

// Login klik
loginBtn.onclick = () => {
  const username = usernameInput.value.trim();
  const password = passwordInput.value;

  fetch('/login', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({ username, password })
  })
    .then(res => res.json())
    .then(data => {
      if (data.success) {
        currentUser = username;
        loginContainer.style.display = 'none';
        chatContainer.style.display = 'block';
        socket.emit('userOnline', username);
      } else {
        alert('Login gagal!');
      }
    });
};

// Logout
logoutBtn.onclick = () => {
  socket.emit('userOffline', currentUser);
  currentUser = null;
  chatContainer.style.display = 'none';
  loginContainer.style.display = 'block';
};

// Kirim pesan
sendBtn.onclick = () => {
  const msg = messageInput.value.trim();
  if (msg && currentUser) {
    socket.emit('chatMessage', { user: currentUser, text: msg });
    messageInput.value = '';
  }
};

// Tampilkan pesan
socket.on('chatMessage', msg => {
  const div = document.createElement('div');
  div.textContent = `${msg.user}: ${msg.text}`;
  messagesDiv.appendChild(div);
  messagesDiv.scrollTop = messagesDiv.scrollHeight;
});

// Tampilkan semua pesan lama
socket.on('loadMessages', msgs => {
  messagesDiv.innerHTML = '';
  msgs.forEach(msg => {
    const div = document.createElement('div');
    div.textContent = `${msg.user}: ${msg.text}`;
    messagesDiv.appendChild(div);
  });
  messagesDiv.scrollTop = messagesDiv.scrollHeight;
});

// Update daftar online
socket.on('updateOnlineUsers', users => {
  onlineUsersSpan.textContent = users.join(', ');
});
