import { useState, useEffect } from 'react';
import { apiRequest } from '@/lib/queryClient';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useFileSystem } from '@/lib/mock-fs';
import { cn } from '@/lib/utils';
import { useLocation } from 'wouter';
import { ArrowLeft, LogOut } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export default function Profile() {
  const { theme, logout } = useFileSystem();
  const [user, setUser] = useState<{ id: string; username: string; name?: string | null } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const res = await apiRequest("GET", "/api/auth/me");
        if (res.ok) {
            const userData = await res.json();
            setUser(userData);
        } else {
            // If unauthorized or other error
            throw new Error("Failed to fetch user");
        }
      } catch (err) {
        console.error("Failed to fetch user data", err);
        // If unauthorized, redirect to login is handled by App.tsx router usually, but we can double check
      } finally {
        setIsLoading(false);
      }
    };
    fetchUser();
  }, []);

  const handleLogout = async () => {
    try {
      await apiRequest("POST", "/api/auth/logout");
      logout(); // Update local state
      setLocation("/login");
    } catch (err) {
      toast({
        variant: "destructive",
        title: "Ошибка",
        description: "Не удалось выйти из системы",
      });
    }
  };

  const themeClass = theme === 'obsidian-dark' ? '' : `theme-${theme}`;

  if (isLoading) {
    return <div className={cn("h-screen w-full flex items-center justify-center text-foreground", themeClass)}>Загрузка...</div>;
  }

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
                    <div className="bg-background/50 p-3 rounded-md font-mono text-sm border border-border/50">{user.username}</div>
                </div>
                </CardContent>
            </Card>
      </div>
    </div>
  );
}
