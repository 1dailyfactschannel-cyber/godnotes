
import { useState } from 'react';
import { Editor } from '@tiptap/react';
import { BubbleMenu } from '@tiptap/react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Loader2, Sparkles, Check, X, RefreshCw, Wand2 } from 'lucide-react';
import { generateText } from '@/lib/ai-service';
import { toast } from '@/hooks/use-toast';
import { useFileSystem } from '@/lib/mock-fs';
import { cn } from '@/lib/utils';

interface AIAssistantBubbleMenuProps {
  editor: Editor;
}

export function AIAssistantBubbleMenu({ editor }: AIAssistantBubbleMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [prompt, setPrompt] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const { aiConfig } = useFileSystem();

  const handleGenerate = async (customPrompt?: string) => {
    if (!aiConfig.apiKey) {
      toast({
        title: "AI не настроен",
        description: "Пожалуйста, добавьте API ключ в настройках",
        variant: "destructive"
      });
      return;
    }

    const selection = editor.state.doc.textBetween(
      editor.state.selection.from,
      editor.state.selection.to,
      ' '
    );

    if (!selection) return;

    setIsLoading(true);
    setResult(null);

    const userPrompt = customPrompt || prompt;
    const finalPrompt = `${userPrompt}:\n"${selection}"`;

    const response = await generateText(finalPrompt, "The user wants to modify the selected text.");

    setIsLoading(false);

    if (response.error) {
      toast({
        title: "Ошибка AI",
        description: response.error,
        variant: "destructive"
      });
    } else {
      setResult(response.text);
    }
  };

  const handleReplace = () => {
    if (result) {
      editor.chain().focus().insertContent(result).run();
      setResult(null);
      setIsOpen(false);
    }
  };

  const handleInsertBelow = () => {
    if (result) {
        const selection = editor.state.selection;
        editor.chain().focus().setTextSelection(selection.to).insertContent(`\n${result}`).run();
        setResult(null);
        setIsOpen(false);
    }
  };

  const handleDiscard = () => {
    setResult(null);
  };

  const presetActions = [
    { label: 'Исправить ошибки', prompt: 'Fix grammar and spelling in this text' },
    { label: 'Улучшить текст', prompt: 'Improve the writing style of this text' },
    { label: 'Сократить', prompt: 'Make this text more concise' },
    { label: 'Сделать подробнее', prompt: 'Expand on this text with more details' },
    { label: 'Summarize', prompt: 'Summarize this text' },
  ];

  return (
    <BubbleMenu 
      editor={editor} 
      tippyOptions={{ duration: 100, placement: 'bottom-start' }}
      shouldShow={({ editor, from, to }) => {
        // Don't show if selection is empty
        if (from === to) return false;
        // Don't show if active in a table (conflicts with table menu)
        if (editor.isActive('table')) return false;
        // Don't show if link editing (optional)
        return true;
      }}
    >
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <Button 
            variant="secondary" 
            size="sm" 
            className="h-8 gap-2 shadow-md border bg-background hover:bg-accent text-xs"
          >
            <Sparkles className="h-3.5 w-3.5 text-purple-500" />
            AI
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-80 p-3" align="start" sideOffset={10}>
          <div className="space-y-3">
            <div className="flex items-center gap-2 pb-2 border-b">
              <Sparkles className="h-4 w-4 text-purple-500" />
              <h4 className="font-medium text-sm">AI Ассистент</h4>
            </div>

            {!result ? (
              <>
                <div className="grid grid-cols-2 gap-2">
                  {presetActions.map((action) => (
                    <Button
                      key={action.label}
                      variant="outline"
                      size="sm"
                      className="text-xs justify-start h-auto py-1.5"
                      onClick={() => handleGenerate(action.prompt)}
                      disabled={isLoading}
                    >
                      {action.label}
                    </Button>
                  ))}
                </div>

                <div className="flex gap-2">
                  <Input
                    placeholder="Свой запрос..."
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    className="h-8 text-xs"
                    onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            handleGenerate();
                        }
                    }}
                  />
                  <Button 
                    size="sm" 
                    className="h-8 w-8 p-0" 
                    onClick={() => handleGenerate()}
                    disabled={isLoading || !prompt.trim()}
                  >
                    {isLoading ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Wand2 className="h-3.5 w-3.5" />
                    )}
                  </Button>
                </div>
              </>
            ) : (
              <div className="space-y-3">
                <div className="bg-muted p-2 rounded-md text-sm max-h-40 overflow-y-auto">
                  {result}
                </div>
                <div className="flex gap-2">
                  <Button 
                    variant="default" 
                    size="sm" 
                    className="flex-1 h-8 text-xs" 
                    onClick={handleReplace}
                  >
                    <Check className="h-3.5 w-3.5 mr-1" />
                    Заменить
                  </Button>
                  <Button 
                    variant="secondary" 
                    size="sm" 
                    className="flex-1 h-8 text-xs" 
                    onClick={handleInsertBelow}
                  >
                    <PlusIcon className="h-3.5 w-3.5 mr-1" />
                    Вставить ниже
                  </Button>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="h-8 w-8 p-0" 
                    onClick={handleDiscard}
                    title="Отмена"
                  >
                    <RefreshCw className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            )}
          </div>
        </PopoverContent>
      </Popover>
    </BubbleMenu>
  );
}

function PlusIcon({ className }: { className?: string }) {
    return (
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M5 12h14"/><path d="M12 5v14"/></svg>
    )
}
