import { useUpdateStore } from '@/lib/update-store';
import { Progress } from '@/components/ui/progress';

export function DownloadProgressToast() {
  const progress = useUpdateStore((state) => state.progress);

  if (!progress) return (
    <div className="flex flex-col gap-2 w-full">
      <span>Подготовка к загрузке...</span>
      <Progress value={0} className="h-2 w-full" />
    </div>
  );

  return (
    <div className="flex flex-col gap-2 w-full">
      <span>{`Загружено ${Math.round(progress.percent)}% (${(progress.transferred / 1024 / 1024).toFixed(1)} MB / ${(progress.total / 1024 / 1024).toFixed(1)} MB)`}</span>
      <Progress value={progress.percent} className="h-2 w-full" />
    </div>
  );
}
