import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { LogOut, User as UserIcon, Save, RefreshCw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useFileSystem } from "@/lib/mock-fs";
import { useAuthContext } from "@/contexts/AuthContext";
import { useLocation } from "wouter";
import { useState, useEffect } from "react";

interface UserProfileDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function UserProfileDialog({ open, onOpenChange }: UserProfileDialogProps) {
  console.log('UserProfileDialog rendered, open:', open);
  const { toast } = useToast();
  const { user, logout: fsLogout, updateUserPrefs, isAuthenticated } = useFileSystem();
  const { logout: authLogout } = useAuthContext();
  const [, setLocation] = useLocation();
  const [telegram, setTelegram] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // При открытии диалога проверяем аутентификацию
  useEffect(() => {
    if (open && !isAuthenticated) {
      // Вызываем checkAuth для синхронизации состояния
      // Используем setTimeout чтобы избежать flushSync warning
      setTimeout(() => {
        const fs = useFileSystem.getState();
        fs.checkAuth();
      }, 0);
    }
  }, [open, isAuthenticated]);

  useEffect(() => {
    if (open && user) {
      setTelegram(user.prefs?.telegram || '');
    }
  }, [open, user]);

  const handleLogout = async () => {
    try {
      await fsLogout();
      await authLogout();
      toast({
        title: "Выход из системы",
        description: "Вы успешно вышли из аккаунта",
      });
      onOpenChange(false);
    } catch (err) {
      toast({
        variant: "destructive",
        title: "Ошибка",
        description: "Не удалось выйти из системы",
      });
    }
  };

  const handleSaveTelegram = async () => {
    if (!user) return;
    setIsSaving(true);
    try {
      await updateUserPrefs({ telegram });
      toast({
        title: "Профиль обновлен",
        description: "Ваш Telegram успешно сохранен",
      });
    } catch (e) {
      toast({
        title: "Ошибка обновления",
        description: "Не удалось сохранить Telegram",
        variant: "destructive"
      });
    } finally {
      setIsSaving(false);
    }
  };

  // Если пользователь не авторизован, показываем сообщение
  if (!isAuthenticated) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Требуется авторизация</DialogTitle>
            <DialogDescription>
              Для просмотра профиля необходимо войти в систему
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4 py-4">
            <Button onClick={() => {
              onOpenChange(false);
              setLocation("/login");
            }}>
              Перейти к входу
            </Button>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Закрыть
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  if (!user) return null;

  const registeredAt = new Date(user.$createdAt).toLocaleDateString('ru-RU');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Профиль пользователя</DialogTitle>
          <DialogDescription>
            Личные данные и настройки аккаунта
          </DialogDescription>
        </DialogHeader>
        
        <div className="py-6">
          <div className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="name" className="text-muted-foreground text-xs uppercase tracking-wider">Имя</Label>
              <div className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                {user.name}
              </div>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="email" className="text-muted-foreground text-xs uppercase tracking-wider">Email</Label>
              <div className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                {user.email}
              </div>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="telegram" className="text-muted-foreground text-xs uppercase tracking-wider">Telegram</Label>
              <div className="flex gap-2">
                <Input
                  id="telegram"
                  value={telegram}
                  onChange={(e) => setTelegram(e.target.value)}
                  placeholder="@username"
                  className="flex-1 h-10 text-sm"
                />
                <Button size="icon" variant="ghost" className="h-10 w-10" onClick={handleSaveTelegram} disabled={isSaving}>
                  {isSaving ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                </Button>
              </div>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="registered" className="text-muted-foreground text-xs uppercase tracking-wider">Дата регистрации</Label>
              <div className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                {registeredAt}
              </div>
            </div>
          </div>
        </div>

        <DialogFooter className="sm:justify-between gap-2 mt-auto pt-4 border-t">
          <div className="flex gap-2 w-full justify-end">
            <Button variant="destructive" onClick={handleLogout}>
                <LogOut className="mr-2 h-4 w-4" />
                Выйти
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
