import type { IncomingMessage, ServerResponse } from 'http';
import { webhookCallback } from 'grammy';
import { loadConfig } from '../src/config';
import { createLLMProvider } from '../src/llm';
import { createBot } from '../src/bot';
import { RateLimiter } from '../src/utils/rateLimit';

let cachedHandler: ((req: IncomingMessage, res: ServerResponse) => Promise<void>) | null = null;

function getHandler() {
  if (cachedHandler) return cachedHandler;

  const config = loadConfig();
  const rateLimiter = new RateLimiter(60000);
  const llmProvider = createLLMProvider(config);
  const bot = createBot(config, llmProvider, rateLimiter);

  const telegramWebhook = webhookCallback(bot, 'http', {
    secretToken: config.WEBHOOK_SECRET,
  });

  cachedHandler = async (req: IncomingMessage, res: ServerResponse) => {
    // 1. Tangani request POST dari Telegram (pesan chat masuk)
    if (req.method === 'POST') {
      return telegramWebhook(req, res);
    }

    // 2. Fitur bantuan: Otomatis set webhook lewat browser
    // Contoh buka: https://nama-projek.vercel.app/api?action=setWebhook
    const url = new URL(req.url || '/', `https://${req.headers.host || 'localhost'}`);
    if (url.searchParams.get('action') === 'setWebhook') {
      const webhookUrl = `https://${req.headers.host}/api`;
      try {
        await bot.api.setWebhook(webhookUrl, {
          secret_token: config.WEBHOOK_SECRET,
        });
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(
          JSON.stringify({
            status: 'success',
            message: `Webhook berhasil diarahkan ke ${webhookUrl}`,
          })
        );
      } catch (err: any) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(
          JSON.stringify({
            status: 'error',
            message: err.message || 'Gagal mendaftarkan webhook',
          })
        );
      }
      return;
    }

    // 3. Health check GET biasa
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('AI Study Assistant Telegram Bot is running on Vercel!');
  };

  return cachedHandler;
}

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  try {
    const handle = getHandler();
    return await handle(req, res);
  } catch (err: any) {
    console.error('[VERCEL HANDLER ERROR]:', err);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(
      JSON.stringify({
        status: 'error',
        message: err.message || 'Internal Server Error',
      })
    );
  }
}
