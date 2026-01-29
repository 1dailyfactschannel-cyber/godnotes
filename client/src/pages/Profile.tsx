import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useFileSystem } from '@/lib/data-store';
import { useAuthContext } from "@/contexts/AuthContext";
import { cn } from '@/lib/utils';
import { useLocation } from 'wouter';
import { ArrowLeft, LogOut } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export default function Profile() {
  const { theme, logout: fsLogout, user } = useFileSystem();
  const { logout: authLogout } = useAuthContext();
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const handleLogout = async () => {
    try {
      await fsLogout();
      await authLogout();
      // Редирект происходит автоматически в App.tsx когда isAuthenticated становится false
    } catch (err) {
      toast({
        variant: "destructive",
        title: "Ошибка",
        description: "Не удалось выйти из системы",
      });
    }
  };

  const themeClass = theme === 'obsidian-dark' ? '' : `theme-${theme}`;

  if (!user) {
    return (
        <div className={cn("h-screen w-full flex flex-col items-center justify-center text-foreground gap-4", themeClass)}>
            <div>Не удалось загрузить данные профиля</div>
            <Button onClick={() => setLocation("/login")}>Войти снова</Button>
        </div>
    );
  }

  return (
    <div className={cn("h-screen w-full bg-[#161616] flex flex-col overflow-hidden p-6 text-foreground", themeClass)}>
        <div className="max-w-2xl mx-auto w-full">
            <Button 
                variant="ghost" 
                className="mb-6 pl-0 hover:bg-transparent hover:text-primary"
                onClick={() => setLocation("/")}
            >
                <ArrowLeft className="mr-2 h-4 w-4" />
                Назад к заметкам
            </Button>
            
            <Card className="w-full bg-card/50 backdrop-blur-md border-sidebar-border shadow-2xl">
                <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Профиль пользователя</CardTitle>
                <Button variant="destructive" size="sm" onClick={handleLogout}>
                    <LogOut className="mr-2 h-4 w-4" />
                    Выйти
                </Button>
                </CardHeader>
                <CardContent className="space-y-6">
                <div className="space-y-2">
                    <label className="text-sm text-muted-foreground font-medium">Имя</label>
                    <div className="bg-background/50 p-3 rounded-md font-medium border border-border/50">{user.name || 'Не указано'}</div>
                </div>
                <div className="space-y-2">
                    <label className="text-sm text-muted-foreground font-medium">Email</label>
                    <div className="bg-background/50 p-3 rounded-md font-mono text-sm border border-border/50">{user.email}</div>
                </div>
                </CardContent>
            </Card>
      </div>
    </div>
  );
}
