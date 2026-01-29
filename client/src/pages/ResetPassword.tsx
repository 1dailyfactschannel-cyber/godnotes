import { useState, useEffect } from 'react';
import { useFileSystem } from '@/lib/data-store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { KeyRound, Eye, EyeOff, ArrowLeft } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Logo } from '@/components/Logo';
import { useToast } from '@/hooks/use-toast';
import { useLocation } from 'wouter';

export default function ResetPasswordPage() {
  const { theme, updateRecovery } = useFileSystem();
  const [password, setPassword] = useState('');
  const [passwordAgain, setPasswordAgain] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();
  const [location, setLocation] = useLocation();

  // Parse query params
  const [userId, setUserId] = useState('');
  const [secret, setSecret] = useState('');

  useEffect(() => {
    // Extract params from hash or search
    // URL might be http://localhost:5173/#/reset-password?userId=x&secret=y
    const url = window.location.href;
    const searchParams = new URLSearchParams(url.split('?')[1]);
    
    const uid = searchParams.get('userId');
    const sec = searchParams.get('secret');
    
    if (uid) setUserId(uid);
    if (sec) setSecret(sec);
    
    if (!uid || !sec) {
        // Only show error if we are on this page, but wait, if params are missing it's confusing.
        // But maybe they are just navigating here?
        // No, this page is only for recovery.
        // We won't show toast immediately on mount to avoid double render issues or noise if redirected.
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    
    if (password !== passwordAgain) {
        toast({
            variant: "destructive",
            title: "Ошибка",
            description: "Пароли не совпадают",
        });
        return;
    }

    if (!userId || !secret) {
         toast({
            variant: "destructive",
            title: "Ошибка",
            description: "Неверная ссылка восстановления. Попробуйте запросить сброс заново.",
        });
        return;
    }

    setIsSubmitting(true);
    try {
      await updateRecovery(userId, secret, password, passwordAgain);
      toast({
        title: "Успешно",
        description: "Пароль обновлен. Теперь вы можете войти.",
      });
      // Redirect to login
      setLocation('/login');
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Не удалось обновить пароль";
      toast({
        variant: "destructive",
        title: "Ошибка",
        description: message,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const themeClass = theme === 'obsidian-dark' ? '' : `theme-${theme}`;

  return (
    <div className={cn("h-screen w-full bg-[#161616] flex flex-col overflow-hidden", themeClass)}>
       {/* Fake Windows Bar */}
       <div className="h-8 bg-[#1e1e1e] flex items-center justify-between select-none shrink-0 border-b border-white/5">
        <div className="px-3 flex items-center gap-2">
          <div className="w-4 h-4 bg-primary rounded-sm flex items-center justify-center p-0.5">
            <Logo className="w-full h-full text-primary-foreground" />
          </div>
          <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-tight">
            Godnotes Reset Password
          </span>
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center p-4 bg-background">
        <Card className="w-full max-w-md bg-card/50 backdrop-blur-md border-sidebar-border shadow-2xl animate-in zoom-in-95 duration-300">
          <CardHeader className="space-y-1 text-center">
            <div className="mx-auto w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center mb-4">
              <Logo className="h-6 w-6 text-primary" />
            </div>
            <CardTitle className="text-2xl font-bold tracking-tight">
              Новый пароль
            </CardTitle>
            <CardDescription className="text-muted-foreground">
              Придумайте новый пароль для вашего аккаунта
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="password">Пароль</Label>
                <div className="relative">
                  <KeyRound className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input 
                    id="password" 
                    type={showPassword ? "text" : "password"} 
                    className="pl-10 pr-10 bg-background/50"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={8}
                    placeholder="Минимум 8 символов"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-3 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="passwordAgain">Повторите пароль</Label>
                <div className="relative">
                  <KeyRound className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input 
                    id="passwordAgain" 
                    type={showPassword ? "text" : "password"} 
                    className="pl-10 pr-10 bg-background/50"
                    value={passwordAgain}
                    onChange={(e) => setPasswordAgain(e.target.value)}
                    required
                    minLength={8}
                    placeholder="Повторите пароль"
                  />
                </div>
              </div>
              <Button
                type="submit"
                className="w-full font-semibold py-6 text-lg shadow-lg hover:shadow-primary/20 transition-all mt-6"
                disabled={isSubmitting}
              >
                Сохранить пароль
              </Button>
            </form>
            
            <div className="mt-6 flex flex-col gap-4">
              <button 
                onClick={() => setLocation('/login')}
                className="text-sm text-center text-muted-foreground hover:text-primary transition-colors flex items-center justify-center gap-2"
              >
                <ArrowLeft className="h-4 w-4" /> Вернуться ко входу
              </button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
