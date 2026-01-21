import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Check, CheckCircle2, FolderOpen, Loader2, Plus, Send, Settings, Trash2, Unplug, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useFileSystem, ThemeType } from '@/lib/mock-fs';
import { useTasks } from '@/lib/tasks-store';
import { telegramRequest, selectDirectory, getStoreValue, setStoreValue, isElectron, electron } from '@/lib/electron';
import { useToast } from '@/hooks/use-toast';
import { ScrollArea } from '@/components/ui/scroll-area';
import { changelog } from '@/data/changelog';

interface SettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type SettingsTab = 'general' | 'theme' | 'hotkeys' | 'telegram' | 'about';

export function SettingsDialog({ open, onOpenChange }: SettingsDialogProps) {
  const [activeTab, setActiveTab] = useState<SettingsTab>('general');
  const { theme, setTheme, hotkeys, setHotkey, isOfflineMode, toggleOfflineMode, items, downloadAllFiles, updateUserPrefs } = useFileSystem();
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

      toast({ title: "Пространство добавлено", description: `Пространство "${spaceNameInput}" успешно добавлено` });
      
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
    if (!confirm(`Вы уверены, что хотите удалить пространство "${spaceToRemove?.name}" из списка?`)) return;

    const newSpaces = spaces.filter(s => s.id !== id);
    setSpaces(newSpaces);
    await setStoreValue('spaces', newSpaces);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-3xl h-[600px] p-0 flex gap-0 overflow-hidden">
          {/* Sidebar */}
          <div className="w-48 bg-muted/30 border-r border-border p-4 flex flex-col gap-2 shrink-0">
            <div className="text-sm font-semibold mb-4 px-2">Настройки</div>
            <NavButton active={activeTab === 'general'} onClick={() => setActiveTab('general')} label="Общие" />
            <NavButton active={activeTab === 'theme'} onClick={() => setActiveTab('theme')} label="Внешний вид" />
            <NavButton active={activeTab === 'hotkeys'} onClick={() => setActiveTab('hotkeys')} label="Горячие клавиши" />
            <NavButton active={activeTab === 'telegram'} onClick={() => setActiveTab('telegram')} label="Telegram" />
            <div className="flex-1" />
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
                    value={hotkeys.link || 'Ctrl+K'} 
                    onChange={(v) => setHotkey('link', v)} 
                  />
                  <HotkeySetting 
                    label="Список задач" 
                    value={hotkeys.taskList || 'Ctrl+Shift+9'} 
                    onChange={(v) => setHotkey('taskList', v)} 
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
                      onChange={(e) => setTelegramConfig({ ...telegramConfig, botToken: e.target.value })} 
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
