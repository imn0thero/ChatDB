const socket = io();

let currentUser = null;
const loginDiv = document.getElementById('login');
const chatDiv = document.getElementById('chat-container');
const loginBtn = document.getElementById('loginBtn');
const username = document.getElementById('username');
const password = document.getElementById('password');
const loginError = document.getElementById('loginError');
const status = document.getElementById('status');
const message = document.getElementById('message');
const fileInput = document.getElementById('file-input');
const sendBtn = document.getElementById('sendBtn');
const messagesDiv = document.getElementById('messages');

loginBtn.onclick = () => {
  socket.emit('login', {
    username: username.value.trim(),
    password: password.value
  });
};

socket.on('loginResult', result => {
  if (result.success) {
    currentUser = result.user;
    loginDiv.style.display = 'none';
    chatDiv.style.display = 'block';
  } else {
    loginError.textContent = result.message;
  }
});

sendBtn.onclick = () => {
  const text = message.value.trim();
  const file = fileInput.files[0];

  if (text) {
    socket.emit('chatMessage', {
      user: currentUser,
      text
    });
    message.value = '';
  }

  if (file) {
    const reader = new FileReader();
    reader.onload = function () {
      socket.emit('mediaMessage', {
        user: currentUser,
        name: file.name,
        type: file.type,
        data: reader.result
      });
    };
    reader.readAsDataURL(file);
    fileInput.value = '';
  }
};

socket.on('chatMessage', msg => {
  const div = document.createElement('div');
  div.textContent = `${msg.user}: ${msg.text}`;
  messagesDiv.appendChild(div);
  messagesDiv.scrollTop = messagesDiv.scrollHeight;
});

socket.on('mediaMessage', file => {
  const div = document.createElement('div');
  div.innerHTML = `<strong>${file.user} mengirim:</strong><br/>`;

  if (file.type.startsWith('image/')) {
    div.innerHTML += `<img src="${file.data}" />`;
  } else if (file.type.startsWith('video/')) {
    div.innerHTML += `<video controls><source src="${file.data}" type="${file.type}"></video>`;
  } else if (file.type.startsWith('audio/')) {
    div.innerHTML += `<audio controls><source src="${file.data}" type="${file.type}"></audio>`;
  } else {
    div.innerHTML += `<a href="${file.data}" download="${file.name}">${file.name}</a>`;
  }

  messagesDiv.appendChild(div);
  messagesDiv.scrollTop = messagesDiv.scrollHeight;
});

socket.on('loadMessages', msgs => {
  messagesDiv.innerHTML = '';
  msgs.forEach(msg => {
    if (msg.text) {
      socket.emit('chatMessage', msg);
    } else if (msg.data) {
      socket.emit('mediaMessage', msg);
    }
  });
});

socket.on('userStatus', isOnline => {
  status.textContent = isOnline ? 'Online' : 'Offline';
});
