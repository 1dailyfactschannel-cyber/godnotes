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
import { LogOut, User as UserIcon, RefreshCw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useFileSystem } from "@/lib/mock-fs";
import { isElectron } from "@/lib/electron";
import { useState } from "react";

interface UserProfileDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function UserProfileDialog({ open, onOpenChange }: UserProfileDialogProps) {
  const { toast } = useToast();
  const { user, logout, downloadAllFiles } = useFileSystem();
  const [isSyncing, setIsSyncing] = useState(false);

  const handleLogout = async () => {
    await logout();
    toast({
      title: "Выход из системы",
      description: "Вы успешно вышли из аккаунта",
    });
    onOpenChange(false);
  };

  const handleSync = async () => {
    setIsSyncing(true);
    try {
      await downloadAllFiles();
      toast({
        title: "Синхронизация завершена",
        description: "Все файлы успешно загружены на устройство",
      });
    } catch (e) {
      toast({
        title: "Ошибка синхронизации",
        description: "Не удалось загрузить файлы",
        variant: "destructive"
      });
    } finally {
      setIsSyncing(false);
    }
  };

  if (!user) return null;

  const registeredAt = new Date(user.$createdAt).toLocaleDateString('ru-RU');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Профиль пользователя</DialogTitle>
          <DialogDescription>
            Личные данные и настройки аккаунта
          </DialogDescription>
        </DialogHeader>
        
        <div className="flex flex-col items-center gap-6 py-4">
          <div className="h-24 w-24 rounded-full bg-secondary flex items-center justify-center text-primary ring-4 ring-background shadow-lg">
            <UserIcon className="h-12 w-12" />
          </div>
          
          <div className="grid w-full gap-4">
            <div className="grid gap-2">
              <Label htmlFor="name" className="text-muted-foreground text-xs uppercase tracking-wider">Имя</Label>
              <div className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50">
                {user.name}
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="email" className="text-muted-foreground text-xs uppercase tracking-wider">Email</Label>
              <div className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50">
                {user.email}
              </div>
            </div>
             <div className="grid gap-2">
              <Label htmlFor="registered" className="text-muted-foreground text-xs uppercase tracking-wider">Дата регистрации</Label>
              <div className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50">
                {registeredAt}
              </div>
            </div>
          </div>
        </div>

        <DialogFooter className="sm:justify-between gap-2">
          <div className="flex gap-2 w-full justify-between">
            {isElectron() && (
                <Button variant="outline" onClick={handleSync} disabled={isSyncing}>
                    <RefreshCw className={`mr-2 h-4 w-4 ${isSyncing ? 'animate-spin' : ''}`} />
                    {isSyncing ? 'Синхронизация...' : 'Скачать все файлы'}
                </Button>
            )}
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
