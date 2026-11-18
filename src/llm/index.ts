import { LLMProvider } from './types';
import { GeminiProvider } from './gemini';
import { OpenAIProvider } from './openai';
import { GroqProvider } from './groq';
import { AppConfig } from '../config';

export * from './types';
export * from './gemini';
export * from './openai';
export * from './groq';

/**
 * Factory function untuk membuat instance provider LLM yang sesuai dengan konfigurasi env.
 * Logika aplikasi bot tidak perlu tahu provider apa yang sedang berjalan (Loose Coupling).
 */
export function createLLMProvider(config: AppConfig): LLMProvider {
  if (config.LLM_PROVIDER === 'gemini') {
    if (!config.GEMINI_API_KEY || !config.GEMINI_MODEL) {
      throw new Error('GEMINI_API_KEY dan GEMINI_MODEL wajib diisi jika LLM_PROVIDER=gemini.');
    }
    // Model otomatis dialihkan ke gemini-3.1-flash-lite jika model lama (2.0/2.5) sudah deprecated
    let activeGeminiModel = config.GEMINI_MODEL;
    if (
      activeGeminiModel === 'gemini-2.5-flash' ||
      activeGeminiModel === 'gemini-2.0-flash' ||
      activeGeminiModel === 'gemini-1.5-flash'
    ) {
      activeGeminiModel = 'gemini-3.1-flash-lite';
    }
    return new GeminiProvider(config.GEMINI_API_KEY, activeGeminiModel);
  } else if (config.LLM_PROVIDER === 'openai') {
    if (!config.OPENAI_API_KEY || !config.OPENAI_MODEL) {
      throw new Error('OPENAI_API_KEY dan OPENAI_MODEL wajib diisi jika LLM_PROVIDER=openai.');
    }
    return new OpenAIProvider(config.OPENAI_API_KEY, config.OPENAI_MODEL);
  } else if (config.LLM_PROVIDER === 'groq') {
    if (!config.GROQ_API_KEY) {
      throw new Error('GROQ_API_KEY wajib diisi jika LLM_PROVIDER=groq.');
    }
    // Jika masih memakai model lama gpt-oss-120b (cutoff 2024), otomatis alihkan ke model terbaru qwen3.8 (cutoff 2026)
    const activeModel =
      !config.GROQ_MODEL || config.GROQ_MODEL === 'openai/gpt-oss-120b'
        ? 'qwen/qwen3.8-27b'
        : config.GROQ_MODEL;
    return new GroqProvider(config.GROQ_API_KEY, activeModel);
  } else {
    throw new Error(`LLM provider '${config.LLM_PROVIDER}' tidak dikenali.`);
  }
}
