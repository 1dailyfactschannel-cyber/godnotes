
import { create } from 'zustand';

// Mock types
type AIConfig = {
  provider: 'openai' | 'anthropic' | 'custom' | 'openrouter';
  apiKey: string;
  model: string;
  mode?: 'builtin' | 'custom';
};

const BUILT_IN_AI_CONFIG: AIConfig = {
  provider: 'openrouter',
  apiKey: 'sk-builtin',
  model: 'gemini',
  mode: 'builtin',
};

// Mock store
const useStore = create<{
  aiConfig: AIConfig;
  updateAIConfig: (config: Partial<AIConfig>) => void;
}>((set) => ({
  aiConfig: BUILT_IN_AI_CONFIG,
  updateAIConfig: (config) => set((state) => ({ aiConfig: { ...state.aiConfig, ...config } })),
}));

// Simulation
function simulate() {
  const store = useStore.getState();
  console.log('Initial:', store.aiConfig);

  // 1. Open dialog
  let open = true;
  let isBuiltIn = store.aiConfig.apiKey === BUILT_IN_AI_CONFIG.apiKey;
  let aiMode = isBuiltIn ? 'builtin' : 'custom';
  console.log('Opened. Mode:', aiMode);

  // 2. Switch to custom
  aiMode = 'custom';
  if (isBuiltIn) {
    store.updateAIConfig({ provider: 'openai', apiKey: '', model: 'gpt-4o' });
  }
  console.log('Switched to custom. Config:', useStore.getState().aiConfig);

  // 3. Type API Key
  store.updateAIConfig({ apiKey: 'my-secret-key' });
  console.log('Typed key. Config:', useStore.getState().aiConfig);

  // 4. Close dialog
  open = false;
  
  // 5. Reopen dialog
  open = true;
  const currentConfig = useStore.getState().aiConfig;
  isBuiltIn = currentConfig.apiKey === BUILT_IN_AI_CONFIG.apiKey && currentConfig.provider === BUILT_IN_AI_CONFIG.provider;
  
  // Effect logic
  aiMode = isBuiltIn ? 'builtin' : 'custom';
  
  console.log('Reopened. Config:', currentConfig);
  console.log('Is BuiltIn:', isBuiltIn);
  console.log('Restored Mode:', aiMode);
  
  if (aiMode !== 'custom' || currentConfig.apiKey !== 'my-secret-key') {
      console.error('FAIL: Did not save or restore correctly');
  } else {
      console.log('SUCCESS: Logic seems correct');
  }
}

simulate();
