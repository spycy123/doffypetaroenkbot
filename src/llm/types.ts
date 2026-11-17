export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface LLMProvider {
  readonly name: string;
  readonly model: string;
  generate(messages: ChatMessage[], systemPrompt: string): Promise<string>;
}
