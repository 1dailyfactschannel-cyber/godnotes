import React from 'react';
import { useRoute } from 'wouter';
import { useTasks } from '@/lib/tasks-store';
import { TaskItem } from '@/pages/Todo';
import { Button } from '@/components/ui/button';
import { X } from 'lucide-react';

export default function TaskWindow() {
  const [, params] = useRoute('/task/:taskId');
  const { tasks } = useTasks();
  const task = tasks.find(t => t.id === params?.taskId);

  if (!task) {
    return (
      <div className="flex items-center justify-center h-screen bg-background text-foreground">
        <p className="text-muted-foreground">Задача не найдена</p>
      </div>
    );
  }

  return (
    <div className="h-screen bg-background text-foreground flex flex-col">
      {/* Custom Title Bar Area - draggable region */}
      <div className="h-8 bg-muted/50 flex items-center justify-between px-2 app-region-drag select-none border-b border-border/50">
         <span className="text-xs font-medium text-muted-foreground flex items-center gap-2">
            GodNotes Task
         </span>
         <Button variant="ghost" size="icon" className="h-6 w-6 app-region-no-drag hover:bg-destructive hover:text-destructive-foreground" onClick={() => window.close()}>
             <X className="h-3 w-3" />
         </Button>
      </div>
      
      <div className="p-4 flex-1 overflow-auto">
         <div className="max-w-2xl mx-auto">
            <TaskItem task={task} hideExternalButton={true} />
         </div>
      </div>
    </div>
  );
}
