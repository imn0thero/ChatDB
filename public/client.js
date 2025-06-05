const socket = io();
const username = document.cookie
  .split('; ')
  .find(row => row.startsWith('connect.sid')) ? prompt("Masukkan username Anda:") : null;

if (username) socket.emit('login', username);

socket.on('user-status', users => {
  document.getElementById('online-users').innerText =
    'Online: ' + Object.keys(users).join(', ');
});

const msgBox = document.getElementById('messages');
const form = document.getElementById('sendForm');
const fileInput = document.getElementById('fileInput');

form.onsubmit = e => {
  e.preventDefault();
  const msg = document.getElementById('msg').value;
  const file = fileInput.files[0];
  if (file) {
    const reader = new FileReader();
    reader.onload = () => {
      socket.emit('message', { text: msg, file: reader.result });
    };
    reader.readAsDataURL(file);
  } else {
    socket.emit('message', { text: msg });
  }
  document.getElementById('msg').value = '';
  fileInput.value = '';
};

socket.on('message', msg => {
  const el = document.createElement('div');
  el.id = 'msg-' + msg.id;
  el.innerHTML = `<b>${msg.from}</b>: ${msg.text} ${msg.file ? `<br><img src="${msg.file}" width="100">` : ''}
    <button onclick="edit(${msg.id})">Edit</button>
    <button onclick="del(${msg.id})">Hapus</button>
    ${msg.read ? '✔️' : ''}
  `;
  msgBox.appendChild(el);
  socket.emit('mark-read', msg.id);
});

socket.on('update-message', msg => {
  const el = document.getElementById('msg-' + msg.id);
  if (el) el.innerHTML = `<b>${msg.from}</b>: ${msg.text} ${msg.file ? `<br><img src="${msg.file}" width="100">` : ''}
    <button onclick="edit(${msg.id})">Edit</button>
    <button onclick="del(${msg.id})">Hapus</button>
    ${msg.read ? '✔️' : ''}
  `;
});

socket.on('delete-message', id => {
  const el = document.getElementById('msg-' + id);
  if (el) el.remove();
});

function edit(id) {
  const newText = prompt("Edit pesan:");
  if (newText) socket.emit('edit-message', { id, text: newText });
}
function del(id) {
  if (confirm("Hapus pesan ini?")) socket.emit('delete-message', id);
}
