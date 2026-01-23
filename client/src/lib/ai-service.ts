
import { useFileSystem, BUILT_IN_AI_CONFIG } from './mock-fs';

export interface AIConfig {
  provider: 'openai' | 'anthropic' | 'custom' | 'openrouter';
  apiKey: string;
  baseUrl?: string;
  model: string;
  mode?: 'builtin' | 'custom';
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

  let systemPrompt = `You are an intelligent writing assistant embedded in a note-taking app. 
  Your goal is to help the user write, edit, and improve their notes.
  Be concise and helpful. Return only the requested text without conversational filler if possible.`;

  // Force Russian language for built-in model
  if (aiConfig.mode === 'builtin') {
    systemPrompt += `\nIMPORTANT: ALWAYS answer in Russian language.`;
  }

  systemPrompt += `${context ? `\nContext:\n${context}` : ''}`;

  try {
    let baseUrl = aiConfig.baseUrl || 'https://api.openai.com/v1';
    
    if (aiConfig.provider === 'openrouter') {
      baseUrl = 'https://openrouter.ai/api/v1';
    }

    const url = `${baseUrl}/chat/completions`;

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${aiConfig.apiKey}`,
    };

    if (aiConfig.provider === 'openrouter') {
      headers['HTTP-Referer'] = 'https://godnotes.app'; // Required by OpenRouter
      headers['X-Title'] = 'GodNotes'; // Optional
    }

    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model: aiConfig.model || (aiConfig.provider === 'openrouter' ? 'tngtech/deepseek-r1t2-chimera:free' : 'gpt-3.5-turbo'),
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
