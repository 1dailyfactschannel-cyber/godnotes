
import { useFileSystem, BUILT_IN_AI_CONFIG, AI_KEY_POOL } from './mock-fs';

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

let currentKeyIndex = 0;
let activeKeyPool: string[] = [];
let isPoolInitialized = false;

// URL для получения новых ключей (замените на ваш реальный URL)
// Формат JSON: ["key1", "key2"] или {"keys": ["key1", "key2"]}
const REMOTE_KEYS_URL = 'https://raw.githubusercontent.com/1dailyfactschannel-cyber/godnotes/main/ai-keys.json';

function initializePool() {
  if (!isPoolInitialized) {
    activeKeyPool = [...AI_KEY_POOL];
    isPoolInitialized = true;
  }
}

async function fetchRemoteKeys(): Promise<boolean> {
  try {
    console.log('Attempting to fetch remote keys...');
    const response = await fetch(REMOTE_KEYS_URL);
    if (!response.ok) return false;

    const data = await response.json();
    const newKeys = Array.isArray(data) ? data : data.keys;

    if (Array.isArray(newKeys)) {
      const validKeys = newKeys.filter((k: any) => typeof k === 'string' && k.length > 10);
      const uniqueNewKeys = validKeys.filter((k: string) => !activeKeyPool.includes(k));

      if (uniqueNewKeys.length > 0) {
        console.log(`Found ${uniqueNewKeys.length} new keys`);
        activeKeyPool.push(...uniqueNewKeys);
        return true;
      }
    }
  } catch (error) {
    console.error('Failed to fetch remote keys:', error);
  }
  return false;
}

export async function generateText(prompt: string, context: string = ''): Promise<AIResponse> {
  const { aiConfig, updateAIConfig } = useFileSystem.getState();

  // Если режим builtin, используем логику ротации ключей
  const isBuiltin = aiConfig.mode === 'builtin';
  
  // Если это кастомный режим и ключа нет - ошибка
  if (!isBuiltin && (!aiConfig || !aiConfig.apiKey)) {
    return { text: '', error: 'API Key is missing. Please configure AI settings.' };
  }

  let systemPrompt = `You are an intelligent writing assistant embedded in a note-taking app. 
  Your goal is to help the user write, edit, and improve their notes.
  Be concise and helpful. Return only the requested text without conversational filler if possible.`;

  // Force Russian language for built-in model
  if (isBuiltin) {
    systemPrompt += `\nIMPORTANT: ALWAYS answer in Russian language.`;
  }

  systemPrompt += `${context ? `\nContext:\n${context}` : ''}`;

  // Функция для выполнения запроса с конкретным ключом
  const executeRequest = async (apiKey: string) => {
    let baseUrl = aiConfig.baseUrl || 'https://api.openai.com/v1';
    
    if (aiConfig.provider === 'openrouter') {
      baseUrl = 'https://openrouter.ai/api/v1';
    }

    const url = `${baseUrl}/chat/completions`;

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
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
      const errorMessage = errorData.error?.message || `API Error: ${response.statusText}`;
      
      // Проверяем ошибки, требующие смены ключа (401 - Auth, 402 - Payment, 429 - Rate Limit)
      if (response.status === 401 || response.status === 402 || response.status === 429) {
        throw new Error(`ROTATION_REQUIRED: ${errorMessage}`);
      }
      
      throw new Error(errorMessage);
    }

    const data = await response.json();
    return data.choices?.[0]?.message?.content || '';
  };

  try {
    if (isBuiltin) {
      initializePool();
      
      const failedKeys = new Set<string>();
      let hasTriedRemoteFetch = false;
      
      // Бесконечный цикл, выход только через return или throw
      while (true) {
        // Если перебрали все ключи
        if (failedKeys.size >= activeKeyPool.length) {
          if (!hasTriedRemoteFetch) {
            // Пытаемся получить новые ключи
            const gotNewKeys = await fetchRemoteKeys();
            if (gotNewKeys) {
              hasTriedRemoteFetch = true;
              // Продолжаем цикл, так как activeKeyPool увеличился
              // Сбрасываем индекс на первый новый ключ (примерно)
              // Или просто идем дальше, так как failedKeys.size теперь < activeKeyPool.length
              currentKeyIndex = (currentKeyIndex + 1) % activeKeyPool.length;
              continue;
            }
          }
          throw new Error('All AI keys exhausted. Please check your internet connection or try again later.');
        }

        const keyToUse = activeKeyPool[currentKeyIndex];
        
        // Если этот ключ уже пробовали в этом вызове (и он не сработал), пропускаем
        if (failedKeys.has(keyToUse)) {
          currentKeyIndex = (currentKeyIndex + 1) % activeKeyPool.length;
          continue;
        }

        try {
          const text = await executeRequest(keyToUse);
          return { text };
        } catch (error: any) {
          if (error.message?.startsWith('ROTATION_REQUIRED')) {
            console.warn(`Key failed (${error.message}), rotating...`);
            failedKeys.add(keyToUse);
            currentKeyIndex = (currentKeyIndex + 1) % activeKeyPool.length;
          } else throw error;
        }
      }
    } else {
      // Custom mode
      const text = await executeRequest(aiConfig.apiKey);
      return { text };
    }
  } catch (error: any) {
    console.error('AI Generation error:', error);
    return { 
      text: '', 
      error: error.message || 'Failed to generate text' 
    };
  }
}
