import { useEffect, useRef } from 'react';
import { useToast } from '@/hooks/use-toast';
import { isElectron, electron } from '@/lib/electron';
import { ToastAction } from '@/components/ui/toast';
import { useUpdateStore } from '@/lib/update-store';
import { DownloadProgressToast } from '@/components/DownloadProgressToast';

export function UpdateManager() {
  const { toast } = useToast();
  // Store the toast handle for progress updates
  const progressToastRef = useRef<{ id: string; update: (props: any) => void; dismiss: () => void } | null>(null);

  useEffect(() => {
    if (!isElectron() || !electron) return;

    electron.onUpdateStatus((data: any) => {
      console.log('Update status:', data);
      
      switch (data.status) {
        case 'checking':
          console.log('Checking for updates...');
          break;
        case 'available':
          toast({
            title: 'Доступно обновление',
            description: `Версия ${data.info.version} найдена. Хотите загрузить?`,
            action: (
              <ToastAction altText="Загрузить" onClick={() => electron?.startDownload()}>
                Загрузить
              </ToastAction>
            ),
            duration: Infinity,
          });
          break;
        case 'progress':
          if (data.progress) {
             // Update the store directly, which will cause DownloadProgressToast to re-render
             useUpdateStore.getState().setProgress(data.progress);

             // Only create toast if it doesn't exist
             if (!progressToastRef.current) {
                progressToastRef.current = toast({
                   title: 'Загрузка обновления',
                   description: <DownloadProgressToast />,
                   duration: Infinity,
                });
             }
          }
          break;
        case 'not-available':
          toast({
            title: 'Обновлений нет',
            description: 'У вас установлена последняя версия приложения.',
          });
          break;
        case 'downloaded':
          // Reset progress store
          useUpdateStore.getState().setProgress(null);
          
          // Close progress toast if exists
          if (progressToastRef.current) {
              progressToastRef.current.dismiss();
              progressToastRef.current = null;
          }
          
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
          
          // Reset progress store
          useUpdateStore.getState().setProgress(null);

          if (progressToastRef.current) {
              progressToastRef.current.dismiss();
              progressToastRef.current = null;
          }

          let errorMsg = `Не удалось проверить обновления: ${data.error}`;
          
          if (typeof data.error === 'string' && data.error.includes('404')) {
              errorMsg = 'Не удалось получить данные об обновлении. Проверьте публичный репозиторий релизов (404).';
           }

          toast({
            variant: "destructive",
            title: 'Ошибка обновления',
            description: errorMsg,
          });
          break;
      }
    });
  }, [toast]);

  return null;
}
