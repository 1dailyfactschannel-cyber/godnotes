import { useState } from 'react';
import { useFileSystem } from '@/lib/mock-fs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { KeyRound, Mail, Minimize2, Square, X, UserPlus, ArrowLeft } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function LoginPage() {
  const { login, theme } = useFileSystem();
  const [email, setEmail] = useState('demo@obsidian.com');
  const [password, setPassword] = useState('password');
  const [isRegistering, setIsRegistering] = useState(false);
  const [name, setName] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    login();
  };

  const themeClass = theme === 'obsidian-dark' ? '' : `theme-${theme}`;

  return (
    <div className={cn("h-screen w-full bg-[#161616] flex flex-col overflow-hidden", themeClass)}>
       {/* Fake Windows Bar */}
       <div className="h-8 bg-[#1e1e1e] flex items-center justify-between select-none shrink-0 border-b border-white/5">
        <div className="px-3 flex items-center gap-2">
          <div className="w-4 h-4 bg-primary rounded-sm flex items-center justify-center">
            <div className="w-2 h-2 bg-primary-foreground rotate-45" />
          </div>
          <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-tight">
            {isRegistering ? 'Obsidian Registration' : 'Obsidian Login'}
          </span>
        </div>
        <div className="flex h-full">
           <button className="h-full px-4 hover:bg-white/10 transition-colors flex items-center justify-center group">
              <Minimize2 className="h-3.5 w-3.5 text-muted-foreground group-hover:text-foreground" />
           </button>
           <button className="h-full px-4 hover:bg-white/10 transition-colors flex items-center justify-center group">
              <Square className="h-3 w-3 text-muted-foreground group-hover:text-foreground" />
           </button>
           <button className="h-full px-4 hover:bg-red-500 transition-colors flex items-center justify-center group">
              <X className="h-4 w-4 text-muted-foreground group-hover:text-white" />
           </button>
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center p-4 bg-background">
        <Card className="w-full max-w-md bg-card/50 backdrop-blur-md border-sidebar-border shadow-2xl animate-in zoom-in-95 duration-300">
          <CardHeader className="space-y-1 text-center">
            <div className="mx-auto w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center mb-4">
              {isRegistering ? <UserPlus className="h-6 w-6 text-primary" /> : <KeyRound className="h-6 w-6 text-primary" />}
            </div>
            <CardTitle className="text-2xl font-bold tracking-tight">
              {isRegistering ? 'Создать аккаунт' : 'Welcome Back'}
            </CardTitle>
            <CardDescription className="text-muted-foreground">
              {isRegistering ? 'Заполните данные для регистрации' : 'Введите свои данные для доступа к заметкам'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {isRegistering && (
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
              <div className="space-y-2">
                <Label htmlFor="password">Пароль</Label>
                <div className="relative">
                  <KeyRound className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input 
                    id="password" 
                    type="password" 
                    className="pl-10 bg-background/50"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                </div>
              </div>
              <Button type="submit" className="w-full font-semibold py-6 text-lg shadow-lg hover:shadow-primary/20 transition-all mt-6">
                {isRegistering ? 'Зарегистрироваться' : 'Войти в хранилище'}
              </Button>
            </form>
            
            <div className="mt-6 flex flex-col gap-4">
              <button 
                onClick={() => setIsRegistering(!isRegistering)}
                className="text-sm text-center text-muted-foreground hover:text-primary transition-colors flex items-center justify-center gap-2"
              >
                {isRegistering ? (
                  <><ArrowLeft className="h-4 w-4" /> Уже есть аккаунт? Войти</>
                ) : (
                  'Нет аккаунта? Создать новый'
                )}
              </button>
              
              {!isRegistering && (
                <div className="text-center text-sm">
                  <button className="text-muted-foreground/50 hover:text-primary transition-colors">Забыли пароль?</button>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
