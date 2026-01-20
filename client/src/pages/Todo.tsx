import React, { useState } from 'react';
import { useTasks, Task } from '@/lib/tasks-store';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Trash2, Plus, Calendar as CalendarIcon, CornerDownRight, FileText, ArrowLeft } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';
import { Link } from 'wouter';

const TaskItem = ({ task, level = 0 }: { task: Task; level?: number }) => {
  const { toggleTask, deleteTask, addTask, setTaskDate, tasks, updateTask } = useTasks();
  const [isAddingSubtask, setIsAddingSubtask] = useState(false);
  const [subtaskContent, setSubtaskContent] = useState('');
  const [showDescription, setShowDescription] = useState(false);
  const [descriptionInput, setDescriptionInput] = useState(task.description || '');

  const subtasks = tasks.filter(t => t.parentId === task.id);
  
  const handleAddSubtask = (e: React.FormEvent) => {
    e.preventDefault();
    if (subtaskContent.trim()) {
      addTask(subtaskContent, task.id);
      setSubtaskContent('');
      setIsAddingSubtask(false);
    }
  };

  const handleDescriptionSave = () => {
    updateTask(task.id, { description: descriptionInput });
    setShowDescription(false);
  };

  const handleDateSelect = (date: Date | undefined) => {
    if (!date) {
        setTaskDate(task.id, undefined);
        return;
    }
    
    // Preserve time if exists
    if (task.dueDate) {
        const current = new Date(task.dueDate);
        date.setHours(current.getHours(), current.getMinutes());
    } else {
        // Default to 09:00 if no previous date
        date.setHours(9, 0);
    }
    setTaskDate(task.id, date.getTime());
  };

  const handleTimeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const timeStr = e.target.value;
    if (!timeStr) return;
    
    const [hours, minutes] = timeStr.split(':').map(Number);
    const date = task.dueDate ? new Date(task.dueDate) : new Date();
    date.setHours(hours, minutes);
    setTaskDate(task.id, date.getTime());
  };

  return (
    <div className={cn("flex flex-col gap-2", level > 0 && "ml-6 border-l pl-2 border-border/50")}>
      <div className="flex items-start gap-2 group hover:bg-accent/20 p-1 rounded-md transition-colors">
        <Checkbox 
          checked={task.isCompleted} 
          onCheckedChange={() => toggleTask(task.id)}
          className="mt-1"
        />
        <div className="flex-1 flex flex-col gap-1">
            <span className={cn("text-sm", task.isCompleted && "line-through text-muted-foreground")}>
              {task.content}
            </span>
            {task.description && !showDescription && (
                <p className="text-xs text-muted-foreground whitespace-pre-wrap">{task.description}</p>
            )}
        </div>
        
        {task.dueDate && (
            <div className="flex items-center gap-1 text-xs text-primary bg-primary/10 px-2 py-0.5 rounded-full self-start mt-0.5">
                <CalendarIcon className="h-3 w-3" />
                {format(task.dueDate, 'd MMM HH:mm', { locale: ru })}
            </div>
        )}

        <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 self-start">
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="icon" className="h-6 w-6" title="Назначить дату">
                <CalendarIcon className="h-3 w-3" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="end">
              <Calendar
                mode="single"
                selected={task.dueDate ? new Date(task.dueDate) : undefined}
                onSelect={handleDateSelect}
                initialFocus
              />
              <div className="p-3 border-t border-border">
                <Input 
                    type="time" 
                    className="w-full"
                    value={task.dueDate ? format(task.dueDate, 'HH:mm') : '09:00'}
                    onChange={handleTimeChange}
                />
              </div>
            </PopoverContent>
          </Popover>

          <Button 
            variant="ghost" 
            size="icon" 
            className={cn("h-6 w-6", task.description && "text-primary")}
            onClick={() => {
                setShowDescription(!showDescription);
                setDescriptionInput(task.description || '');
            }}
            title="Описание"
          >
            <FileText className="h-3 w-3" />
          </Button>

          <Button 
            variant="ghost" 
            size="icon" 
            className="h-6 w-6" 
            onClick={() => setIsAddingSubtask(true)}
            title="Добавить подзадачу"
          >
            <CornerDownRight className="h-3 w-3" />
          </Button>
          
          <Button 
            variant="ghost" 
            size="icon" 
            className="h-6 w-6 text-destructive hover:text-destructive" 
            onClick={() => deleteTask(task.id)}
            title="Удалить"
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      </div>

      {showDescription && (
        <div className="ml-6 flex flex-col gap-2 p-2 bg-muted/30 rounded-md">
            <Textarea
                value={descriptionInput}
                onChange={(e) => setDescriptionInput(e.target.value)}
                placeholder="Добавьте описание..."
                className="text-xs min-h-[60px]"
            />
            <div className="flex justify-end gap-2">
                <Button size="sm" variant="ghost" onClick={() => setShowDescription(false)} className="h-7 text-xs">Отмена</Button>
                <Button size="sm" onClick={handleDescriptionSave} className="h-7 text-xs">Сохранить</Button>
            </div>
        </div>
      )}

      {isAddingSubtask && (
        <form onSubmit={handleAddSubtask} className="ml-6 flex items-center gap-2">
            <Input
              autoFocus
              value={subtaskContent}
              onChange={(e) => setSubtaskContent(e.target.value)}
              placeholder="Подзадача..."
              className="h-8 text-sm"
            />
            <Button type="submit" size="sm" className="h-8">OK</Button>
            <Button type="button" variant="ghost" size="sm" className="h-8" onClick={() => setIsAddingSubtask(false)}>X</Button>
        </form>
      )}

      {subtasks.length > 0 && (
        <div className="flex flex-col gap-1">
          {subtasks.map(st => (
            <TaskItem key={st.id} task={st} level={level + 1} />
          ))}
        </div>
      )}
    </div>
  );
};

export default function Todo() {
  const { tasks, addTask } = useTasks();
  const [newParams, setNewParams] = useState('');

  const rootTasks = tasks.filter(t => !t.parentId);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (newParams.trim()) {
      addTask(newParams);
      setNewParams('');
    }
  };

  return (
    <div className="h-full flex flex-col p-6 max-w-4xl mx-auto w-full">
      <div className="flex items-center gap-4 mb-6">
          <Link href="/">
              <Button variant="ghost" size="icon" title="Назад к заметкам">
                  <ArrowLeft className="h-5 w-5" />
              </Button>
          </Link>
          <h1 className="text-3xl font-bold">Задачи</h1>
      </div>
      
      <form onSubmit={handleSubmit} className="flex gap-2 mb-8">
        <Input 
          value={newParams}
          onChange={(e) => setNewParams(e.target.value)}
          placeholder="Новая задача..."
          className="flex-1"
        />
        <Button type="submit">
          <Plus className="h-4 w-4 mr-2" />
          Добавить
        </Button>
      </form>

      <div className="flex-1 overflow-y-auto space-y-4">
        {rootTasks.length === 0 ? (
          <div className="text-center text-muted-foreground py-10">
            Нет задач. Создайте первую!
          </div>
        ) : (
          rootTasks.map(task => (
            <TaskItem key={task.id} task={task} />
          ))
        )}
      </div>
    </div>
  );
}
