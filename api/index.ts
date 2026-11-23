import type { IncomingMessage, ServerResponse } from 'http';
import { loadConfig } from '../src/config';
import { createLLMProvider } from '../src/llm';
import { createBot } from '../src/bot';
import { RateLimiter } from '../src/utils/rateLimit';

let botInstance: any = null;
let rateLimiterInstance: RateLimiter | null = null;
let configInstance: any = null;

async function getOrInitBot() {
  if (botInstance) return { bot: botInstance, config: configInstance };

  configInstance = loadConfig();
  rateLimiterInstance = new RateLimiter(60000);
  const llmProvider = createLLMProvider(configInstance);
  botInstance = createBot(configInstance, llmProvider, rateLimiterInstance);

  if (!botInstance.isInited()) {
    await botInstance.init();
  }

  return { bot: botInstance, config: configInstance };
}

async function parseBody(req: IncomingMessage): Promise<any> {
  // Jika Vercel sudah mem-parse body ke (req as any).body
  if ((req as any).body) {
    if (typeof (req as any).body === 'string') {
      try {
        return JSON.parse((req as any).body);
      } catch {
        return {};
      }
    }
    return (req as any).body;
  }

  // Jika body masih berupa raw stream
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
    req.on('end', () => {
      try {
        const raw = Buffer.concat(chunks).toString('utf-8');
        resolve(raw.trim().length > 0 ? JSON.parse(raw) : {});
      } catch (err) {
        reject(err);
      }
    });
    req.on('error', reject);
  });
}

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  try {
    const { bot, config } = await getOrInitBot();

    // 1. Tangani request POST dari Telegram (pesan chat masuk)
    if (req.method === 'POST') {
      // Verifikasi secret token Telegram jika diset
      if (config.WEBHOOK_SECRET) {
        const secretHeader = req.headers['x-telegram-bot-api-secret-token'];
        if (secretHeader !== config.WEBHOOK_SECRET) {
          res.writeHead(401, { 'Content-Type': 'text/plain' });
          res.end('Unauthorized: secret token mismatch');
          return;
        }
      }

      const update = await parseBody(req);
      if (update && typeof update === 'object' && Object.keys(update).length > 0) {
        await bot.handleUpdate(update);
      }

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true }));
      return;
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
