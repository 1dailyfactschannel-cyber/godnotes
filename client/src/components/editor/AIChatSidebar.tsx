import { useState, useRef, useEffect } from 'react';
import { Send, X, Bot, User, Sparkles, Loader2, RefreshCw, Copy, Check, Globe, FileText, CornerDownLeft, GitCompare, ChevronsUpDown, Plus, Tags, FileSearch } from 'lucide-react';
import * as Diff from 'diff';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Toggle } from '@/components/ui/toggle';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from '@/lib/utils';
import { useEditorStore } from '@/lib/editor-store';
import { useFileSystem } from '@/lib/mock-fs';
import { generateText } from '@/lib/ai-service';
import { toast } from '@/hooks/use-toast';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

export function AIChatSidebar() {
  const { editor, setAiSidebarOpen } = useEditorStore();
  const { items, activeFileId, aiConfig, searchGlobal, updateAIConfig, updateTags, updateUserPrefs, isAuthenticated, user } = useFileSystem();
  const [useGlobalContext, setUseGlobalContext] = useState(false);
  const [modelOpen, setModelOpen] = useState(false);
  const [newModelInput, setNewModelInput] = useState('');
  const [isGeneratingTags, setIsGeneratingTags] = useState(false);
  const [isGeneratingSummary, setIsGeneratingSummary] = useState(false);
  const CUSTOM_CONFIG_KEY = 'aiCustomConfig';

  const activeFile = items.find(i => i.id === activeFileId);

  const saveCustomConfig = (cfg: any) => {
    try { 
      const data = JSON.stringify(cfg);
      localStorage.setItem(CUSTOM_CONFIG_KEY, data); 
      
      // Синхронизируем с облаком
      if (isAuthenticated && user) {
        updateUserPrefs({ aiCustomConfig: data })
          .catch(err => console.error('Failed to sync custom AI config to cloud:', err));
      }
    } catch {}
  };
  const loadCustomConfig = (): any | null => {
    try {
      const raw = localStorage.getItem(CUSTOM_CONFIG_KEY);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch { return null; }
  };
  const normalizeProviderForModel = (m: string) => {
    const lower = m.toLowerCase();
    if (lower.includes('/') || lower.includes(':')) {
      return { provider: 'openrouter' as const, baseUrl: 'https://openrouter.ai/api/v1' };
    }
    if (lower.startsWith('gpt')) {
      return { provider: 'openai' as const, baseUrl: 'https://api.openai.com/v1' };
    }
    if (lower.startsWith('claude')) {
      return { provider: 'anthropic' as const, baseUrl: 'https://api.anthropic.com' };
    }
    return { provider: aiConfig.provider, baseUrl: aiConfig.baseUrl };
  };
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content: 'Привет! Я ваш AI-ассистент. Я могу помочь вам с написанием текста, исправлением ошибок или генерацией идей. Просто спросите меня о чем-нибудь или выделите текст в редакторе.',
      timestamp: Date.now(),
    }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleClearHistory = () => {
    setMessages([
      {
        id: 'welcome',
        role: 'assistant',
        content: 'Привет! Я ваш AI-ассистент. Я могу помочь вам с написанием текста, исправлением ошибок или генерацией идей. Просто спросите меня о чем-нибудь или выделите текст в редакторе.',
        timestamp: Date.now(),
      }
    ]);
  };

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    if (!aiConfig.apiKey) {
      toast({
        title: "AI не настроен",
        description: "Пожалуйста, добавьте API ключ в настройках",
        variant: "destructive"
      });
      return;
    }

    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: 'user',
      content: input,
      timestamp: Date.now(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      // Get context from editor
      let context = '';
      let systemPrompt = "You are a helpful AI assistant integrated into a note-taking app.";
      
      if (useGlobalContext) {
        try {
           const searchResults = await searchGlobal(userMessage.content);
           if (searchResults.length > 0) {
             const topResults = searchResults.slice(0, 3); // Take top 3 results
             context = `\n\nRelevant notes from the knowledge base:\n${topResults.map((item, index) => 
               `[Note ${index + 1}: ${item.name}]\nContent: ${item.content || '(No content loaded)'}\n`
             ).join('\n')}`;
             
             systemPrompt += " You have access to the user's notes database. Use the provided 'Relevant notes' context to answer the user's question. If the information is not in the context, say so.";
           } else {
             context = "\n\nNo relevant notes found in the database.";
           }
        } catch (e) {
          console.error("Failed to search global context:", e);
          context = "\n\nError searching database.";
        }
      } else if (editor) {
        const selection = editor.state.doc.textBetween(
          editor.state.selection.from,
          editor.state.selection.to,
          ' '
        );
        
        const fullText = editor.getText();

        if (selection) {
          context = `\n\nSelected text context:\n"${selection}"`;
          systemPrompt += " The user has selected a portion of text. Focus your answer on the selected text. If asked to edit/rewrite, provide the updated version clearly.";
        } else if (fullText) {
          context = `\n\nCurrent note content context (for reference):\n"${fullText.slice(0, 5000)}${fullText.length > 5000 ? '...' : ''}"`;
          systemPrompt += " The user is viewing this note. If asked to edit/rewrite, use this content as the source. Provide the updated version clearly.";
        }
      }

      const prompt = `${userMessage.content}${context}`;

      const response = await generateText(prompt, systemPrompt);

      if (response.error) {
        throw new Error(response.error);
      }

      const aiMessage: Message = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: response.text || 'Извините, я не смог сгенерировать ответ.',
        timestamp: Date.now(),
      };

      setMessages(prev => [...prev, aiMessage]);
    } catch (error: any) {
      toast({
        title: "Ошибка",
        description: error.message || "Не удалось получить ответ от AI",
        variant: "destructive"
      });
      setMessages(prev => [...prev, {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: `Произошла ошибка: ${error.message}`,
        timestamp: Date.now(),
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const insertToEditor = (text: string) => {
    if (editor) {
      editor.chain().focus().insertContent(text).run();
    }
  };

  const handleGenerateTags = async () => {
    if (!activeFile || !editor || isGeneratingTags) return;
    
    const content = editor.getText();
    if (!content || content.length < 20) {
      toast({ title: "Недостаточно текста", description: "Напишите что-нибудь в заметке, чтобы AI мог подобрать теги", variant: "destructive" });
      return;
    }

    setIsGeneratingTags(true);
    try {
      const prompt = `Проанализируй текст этой заметки и предложи 3-5 наиболее подходящих тегов (одним словом каждый). 
      Верни ТОЛЬКО список тегов через запятую, без лишних слов и пояснений.
      
      Текст заметки:
      "${content.slice(0, 3000)}"`;

      const response = await generateText(prompt, "You are a helpful assistant that generates relevant tags for notes.");
      
      if (response.error) throw new Error(response.error);

      const newTags = response.text
        .split(',')
        .map(t => t.trim().toLowerCase())
        .filter(t => t && t.length > 1 && !activeFile.tags?.includes(t));

      if (newTags.length > 0) {
        const updatedTags = [...(activeFile.tags || []), ...newTags];
        await updateTags(activeFile.id, updatedTags);
        toast({ title: "Теги добавлены", description: `Добавлено: ${newTags.join(', ')}` });
      } else {
        toast({ title: "Новых тегов не найдено", description: "AI не смог предложить новых подходящих тегов" });
      }
    } catch (error: any) {
      toast({ title: "Ошибка генерации тегов", description: error.message, variant: "destructive" });
    } finally {
      setIsGeneratingTags(false);
    }
  };

  const handleGenerateSummary = async () => {
    if (!activeFile || !editor || isGeneratingSummary) return;
    
    const content = editor.getText();
    if (!content || content.length < 50) {
      toast({ title: "Недостаточно текста", description: "Напишите более длинную заметку для создания саммари", variant: "destructive" });
      return;
    }

    setIsGeneratingSummary(true);
    try {
      const prompt = `Создай краткое и емкое резюме (summary) этой заметки на русском языке. 
      Оно должно быть не более 3-4 предложений и отражать основную суть.
      
      Текст заметки:
      "${content.slice(0, 5000)}"`;

      const response = await generateText(prompt, "You are a helpful assistant that summarizes notes.");
      
      if (response.error) throw new Error(response.error);

      const aiMessage: Message = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: `**Краткое резюме заметки:**\n\n${response.text}`,
        timestamp: Date.now(),
      };

      setMessages(prev => [...prev, aiMessage]);
    } catch (error: any) {
      toast({ title: "Ошибка создания резюме", description: error.message, variant: "destructive" });
    } finally {
      setIsGeneratingSummary(false);
    }
  };

  const reviewChanges = (text: string) => {
    if (!editor) return;

    const selection = editor.state.selection;
    const isSelection = !selection.empty;
    
    const currentText = isSelection 
      ? editor.state.doc.textBetween(selection.from, selection.to, '\n')
      : editor.getText();
      
    if (!currentText) {
      insertToEditor(text);
      return;
    }

    const diffs = Diff.diffLines(currentText, text);
    
    let html = '';
    diffs.forEach(part => {
      const value = part.value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/\n/g, '<br>');
        
      if (part.added) {
        html += `<span data-diff-type="added">${value}</span>`;
      } else if (part.removed) {
        html += `<span data-diff-type="removed">${value}</span>`;
      } else {
        html += value;
      }
    });

    if (isSelection) {
        editor.chain().focus().insertContent(html).run();
    } else {
        editor.chain().focus().setContent(html).run();
    }
  };

  return (
    <div className="flex flex-col h-full bg-sidebar border-l border-sidebar-border w-full relative">
      {/* Header */}
      <div className="h-12 flex items-center justify-between px-3 border-b border-sidebar-border bg-sidebar shrink-0 relative z-[100]" style={{ pointerEvents: 'auto' } as React.CSSProperties}>
        <div className="flex items-center gap-2 overflow-hidden min-w-0 mr-2">
          <Sparkles className="h-4 w-4 text-primary shrink-0" />
          <span className="text-sm font-semibold truncate">AI</span>
        </div>
        
        <div className="flex items-center gap-1.5 flex-1 justify-end relative z-[101]" style={{ pointerEvents: 'auto' } as React.CSSProperties}>
          
          <div
            className="ml-2 px-2 py-1 text-[10px] rounded-md border border-border/50 bg-background/60 max-w-[220px] truncate shrink-0 select-none"
            title={`${aiConfig.model} (${aiConfig.provider})`}
          >
            <span className="font-medium">Модель</span>
            <span className="mx-1 opacity-50">•</span>
            <span className="truncate">{aiConfig.model}</span>
          </div>
          
          <Popover open={modelOpen} onOpenChange={setModelOpen}>
            <PopoverTrigger asChild>
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="h-7 text-[10px] px-2 gap-1 max-w-[90px] justify-between bg-background/50 hover:bg-background border-border/50 shrink-0"
                >
                  <span className="truncate">{aiConfig.model}</span>
                  <ChevronsUpDown className="h-3 w-3 shrink-0 opacity-50" />
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-64 p-2" align="end">
                <div className="space-y-2">
                  <h4 className="font-medium text-xs text-muted-foreground mb-1 px-1">Выбор модели</h4>
                  <div className="max-h-[200px] overflow-y-auto space-y-1">
                      {Array.from(new Set([aiConfig.model, ...(aiConfig.availableModels || [])])).filter(Boolean).map(m => (
                        <Button 
                          key={m} 
                          variant={aiConfig.model === m ? "secondary" : "ghost"} 
                          size="sm" 
                          className="w-full justify-start h-7 text-xs" 
                          onClick={() => {
                            const np = normalizeProviderForModel(m);
                            updateAIConfig({ provider: np.provider, apiKey: aiConfig.apiKey, model: m, baseUrl: np.baseUrl });
                            saveCustomConfig({ provider: np.provider, apiKey: aiConfig.apiKey, model: m, baseUrl: np.baseUrl });
                            setModelOpen(false);
                          }}
                        >
                            {aiConfig.model === m && <Check className="mr-2 h-3 w-3" />}
                            <span className="truncate">{m}</span>
                        </Button>
                      ))}
                  </div>
                  <div className="flex gap-1 pt-2 border-t">
                      <Input 
                        className="h-7 text-xs" 
                        placeholder="Новая модель..." 
                        value={newModelInput} 
                        onChange={e => setNewModelInput(e.target.value)} 
                        onKeyDown={e => {
                            if (e.key === 'Enter') {
                                if (!newModelInput.trim()) return;
                                const currentModels = aiConfig.availableModels || [];
                                const newModels = Array.from(new Set([...currentModels, aiConfig.model, newModelInput.trim()]));
                                const np = normalizeProviderForModel(newModelInput.trim());
                                updateAIConfig({ availableModels: newModels, model: newModelInput.trim(), provider: np.provider, baseUrl: np.baseUrl });
                                saveCustomConfig({ provider: np.provider, apiKey: aiConfig.apiKey, model: newModelInput.trim(), baseUrl: np.baseUrl });
                                setNewModelInput('');
                                setModelOpen(false);
                            }
                        }}
                      />
                      <Button 
                        size="icon" 
                        variant="ghost" 
                        className="h-7 w-7"
                        onClick={() => {
                            if (!newModelInput.trim()) return;
                            const currentModels = aiConfig.availableModels || [];
                            const newModels = Array.from(new Set([...currentModels, aiConfig.model, newModelInput.trim()]));
                            const np = normalizeProviderForModel(newModelInput.trim());
                            updateAIConfig({ availableModels: newModels, model: newModelInput.trim(), provider: np.provider, baseUrl: np.baseUrl });
                            saveCustomConfig({ provider: np.provider, apiKey: aiConfig.apiKey, model: newModelInput.trim(), baseUrl: np.baseUrl });
                            setNewModelInput('');
                            setModelOpen(false);
                        }}
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                  </div>
                </div>
            </PopoverContent>
          </Popover>
        </div>
        <div className="flex items-center gap-1">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={handleClearHistory}>
                  <RefreshCw className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Очистить историю чата</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setAiSidebarOpen(false)}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar" ref={scrollRef}>
        {/* Quick Actions */}
        <div className="grid grid-cols-2 gap-2 mb-2">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="h-8 text-[10px] gap-2 bg-background/40 hover:bg-background/60 border-border/50"
                  onClick={handleGenerateTags}
                  disabled={isGeneratingTags || !activeFile}
                >
                  {isGeneratingTags ? <Loader2 className="h-3 w-3 animate-spin" /> : <Tags className="h-3 w-3 text-primary" />}
                  Теги
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Автоматически подобрать теги для заметки</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>

          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="h-8 text-[10px] gap-2 bg-background/40 hover:bg-background/60 border-border/50"
                  onClick={handleGenerateSummary}
                  disabled={isGeneratingSummary || !activeFile}
                >
                  {isGeneratingSummary ? <Loader2 className="h-3 w-3 animate-spin" /> : <FileSearch className="h-3 w-3 text-primary" />}
                  Саммари
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Создать краткое резюме заметки</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>

        {messages.map((msg) => (
          <div
            key={msg.id}
            className={cn(
              "flex gap-3 text-xs group",
              msg.role === 'user' ? "flex-row-reverse" : "flex-row"
            )}
          >
            <div className={cn(
              "h-8 w-8 rounded-full flex items-center justify-center shrink-0",
              msg.role === 'user' ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
            )}>
              {msg.role === 'user' ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
            </div>
            
            <div className={cn(
              "flex flex-col gap-1 max-w-[85%]",
              msg.role === 'user' ? "items-end" : "items-start"
            )}>
              <div className={cn(
                "px-3 py-2 rounded-lg whitespace-pre-wrap break-words",
                msg.role === 'user' 
                  ? "bg-primary text-primary-foreground rounded-tr-none" 
                  : "bg-muted/50 border border-border rounded-tl-none"
              )}>
                {msg.content}
              </div>
              
              {msg.role === 'assistant' && (
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-6 w-6" 
                    onClick={() => copyToClipboard(msg.content, msg.id)}
                    title="Копировать"
                  >
                    {copiedId === msg.id ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                  </Button>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-6 w-6" 
                    onClick={() => insertToEditor(msg.content)}
                    title="Вставить в заметку (заменит выделенное)"
                  >
                    <CornerDownLeft className="h-3 w-3" />
                  </Button>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-6 w-6" 
                    onClick={() => reviewChanges(msg.content)}
                    title="Сравнить и применить (Diff)"
                  >
                    <GitCompare className="h-3 w-3" />
                  </Button>
                </div>
              )}
            </div>
          </div>
        ))}
        {isLoading && (
           <div className="flex gap-3 text-xs flex-row">
              <div className="h-8 w-8 rounded-full bg-muted text-muted-foreground flex items-center justify-center shrink-0">
                 <Bot className="h-4 w-4" />
              </div>
              <div className="flex flex-col gap-1 max-w-[85%] items-start">
                  <div className="bg-muted/50 border border-border rounded-lg rounded-tl-none px-3 py-2">
                     <div className="flex items-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span>Думаю...</span>
                     </div>
                  </div>
              </div>
           </div>
        )}
      </div>

      {/* Input */}
      <div className="p-4 border-t border-sidebar-border bg-sidebar/50 space-y-3">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            <span className="font-medium">Контекст:</span>
            <Toggle 
              pressed={useGlobalContext} 
              onPressedChange={setUseGlobalContext}
              size="sm"
              className="h-6 px-2 gap-1 data-[state=on]:bg-primary/20 data-[state=on]:text-primary"
            >
              {useGlobalContext ? (
                <>
                  <Globe className="h-3 w-3" />
                  <span>Вся база</span>
                </>
              ) : (
                <>
                  <FileText className="h-3 w-3" />
                  <span>Текущая заметка</span>
                </>
              )}
            </Toggle>
          </div>
          {useGlobalContext && (
             <span className="text-[10px] opacity-70">Поиск по базе</span>
          )}
        </div>

        <div className="relative">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={useGlobalContext ? "Спросите о любой заметке..." : "Спросите о текущем тексте..."}
            className="pr-10 bg-background/50 min-h-[100px] resize-none"
            disabled={isLoading}
          />
          <Button 
            size="icon" 
            className="absolute right-2 bottom-2 h-7 w-7" 
            onClick={handleSend}
            disabled={!input.trim() || isLoading}
          >
            <Send className="h-3 w-3" />
          </Button>
        </div>
      </div>
    </div>
  );
}
