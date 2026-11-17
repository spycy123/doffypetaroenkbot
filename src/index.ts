import http from 'http';
import { run } from '@grammyjs/runner';
import { webhookCallback } from 'grammy';
import { loadConfig } from './config';
import { createLLMProvider } from './llm';
import { getDatabase, closeDatabase } from './db';
import { RateLimiter } from './utils/rateLimit';
import { createBot } from './bot';

async function main() {
  console.log('====================================================');
  console.log('🚀 Memulai AI Study Assistant (Telegram Bot)...');
  console.log('====================================================');

  // 1. Validasi & muat konfigurasi environment
  const config = loadConfig();

  // 2. Inisialisasi Database SQLite
  getDatabase();
  console.log('📦 Database SQLite terhubung dan tabel siap digunakan.');

  // 3. Inisialisasi Rate Limiter
  const rateLimiter = new RateLimiter(60000);

  // 4. Inisialisasi LLM Provider
  const llmProvider = createLLMProvider(config);
  console.log(`🤖 LLM Provider aktif: ${llmProvider.name.toUpperCase()} (Model: ${llmProvider.model})`);

  // 5. Inisialisasi Bot Telegram
  const bot = createBot(config, llmProvider, rateLimiter);

  // State untuk Graceful Shutdown
  let runner: ReturnType<typeof run> | null = null;
  let server: http.Server | null = null;
  let isShuttingDown = false;

  const gracefulShutdown = async (signal: string) => {
    if (isShuttingDown) return;
    isShuttingDown = true;

    console.log(`\n🛑 Menerima sinyal ${signal}. Menutup proses secara aman...`);

    // Hentikan polling runner
    if (runner && runner.isRunning()) {
      console.log('⏳ Menghentikan runner polling Telegram...');
      await runner.stop();
      console.log('✅ Polling dihentikan.');
    }

    // Hentikan server HTTP webhook
    if (server) {
      console.log('⏳ Menutup HTTP server webhook...');
      await new Promise<void>((resolve) => {
        server?.close(() => {
          console.log('✅ HTTP server webhook ditutup.');
          resolve();
        });
      });
    }

    // Bersihkan rate limiter
    rateLimiter.destroy();

    // Tutup koneksi SQLite
    closeDatabase();

    console.log('👋 Bot berhasil dimatikan dengan aman. Sampai jumpa!');
    process.exit(0);
  };

  process.once('SIGINT', () => gracefulShutdown('SIGINT'));
  process.once('SIGTERM', () => gracefulShutdown('SIGTERM'));

  // 6. Jalankan bot sesuai MODE
  if (config.MODE === 'polling') {
    console.log('📡 Mode POLLING aktif: Bot sedang mendengarkan pesan...');
    runner = run(bot);

    try {
      const me = await bot.api.getMe();
      console.log(`✅ Berhasil terhubung ke Telegram sebagai @${me.username} (ID: ${me.id})`);
      console.log('💬 Siap menerima pesan dari pengguna!');
    } catch (err: any) {
      console.error('❌ Gagal menghubungi Telegram API:', err.message || err);
      console.error('Pastikan TELEGRAM_BOT_TOKEN yang Anda masukkan sudah benar.');
    }
  } else if (config.MODE === 'webhook') {
    if (!config.WEBHOOK_URL) {
      throw new Error('WEBHOOK_URL wajib diisi jika MODE=webhook.');
    }

    console.log(`🌐 Mode WEBHOOK aktif: Menyiapkan HTTP server pada port ${config.PORT}...`);

    const handleWebhook = webhookCallback(bot, 'http', {
      secretToken: config.WEBHOOK_SECRET,
    });

    server = http.createServer((req, res) => {
      if (req.method === 'POST') {
        handleWebhook(req, res);
      } else if (req.method === 'GET' && req.url === '/health') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(
          JSON.stringify({
            status: 'ok',
            provider: llmProvider.name,
            model: llmProvider.model,
            timestamp: new Date().toISOString(),
          })
        );
      } else {
        res.writeHead(200, { 'Content-Type': 'text/plain' });
        res.end('AI Study Assistant Telegram Bot is running in Webhook mode.');
      }
    });

    server.listen(config.PORT, async () => {
      console.log(`🚀 HTTP Server berjalan di port ${config.PORT}`);
      try {
        console.log(`📡 Mendaftarkan webhook URL ke Telegram: ${config.WEBHOOK_URL}...`);
        await bot.api.setWebhook(config.WEBHOOK_URL!, {
          secret_token: config.WEBHOOK_SECRET,
        });
        const me = await bot.api.getMe();
        console.log(`✅ Webhook berhasil didaftarkan untuk @${me.username}!`);
      } catch (err: any) {
        console.error('❌ Gagal mendaftarkan webhook ke Telegram API:', err.message || err);
      }
    });
  }
}

main().catch((err) => {
  console.error('❌ Kesalahan fatal aplikasi:', err);
  process.exit(1);
});
