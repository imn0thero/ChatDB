const mysql = require('mysql2');

const db = mysql.createConnection({
  host: 'osk.domcloud.co',       // atau sesuai info dari Domcloud
  user: 'iloveu-e2e',       // ganti
  password: '57w3mWH+bA)1m+jG3W',   // ganti
  database: 'iloveu_e2e_1' // ganti
});

db.connect(err => {
  if (err) throw err;
  console.log('✅ Terhubung ke MySQL');
});

module.exports = db;
