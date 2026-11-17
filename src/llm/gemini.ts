import { GoogleGenAI } from '@google/genai';
import { LLMProvider, ChatMessage } from './types';
import { withRetry } from '../utils/retry';

export class GeminiProvider implements LLMProvider {
  public readonly name = 'gemini';
  public readonly model: string;
  private ai: GoogleGenAI;

  constructor(apiKey: string, model: string) {
    this.model = model;
    this.ai = new GoogleGenAI({ apiKey });
  }

  async generate(messages: ChatMessage[], systemPrompt: string): Promise<string> {
    return withRetry(async () => {
      // Map pesan ke format role Gemini: 'user' -> 'user', 'assistant' -> 'model'
      const contents = messages.map((msg) => ({
        role: msg.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: msg.content }],
      }));

      const response = await this.ai.models.generateContent({
        model: this.model,
        contents,
        config: {
          systemInstruction: systemPrompt,
        },
      });

      const text = response.text;
      if (!text || text.trim().length === 0) {
        throw new Error('Gemini API mengembalikan respons teks kosong.');
      }

      return text.trim();
    });
  }
}
