import OpenAI from 'openai';
import { LLMProvider, ChatMessage } from './types';
import { withRetry } from '../utils/retry';

export class GroqProvider implements LLMProvider {
  public readonly name = 'groq';
  public readonly model: string;
  private client: OpenAI;

  constructor(apiKey: string, model: string) {
    this.model = model;
    this.client = new OpenAI({
      apiKey: apiKey,
      baseURL: 'https://api.groq.com/openai/v1',
    });
  }

  async generate(messages: ChatMessage[], systemPrompt: string): Promise<string> {
    return withRetry(async () => {
      const formattedMessages: OpenAI.Chat.ChatCompletionMessageParam[] = [
        { role: 'system', content: systemPrompt },
        ...messages.map((msg) => ({
          role: msg.role as 'user' | 'assistant',
          content: msg.content,
        })),
      ];

      const response = await this.client.chat.completions.create({
        model: this.model,
        messages: formattedMessages,
      });

      const text = response.choices[0]?.message?.content;
      if (!text || text.trim().length === 0) {
        throw new Error('Groq API mengembalikan respons teks kosong.');
      }

      return text.trim();
    });
  }
}
