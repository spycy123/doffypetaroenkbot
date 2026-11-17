import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { z } from 'zod';

// Muat variabel lingkungan dari file .env
dotenv.config();

const rawEnvSchema = z.object({
  TELEGRAM_BOT_TOKEN: z.string().min(1, 'TELEGRAM_BOT_TOKEN wajib diisi.'),
  LLM_PROVIDER: z.enum(['gemini', 'openai', 'groq'], {
    message: "LLM_PROVIDER harus 'gemini', 'openai', atau 'groq'."
  }),
  GEMINI_API_KEY: z.string().optional(),
  GEMINI_MODEL: z.string().optional(),
  OPENAI_API_KEY: z.string().optional(),
  OPENAI_MODEL: z.string().optional(),
  GROQ_API_KEY: z.string().optional(),
  GROQ_MODEL: z.string().optional().default('qwen/qwen3.8-27b'),
  ALLOWED_USER_IDS: z.string().optional(),
  MAX_HISTORY_MESSAGES: z.coerce.number().int().min(1, 'MAX_HISTORY_MESSAGES minimal 1').default(20),
  RATE_LIMIT_PER_MINUTE: z.coerce.number().int().min(1, 'RATE_LIMIT_PER_MINUTE minimal 1').default(10),
  MODE: z.enum(['polling', 'webhook']).default('polling'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  WEBHOOK_URL: z.string().optional(),
  WEBHOOK_SECRET: z.string().optional(),
});

const envSchema = rawEnvSchema.superRefine((data, ctx) => {
  if (data.LLM_PROVIDER === 'gemini') {
    if (!data.GEMINI_API_KEY || data.GEMINI_API_KEY.trim() === '') {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'GEMINI_API_KEY wajib diisi jika LLM_PROVIDER=gemini. Buat API key di https://aistudio.google.com/',
        path: ['GEMINI_API_KEY'],
      });
    }
    if (!data.GEMINI_MODEL || data.GEMINI_MODEL.trim() === '') {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'GEMINI_MODEL wajib diisi jika LLM_PROVIDER=gemini (contoh: gemini-2.5-flash).',
        path: ['GEMINI_MODEL'],
      });
    }
  }

  if (data.LLM_PROVIDER === 'openai') {
    if (!data.OPENAI_API_KEY || data.OPENAI_API_KEY.trim() === '') {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'OPENAI_API_KEY wajib diisi jika LLM_PROVIDER=openai. Buat API key di https://platform.openai.com/api-keys',
        path: ['OPENAI_API_KEY'],
      });
    }
    if (!data.OPENAI_MODEL || data.OPENAI_MODEL.trim() === '') {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'OPENAI_MODEL wajib diisi jika LLM_PROVIDER=openai (contoh: gpt-4o-mini).',
        path: ['OPENAI_MODEL'],
      });
    }
  }

  if (data.LLM_PROVIDER === 'groq') {
    if (!data.GROQ_API_KEY || data.GROQ_API_KEY.trim() === '') {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'GROQ_API_KEY wajib diisi jika LLM_PROVIDER=groq. Buat API key gratis di https://console.groq.com/keys',
        path: ['GROQ_API_KEY'],
      });
    }
    if (!data.GROQ_MODEL || data.GROQ_MODEL.trim() === '') {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'GROQ_MODEL wajib diisi jika LLM_PROVIDER=groq (contoh: llama-3.3-70b-versatile).',
        path: ['GROQ_MODEL'],
      });
    }
  }

  if (data.MODE === 'webhook' && !process.env.VERCEL) {
    if (!data.WEBHOOK_URL || data.WEBHOOK_URL.trim() === '') {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'WEBHOOK_URL wajib diisi jika MODE=webhook (contoh: https://domain-kamu.com/webhook).',
        path: ['WEBHOOK_URL'],
      });
    } else if (!data.WEBHOOK_URL.startsWith('https://')) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Telegram API mengharuskan URL webhook menggunakan HTTPS (https://...).',
        path: ['WEBHOOK_URL'],
      });
    }
  }
});

export interface AppConfig {
  TELEGRAM_BOT_TOKEN: string;
  LLM_PROVIDER: 'gemini' | 'openai' | 'groq';
  GEMINI_API_KEY?: string;
  GEMINI_MODEL?: string;
  OPENAI_API_KEY?: string;
  OPENAI_MODEL?: string;
  GROQ_API_KEY?: string;
  GROQ_MODEL?: string;
  ALLOWED_USER_IDS: number[];
  MAX_HISTORY_MESSAGES: number;
  RATE_LIMIT_PER_MINUTE: number;
  MODE: 'polling' | 'webhook';
  PORT: number;
  WEBHOOK_URL?: string;
  WEBHOOK_SECRET?: string;
  systemPrompt: string;
}

export function loadSystemPrompt(promptPath = path.join(process.cwd(), 'prompts', 'system.txt')): string {
  try {
    if (fs.existsSync(promptPath)) {
      const content = fs.readFileSync(promptPath, 'utf8').trim();
      if (content.length > 0) return content;
    }
  } catch (error) {
    console.warn(`[CONFIG WARNING] Gagal membaca file system prompt di ${promptPath}:`, error);
  }

  return (
    'Kamu adalah tutor AI yang membantu pengguna belajar. Jawab dalam bahasa Indonesia yang santai tapi jelas, ' +
    'kecuali pengguna memakai bahasa lain. Saat menjelaskan materi: mulai dari inti konsep dalam 1-2 kalimat, ' +
    'lalu jelaskan bertahap, beri contoh konkret, dan tutup dengan ringkasan singkat atau pertanyaan latihan jika relevan. ' +
    'Jika pertanyaan ambigu, tanyakan klarifikasi singkat. Jika kamu tidak yakin, katakan terus terang, jangan mengarang fakta. ' +
    'Untuk soal hitungan, tunjukkan langkah penyelesaian. Jaga jawaban ringkas kecuali pengguna minta detail.'
  );
}

export function parseAllowedUserIds(raw?: string): number[] {
  if (!raw || raw.trim() === '') return [];
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
    .map((s) => {
      const num = Number(s);
      if (isNaN(num)) {
        console.warn(`[CONFIG WARNING] User ID '${s}' bukan angka yang valid dan akan diabaikan.`);
        return null;
      }
      return num;
    })
    .filter((id): id is number => id !== null);
}

export function loadConfig(): AppConfig {
  const result = envSchema.safeParse(process.env);

  if (!result.success) {
    console.error('\n========================================');
    console.error('❌ KESALAHAN KONFIGURASI ENVIRONMENT (.env)');
    console.error('========================================');
    for (const issue of result.error.issues) {
      const field = issue.path.join('.') || 'Global';
      console.error(`- [${field}]: ${issue.message}`);
    }
    console.error('========================================');
    console.error('Silakan periksa file .env Anda atau gunakan .env.example sebagai acuan.\n');
    if (process.env.VERCEL) {
      const messages = result.error.issues.map((i) => `[${i.path.join('.') || 'Global'}]: ${i.message}`).join('; ');
      throw new Error(`Kesalahan konfigurasi env: ${messages}`);
    }
    process.exit(1);
  }

  const validData = result.data;

  return {
    TELEGRAM_BOT_TOKEN: validData.TELEGRAM_BOT_TOKEN.trim(),
    LLM_PROVIDER: validData.LLM_PROVIDER,
    GEMINI_API_KEY: validData.GEMINI_API_KEY?.trim(),
    GEMINI_MODEL: validData.GEMINI_MODEL?.trim(),
    OPENAI_API_KEY: validData.OPENAI_API_KEY?.trim(),
    OPENAI_MODEL: validData.OPENAI_MODEL?.trim(),
    GROQ_API_KEY: validData.GROQ_API_KEY?.trim(),
    GROQ_MODEL: validData.GROQ_MODEL?.trim(),
    ALLOWED_USER_IDS: parseAllowedUserIds(validData.ALLOWED_USER_IDS),
    MAX_HISTORY_MESSAGES: validData.MAX_HISTORY_MESSAGES,
    RATE_LIMIT_PER_MINUTE: validData.RATE_LIMIT_PER_MINUTE,
    MODE: validData.MODE,
    PORT: validData.PORT,
    WEBHOOK_URL: validData.WEBHOOK_URL,
    WEBHOOK_SECRET: validData.WEBHOOK_SECRET,
    systemPrompt: loadSystemPrompt(),
  };
}
