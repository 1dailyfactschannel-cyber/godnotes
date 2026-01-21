import { useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';
import { isElectron, electron } from '@/lib/electron';
import { ToastAction } from '@/components/ui/toast';

export function UpdateManager() {
  const { toast } = useToast();

  useEffect(() => {
    if (!isElectron() || !electron) return;

    electron.onUpdateStatus((data: any) => {
      console.log('Update status:', data);
      
      switch (data.status) {
        case 'available':
          toast({
            title: 'Доступно обновление',
            description: `Версия ${data.info.version} загружается...`,
          });
          break;
        case 'downloaded':
          toast({
            title: 'Обновление готово',
            description: 'Новая версия загружена. Перезапустите приложение для обновления.',
            action: (
              <ToastAction altText="Перезапустить" onClick={() => electron?.quitAndInstall()}>
                Перезапустить
              </ToastAction>
            ),
            duration: Infinity, 
          });
          break;
        case 'error':
          console.error('Update error:', data.error);
          break;
      }
    });
  }, [toast]);

  return null;
}
