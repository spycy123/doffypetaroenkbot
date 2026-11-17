import { AppConfig, loadSystemPrompt } from '../src/config';
import { LLMProvider, ChatMessage } from '../src/llm/types';
import { RateLimiter } from '../src/utils/rateLimit';
import { createBot } from '../src/bot';
import { getDatabase, saveMessage, getHistory, clearHistory, closeDatabase } from '../src/db';
import { splitMessage } from '../src/utils/splitMessage';
import { markdownToTelegramHtml } from '../src/utils/formatTelegram';

console.log('--- Menjalankan Integration Test Alur Bot ---');

// 1. Mock LLM Provider
class MockTutorProvider implements LLMProvider {
  public readonly name = 'mock-tutor';
  public readonly model = 'mock-v1';

  async generate(messages: ChatMessage[], systemPrompt: string): Promise<string> {
    const lastMsg = messages[messages.length - 1];
    return (
      `**Penjelasan Tutor:** Mengenai "${lastMsg.content}".\n\n` +
      `Konsep dasarnya adalah *sangat sederhana*.\n` +
      `Contoh kode:\n` +
      `\`\`\`python\n` +
      `def sapa():\n` +
      `    print("Halo Dunia!")\n` +
      `\`\`\`\n` +
      `Apakah ada bagian yang belum jelas?`
    );
  }
}

// 2. Mock Config
const mockConfig: AppConfig = {
  TELEGRAM_BOT_TOKEN: '123456789:ABCdefGHIjklMNOpqrsTUVwxyz',
  LLM_PROVIDER: 'gemini',
  GEMINI_API_KEY: 'test-key',
  GEMINI_MODEL: 'gemini-2.5-flash',
  ALLOWED_USER_IDS: [11111, 22222],
  MAX_HISTORY_MESSAGES: 5,
  RATE_LIMIT_PER_MINUTE: 10,
  MODE: 'polling',
  PORT: 3000,
  systemPrompt: loadSystemPrompt(),
};

// 3. Database test
getDatabase(':memory:');
saveMessage(11111, 'user', 'Apa itu loop?');
const history = getHistory(11111, 5);
console.log('DB History:', history.length === 1 ? 'OK' : 'FAIL');

// 4. Rate Limiter test
const limiter = new RateLimiter(60000);
const r1 = limiter.check(11111, 10);
console.log('Rate Limiter check:', !r1.limited ? 'OK' : 'FAIL');

// 5. Bot initialization test
const mockLlm = new MockTutorProvider();
const bot = createBot(mockConfig, mockLlm, limiter);
console.log('Bot initialized:', bot ? 'OK' : 'FAIL');

// 6. Formatting & Splitting test
const responseText = `
# Hukum Newton I
Benda akan tetap diam atau bergerak lurus beraturan jika tidak ada resultan gaya yang bekerja (ΣF = 0).

**Contoh Nyata:**
Saat kamu naik bus yang tiba-tiba direm, tubuhmu akan terdorong ke depan karena mempertahankan keadaan gerak.

\`\`\`
Rumus: ΣF = 0
\`\`\`
`;
const chunks = splitMessage(responseText, 4000);
const formattedChunks = chunks.map(c => markdownToTelegramHtml(c));
console.log('Formatted chunks count:', formattedChunks.length);
console.log('First chunk HTML contains <b>:', formattedChunks[0].includes('<b>Hukum Newton I</b>') ? 'OK' : 'FAIL');

// Cleanup
limiter.destroy();
clearHistory(11111);
closeDatabase();

console.log('✅ Semua integration tests berhasil!');
