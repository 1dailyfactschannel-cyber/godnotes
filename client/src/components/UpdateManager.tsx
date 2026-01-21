import { useEffect, useRef } from 'react';
import { useToast } from '@/hooks/use-toast';
import { isElectron, electron } from '@/lib/electron';
import { ToastAction } from '@/components/ui/toast';
import { Progress } from '@/components/ui/progress';

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
             const percent = Math.round(data.progress.percent);
             const description = (
                <div className="flex flex-col gap-2 w-full">
                    <span>{`Загружено ${percent}% (${(data.progress.transferred / 1024 / 1024).toFixed(1)} MB / ${(data.progress.total / 1024 / 1024).toFixed(1)} MB)`}</span>
                    <Progress value={percent} className="h-2 w-full" />
                </div>
             );

             if (progressToastRef.current) {
                progressToastRef.current.update({
                   title: 'Загрузка обновления',
                   description: description,
                   duration: Infinity,
                });
             } else {
                progressToastRef.current = toast({
                   title: 'Загрузка обновления',
                   description: description,
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
