import { useState, useEffect } from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ToastAction } from '@/components/ui/toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Check, CheckCircle2, FolderOpen, Loader2, Plus, Send, Settings, Trash2, Unplug, RefreshCw, HelpCircle, Bot, Sparkles, Shield, Key, Globe, Cpu, Lock, Unlock, ShieldCheck, ShieldAlert, Fingerprint } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useFileSystem, ThemeType } from '@/lib/mock-fs';
import { useTasks } from '@/lib/tasks-store';
import { telegramRequest, selectDirectory, getStoreValue, setStoreValue, isElectron, electron } from '@/lib/electron';
import { useToast } from '@/hooks/use-toast';
import { ScrollArea } from '@/components/ui/scroll-area';
import { changelog } from '@/data/changelog';
import { HelpSettings } from './HelpSettings';

interface SettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type SettingsTab = 'general' | 'theme' | 'hotkeys' | 'telegram' | 'about' | 'help' | 'ai' | 'security';

export function SettingsDialog({ open, onOpenChange }: SettingsDialogProps) {
  const [activeTab, setActiveTab] = useState<SettingsTab>('general');
  const { theme, setTheme, hotkeys, setHotkey, isOfflineMode, toggleOfflineMode, items, downloadAllFiles, updateUserPrefs, updateAccountPassword, aiConfig, updateAIConfig, setMasterPassword, checkMasterPassword, securityConfig, isAuthenticated, user } = useFileSystem();
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [accountOldPassword, setAccountOldPassword] = useState('');
  const [accountNewPassword, setAccountNewPassword] = useState('');
  const [accountConfirmPassword, setAccountConfirmPassword] = useState('');
  const [showAiHelp, setShowAiHelp] = useState(false);
  const [showSecurityHelp, setShowSecurityHelp] = useState(false);
  const [hasPassword, setHasPassword] = useState(!!securityConfig.hashedPassword);

  const CUSTOM_CONFIG_KEY = 'aiCustomConfig';
  const saveCustomConfig = (cfg: any) => {
    try {
      const data = JSON.stringify(cfg);
      localStorage.setItem(CUSTOM_CONFIG_KEY, data);
      
      // Синхронизируем с облаком для сохранности
      if (isAuthenticated && user) {
        updateUserPrefs({ aiCustomConfig: data })
          .catch(err => console.error('Failed to sync custom AI config to cloud:', err));
      }
    } catch {}
  };
  const loadCustomConfig = (): any | null => {
    try {
      const raw = localStorage.getItem(CUSTOM_CONFIG_KEY);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch {
      return null;
    }
  };

  // Local state for inputs to prevent global store updates on every keystroke
  const [localApiKey, setLocalApiKey] = useState(aiConfig.apiKey);
  const [localModel, setLocalModel] = useState(aiConfig.model);
  const [localBaseUrl, setLocalBaseUrl] = useState(aiConfig.baseUrl || '');

  // Sync local state when aiConfig changes (e.g. switching modes)
  useEffect(() => {
    setLocalApiKey(aiConfig.apiKey);
    setLocalModel(aiConfig.model);
    setLocalBaseUrl(aiConfig.baseUrl || '');
  }, [aiConfig]);

  // Отслеживание изменений securityConfig
  useEffect(() => {
    setHasPassword(!!securityConfig.hashedPassword);
    console.log('Security config updated:', securityConfig);
  }, [securityConfig]);

  useEffect(() => {
    const handleOpenSettings = (e: any) => {
      if (e.detail?.tab) {
        setActiveTab(e.detail.tab);
      }
      onOpenChange(true);
    };
    const handleSecurityUpdate = () => {
       // Принудительное обновление компонента при изменении securityConfig
       setHasPassword(!!securityConfig.hashedPassword);
       setOldPassword('');
       setNewPassword('');
       setConfirmPassword('');
     };
    window.addEventListener('godnotes:open-settings', handleOpenSettings);
    window.addEventListener('security-config-updated', handleSecurityUpdate);
    return () => {
      window.removeEventListener('godnotes:open-settings', handleOpenSettings);
      window.removeEventListener('security-config-updated', handleSecurityUpdate);
    };
  }, [onOpenChange]);

  const handleSetPassword = async () => {
      if (!newPassword) {
          toast({ title: "Ошибка", description: "Пароль не может быть пустым", variant: "destructive" });
          return;
      }
      if (newPassword !== confirmPassword) {
          toast({ title: "Ошибка", description: "Пароли не совпадают", variant: "destructive" });
          return;
      }

      // Если пароль уже установлен, требуем старый пароль
      if (hasPassword) {
        if (!oldPassword) {
            toast({ title: "Ошибка", description: "Введите старый пароль", variant: "destructive" });
            return;
        }
        const isValid = await checkMasterPassword(oldPassword);
        if (!isValid) {
            toast({ title: "Ошибка", description: "Неверный старый пароль", variant: "destructive" });
            return;
        }
      }

      await setMasterPassword(newPassword);
      toast({ title: "Успех", description: "Мастер-пароль обновлен" });
      setOldPassword('');
      setNewPassword('');
      setConfirmPassword('');
      // Принудительное обновление для отображения нового статуса
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent('security-config-updated'));
      }, 100);
  };

  const handleUpdateAccountPassword = async () => {
    if (!accountNewPassword) {
      toast({ title: "Ошибка", description: "Пароль не может быть пустым", variant: "destructive" });
      return;
    }
    if (accountNewPassword !== accountConfirmPassword) {
      toast({ title: "Ошибка", description: "Пароли не совпадают", variant: "destructive" });
      return;
    }
    if (!accountOldPassword) {
      toast({ title: "Ошибка", description: "Введите старый пароль аккаунта", variant: "destructive" });
      return;
    }

    try {
      await updateAccountPassword(accountNewPassword, accountOldPassword);
      toast({ title: "Успех", description: "Пароль аккаунта успешно изменен" });
      setAccountOldPassword('');
      setAccountNewPassword('');
      setAccountConfirmPassword('');
    } catch (err: any) {
      toast({ 
        title: "Ошибка", 
        description: err.message || "Не удалось изменить пароль аккаунта", 
        variant: "destructive" 
      });
    }
  };

  const { telegramConfig, setTelegramConfig } = useTasks();
  const { toast } = useToast();
  const [isConnecting, setIsConnecting] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [spaces, setSpaces] = useState<{ id: string; name: string; path: string }[]>([]);
  const [storagePath, setStoragePath] = useState<string>('');
  const [spaceNameDialogOpen, setSpaceNameDialogOpen] = useState(false);
  const [pendingSpacePath, setPendingSpacePath] = useState<string | null>(null);
  const [spaceNameInput, setSpaceNameInput] = useState('');
  const [appVersion, setAppVersion] = useState<string>('');
  
  const [spaceToDelete, setSpaceToDelete] = useState<{ id: string; name: string; path: string } | null>(null);
  const [deleteFilesChecked, setDeleteFilesChecked] = useState(false);

  // const [changelog] is now imported directly

  useEffect(() => {
    const loadSettings = async () => {
      try {
        const path = await getStoreValue('storagePath');
        if (path) setStoragePath(path);

        const savedSpaces = await getStoreValue('spaces');
        if (savedSpaces && Array.isArray(savedSpaces)) {
          setSpaces(savedSpaces);
        }

        if (isElectron() && electron) {
             electron.getAppVersion().then(setAppVersion);
        }
      } catch (err) {
        console.error('Failed to load settings:', err);
      }
    };
    if (open) loadSettings();
  }, [open]);

  const handleCheckUpdates = async () => {
    if (electron) {
        toast({ title: 'Проверка обновлений', description: 'Поиск новой версии...' });
        await electron.checkForUpdates();
    }
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

  const handleConnectTelegram = async () => {
    if (!telegramConfig.botToken?.trim()) {
      toast({ variant: "destructive", title: "Ошибка", description: "Bot Token не задан" });
      return;
    }
    setIsConnecting(true);
    const code = crypto.randomUUID().split('-')[0];
    const botUrl = `https://t.me/godnotes_bot?start=${code}`;
    window.open(botUrl, '_blank');

    const start = Date.now();
    const token = telegramConfig.botToken;
    let connected = false;

    while (Date.now() - start < 60000 && !connected) { // 1 min timeout
      try {
        const data = await telegramRequest(`https://api.telegram.org/bot${token}/getUpdates?limit=10`);
        if (data.ok) {
          const update = data.result.find((u: any) => u.message?.text === `/start ${code}`);
          if (update) {
            const chatId = update.message.chat.id.toString();
            const username = update.message.from?.username;
            setTelegramConfig({ ...telegramConfig, chatId });
            
            // Sync to user prefs
            try {
              await updateUserPrefs({ telegramChatId: chatId });
              if (username) {
                 await updateUserPrefs({ telegram: username });
              }
            } catch (e) {
              console.error('Failed to sync telegram config', e);
            }

            await telegramRequest(`https://api.telegram.org/bot${token}/sendMessage`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                chat_id: chatId,
                text: '✅ GodNotes: Уведомления успешно подключены!',
              }),
            });

            toast({ title: "Успех", description: "Telegram уведомления подключены" });
            connected = true;
          }
        }
      } catch (e) {
        console.error(e);
      }
      if (!connected) await new Promise(r => setTimeout(r, 2000));
    }

    setIsConnecting(false);
    if (!connected) {
      toast({ title: "Ошибка", description: "Не удалось подключить Telegram (таймаут)", variant: "destructive" });
    }
  };

  const handleDisconnectTelegram = async () => {
    setTelegramConfig({ ...telegramConfig, chatId: '' });
    try {
      await updateUserPrefs({ telegramChatId: '' });
    } catch (e) {
      console.error('Failed to sync telegram config', e);
    }
    toast({ title: "Отключено", description: "Telegram уведомления отключены" });
  };

  const handleAddSpace = async () => {
    try {
      const result = await selectDirectory();
      if (result) {
        setPendingSpacePath(result);
        const folderName = result.split(/[/\\]/).pop() || 'Новое пространство';
        setSpaceNameInput(folderName);
        setSpaceNameDialogOpen(true);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const confirmAddSpace = async () => {
    if (!pendingSpacePath || !spaceNameInput) return;

    try {
      const newSpace = { id: crypto.randomUUID(), name: spaceNameInput, path: pendingSpacePath };
      const newSpaces = [...spaces, newSpace];
      setSpaces(newSpaces);
      await setStoreValue('spaces', newSpaces);

      toast({ 
        title: "Пространство добавлено", 
        description: `Пространство "${spaceNameInput}" успешно добавлено`,
        action: (
          <ToastAction 
            altText="Переключиться" 
            onClick={() => handleSwitchSpace(newSpace)}
            className="bg-primary text-primary-foreground hover:bg-primary/90 border-0"
          >
            Переключиться
          </ToastAction>
        )
      });
      
      if (spaces.length === 0) {
        handleSwitchSpace(newSpace);
      }
      
      setSpaceNameDialogOpen(false);
      setPendingSpacePath(null);
      setSpaceNameInput('');
    } catch (err) {
       console.error(err);
       toast({ variant: "destructive", title: "Ошибка", description: "Не удалось сохранить пространство" });
    }
  };

  const handleSwitchSpace = async (space: { id: string, name: string, path: string }) => {
    try {
      setStoragePath(space.path);
      await setStoreValue('storagePath', space.path);
      toast({ title: "Пространство переключено", description: `Вы перешли в "${space.name}"` });
      setTimeout(() => window.location.reload(), 500);
    } catch (err) {
      console.error(err);
      toast({ variant: "destructive", title: "Ошибка", description: "Не удалось переключить пространство" });
    }
  };

  const handleRemoveSpace = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const spaceToRemove = spaces.find(s => s.id === id);
    if (spaceToRemove?.path === storagePath) {
        toast({ title: "Ошибка", description: "Нельзя удалить активное пространство", variant: "destructive" });
        return;
    }
    setSpaceToDelete(spaceToRemove || null);
    setDeleteFilesChecked(false);
  };

  const confirmDeleteSpace = async () => {
    if (!spaceToDelete) return;

    try {
      if (deleteFilesChecked && isElectron() && electron && electron.fs) {
          const res = await electron.fs.deleteDirectory(spaceToDelete.path);
          if (!res.success) {
             console.error("Failed to delete directory:", res.error);
             toast({ variant: "destructive", title: "Ошибка удаления файлов", description: res.error });
             // We continue to remove from list even if file deletion fails partially, 
             // but user sees the error.
          } else {
             toast({ title: "Успех", description: "Файлы пространства перемещены в корзину" });
          }
      }

      const newSpaces = spaces.filter(s => s.id !== spaceToDelete.id);
      setSpaces(newSpaces);
      await setStoreValue('spaces', newSpaces);
      toast({ title: "Пространство удалено", description: `Пространство "${spaceToDelete.name}" удалено из списка` });
    } catch (e) {
      console.error(e);
      toast({ variant: "destructive", title: "Ошибка", description: "Не удалось удалить пространство" });
    } finally {
      setSpaceToDelete(null);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-3xl h-[600px] p-0 flex gap-0 overflow-hidden">
          <DialogTitle className="sr-only">Настройки</DialogTitle>
          <DialogDescription className="sr-only">
            Управление настройками приложения: внешний вид, горячие клавиши, Telegram и другое
          </DialogDescription>
          {/* Sidebar */}
          <div className="w-48 bg-muted/30 border-r border-border p-4 flex flex-col gap-2 shrink-0">
            <div className="text-sm font-semibold mb-4 px-2">Настройки</div>
            <NavButton active={activeTab === 'general'} onClick={() => setActiveTab('general')} label="Общие" />
            <NavButton active={activeTab === 'theme'} onClick={() => setActiveTab('theme')} label="Внешний вид" />
            <NavButton active={activeTab === 'hotkeys'} onClick={() => setActiveTab('hotkeys')} label="Горячие клавиши" />
            <NavButton active={activeTab === 'telegram'} onClick={() => setActiveTab('telegram')} label="Telegram" />
            <NavButton active={activeTab === 'security'} onClick={() => setActiveTab('security')} label="Безопасность" />
            <div className="flex-1" />
            <button
              onClick={() => setActiveTab('ai')}
              className={cn(
                "w-full text-left px-3 py-2 rounded-md text-sm transition-colors flex items-center",
                activeTab === 'ai' ? "bg-primary text-primary-foreground font-medium" : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <Bot className="mr-2 h-4 w-4" />
              AI Помощник
            </button>
            <NavButton active={activeTab === 'help'} onClick={() => setActiveTab('help')} label="Как пользоваться" />
            <NavButton active={activeTab === 'about'} onClick={() => setActiveTab('about')} label="О приложении" />
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-6">
            {activeTab === 'general' && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-medium mb-4">Общие настройки</h3>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label className="text-base">Офлайн режим</Label>
                        <p className="text-sm text-muted-foreground">Хранить данные только локально</p>
                      </div>
                      <Switch checked={isOfflineMode} onCheckedChange={toggleOfflineMode} />
                    </div>

                    {isElectron() && (
                      <div className="flex items-center justify-between pt-4 border-t border-border">
                        <div className="space-y-0.5">
                          <Label className="text-base">Синхронизация</Label>
                          <p className="text-sm text-muted-foreground">Скачать все файлы из облака</p>
                        </div>
                        <Button variant="outline" size="sm" onClick={handleSync} disabled={isSyncing}>
                          <RefreshCw className={`mr-2 h-4 w-4 ${isSyncing ? 'animate-spin' : ''}`} />
                          {isSyncing ? 'Загрузка...' : 'Скачать'}
                        </Button>
                      </div>
                    )}
                  </div>
                </div>

                <div className="pt-6 border-t border-border">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-medium">Пространства</h3>
                    <Button variant="ghost" size="sm" onClick={handleAddSpace}>
                      <Plus className="h-4 w-4 mr-2" />
                      Добавить
                    </Button>
                  </div>
                  <div className="space-y-2">
                    {spaces.length === 0 ? (
                      <div className="text-sm text-muted-foreground italic text-center py-4">Нет добавленных пространств</div>
                    ) : (
                      spaces.map(space => (
                        <div key={space.id} className={cn(
                          "flex items-center justify-between p-3 rounded-md border transition-colors",
                          storagePath === space.path ? "bg-primary/5 border-primary/20" : "bg-card border-border hover:bg-accent/50"
                        )}>
                          <div className="flex items-center gap-3 overflow-hidden flex-1 cursor-pointer" onClick={() => handleSwitchSpace(space)}>
                            {storagePath === space.path ? (
                              <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />
                            ) : (
                              <FolderOpen className="h-4 w-4 text-muted-foreground shrink-0" />
                            )}
                            <div className="flex flex-col overflow-hidden">
                              <span className="font-medium truncate text-sm">{space.name}</span>
                              <span className="text-xs text-muted-foreground truncate opacity-70" title={space.path}>{space.path}</span>
                            </div>
                          </div>
                          
                          {storagePath !== space.path && (
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10" 
                              onClick={(e) => handleRemoveSpace(space.id, e)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'theme' && (
              <div className="space-y-6">
                <h3 className="text-lg font-medium mb-4">Внешний вид</h3>
                <div className="grid grid-cols-2 gap-4">
                  <ThemeCard 
                    label="Obsidian Dark" 
                    active={theme === 'obsidian-dark'} 
                    onClick={() => setTheme('obsidian-dark')}
                    previewClass="bg-[#1e1e1e]" 
                  />
                  <ThemeCard 
                    label="Midnight Blue" 
                    active={theme === 'midnight-blue'} 
                    onClick={() => setTheme('midnight-blue')}
                    previewClass="bg-[#0f172a]" 
                  />
                  <ThemeCard 
                    label="Graphite" 
                    active={theme === 'graphite'} 
                    onClick={() => setTheme('graphite')}
                    previewClass="bg-[#18181b]" 
                  />
                  <ThemeCard 
                    label="Light Mode" 
                    active={theme === 'light-mode'} 
                    onClick={() => setTheme('light-mode')}
                    previewClass="bg-white border" 
                  />
                  <ThemeCard 
                    label="Forest" 
                    active={theme === 'forest'} 
                    onClick={() => setTheme('forest')}
                    previewClass="bg-[#101411]" 
                  />
                  <ThemeCard 
                    label="Sunset" 
                    active={theme === 'sunset'} 
                    onClick={() => setTheme('sunset')}
                    previewClass="bg-[#1f1c29]" 
                  />
                  <ThemeCard 
                    label="Ocean" 
                    active={theme === 'ocean'} 
                    onClick={() => setTheme('ocean')}
                    previewClass="bg-[#0f1d24]" 
                  />
                  <ThemeCard 
                    label="Cyberpunk" 
                    active={theme === 'cyberpunk'} 
                    onClick={() => setTheme('cyberpunk')}
                    previewClass="bg-[#160e22]" 
                  />
                </div>
              </div>
            )}

            {activeTab === 'hotkeys' && (
              <div className="space-y-6">
                <h3 className="text-lg font-medium mb-4">Горячие клавиши</h3>
                <div className="space-y-2">
                  <HotkeySetting 
                    label="Командная панель" 
                    value={hotkeys.commandPalette || 'Ctrl+K'} 
                    onChange={(v) => setHotkey('commandPalette', v)} 
                  />
                  <HotkeySetting 
                    label="Жирный (Bold)" 
                    value={hotkeys.bold || 'Ctrl+B'} 
                    onChange={(v) => setHotkey('bold', v)} 
                  />
                  <HotkeySetting 
                    label="Курсив (Italic)" 
                    value={hotkeys.italic || 'Ctrl+I'} 
                    onChange={(v) => setHotkey('italic', v)} 
                  />
                  <HotkeySetting 
                    label="Вставить ссылку" 
                    value={hotkeys.link || 'Ctrl+L'} 
                    onChange={(v) => setHotkey('link', v)} 
                  />
                  <HotkeySetting 
                    label="Список задач" 
                    value={hotkeys.taskList || 'Ctrl+Shift+9'} 
                    onChange={(v) => setHotkey('taskList', v)} 
                  />
                  <HotkeySetting 
                    label="Создать заметку" 
                    value={hotkeys.newNote || 'Ctrl+Alt+N'} 
                    onChange={(v) => setHotkey('newNote', v)} 
                  />
                  <HotkeySetting 
                    label="Настройки" 
                    value={hotkeys.settings || 'Ctrl+,'} 
                    onChange={(v) => setHotkey('settings', v)} 
                  />
                  <HotkeySetting 
                    label="Показать/Скрыть меню" 
                    value={hotkeys.toggleSidebar || 'Ctrl+\\'} 
                    onChange={(v) => setHotkey('toggleSidebar', v)} 
                  />
                </div>
              </div>
            )}

            {activeTab === 'telegram' && (
              <div className="space-y-6">
                <h3 className="text-lg font-medium mb-4">Telegram уведомления</h3>
                <div className="space-y-4 max-w-md">
                  <div className="grid gap-2">
                    <Label>Bot Token</Label>
                    <Input 
                      value={telegramConfig.botToken} 
                      onChange={async (e) => {
                        const val = e.target.value;
                        setTelegramConfig({ ...telegramConfig, botToken: val });
                        if (isElectron() && electron && electron.saveSecret) {
                          await electron.saveSecret('telegramBotToken', val);
                        }
                      }}
                      type="password"
                      placeholder="Введите токен бота"
                    />
                    <p className="text-xs text-muted-foreground">Токен вашего бота от @BotFather</p>
                  </div>
                  
                  <div className="pt-4">
                    {telegramConfig.chatId ? (
                       <div className="flex items-center justify-between p-4 bg-green-500/10 border border-green-500/20 rounded-md">
                           <div className="flex items-center gap-3">
                               <CheckCircle2 className="h-5 w-5 text-green-500" />
                               <div>
                                 <div className="font-medium text-green-500">Уведомления подключены</div>
                                 <div className="text-xs text-muted-foreground">Chat ID: {telegramConfig.chatId}</div>
                               </div>
                           </div>
                           <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-destructive" onClick={handleDisconnectTelegram} title="Отключить">
                               <Unplug className="h-4 w-4" />
                           </Button>
                       </div>
                    ) : (
                       <Button 
                           className="w-full gap-2" 
                           onClick={handleConnectTelegram} 
                           disabled={isConnecting}
                       >
                           {isConnecting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                           {isConnecting ? 'Подключение...' : 'Подключить уведомления'}
                       </Button>
                    )}
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'security' && (
              <div className="space-y-4 max-w-md">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-medium">Безопасность</h3>
                  <Button variant="ghost" size="sm" onClick={() => setShowSecurityHelp(true)} className="h-8 text-muted-foreground hover:text-primary">
                    <HelpCircle className="h-4 w-4 mr-2" />
                    Инструкция
                  </Button>
                </div>

                <div className="p-3 rounded-lg border bg-muted/30 space-y-3 transition-all hover:bg-muted/50 group">
                  <div className="flex items-center justify-between pb-2 border-b border-border/50">
                    <div className="flex items-center gap-2">
                      <div className={cn(
                        "p-1.5 rounded-md transition-colors",
                        hasPassword ? "bg-green-500/10 text-green-500" : "bg-orange-500/10 text-orange-500 animate-pulse"
                      )}>
                        {hasPassword ? <Lock className="h-4 w-4" /> : <Unlock className="h-4 w-4" />}
                      </div>
                      <span className="text-sm font-medium">
                        {hasPassword ? 'Мастер-пароль активен' : 'Пароль не установлен'}
                      </span>
                    </div>
                    {hasPassword && (
                      <div className="flex items-center gap-1">
                        <span className="relative flex h-2 w-2">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                        </span>
                        <span className="text-[10px] uppercase tracking-wider font-bold text-green-500/70">Secure</span>
                      </div>
                    )}
                  </div>

                  <div className="grid gap-2.5">
                    {hasPassword && (
                      <div className="grid gap-1.5 group/input">
                        <Label className="text-xs text-muted-foreground group-hover/input:text-foreground transition-colors">Старый пароль</Label>
                        <Input 
                          type="password" 
                          placeholder="Текущий пароль" 
                          value={oldPassword}
                          onChange={(e) => setOldPassword(e.target.value)}
                          className="h-8 text-sm bg-background/50 focus:bg-background transition-all"
                        />
                      </div>
                    )}
                    <div className="grid gap-1.5 group/input">
                      <Label className="text-xs text-muted-foreground group-hover/input:text-foreground transition-colors">Новый пароль</Label>
                      <Input 
                        type="password" 
                        placeholder="Новый пароль" 
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        className="h-8 text-sm bg-background/50 focus:bg-background transition-all"
                      />
                    </div>
                    <div className="grid gap-1.5 group/input">
                      <Label className="text-xs text-muted-foreground group-hover/input:text-foreground transition-colors">Повторите пароль</Label>
                      <Input 
                        type="password" 
                        placeholder="Подтверждение" 
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        className="h-8 text-sm bg-background/50 focus:bg-background transition-all"
                      />
                    </div>
                    <Button 
                      size="sm" 
                      className={cn(
                        "w-full mt-1 h-8 transition-all active:scale-[0.98]",
                        hasPassword ? "bg-primary hover:bg-primary/90" : "bg-orange-600 hover:bg-orange-700 text-white"
                      )}
                      onClick={handleSetPassword}
                    >
                      {hasPassword ? (
                        <RefreshCw className="h-3.5 w-3.5 mr-2 group-hover:rotate-180 transition-transform duration-500" />
                      ) : (
                        <Key className="h-3.5 w-3.5 mr-2 animate-bounce" />
                      )}
                      {hasPassword ? 'Обновить мастер-пароль' : 'Установить мастер-пароль'}
                    </Button>
                  </div>
                </div>

                <p className="text-[11px] text-muted-foreground px-1 leading-relaxed italic">
                  * Мастер-пароль хранится только локально. Если вы его забудете, доступ к защищенным заметкам будет потерян навсегда.
                </p>

                {isAuthenticated && (
                  <div className="p-3 rounded-lg border bg-muted/30 space-y-3 mt-4 transition-all hover:bg-muted/50 group">
                    <div className="flex items-center gap-2 pb-2 border-b border-border/50">
                      <div className="p-1.5 rounded-md bg-blue-500/10 text-blue-500 group-hover:bg-blue-500/20 transition-colors">
                        <Fingerprint className="h-4 w-4" />
                      </div>
                      <span className="text-sm font-medium">Пароль аккаунта (Appwrite)</span>
                    </div>

                    <div className="grid gap-2.5">
                      <div className="grid gap-1.5 group/input">
                        <Label className="text-xs text-muted-foreground group-hover/input:text-foreground transition-colors">Старый пароль аккаунта</Label>
                        <Input 
                          type="password" 
                          placeholder="Текущий пароль аккаунта" 
                          value={accountOldPassword}
                          onChange={(e) => setAccountOldPassword(e.target.value)}
                          className="h-8 text-sm bg-background/50 focus:bg-background transition-all"
                        />
                      </div>
                      <div className="grid gap-1.5 group/input">
                        <Label className="text-xs text-muted-foreground group-hover/input:text-foreground transition-colors">Новый пароль аккаунта</Label>
                        <Input 
                          type="password" 
                          placeholder="Новый пароль" 
                          value={accountNewPassword}
                          onChange={(e) => setAccountNewPassword(e.target.value)}
                          className="h-8 text-sm bg-background/50 focus:bg-background transition-all"
                        />
                      </div>
                      <div className="grid gap-1.5 group/input">
                        <Label className="text-xs text-muted-foreground group-hover/input:text-foreground transition-colors">Повторите новый пароль</Label>
                        <Input 
                          type="password" 
                          placeholder="Подтверждение" 
                          value={accountConfirmPassword}
                          onChange={(e) => setAccountConfirmPassword(e.target.value)}
                          className="h-8 text-sm bg-background/50 focus:bg-background transition-all"
                        />
                      </div>
                      <Button size="sm" className="w-full mt-1 h-8 transition-all active:scale-[0.98]" onClick={handleUpdateAccountPassword}>
                        <ShieldCheck className="h-3.5 w-3.5 mr-2 group-hover:scale-110 transition-transform" />
                        Изменить пароль аккаунта
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'ai' && (
              <div className="space-y-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-medium">AI Помощник</h3>
                  <Button variant="ghost" size="sm" onClick={() => setShowAiHelp(true)}>
                    <HelpCircle className="h-4 w-4 mr-2" />
                    Инструкция
                  </Button>
                </div>
                <div className="space-y-6 max-w-md">
                    <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
                      <div className="grid gap-2">
                        <Label>Провайдер</Label>
                        <Select 
                          value={aiConfig.provider} 
                          onValueChange={(val: any) => {
                            // Предлагаем дефолтную модель только если текущее поле пустое
                            // или содержит дефолтную модель другого провайдера
                            const isDefaultModel = !localModel || 
                                                 ['gpt-4o', 'claude-3-5-sonnet-20240620', 'google/gemini-2.0-flash-lite-001', 'google/gemini-2.0-flash-exp:free', 'gpt-3.5-turbo'].includes(localModel);
                            
                            let nextModel = localModel;
                            if (isDefaultModel) {
                              nextModel = val === 'anthropic' ? 'claude-3-5-sonnet-20240620' : 
                                          val === 'openrouter' ? 'google/gemini-2.0-flash-lite-001' : 
                                          val === 'openai' ? 'gpt-4o' : localModel;
                            }
                            
                            setLocalModel(nextModel);
                            updateAIConfig({ provider: val, model: nextModel });
                            saveCustomConfig({ provider: val, apiKey: localApiKey, model: nextModel, baseUrl: localBaseUrl });
                          }}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Выберите провайдера" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="openai">OpenAI</SelectItem>
                            <SelectItem value="anthropic">Anthropic</SelectItem>
                            <SelectItem value="openrouter">OpenRouter.ai</SelectItem>
                            <SelectItem value="custom">Custom (Local LLM)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="grid gap-2">
                        <Label>API Key</Label>
                        <Input 
                          type="password" 
                          value={localApiKey} 
                          onChange={(e) => setLocalApiKey(e.target.value)}
                          onBlur={() => {
                            const newConfig = { ...aiConfig, apiKey: localApiKey };
                            updateAIConfig({ apiKey: localApiKey });
                            saveCustomConfig({ ...newConfig, model: localModel, baseUrl: localBaseUrl });
                          }}
                          placeholder="sk-..."
                          autoComplete="new-password"
                          className="font-mono"
                        />
                        <p className="text-xs text-muted-foreground">
                            {aiConfig.provider === 'openrouter' ? 'Ключ от openrouter.ai' : 'Ваш API ключ'}
                        </p>
                      </div>

                      <div className="grid gap-2">
                        <Label>Модель</Label>
                        <Input 
                          value={localModel} 
                          onChange={(e) => setLocalModel(e.target.value)}
                          onBlur={() => {
                            const newConfig = { ...aiConfig, model: localModel };
                            updateAIConfig({ model: localModel });
                            saveCustomConfig({ ...newConfig, apiKey: localApiKey, baseUrl: localBaseUrl });
                          }}
                          placeholder={aiConfig.provider === 'openrouter' ? 'tngtech/deepseek-r1t2-chimera:free' : 'gpt-3.5-turbo'}
                        />
                        {aiConfig.provider === 'openrouter' && (
                            <p className="text-xs text-muted-foreground">
                                Например: anthropic/claude-3-opus, google/gemini-pro
                            </p>
                        )}
                      </div>

                      {aiConfig.provider === 'custom' && (
                        <div className="grid gap-2">
                          <Label>Base URL</Label>
                          <Input 
                            value={localBaseUrl} 
                            onChange={(e) => setLocalBaseUrl(e.target.value)}
                            onBlur={() => {
                              const newConfig = { ...aiConfig, baseUrl: localBaseUrl };
                              updateAIConfig({ baseUrl: localBaseUrl });
                              saveCustomConfig({ ...newConfig, provider: aiConfig.provider, apiKey: localApiKey, model: localModel });
                            }}
                            placeholder="https://api.openai.com/v1"
                          />
                        </div>
                      )}
                    </div>

                  <div className="pt-4 p-4 bg-muted/50 rounded-lg text-sm text-muted-foreground">
                    <p className="flex items-center gap-2 mb-2">
                        <Sparkles className="h-4 w-4" />
                        <strong>Возможности AI:</strong>
                    </p>
                    <ul className="list-disc list-inside space-y-1 ml-1">
                        <li>Генерация текста и идей</li>
                        <li>Исправление ошибок и переписывание</li>
                        <li>Поиск по базе знаний (RAG)</li>
                        <li>Чат с контекстом заметок</li>
                    </ul>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'help' && (
              <HelpSettings />
            )}

            {activeTab === 'about' && (
              <div className="space-y-6 h-full flex flex-col">
                <h3 className="text-lg font-medium mb-4">О приложении</h3>
                
                <div className="flex flex-col items-center gap-2 p-6 bg-secondary/20 rounded-lg border border-border shrink-0">
                    <div className="text-xl font-bold">GodNotes</div>
                    <div className="text-sm text-muted-foreground">Версия {appVersion || '1.1.0'}</div>
                    {isElectron() && (
                      <Button variant="outline" size="sm" onClick={handleCheckUpdates} className="mt-2">
                          <RefreshCw className="mr-2 h-4 w-4" />
                          Проверить обновления
                      </Button>
                    )}
                </div>

                <div className="flex-1 flex flex-col min-h-0">
                    <Label className="mb-2 px-1">История изменений</Label>
                    <ScrollArea className="flex-1 border rounded-md p-4 bg-background">
                        {changelog.map((release, index) => (
                            <div key={index} className="mb-6 last:mb-0">
                                <div className="flex items-center justify-between mb-2">
                                    <span className="font-semibold">v{release.version}</span>
                                    <span className="text-xs text-muted-foreground">{release.date}</span>
                                </div>
                                <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
                                    {release.notes.map((note: string, i: number) => (
                                        <li key={i}>{note}</li>
                                    ))}
                                </ul>
                            </div>
                        ))}
                    </ScrollArea>
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={spaceNameDialogOpen} onOpenChange={setSpaceNameDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Название пространства</DialogTitle>
            <DialogDescription>
              Введите название для папки: {pendingSpacePath}
            </DialogDescription>
          </DialogHeader>
          <Input 
            value={spaceNameInput} 
            onChange={(e) => setSpaceNameInput(e.target.value)} 
            placeholder="Мои заметки"
          />
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" onClick={() => setSpaceNameDialogOpen(false)}>Отмена</Button>
            <Button onClick={confirmAddSpace}>Добавить</Button>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!spaceToDelete} onOpenChange={(open) => !open && setSpaceToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Удалить пространство?</AlertDialogTitle>
            <AlertDialogDescription>
              Вы уверены, что хотите удалить пространство "{spaceToDelete?.name}"?
              Это действие удалит его из списка ваших пространств.
            </AlertDialogDescription>
          </AlertDialogHeader>
          
          <div className="flex flex-col space-y-2 py-4">
            <div className="flex items-center space-x-2">
              <Switch 
                id="delete-files" 
                checked={deleteFilesChecked} 
                onCheckedChange={setDeleteFilesChecked} 
              />
              <Label htmlFor="delete-files">Также переместить файлы папки в корзину</Label>
            </div>
            {deleteFilesChecked && (
              <p className="text-sm text-destructive pl-12">
                Внимание: Будут удалены <strong>все файлы</strong> в выбранной папке, включая те, что не являются заметками.
              </p>
            )}
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel>Отмена</AlertDialogCancel>
            <AlertDialogAction 
              onClick={confirmDeleteSpace}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Удалить
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={showAiHelp} onOpenChange={setShowAiHelp}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Как подключить AI?</AlertDialogTitle>
            <AlertDialogDescription className="space-y-3 pt-2">
              <p>Для работы AI функций необходимо получить API ключ у одного из провайдеров:</p>
              <ul className="list-disc list-inside space-y-1 text-sm">
                <li><strong>OpenRouter (Рекомендуется):</strong> Зарегистрируйтесь на openrouter.ai, создайте ключ. Доступны бесплатные модели (например, DeepSeek).</li>
                <li><strong>OpenAI:</strong> Требуется аккаунт с привязанной картой (GPT-3.5/4).</li>
                <li><strong>Anthropic:</strong> Требуется аккаунт Claude API.</li>
              </ul>
              <p className="text-sm font-medium mt-2">Порядок действий:</p>
              <ol className="list-decimal list-inside space-y-1 text-sm">
                <li>Выберите провайдера в списке.</li>
                <li>Вставьте полученный ключ в поле "API Key".</li>
                <li>Модель подставится автоматически, но вы можете изменить её.</li>
              </ol>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction onClick={() => setShowAiHelp(false)}>Понятно</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={showSecurityHelp} onOpenChange={setShowSecurityHelp}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Что такое мастер-пароль?</AlertDialogTitle>
            <AlertDialogDescription className="space-y-4 pt-2">
              <div className="space-y-2">
                <p className="font-medium text-foreground">Зачем он нужен?</p>
                <p>Мастер-пароль позволяет заблокировать доступ к отдельным заметкам. Даже если кто-то получит доступ к вашему компьютеру или аккаунту, он не сможет прочитать защищенные заметки без этого пароля.</p>
              </div>

              <div className="space-y-2">
                <p className="font-medium text-foreground">Где он хранится?</p>
                <p>Пароль хранится <strong>только локально</strong> на вашем устройстве в зашифрованном виде. Он никогда не передается на сервер GodNotes.</p>
              </div>

              <div className="space-y-2">
                <p className="font-medium text-foreground text-destructive">Важное предупреждение:</p>
                <p>Мы не храним ваш мастер-пароль. Если вы его забудете, мы <strong>не сможем</strong> восстановить доступ к вашим защищенным заметкам. Пожалуйста, запомните его или сохраните в надежном месте.</p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction onClick={() => setShowSecurityHelp(false)}>Я понял</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function NavButton({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full text-left px-3 py-2 rounded-md text-sm transition-colors",
        active ? "bg-primary text-primary-foreground font-medium" : "text-muted-foreground hover:bg-muted hover:text-foreground"
      )}
    >
      {label}
    </button>
  );
}

function ThemeCard({ label, active, onClick, previewClass }: { label: string; active: boolean; onClick: () => void; previewClass: string }) {
  return (
    <div 
      onClick={onClick}
      className={cn(
        "cursor-pointer rounded-lg border-2 p-1 transition-all",
        active ? "border-primary" : "border-transparent hover:border-muted-foreground/20"
      )}
    >
      <div className={cn("h-20 rounded-md mb-2 shadow-sm", previewClass)} />
      <div className="flex items-center justify-between px-1">
        <span className="text-sm font-medium">{label}</span>
        {active && <CheckCircle2 className="h-4 w-4 text-primary" />}
      </div>
    </div>
  );
}

function HotkeySetting({ label, value, onChange }: { label: string, value: string, onChange: (v: string) => void }) {
  const [isRecording, setIsRecording] = useState(false);

  useEffect(() => {
    if (!isRecording) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();

      const modifiers = [];
      if (e.ctrlKey || e.metaKey) modifiers.push('Ctrl');
      if (e.shiftKey) modifiers.push('Shift');
      if (e.altKey) modifiers.push('Alt');

      let key = '';
      if (e.code.startsWith('Key')) {
        key = e.code.replace('Key', '');
      } else if (e.code.startsWith('Digit')) {
        key = e.code.replace('Digit', '');
      } else {
        key = e.key.toUpperCase();
      }
      
      if (['CONTROL', 'SHIFT', 'ALT', 'META'].includes(key)) return;

      const shortcut = [...modifiers, key].join('+');
      onChange(shortcut);
      setIsRecording(false);
    };

    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [isRecording, onChange]);

  return (
    <div className="flex items-center justify-between p-2 rounded-md border border-transparent hover:bg-muted/50 transition-colors">
      <span className="text-sm">{label}</span>
      <button 
        className={cn(
            "px-3 py-1 rounded text-xs border min-w-[80px] text-center transition-all font-mono",
            isRecording ? "bg-primary text-primary-foreground border-primary" : "bg-muted border-border hover:border-muted-foreground/50"
        )}
        onClick={() => setIsRecording(true)}
      >
        {isRecording ? "Нажмите..." : value}
      </button>
    </div>
  );
}

