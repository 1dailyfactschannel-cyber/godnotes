import { useState } from 'react';
import { useFileSystem } from '@/lib/mock-fs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { KeyRound, Mail, UserPlus, ArrowLeft, Eye, EyeOff } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Logo } from '@/components/Logo';
import { useToast } from '@/hooks/use-toast';

export default function LoginPage() {
  const { theme, checkAuth, login, register, resetPassword } = useFileSystem();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);
  const [isResettingPassword, setIsResettingPassword] = useState(false);
  const [name, setName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  // Load saved credentials on mount
  useState(() => {
    const savedEmail = localStorage.getItem('savedEmail');
    if (savedEmail) {
      setEmail(savedEmail);
    }
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      if (isResettingPassword) {
        await resetPassword(email);
        toast({
          title: "Письмо отправлено",
          description: "Проверьте вашу почту для сброса пароля",
        });
        setIsResettingPassword(false);
      } else if (isRegistering) {
        await register(email, password, name);
      } else {
        await login(email, password);
        // Save email on successful login
        localStorage.setItem('savedEmail', email);
      }
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Не удалось выполнить запрос";
      toast({
        variant: "destructive",
        title: isResettingPassword ? "Ошибка сброса" : "Ошибка входа",
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
            {isResettingPassword ? 'Восстановление пароля' : (isRegistering ? 'Godnotes Registration' : 'Godnotes Login')}
          </span>
        </div>
        <div className="flex h-full">
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center p-4 bg-background">
        <Card className="w-full max-w-md bg-card/50 backdrop-blur-md border-sidebar-border shadow-2xl animate-in zoom-in-95 duration-300">
          <CardHeader className="space-y-1 text-center">
            <div className="mx-auto w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center mb-4">
              {isRegistering ? <UserPlus className="h-6 w-6 text-primary" /> : <Logo className="h-6 w-6 text-primary" />}
            </div>
            <CardTitle className="text-2xl font-bold tracking-tight">
              {isResettingPassword ? 'Сброс пароля' : (isRegistering ? 'Создать аккаунт' : 'GodNotes')}
            </CardTitle>
            <CardDescription className="text-muted-foreground">
              {isResettingPassword 
                ? 'Введите email для получения ссылки на сброс пароля'
                : (isRegistering ? 'Заполните данные для регистрации' : 'Введите свои данные для доступа к заметкам')}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {isRegistering && !isResettingPassword && (
                <div className="space-y-2 animate-in slide-in-from-top-2 duration-200">
                  <Label htmlFor="name">Имя</Label>
                  <Input 
                    id="name" 
                    placeholder="Ваше имя" 
                    className="bg-background/50"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                  />
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input 
                    id="email" 
                    type="email" 
                    placeholder="name@example.com" 
                    className="pl-10 bg-background/50"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
              </div>
              {!isResettingPassword && (
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
              )}
              <Button
                type="submit"
                className="w-full font-semibold py-6 text-lg shadow-lg hover:shadow-primary/20 transition-all mt-6"
                disabled={isSubmitting}
              >
                {isResettingPassword ? 'Отправить ссылку' : (isRegistering ? 'Зарегистрироваться' : 'Войти в хранилище')}
              </Button>
            </form>
            
            <div className="mt-6 flex flex-col gap-4">
              <button 
                type="button"
                onClick={() => {
                  if (isResettingPassword) {
                    setIsResettingPassword(false);
                  } else {
                    setIsRegistering(!isRegistering);
                  }
                }}
                className="text-sm text-center text-muted-foreground hover:text-primary transition-colors flex items-center justify-center gap-2"
              >
                {isResettingPassword ? (
                  <><ArrowLeft className="h-4 w-4" /> Вернуться ко входу</>
                ) : (
                  isRegistering ? (
                    <><ArrowLeft className="h-4 w-4" /> Уже есть аккаунт? Войти</>
                  ) : (
                    'Нет аккаунта? Создать новый'
                  )
                )}
              </button>
              
              {!isRegistering && !isResettingPassword && (
                <div className="text-center text-sm">
                  <button 
                    type="button"
                    onClick={() => setIsResettingPassword(true)}
                    className="text-muted-foreground/50 hover:text-primary transition-colors"
                  >
                    Забыли пароль?
                  </button>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
