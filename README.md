# AI Study Assistant (Telegram Bot)

Bot Telegram pintar berbasis AI yang dirancang sebagai tutor belajar interaktif untuk siswa dan mahasiswa. Bot ini mampu menjelaskan konsep pelajaran yang sulit dengan bahasa yang santai, bertahap, disertai analogi dan contoh konkret, serta ramah pemula.

Dibangun menggunakan Node.js, TypeScript, dan framework grammY, bot ini mendukung integrasi multi-provider (Google Gemini, OpenAI GPT, dan Groq LPU) yang dapat diganti kapan saja melalui file .env.

---

## Fitur Utama

- Multi LLM Provider: Mendukung Google Gemini (@google/genai), OpenAI GPT (openai), dan Groq LPU (Llama 3 / Qwen). Pergantian provider cukup dilakukan melalui konfigurasi .env.
- Memori Percakapan (Context Memory): Menyimpan riwayat obrolan di database SQLite lokal (better-sqlite3) sehingga bot mengingat konteks pertanyaan sebelumnya.
- Auto-Retry dan Anti-Crash: Dilengkapi @grammyjs/auto-retry dan exponential backoff retry untuk menangani gangguan sementara (429 Rate Limit / 5xx Server Error).
- Indikator Typing: Menampilkan status sedang mengetik saat bot menunggu respon dari AI (diperbarui berkala tiap ~4 detik).
- Smart Message Splitting: Memecah jawaban panjang yang melebihi batas 4096 karakter Telegram secara cerdas tanpa memotong kata atau blok kode.
- Safe HTML Formatting: Mengonversi Markdown dari LLM ke format HTML Telegram yang valid, dengan fallback otomatis ke teks biasa jika terjadi error parsing.
- Rate Limiter: Mencegah spam pesan berlebih dari user tertentu (RATE_LIMIT_PER_MINUTE).
- Whitelist Akses (Opsional): Batasi akses bot hanya untuk Telegram User ID tertentu (ALLOWED_USER_IDS).
- Dua Mode Berjalan:
  - MODE=polling untuk development lokal tanpa perlu domain publik atau tunneling.
  - MODE=webhook untuk production di server cloud (Vercel, VPS, dsb.) dengan verifikasi token rahasia Telegram.
- Graceful Shutdown: Mematikan bot, koneksi database, dan background task secara rapi saat proses menerima sinyal SIGINT/SIGTERM.

---

## Struktur Folder Project

```text
bot-tele/
├── api/
│   └── index.ts              # Serverless webhook handler untuk Vercel
├── src/
│   ├── index.ts              # Entry point utama (menjalankan polling/webhook dan shutdown)
│   ├── config.ts             # Validasi variabel environment (.env) dengan Zod
│   ├── bot.ts                # Inisialisasi bot, command handler, dan event handler
│   ├── db.ts                 # Operasi database SQLite (simpan, ambil, prune, reset)
│   ├── llm/
│   │   ├── types.ts          # Interface LLMProvider dan tipe pesan
│   │   ├── gemini.ts         # Implementasi SDK resmi @google/genai
│   │   ├── openai.ts         # Implementasi SDK resmi openai
│   │   ├── groq.ts           # Implementasi Groq LPU ultra-cepat
│   │   └── index.ts          # Factory provider LLM
│   └── utils/
│       ├── formatTelegram.ts # Konversi Markdown ke HTML Telegram yang aman
│       ├── rateLimit.ts      # In-memory sliding window rate limiter
│       ├── retry.ts          # Helper exponential backoff retry
│       └── splitMessage.ts   # Pemecah pesan panjang batas 4096 karakter
├── prompts/
│   └── system.txt            # System prompt instruksi tutor AI (mudah diedit)
├── data/                     # Folder penyimpanan file SQLite bot.db
├── .env.example              # Template variabel konfigurasi
├── vercel.json               # Konfigurasi routing serverless Vercel
├── Dockerfile                # File build multi-stage Docker siap pakai
├── .dockerignore             # File yang diabaikan saat build Docker
├── package.json              # Daftar dependencies dan scripts
├── tsconfig.json             # Konfigurasi TypeScript Node20+
└── README.md                 # Dokumentasi panduan lengkap
```

---

## Persyaratan Sistem

- Node.js versi 20.0.0 ke atas (direkomendasikan v20.x atau v22.x LTS)
- npm (otomatis terpasang bersama Node.js)
- Akun Telegram aktif

---

## Panduan Langkah demi Langkah untuk Pemula

### 1. Membuat Bot Telegram dan Mengambil Token

1. Buka aplikasi Telegram di perangkat Anda.
2. Di kolom pencarian Telegram, cari akun resmi @BotFather (pastikan bercentang biru).
3. Buka obrolan lalu kirim pesan /start.
4. Ketik perintah /newbot lalu tekan Enter.
5. Masukkan nama tampilan bot Anda (contoh: Tutor Belajar AI).
6. Masukkan username bot (harus berakhiran bot, contoh: tutor_belajar_ai_bot).
7. BotFather akan memberikan HTTP API Token, contohnya:
   ```text
   7123456789:AAFlkjhsdf897234_kjhsdf87234ljksdf
   ```
8. Simpan token ini dengan aman. Jangan dibagikan kepada publik.

---

### 2. Mendapatkan API Key AI

Pilih provider yang ingin Anda gunakan:

#### Opsi A: Groq (Rekomendasi Utama: 100% Gratis dan Sangat Cepat)
1. Buka situs konsol Groq: https://console.groq.com/keys
2. Login menggunakan akun Google Anda.
3. Klik Create API Key, beri nama, lalu salin kodenya (diawali gsk_...).

#### Opsi B: Google Gemini
1. Buka Google AI Studio di browser: https://aistudio.google.com/
2. Login menggunakan akun Google Anda.
3. Klik tombol Get API key di bilah navigasi.
4. Klik Create API key dan pilih proyek Google Cloud Anda.
5. Salin API Key yang dihasilkan.

#### Opsi C: OpenAI (ChatGPT)
1. Buka OpenAI Platform: https://platform.openai.com/api-keys
2. Login atau daftar akun baru.
3. Klik tombol Create new secret key.
4. Beri nama kunci dan salin secret key yang ditampilkan.

---

### 3. Instalasi dan Menjalankan di Komputer Lokal

1. Clone atau buka folder project ini:
   ```bash
   cd bot-tele
   ```

2. Pasang seluruh dependencies:
   ```bash
   npm install
   ```

3. Buat file konfigurasi .env:
   Salin file template .env.example menjadi .env:
   - Di Windows (PowerShell):
     ```powershell
     Copy-Item .env.example .env
     ```
   - Di Linux / macOS:
     ```bash
     cp .env.example .env
     ```

4. Isi file .env:
   Buka file .env menggunakan editor teks, lalu isi nilai token dan API key:

   ```env
   # Masukkan token dari @BotFather
   TELEGRAM_BOT_TOKEN=7123456789:AAFlkjhsdf897234_kjhsdf87234ljksdf

   # Pilih provider: groq | gemini | openai
   LLM_PROVIDER=groq

   # Jika memilih groq:
   GROQ_API_KEY=gsk_kunci_groq_anda
   GROQ_MODEL=qwen/qwen3.8-27b

   # Pengaturan bot
   MODE=polling
   MAX_HISTORY_MESSAGES=20
   RATE_LIMIT_PER_MINUTE=10
   ```

5. Jalankan bot dalam mode pengembangan (Development):
   ```bash
   npm run dev
   ```
   Jika berhasil, terminal akan menampilkan pesan:
   ```text
   ====================================================
   Memulai AI Study Assistant (Telegram Bot)...
   ====================================================
   Database SQLite terhubung dan tabel siap digunakan.
   LLM Provider aktif: GROQ (Model: qwen/qwen3.8-27b)
   Mode POLLING aktif: Bot sedang mendengarkan pesan...
   Berhasil terhubung ke Telegram sebagai @tutor_belajar_ai_bot (ID: 123456789)
   Siap menerima pesan dari pengguna!
   ```

6. Uji Coba Bot di Telegram:
   Buka Telegram, cari bot Anda, lalu klik Start atau ketik /start. Coba tanyakan materi belajar apa saja.

---

### 4. Cara Berganti Provider Melalui .env

Cukup ubah nilai LLM_PROVIDER di file .env:

- Untuk menggunakan Groq:
  ```env
  LLM_PROVIDER=groq
  GROQ_API_KEY=gsk_...
  GROQ_MODEL=qwen/qwen3.8-27b
  ```

- Untuk menggunakan Gemini:
  ```env
  LLM_PROVIDER=gemini
  GEMINI_API_KEY=AIzaSy...
  GEMINI_MODEL=gemini-3.5-flash-lite
  ```

- Untuk menggunakan OpenAI (GPT):
  ```env
  LLM_PROVIDER=openai
  OPENAI_API_KEY=sk-proj-...
  OPENAI_MODEL=gpt-4o-mini
  ```

Simpan file .env. Perubahan akan langsung terbaca setelah aplikasi dijalankan ulang. Ketik /model di Telegram untuk memastikan model baru sudah aktif.

---

### 5. Cara Mengaktifkan Whitelist Pengguna

Jika Anda ingin membatasi akses bot hanya untuk user tertentu:

1. Cari tahu Telegram User ID Anda:
   - Di Telegram, cari bot bernama @userinfobot atau @raw_data_bot.
   - Kirim pesan apa saja ke bot tersebut untuk melihat ID numerik Anda.
2. Masukkan ke file .env:
   ```env
   # Satu user:
   ALLOWED_USER_IDS=123456789

   # Lebih dari satu user (pisahkan dengan koma):
   ALLOWED_USER_IDS=123456789,987654321
   ```
3. Kosongkan nilai ALLOWED_USER_IDS= jika bot boleh diakses oleh publik.

---

### 6. Cara Mengubah Karakter dan Gaya Menjawab Tutor

System prompt instruksi bot disimpan terpisah pada file:
prompts/system.txt

Anda dapat mengubah nada bicara atau aturan bot tanpa menyentuh kode program. Cukup edit teks di dalam prompts/system.txt lalu jalankan ulang bot.

---

### 7. Panduan Deployment 24/7 Tanpa Laptop Menyala (Vercel)

Untuk menjaga bot aktif 24 jam gratis tanpa biaya server dan tanpa perlu laptop menyala, gunakan platform Vercel:

1. Unggah kode ke repositori GitHub Anda.
2. Buka situs Vercel: https://vercel.com/signup dan login dengan akun GitHub Anda.
3. Klik Add New... lalu pilih Project, kemudian klik Import pada repositori bot Anda.
4. Pada bagian Environment Variables, masukkan variabel berikut:
   - TELEGRAM_BOT_TOKEN
   - LLM_PROVIDER (isi: groq)
   - GROQ_API_KEY
   - GROQ_MODEL (isi: qwen/qwen3.8-27b)
   - MODE (isi: webhook)
5. Klik Deploy dan tunggu proses kompilasi selesai.
6. Setelah deployment berstatus Ready, buka tautan berikut di browser:
   ```text
   https://NAMA-DOMAIN-VERCEL-ANDA.vercel.app/api?action=setWebhook
   ```
7. Webhook Telegram akan otomatis terhubung ke Vercel dan bot aktif 24/7.

---

### 8. Deployment Alternatif Menggunakan Docker

Project ini juga menyediakan Dockerfile multi-stage untuk deployment mandiri di VPS:

```bash
# 1. Build image Docker
docker build -t telegram-study-bot .

# 2. Jalankan container
docker run -d \
  --name study-bot \
  --restart always \
  --env-file .env \
  -p 3000:3000 \
  -v bot_data:/app/data \
  telegram-study-bot
```

---

## Troubleshooting Umum

### 1. Bot tidak membalas sama sekali
- Pastikan bot sedang berjalan di terminal lokal (npm run dev) atau webhook di Vercel sudah diset dengan benar.
- Periksa kembali TELEGRAM_BOT_TOKEN di .env, pastikan tidak ada kesalahan ketik atau spasi liar.
- Jika ALLOWED_USER_IDS diisi, pastikan ID Telegram Anda sudah terdaftar di dalamnya.

### 2. Error 401 Unauthorized (Telegram)
- Token bot salah atau telah direvoke di @BotFather. Silakan buat token baru di @BotFather dan perbarui file .env.

### 3. Error 429 Too Many Requests (LLM)
- Kuota gratis penyedia AI sedang mencapai batas. Bot memiliki auto-retry otomatis, namun jika terjadi terus-menerus, gunakan provider lain seperti Groq yang memiliki kuota lebih besar.

### 4. Error saat instalasi better-sqlite3 di Windows
- Modul better-sqlite3 memerlukan compiler C++. Gunakan Node.js LTS resmi v20 atau v22 yang sudah menyertakan prebuilt binaries.

### 5. Pesan terlalu panjang terpotong
- Bot secara otomatis memecah pesan panjang menjadi bagian maksimal 4000 karakter pada batas paragraf atau baris. Batas pesan teks resmi Telegram adalah 4096 karakter.

---

## Lisensi
ISC License - Bebas digunakan dan dikembangkan untuk keperluan belajar maupun non-komersial.
