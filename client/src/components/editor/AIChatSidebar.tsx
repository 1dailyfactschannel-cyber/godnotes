import { useState, useRef, useEffect } from 'react';
import { Send, X, Bot, User, Sparkles, Loader2, RefreshCw, Copy, Check, Globe, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Toggle } from '@/components/ui/toggle';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { useEditorStore } from '@/lib/editor-store';
import { useFileSystem } from '@/lib/mock-fs';
import { generateText } from '@/lib/ai-service';
import { toast } from '@/hooks/use-toast';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

export function AIChatSidebar() {
  const { editor, setAiSidebarOpen } = useEditorStore();
  const { aiConfig, searchGlobal } = useFileSystem();
  const [useGlobalContext, setUseGlobalContext] = useState(false);
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
          systemPrompt += " The user has selected a portion of text. Focus your answer on the selected text.";
        } else if (fullText) {
          context = `\n\nCurrent note content context (for reference):\n"${fullText.slice(0, 5000)}${fullText.length > 5000 ? '...' : ''}"`;
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

  return (
    <div className="flex flex-col h-full bg-sidebar border-l border-sidebar-border w-full">
      {/* Header */}
      <div className="h-10 flex items-center justify-between px-4 border-b border-sidebar-border bg-sidebar/50 shrink-0">
        <div className="flex items-center gap-2 text-sm font-medium">
          <Sparkles className="h-4 w-4 text-primary" />
          <span>AI Ассистент</span>
        </div>
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setAiSidebarOpen(false)}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar" ref={scrollRef}>
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={cn(
              "flex gap-3 text-sm",
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
                    title="Вставить в редактор"
                  >
                    <Check className="h-3 w-3" />
                  </Button>
                </div>
              )}
            </div>
          </div>
        ))}
        {isLoading && (
           <div className="flex gap-3 text-sm flex-row">
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
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={useGlobalContext ? "Спросите о любой заметке..." : "Спросите о текущем тексте..."}
            className="pr-10 bg-background/50"
            disabled={isLoading}
          />
          <Button 
            size="icon" 
            className="absolute right-1 top-1 h-7 w-7" 
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
