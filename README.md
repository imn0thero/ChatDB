# 🔒 Private Chat Application

Aplikasi chat pribadi untuk 2 pengguna dengan fitur keamanan dan privasi tinggi.

## ✨ Fitur

- **Maksimal 2 Pengguna**: Hanya memungkinkan 2 pengguna untuk menjaga privasi
- **Auto-Delete 24 Jam**: Pesan otomatis terhapus setelah 24 jam
- **Hapus Semua Pesan**: Tombol untuk menghapus semua pesan sekaligus
- **Status Online/Offline**: Menampilkan status dan waktu terakhir aktif
- **Timestamp Pesan**: Setiap pesan memiliki waktu pengiriman
- **Penyimpanan JSON**: Data disimpan dalam file JSON untuk persistensi
- **Autentikasi**: Sistem login dan signup dengan enkripsi password
- **Real-time Chat**: Menggunakan Socket.IO untuk komunikasi real-time

## 🚀 Instalasi

1. **Clone atau download source code**

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Jalankan aplikasi**
   ```bash
   npm start
   ```
   
   Untuk development dengan auto-reload:
   ```bash
   npm run dev
   ```

4. **Akses aplikasi**
   - Buka browser dan kunjungi: `http://localhost:3000`
   - Port default: 3000 (bisa diubah dengan environment variable PORT)

## 📁 Struktur File

```
private-chat-app/
├── server.js              # Server utama Node.js
├── package.json           # Dependencies dan scripts
├── chat_data.json         # File penyimpanan data (dibuat otomatis)
└── public/
    ├── chat.html          # Halaman chat utama
    ├── login.html         # Halaman login
    └── signup.html        # Halaman registrasi
```

## 🎯 Cara Penggunaan

### 1. Registrasi Pengguna Pertama
- Kunjungi `/signup`
- Isi username dan password
- Klik "Daftar"

### 2. Registrasi Pengguna Kedua
- Pengguna kedua juga perlu registrasi
- Maksimal hanya 2 pengguna yang diizinkan

### 3. Login dan Chat
- Login dengan akun yang sudah dibuat
- Mulai chat dengan pengguna lain
- Lihat status online/offline partner chat
- Pesan akan tersimpan meski logout

### 4. Fitur Keamanan
- **Auto-Delete**: Pesan otomatis terhapus setelah 24 jam
- **Hapus Semua**: Gunakan tombol "Hapus Semua" untuk menghapus semua pesan
- **Logout**: Selalu logout untuk keamanan

## ⚙️ Konfigurasi

### Environment Variables
```bash
PORT=3000                    # Port server (default: 3000)
```

### Session Secret
Untuk production, ubah secret key di `server.js`:
```javascript
app.use(session({
    secret: 'ganti-dengan-secret-key-yang-aman',
    // ...
}));
```

## 📱 Responsive Design

Aplikasi ini responsive dan dapat diakses dari:
- Desktop
- Tablet  
- Mobile phone

## 🔧 Troubleshooting

### Port sudah digunakan
```bash
# Ubah port dengan environment variable
PORT=8080 npm start
```

### File permission error
```bash
# Pastikan direktori dapat ditulis
chmod 755 .
```

### Dependencies error
```bash
# Clear cache dan install ulang
npm cache clean --force
rm -rf node_modules
npm install
```

## 🔒 Keamanan

- Password dienkripsi menggunakan bcrypt
- Session management untuk autentikasi
- Validasi input di client dan server
- Auto-cleanup pesan lama

## 📄 Lisensi

MIT License - Bebas digunakan untuk keperluan pribadi dan komersial.

## 🤝 Kontribusi

Aplikasi ini dibuat untuk keperluan privasi. Jika ada bug atau saran perbaikan, silakan buat issue atau pull request.

---

**⚠️ Penting**: Aplikasi ini dirancang untuk penggunaan pribadi. Pastikan untuk menggunakan HTTPS di production dan menjaga keamanan server.
