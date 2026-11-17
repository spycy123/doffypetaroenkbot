import { Bot, Context } from 'grammy';
import { autoRetry } from '@grammyjs/auto-retry';
import { AppConfig } from './config';
import { LLMProvider } from './llm/types';
import { RateLimiter } from './utils/rateLimit';
import { splitMessage } from './utils/splitMessage';
import { markdownToTelegramHtml } from './utils/formatTelegram';
import {
  saveMessage,
  getHistory,
  clearHistory,
  pruneOldMessages,
} from './db';

export function createBot(
  config: AppConfig,
  llmProvider: LLMProvider,
  rateLimiter: RateLimiter
): Bot<Context> {
  const bot = new Bot<Context>(config.TELEGRAM_BOT_TOKEN);

  // 1. Plugin auto-retry untuk menangani rate limit Telegram (429) & internal error (5xx)
  bot.api.config.use(
    autoRetry({
      maxRetryAttempts: 3,
      maxDelaySeconds: 60,
    })
  );

  // 2. Global Error Handler agar bot tidak pernah crash
  bot.catch((err) => {
    const ctx = err.ctx;
    console.error(`[BOT ERROR] Error saat memproses update ${ctx.update.update_id}:`, err.error);
  });

  // 3. Middleware Whitelist (Opsional lewat ALLOWED_USER_IDS)
  if (config.ALLOWED_USER_IDS && config.ALLOWED_USER_IDS.length > 0) {
    bot.use(async (ctx, next) => {
      const userId = ctx.from?.id;
      if (!userId || !config.ALLOWED_USER_IDS.includes(userId)) {
        console.warn(`[WHITELIST BLOCKED] User ID ${userId} mencoba mengakses bot.`);
        if (ctx.chat?.type === 'private') {
          await ctx.reply(
            `🔒 <b>Akses Dibatasi</b>\n\n` +
            `Maaf, bot ini diset dalam mode privat. User ID Telegram kamu (<code>${userId || 'Unknown'}</code>) belum terdaftar dalam whitelist.`,
            { parse_mode: 'HTML' }
          );
        }
        return;
      }
      return next();
    });
  }

  // 4. Perintah /start: Sambutan dan panduan pemakaian
  bot.command('start', async (ctx) => {
    const name = ctx.from?.first_name || 'Teman';
    const welcome =
      `👋 <b>Halo ${name}! Selamat datang di AI Study Assistant!</b>\n\n` +
      `Saya adalah tutor AI pribadi kamu yang siap membantu memahami materi pelajaran sekolah maupun kuliah.\n\n` +
      `💡 <b>Cara Bertanya:</b>\n` +
      `Ketik saja pertanyaan atau materi yang ingin kamu pelajari. Saya akan menjelaskan secara bertahap:\n` +
      `1. Inti konsep dalam 1-2 kalimat ringkas\n` +
      `2. Penjelasan bertahap yang mudah dipahami\n` +
      `3. Contoh konkret / langkah penyelesaian\n` +
      `4. Ringkasan singkat atau latihan soal\n\n` +
      `📌 <b>Daftar Perintah:</b>\n` +
      `• <code>/help</code> - Panduan lengkap & contoh pertanyaan\n` +
      `• <code>/model</code> - Cek AI Provider & model yang aktif\n` +
      `• <code>/reset</code> - Hapus riwayat chat & mulai topik baru\n\n` +
      `Ayo, mau belajar materi apa hari ini? 🚀`;

    await ctx.reply(welcome, { parse_mode: 'HTML' });
  });

  // 5. Perintah /help: Daftar perintah & tips bertanya
  bot.command('help', async (ctx) => {
    const help =
      `📖 <b>Panduan Penggunaan AI Study Assistant</b>\n\n` +
      `<b>1. Daftar Perintah:</b>\n` +
      `• <code>/start</code> - Memulai bot & melihat pengenalan\n` +
      `• <code>/help</code> - Menampilkan bantuan ini\n` +
      `• <code>/model</code> - Melihat provider & nama model yang sedang digunakan\n` +
      `• <code>/reset</code> - Menghapus riwayat percakapan agar fokus pada materi baru\n\n` +
      `<b>2. Contoh Pertanyaan Belajar:</b>\n` +
      `• <i>"Jelaskan siklus Krebs dalam biologi secara sederhana"</i>\n` +
      `• <i>"Bagaimana cara kerja algoritma Binary Search dan apa bedanya dengan Linear Search?"</i>\n` +
      `• <i>"Tunjukkan langkah penyelesaian integral dari x^2 * sin(x) dx"</i>\n` +
      `• <i>"Apa perbedaan antara inflasi tarikan permintaan dan desakan biaya dalam ekonomi?"</i>\n\n` +
      `<b>3. Catatan:</b>\n` +
      `• Bot mengingat percakapan sebelumnya (hingga ${config.MAX_HISTORY_MESSAGES} pesan).\n` +
      `• Gunakan <code>/reset</code> jika ingin berpindah ke mata pelajaran lain agar AI tidak bingung.`;

    await ctx.reply(help, { parse_mode: 'HTML' });
  });

  // 6. Perintah /model: Tampilkan provider dan model yang aktif
  bot.command('model', async (ctx) => {
    const providerUpper = llmProvider.name.toUpperCase();
    const info =
      `🤖 <b>Status Mesin AI:</b>\n\n` +
      `• <b>Provider:</b> <code>${providerUpper}</code>\n` +
      `• <b>Model:</b> <code>${llmProvider.model}</code>\n` +
      `• <b>Maks Memori Riwayat:</b> <code>${config.MAX_HISTORY_MESSAGES} pesan</code>\n` +
      `• <b>Batas Pesan:</b> <code>${config.RATE_LIMIT_PER_MINUTE} pesan/menit</code>\n` +
      `• <b>Mode Eksekusi:</b> <code>${config.MODE}</code>`;

    await ctx.reply(info, { parse_mode: 'HTML' });
  });

  // 7. Perintah /reset: Hapus riwayat percakapan user
  bot.command('reset', async (ctx) => {
    const userId = ctx.from?.id;
    if (!userId) return;

    const count = clearHistory(userId);
    rateLimiter.reset(userId);

    const reply =
      `🧹 <b>Riwayat Berhasil Dibersihkan!</b>\n\n` +
      `Sebanyak <b>${count} pesan</b> sebelumnya telah dihapus dari memori.\n` +
      `Kamu sekarang bisa memulai topik belajar baru tanpa terpengaruh obrolan sebelumnya! ✨`;

    await ctx.reply(reply, { parse_mode: 'HTML' });
  });

  // 8. Handler Pesan Non-Teks (Foto, Suara, Video, Dokumen, Stiker)
  bot.on(
    [
      'message:photo',
      'message:voice',
      'message:video',
      'message:document',
      'message:sticker',
      'message:audio',
      'message:contact',
      'message:location',
    ],
    async (ctx) => {
      await ctx.reply(
        '📎 Maaf, saat ini saya hanya bisa menerima pertanyaan dalam bentuk teks. ' +
        'Silakan ketik pertanyaan atau materi pelajaran yang ingin kamu diskusikan ya!'
      );
    }
  );

  // 9. Handler Pesan Teks Biasa (Tanya Tutor AI)
  bot.on('message:text', async (ctx) => {
    const userId = ctx.from?.id;
    const userText = ctx.message.text.trim();

    if (!userId || !userText) return;

    // A. Rate Limit Check
    const rateCheck = rateLimiter.check(userId, config.RATE_LIMIT_PER_MINUTE);
    if (rateCheck.limited) {
      await ctx.reply(
        `⏳ <b>Pelan-pelan ya, tunggu sebentar!</b>\n\n` +
        `Kamu sudah mengirim terlalu banyak pesan dalam 1 menit. Silakan tunggu sekitar <b>${rateCheck.retryAfterSeconds} detik</b> sebelum bertanya lagi.`,
        { parse_mode: 'HTML' }
      );
      return;
    }

    // B. Simpan pertanyaan user ke SQLite
    saveMessage(userId, 'user', userText);

    // C. Ambil riwayat chat terbaru untuk konteks LLM
    const history = getHistory(userId, config.MAX_HISTORY_MESSAGES);

    // D. Nyalakan Indikator "Typing..." secara berulang setiap ~4 detik
    let typingInterval: NodeJS.Timeout | null = null;
    const sendTyping = async () => {
      try {
        await ctx.replyWithChatAction('typing');
      } catch (err) {
        // Abaikan jika Telegram chat action gagal sesaat
      }
    };

    // Kirim pertama kali langsung
    await sendTyping();
    typingInterval = setInterval(sendTyping, 4000);

    try {
      // E. Panggil LLM Provider
      const aiReply = await llmProvider.generate(history, config.systemPrompt);

      // F. Simpan jawaban bot ke SQLite & bersihkan riwayat berlebih
      saveMessage(userId, 'assistant', aiReply);
      pruneOldMessages(userId, config.MAX_HISTORY_MESSAGES * 2);

      // G. Pecah jawaban jika melebihi batas 4096 karakter Telegram
      const chunks = splitMessage(aiReply, 4000);

      // H. Kirim tiap chunk dengan format Telegram yang aman
      for (const chunk of chunks) {
        const formattedHtml = markdownToTelegramHtml(chunk);
        try {
          await ctx.reply(formattedHtml, { parse_mode: 'HTML' });
        } catch (parseError: any) {
          console.warn(
            `[TELEGRAM PARSE WARNING] Gagal mengirim dengan parse_mode HTML (${parseError?.message}). Mengirim ulang sebagai teks biasa...`
          );
          // Fallback otomatis tanpa formatting
          await ctx.reply(chunk);
        }
      }
    } catch (error: any) {
      console.error(`[LLM/CHAT ERROR] Gagal memproses pertanyaan dari user ${userId}:`, error);

      const errorMessage =
        '😔 <b>Maaf, terjadi kendala saat memproses jawaban belajarmu.</b>\n\n' +
        'Layanan AI sedang sibuk atau mengalami gangguan sementara. Silakan coba tanyakan kembali dalam beberapa saat ya!';

      await ctx.reply(errorMessage, { parse_mode: 'HTML' });
    } finally {
      // Hentikan indikator typing setelah selesai
      if (typingInterval) {
        clearInterval(typingInterval);
        typingInterval = null;
      }
    }
  });

  return bot;
}
