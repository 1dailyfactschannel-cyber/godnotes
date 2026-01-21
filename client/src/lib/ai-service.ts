
import { useFileSystem } from './mock-fs';

export interface AIConfig {
  provider: 'openai' | 'anthropic' | 'custom';
  apiKey: string;
  baseUrl?: string;
  model: string;
}

export interface AIResponse {
  text: string;
  error?: string;
}

export async function generateText(prompt: string, context: string = ''): Promise<AIResponse> {
  const { aiConfig } = useFileSystem.getState();

  if (!aiConfig || !aiConfig.apiKey) {
    return { text: '', error: 'API Key is missing. Please configure AI settings.' };
  }

  const systemPrompt = `You are an intelligent writing assistant embedded in a note-taking app. 
  Your goal is to help the user write, edit, and improve their notes.
  Be concise and helpful. Return only the requested text without conversational filler if possible.
  ${context ? `\nContext:\n${context}` : ''}`;

  try {
    const baseUrl = aiConfig.baseUrl || 'https://api.openai.com/v1';
    const url = `${baseUrl}/chat/completions`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${aiConfig.apiKey}`,
      },
      body: JSON.stringify({
        model: aiConfig.model || 'gpt-3.5-turbo',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: prompt }
        ],
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return { text: '', error: errorData.error?.message || `API Error: ${response.statusText}` };
    }

    const data = await response.json();
    const text = data.choices?.[0]?.message?.content || '';
    return { text };
  } catch (error: any) {
    return { text: '', error: error.message || 'Failed to connect to AI service' };
  }
}
