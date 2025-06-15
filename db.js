const mysql = require('mysql2');

const db = mysql.createConnection({
  host: 'nue.domcloud.co',       // atau sesuai info dari Domcloud
  user: 'sayangg-kisahkita',       // ganti
  password: 's+Vx15)l72L5Of(CxQ',   // ganti
  database: 'sayangg_kisahkita_sayangg_kisahkita_' // ganti
});

db.connect(err => {
  if (err) throw err;
  console.log('✅ Terhubung ke MySQL');
});

module.exports = db;
