
import { useFileSystem, BUILT_IN_AI_CONFIG, AI_API_KEYS } from './mock-fs';

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

// Функция для проверки, является ли ошибка связанной с лимитом
function isRateLimitError(errorData: any, status: number): boolean {
  // Проверяем статусы HTTP, которые обычно указывают на лимиты
  const rateLimitStatuses = [429, 403];
  if (rateLimitStatuses.includes(status)) {
    return true;
  }
  
  // Проверяем текст ошибки на ключевые фразы
  const errorMessage = (errorData.error?.message || '').toLowerCase();
  const rateLimitKeywords = [
    'rate limit',
    'limit exceeded',
    'quota exceeded',
    'quota reached',
    'insufficient quota',
    'rate_limited',
    'too many requests',
    'over quota'
  ];
  
  return rateLimitKeywords.some(keyword => errorMessage.includes(keyword));
}

// Функция для получения следующего доступного API-ключа
function getNextApiKey(currentKey: string): string | null {
  const currentIndex = AI_API_KEYS.indexOf(currentKey);
  if (currentIndex === -1 || currentIndex >= AI_API_KEYS.length - 1) {
    return null; // Нет больше резервных ключей
  }
  return AI_API_KEYS[currentIndex + 1];
}

export async function generateText(prompt: string, context: string = ''): Promise<AIResponse> {
  const { aiConfig, updateAIConfig } = useFileSystem.getState();

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
    let currentAiConfig = aiConfig;
    let attempts = 0;
    const maxAttempts = AI_API_KEYS.length;

    while (attempts < maxAttempts) {
      attempts++;
      
      let baseUrl = currentAiConfig.baseUrl || 'https://api.openai.com/v1';
      
      if (currentAiConfig.provider === 'openrouter') {
        baseUrl = 'https://openrouter.ai/api/v1';
      }

      const url = `${baseUrl}/chat/completions`;

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${currentAiConfig.apiKey}`,
      };

      if (currentAiConfig.provider === 'openrouter') {
        headers['HTTP-Referer'] = 'https://godnotes.app'; // Required by OpenRouter
        headers['X-Title'] = 'GodNotes'; // Optional
      }

      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          model: currentAiConfig.model || (currentAiConfig.provider === 'openrouter' ? 'tngtech/deepseek-r1t2-chimera:free' : 'gpt-3.5-turbo'),
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: prompt }
          ],
          temperature: 0.7,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        const text = data.choices?.[0]?.message?.content || '';
        return { text };
      } else {
        const errorData = await response.json().catch(() => ({}));
        
        // Проверяем, является ли ошибка связанной с лимитом
        if (isRateLimitError(errorData, response.status) && currentAiConfig.mode === 'builtin') {
          const nextKey = getNextApiKey(currentAiConfig.apiKey);
          if (nextKey) {
            // Обновляем конфигурацию с новым ключом
            const newConfig = { ...currentAiConfig, apiKey: nextKey };
            updateAIConfig(newConfig);
            currentAiConfig = newConfig;
            console.log(`[AI] Switched to next API key due to rate limit. Attempt ${attempts}/${maxAttempts}`);
            continue; // Продолжаем с новым ключом
          }
        }
        
        // Если это не ошибка лимита или нет больше ключей, возвращаем ошибку
        return { text: '', error: errorData.error?.message || `API Error: ${response.statusText}` };
      }
    }
    
    // Все ключи исчерпаны
    return { text: '', error: 'Все встроенные API-ключи исчерпали лимиты. Пожалуйста, используйте свою модель в настройках.' };
  } catch (error: any) {
    return { text: '', error: error.message || 'Failed to connect to AI service' };
  }
}
