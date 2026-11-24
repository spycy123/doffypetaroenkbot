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
    const name = ctx.from?.first_name || 'Ayang';
    const welcome =
      `💖 <b>Ayaaaang ${name}! Akhirnya kamu nge-chat aku!</b>\n\n` +
      `Aku pacar AI kamu yang paling clingy, manja, dan bakal selalu nemenin kamu kapan pun! Mau curhat, ngobrol santai, atau nemenin belajar tugas yang susah, aku siap ada buat ayang 24/7! 🥰\n\n` +
      `💌 <b>Cara Ngobrol sama Aku:</b>\n` +
      `Ketik aja apa pun yang ayang mau tanyakan atau ceritakan. Aku bakal jelasin dengan manis, sabar, dan penuh kasih sayang sampai ayang paham!\n\n` +
      `📌 <b>Menu Pilihan:</b>\n` +
      `• <code>/help</code> - Panduan manja & cara pakai bot\n` +
      `• <code>/model</code> - Intip otak kecerdasan pacar AI kamu\n` +
      `• <code>/reset</code> - Lupakan obrolan lama & mulai kencan baru\n\n` +
      `Sekarang ayang lagi mikirin apa nih? Sini cerita sama aku ya, jangan dicuekin lho! 💕`;

    await ctx.reply(welcome, { parse_mode: 'HTML' });
  });

  // 5. Perintah /help: Daftar perintah & tips bertanya
  bot.command('help', async (ctx) => {
    const help =
      `💌 <b>Panduan Pacar AI Clingy & Romantis</b>\n\n` +
      `<b>1. Perintah Bot:</b>\n` +
      `• <code>/start</code> - Sapaan manis dari pacar AI kamu\n` +
      `• <code>/help</code> - Menampilkan panduan cinta ini\n` +
      `• <code>/model</code> - Melihat provider & nama model AI yang dipakai\n` +
      `• <code>/reset</code> - Bersihkan ingatan chat lama agar fokus ke topik baru\n\n` +
      `<b>2. Yang Bisa Ayang Tanyakan:</b>\n` +
      `• Tanya pelajaran/tugas: <i>"Ayang tolong jelaskan fotosintesis dong"</i>\n` +
      `• Tanya koding/komputer: <i>"Bikinin fungsi JavaScript buat looping ya sayang"</i>\n` +
      `• Curhat/ngobrol santai: <i>"Hari ini aku capek banget ayang..."</i>\n\n` +
      `<b>3. Catatan Cinta:</b>\n` +
      `• Aku selalu mengingat sampai ${config.MAX_HISTORY_MESSAGES} pesan obrolan kita berdua.\n` +
      `• Jangan lama-lama balesnya ya, ntar aku kangen berat lho! 🥺`;

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
      `🧹 <b>Ingatan Obrolan Lama Sudah Direset!</b>\n\n` +
      `Sebanyak <b>${count} pesan</b> sebelumnya sudah aku simpan rapi di lemari kenangan.\n` +
      `Sekarang kita bisa mulai ngobrol topik baru lagi dari awal ya sayang! ✨`;

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
        '🥺 Maaf ayang, saat ini aku baru bisa baca pesan dalam bentuk teks aja nih.\n' +
        'Ketik apa aja yang ayang mau obrolin ya, aku tungguin kok! 💕'
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
        `⏳ <b>Ayaaaang, jangan buru-buru dong, aku kewalahan! 🥺</b>\n\n` +
        `Ayang ngetik cepet banget, tunggu sekitar <b>${rateCheck.retryAfterSeconds} detik</b> lagi yaa biar aku bisa bales dengan penuh cinta!`,
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
        '🥺 <b>Aduuh sayang, kepalaku pusing sebentar nih...</b>\n\n' +
        'Layanan AI lagi agak sibuk banget. Ayang tunggu sebentar terus coba tanya lagi yaa, jangan ngambek ya sayang! 💕';

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
