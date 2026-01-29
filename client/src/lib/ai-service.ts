import { useFileSystem } from './data-store';

export interface AIConfig {
  provider: 'openai' | 'anthropic' | 'custom' | 'openrouter';
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

  let systemPrompt = `You are an intelligent writing assistant embedded in a note-taking app. 
  Your goal is to help the user write, edit, and improve their notes.
  Be concise and helpful. Return only the requested text without conversational filler if possible.`;

  systemPrompt += `${context ? `\nContext:\n${context}` : ''}`;

  try {
    let baseUrl = aiConfig.baseUrl;
    
    // Set default base URLs if not provided
    if (!baseUrl) {
      if (aiConfig.provider === 'openai') baseUrl = 'https://api.openai.com/v1';
      else if (aiConfig.provider === 'anthropic') baseUrl = 'https://api.anthropic.com/v1';
      else if (aiConfig.provider === 'openrouter') baseUrl = 'https://openrouter.ai/api/v1';
      else baseUrl = 'https://api.openai.com/v1'; // Default fallback
    }

    const isAnthropic = aiConfig.provider === 'anthropic' || baseUrl.includes('anthropic.com');
    const url = isAnthropic ? `${baseUrl}/messages` : `${baseUrl}/chat/completions`;

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (isAnthropic) {
      headers['x-api-key'] = aiConfig.apiKey;
      headers['anthropic-version'] = '2023-06-01';
      headers['dangerously-allow-browser'] = 'true'; // Required for client-side calls to Anthropic
    } else {
      headers['Authorization'] = `Bearer ${aiConfig.apiKey}`;
    }

    if (aiConfig.provider === 'openrouter') {
      headers['HTTP-Referer'] = 'https://godnotes.app';
      headers['X-Title'] = 'GodNotes';
    }

    let body: any;
    if (isAnthropic) {
      body = {
        model: aiConfig.model || 'claude-3-5-sonnet-20240620',
        max_tokens: 4096,
        system: systemPrompt,
        messages: [
          { role: 'user', content: prompt }
        ],
        temperature: 0.7,
      };
    } else {
      body = {
        model: aiConfig.model || (aiConfig.provider === 'openrouter' ? 'google/gemini-2.0-flash-lite-001' : 'gpt-4o'),
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: prompt }
        ],
        temperature: 0.7,
      };
    }

    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const errorMessage = errorData.error?.message || errorData.detail || `API Error: ${response.statusText}`;
      throw new Error(errorMessage);
    }

    const data = await response.json();
    
    if (isAnthropic) {
      return { text: data.content?.[0]?.text || '' };
    } else {
      return { text: data.choices?.[0]?.message?.content || '' };
    }
  } catch (error: any) {
    console.error('AI Generation error:', error);
    return { 
      text: '', 
      error: error.message || 'Failed to generate text' 
    };
  }
}
