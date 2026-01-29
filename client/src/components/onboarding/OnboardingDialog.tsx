import { useState, useEffect } from 'react';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription,
  DialogFooter
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { FolderOpen, Sparkles, Shield, BookOpen, Rocket, ArrowRight, CheckCircle2, Cloud } from 'lucide-react';
import { useFileSystem } from '@/lib/data-store';
import { selectDirectory, setStoreValue, getStoreValue, isElectron } from '@/lib/electron';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

export function OnboardingDialog() {
  const [isOpen, setIsOpen] = useState(false);
  const [step, setStep] = useState(1);
  const { localDocumentsPath, setStoragePath } = useFileSystem();
  const [selectedPath, setSelectedPath] = useState<string | null>(null);

  useEffect(() => {
    const checkOnboarding = async () => {
      const completed = await getStoreValue('onboardingCompleted');
      if (!completed) {
        setIsOpen(true);
      }
    };
    checkOnboarding();
  }, []);

  const handleSelectPath = async () => {
    try {
      const path = await selectDirectory();
      if (path) {
        setSelectedPath(path);
      }
    } catch (err) {
      console.error(err);
      toast({ variant: "destructive", title: "Ошибка", description: "Не удалось выбрать папку" });
    }
  };

  const handleComplete = async () => {
    if (isElectron() && !selectedPath && !localDocumentsPath) {
      toast({ 
        title: "Выберите папку", 
        description: "Для работы десктопной версии необходимо выбрать место хранения заметок",
        variant: "destructive" 
      });
      setStep(2);
      return;
    }

    if (selectedPath) {
      await setStoreValue('storagePath', selectedPath);
      
      // Also add this to spaces list if it's the first one
      const currentSpaces = await getStoreValue('spaces') || [];
      if (currentSpaces.length === 0) {
        const folderName = selectedPath.split(/[/\\]/).pop() || 'Мои заметки';
        await setStoreValue('spaces', [{ 
          id: crypto.randomUUID(), 
          name: folderName, 
          path: selectedPath 
        }]);
      }
    }
    
    await setStoreValue('onboardingCompleted', true);
    setIsOpen(false);
    
    if (selectedPath) {
      // Small delay to ensure store is updated before reload if needed, 
      // but usually we can just update the app state
      window.location.reload();
    }
  };

  const steps = [
    {
      title: "Добро пожаловать в GodNotes",
      description: "Ваше новое пространство для идей, знаний и продуктивности.",
      icon: <Rocket className="h-12 w-12 text-primary animate-bounce" />,
      content: (
        <div className="space-y-4 py-4">
          <p className="text-sm text-muted-foreground leading-relaxed">
            GodNotes — это не просто редактор заметок. Это мощная экосистема, объединяющая 
            локальную приватность, облачную синхронизацию и искусственный интеллект.
          </p>
          <div className="grid grid-cols-2 gap-3 mt-4">
            <div className="p-3 rounded-lg bg-secondary/30 border border-border/50">
              <Shield className="h-5 w-5 mb-2 text-blue-500" />
              <div className="text-xs font-medium">Приватность</div>
              <div className="text-[10px] text-muted-foreground mt-1">Шифрование и локальное хранение.</div>
            </div>
            <div className="p-3 rounded-lg bg-secondary/30 border border-border/50">
              <Sparkles className="h-5 w-5 mb-2 text-purple-500" />
              <div className="text-xs font-medium">AI Помощник</div>
              <div className="text-[10px] text-muted-foreground mt-1">GPT-4 и Claude всегда под рукой.</div>
            </div>
          </div>
        </div>
      )
    },
    {
      title: "Где хранить ваши знания?",
      description: isElectron() 
        ? "Выберите папку на вашем компьютере для синхронизации." 
        : "Функция выбора локальной папки доступна только в десктопной версии.",
      icon: <FolderOpen className="h-12 w-12 text-primary" />,
      content: isElectron() ? (
        <div className="space-y-4 py-4">
          <p className="text-sm text-muted-foreground">
            В GodNotes используется концепция <strong>Пространств</strong>. Каждое пространство — это папка на вашем диске, 
            где заметки хранятся в формате Markdown. Это значит, что ваши данные всегда принадлежат вам.
          </p>
          
          <div className={cn(
            "p-4 rounded-xl border-2 border-dashed transition-all",
            selectedPath ? "border-primary bg-primary/5" : "border-border bg-secondary/10"
          )}>
            {selectedPath ? (
              <div className="flex items-center gap-3">
                <CheckCircle2 className="h-5 w-5 text-primary shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-medium truncate">{selectedPath}</div>
                  <div className="text-[10px] text-muted-foreground">Папка выбрана</div>
                </div>
                <Button variant="ghost" size="sm" className="h-7 text-[10px]" onClick={handleSelectPath}>
                  Изменить
                </Button>
              </div>
            ) : (
              <div className="text-center space-y-3">
                <p className="text-xs text-muted-foreground">Нажмите кнопку ниже, чтобы выбрать рабочую директорию</p>
                <Button onClick={handleSelectPath} className="gap-2">
                  <FolderOpen className="h-4 w-4" />
                  Выбрать папку
                </Button>
              </div>
            )}
          </div>
          <p className="text-[11px] text-muted-foreground italic">
            * Вы сможете создать дополнительные пространства позже в настройках.
          </p>
        </div>
      ) : (
        <div className="space-y-4 py-4">
          <p className="text-sm text-muted-foreground">
            В веб-версии GodNotes все данные хранятся безопасно в облаке. 
            Вы можете начать создавать заметки прямо сейчас!
          </p>
          
          <div className="p-4 rounded-xl border-2 border-dashed border-border bg-secondary/10 text-center">
            <Cloud className="h-8 w-8 text-primary mx-auto mb-2" />
            <p className="text-xs text-muted-foreground">
              Ваши заметки автоматически синхронизируются с облаком
            </p>
          </div>
          
          <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg">
            <p className="text-[11px] text-blue-400">
              💡 Для работы с локальными файлами и оффлайн-режима загрузите десктопную версию приложения.
            </p>
          </div>
        </div>
      )
    },
    {
      title: "Почти готово!",
      description: "Коротко о том, как извлечь максимум из приложения.",
      icon: <BookOpen className="h-12 w-12 text-primary" />,
      content: (
        <div className="space-y-4 py-4">
          <ul className="space-y-3">
            <li className="flex gap-3 text-sm">
              <div className="h-5 w-5 rounded-full bg-primary/10 flex items-center justify-center text-[10px] font-bold text-primary shrink-0">1</div>
              <div><strong>Wiki-ссылки:</strong> Используйте [[Название]], чтобы связывать свои идеи.</div>
            </li>
            <li className="flex gap-3 text-sm">
              <div className="h-5 w-5 rounded-full bg-primary/10 flex items-center justify-center text-[10px] font-bold text-primary shrink-0">2</div>
              <div><strong>AI Чат:</strong> Нажмите Ctrl+J, чтобы задать вопрос своему ассистенту.</div>
            </li>
            <li className="flex gap-3 text-sm">
              <div className="h-5 w-5 rounded-full bg-primary/10 flex items-center justify-center text-[10px] font-bold text-primary shrink-0">3</div>
              <div><strong>Справка:</strong> Если возникнут вопросы, загляните в раздел <strong>«Как пользоваться»</strong> в настройках.</div>
            </li>
          </ul>
          <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg mt-4">
            <p className="text-[11px] text-blue-400">
              Вся информация об интерфейсе, горячих клавишах и функциях всегда доступна в настройках (иконка шестеренки → Как пользоваться).
            </p>
          </div>
        </div>
      )
    }
  ];

  const currentStep = steps[step - 1];

  return (
    <Dialog open={isOpen} onOpenChange={() => {}}>
      <DialogContent className="sm:max-w-[450px] p-0 overflow-hidden border-none shadow-2xl bg-background">
        <div className="p-8">
          <div className="flex flex-col items-center text-center space-y-4">
            <div className="p-3 rounded-2xl bg-primary/10 ring-8 ring-primary/5 mb-2">
              {currentStep.icon}
            </div>
            <div className="space-y-2">
              <DialogTitle className="text-2xl font-bold tracking-tight">
                {currentStep.title}
              </DialogTitle>
              <DialogDescription className="text-sm">
                {currentStep.description}
              </DialogDescription>
            </div>
          </div>

          <div className="mt-4">
            {currentStep.content}
          </div>

          <div className="flex items-center justify-between mt-8">
            <div className="flex gap-1.5">
              {steps.map((_, i) => (
                <div 
                  key={i} 
                  className={cn(
                    "h-1.5 rounded-full transition-all duration-300",
                    step === i + 1 ? "w-6 bg-primary" : "w-1.5 bg-secondary"
                  )} 
                />
              ))}
            </div>
            
            <div className="flex gap-2">
              {step > 1 && (
                <Button variant="ghost" onClick={() => setStep(step - 1)}>
                  Назад
                </Button>
              )}
              {step < steps.length ? (
                <Button onClick={() => setStep(step + 1)} className="gap-2">
                  Далее
                  <ArrowRight className="h-4 w-4" />
                </Button>
              ) : (
                <Button onClick={handleComplete} className="gap-2 bg-primary hover:bg-primary/90">
                  Начать работу
                  <CheckCircle2 className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
} 
