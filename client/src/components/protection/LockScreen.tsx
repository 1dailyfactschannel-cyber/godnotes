import { useState } from 'react';
import { Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useFileSystem } from '@/lib/mock-fs';
import { toast } from '@/hooks/use-toast';

interface LockScreenProps {
  noteId: string;
  onUnlock?: () => void;
}

export function LockScreen({ noteId, onUnlock }: LockScreenProps) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState(false);
  const { unlockNote, securityConfig } = useFileSystem();

  const handleUnlock = async () => {
    // If no password configured globally, we assume it's allowed or prompt to set one?
    // Current logic in mock-fs returns true if no password set.
    const success = await unlockNote(noteId, password);
    if (success) {
      if (onUnlock) onUnlock();
      setError(false);
    } else {
      setError(true);
      toast({
          title: "Ошибка",
          description: "Неверный пароль",
          variant: "destructive"
      });
    }
  };

  return (
    <div className="flex flex-col items-center justify-center h-full min-h-[400px] gap-6 text-center p-8 select-none">
      <div className="w-24 h-24 bg-muted/50 rounded-full flex items-center justify-center mb-4 animate-in zoom-in duration-300">
        <Lock className="w-12 h-12 text-muted-foreground" />
      </div>
      <div className="space-y-2">
        <h2 className="text-2xl font-bold tracking-tight">Заметка защищена</h2>
        <p className="text-muted-foreground max-w-md">
          Эта заметка зашифрована и защищена паролем. Введите мастер-пароль для доступа.
        </p>
      </div>
      
      <div className="flex gap-2 w-full max-w-xs mt-4">
        <Input
          type="password"
          placeholder="Мастер-пароль"
          value={password}
          onChange={(e) => {
            setPassword(e.target.value);
            setError(false);
          }}
          onKeyDown={(e) => e.key === 'Enter' && handleUnlock()}
          className={error ? "border-red-500 focus-visible:ring-red-500" : ""}
          autoFocus
        />
        <Button onClick={handleUnlock}>
          Открыть
        </Button>
      </div>
    </div>
  );
}
