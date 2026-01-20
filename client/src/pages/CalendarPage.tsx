import React, { useState } from 'react';
import { useTasks, Task } from '@/lib/tasks-store';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, Plus, ArrowLeft, LayoutList, CalendarDays, Clock } from 'lucide-react';
import { Link } from 'wouter';
import { 
  startOfMonth, 
  endOfMonth, 
  startOfWeek, 
  endOfWeek, 
  eachDayOfInterval, 
  format, 
  isSameMonth, 
  isSameDay, 
  addMonths, 
  subMonths,
  addDays,
  subDays,
  isToday
} from 'date-fns';
import { ru } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

export default function CalendarPage() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<'month' | 'day'>('month');
  const { tasks, addTask, updateTask, deleteTask } = useTasks();
  const [newTaskContent, setNewTaskContent] = useState('');
  const [newTaskDescription, setNewTaskDescription] = useState('');
  const [newTaskTime, setNewTaskTime] = useState('09:00');
  const [notify, setNotify] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);

  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(monthStart);
  const startDate = startOfWeek(monthStart, { locale: ru });
  const endDate = endOfWeek(monthEnd, { locale: ru });

  const calendarDays = eachDayOfInterval({
    start: startDate,
    end: endDate,
  });

  const weekDays = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];

  const getTasksForDate = (date: Date) => {
    return tasks.filter(task => 
      task.dueDate && isSameDay(new Date(task.dueDate), date)
    ).sort((a, b) => (a.dueDate || 0) - (b.dueDate || 0));
  };

  const handlePrev = () => {
    if (viewMode === 'month') {
        setCurrentDate(prev => subMonths(prev, 1));
    } else {
        setCurrentDate(prev => subDays(prev, 1));
    }
  };

  const handleNext = () => {
    if (viewMode === 'month') {
        setCurrentDate(prev => addMonths(prev, 1));
    } else {
        setCurrentDate(prev => addDays(prev, 1));
    }
  };

  const handleToday = () => {
    setCurrentDate(new Date());
  };

  const handleSaveTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (newTaskContent.trim() && selectedDate) {
      // Combine date and time
      const [hours, minutes] = newTaskTime.split(':').map(Number);
      const finalDate = new Date(selectedDate);
      finalDate.setHours(hours, minutes);

      if (editingTask) {
        updateTask(editingTask.id, {
          content: newTaskContent,
          description: newTaskDescription,
          dueDate: finalDate.getTime(),
          notify: notify
        });
      } else {
        addTask(newTaskContent, undefined, finalDate.getTime(), notify, newTaskDescription);
      }
      closeDialog();
    }
  };

  const closeDialog = () => {
    setNewTaskContent('');
    setNewTaskDescription('');
    setNewTaskTime('09:00');
    setNotify(false);
    setEditingTask(null);
    setIsDialogOpen(false);
  };

  const openAddDialog = (date: Date) => {
    setSelectedDate(date);
    setEditingTask(null);
    setNewTaskContent('');
    setNewTaskDescription('');
    setNewTaskTime('09:00');
    setNotify(false);
    setIsDialogOpen(true);
  };

  const openEditDialog = (task: Task) => {
    setEditingTask(task);
    setNewTaskContent(task.content);
    setNewTaskDescription(task.description || '');
    setNotify(task.notify || false);
    
    if (task.dueDate) {
        const date = new Date(task.dueDate);
        setSelectedDate(date);
        setNewTaskTime(format(date, 'HH:mm'));
    } else {
        setSelectedDate(null);
        setNewTaskTime('09:00');
    }
    
    setIsDialogOpen(true);
  };

  const handleDeleteTask = () => {
    if (editingTask) {
      deleteTask(editingTask.id);
      closeDialog();
    }
  };

  return (
    <div className="h-full flex flex-col p-6 overflow-hidden">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
            <Link href="/">
                <Button variant="ghost" size="icon" title="Назад к заметкам">
                    <ArrowLeft className="h-5 w-5" />
                </Button>
            </Link>
            <h1 className="text-3xl font-bold capitalize min-w-[200px]">
              {viewMode === 'month' 
                ? format(currentDate, 'LLLL yyyy', { locale: ru })
                : format(currentDate, 'd MMMM yyyy', { locale: ru })
              }
            </h1>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center bg-muted/30 rounded-lg p-1 mr-2 border border-border/50">
             <Button 
                variant={viewMode === 'month' ? 'secondary' : 'ghost'} 
                size="sm" 
                className="h-7 px-2" 
                onClick={() => setViewMode('month')}
                title="Месяц"
             >
                <CalendarDays className="h-4 w-4" />
             </Button>
             <Button 
                variant={viewMode === 'day' ? 'secondary' : 'ghost'} 
                size="sm" 
                className="h-7 px-2" 
                onClick={() => setViewMode('day')}
                title="День"
             >
                <LayoutList className="h-4 w-4" />
             </Button>
          </div>

          <Button variant="outline" size="icon" onClick={handlePrev}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" onClick={handleToday}>
            Сегодня
          </Button>
          <Button variant="outline" size="icon" onClick={handleNext}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {viewMode === 'month' ? (
        <>
          <div className="grid grid-cols-7 mb-2">
            {weekDays.map(day => (
              <div key={day} className="text-center font-medium text-muted-foreground py-2">
                {day}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 grid-rows-6 flex-1 gap-1 min-h-0">
            {calendarDays.map((day, idx) => {
              const dayTasks = getTasksForDate(day);
              const isCurrentMonth = isSameMonth(day, monthStart);
              
              return (
                <div 
                  key={day.toISOString()} 
                  className={cn(
                    "border rounded-md p-2 flex flex-col gap-1 transition-colors hover:bg-accent/10 relative group overflow-hidden",
                    !isCurrentMonth && "bg-muted/30 text-muted-foreground",
                    isToday(day) && "border-primary bg-primary/5"
                  )}
                  onClick={() => openAddDialog(day)}
                >
                  <div className="flex justify-between items-start">
                    <span className={cn("text-sm font-medium h-6 w-6 flex items-center justify-center rounded-full", isToday(day) && "bg-primary text-primary-foreground")}>
                      {format(day, 'd')}
                    </span>
                    <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-5 w-5 opacity-0 group-hover:opacity-100 -mt-1 -mr-1"
                        onClick={(e) => {
                            e.stopPropagation();
                            openAddDialog(day);
                        }}
                    >
                        <Plus className="h-3 w-3" />
                    </Button>
                  </div>
                  
                  <div className="flex-1 overflow-y-auto space-y-1 custom-scrollbar">
                    {dayTasks.map(task => (
                      <div 
                        key={task.id} 
                        className={cn(
                            "text-xs px-1.5 py-0.5 rounded truncate border border-transparent hover:border-border bg-card cursor-pointer",
                            task.isCompleted && "opacity-50 line-through"
                        )}
                        title={`${task.content}${task.description ? '\n' + task.description : ''}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          openEditDialog(task);
                        }}
                      >
                        <span className="opacity-70 mr-1">{task.dueDate ? format(task.dueDate, 'HH:mm') : ''}</span>
                        {task.content}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      ) : (
        <div className="flex-1 grid grid-cols-1 md:grid-cols-[300px_1fr] gap-6 overflow-hidden">
             {/* Left Column: Date Info */}
             <div className="flex flex-col gap-6 p-6 border rounded-xl bg-card/50 h-full">
                <div className="flex flex-col gap-1">
                    <span className="text-6xl font-bold text-primary">
                        {format(currentDate, 'd')}
                    </span>
                    <span className="text-2xl font-medium capitalize text-muted-foreground">
                        {format(currentDate, 'EEEE', { locale: ru })}
                    </span>
                    <span className="text-lg text-muted-foreground/70 capitalize">
                        {format(currentDate, 'MMMM yyyy', { locale: ru })}
                    </span>
                </div>
                
                {isToday(currentDate) && (
                    <div className="inline-flex items-center px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-medium w-fit">
                        Сегодня
                    </div>
                )}

                <Button className="mt-4 w-full" onClick={() => openAddDialog(currentDate)}>
                    <Plus className="mr-2 h-4 w-4" />
                    Добавить задачу
                </Button>
             </div>

             {/* Right Column: Tasks List */}
             <div className="flex flex-col gap-4 overflow-y-auto pr-2 custom-scrollbar">
                <div className="flex items-center justify-between">
                     <h3 className="font-semibold text-lg">Задачи на день</h3>
                     <span className="text-sm text-muted-foreground">{getTasksForDate(currentDate).length} задач</span>
                </div>

                <div className="space-y-2">
                    {getTasksForDate(currentDate).length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-40 text-muted-foreground border-2 border-dashed rounded-xl">
                            <Clock className="h-8 w-8 mb-2 opacity-50" />
                            <p>Нет задач на этот день</p>
                            <Button variant="link" onClick={() => openAddDialog(currentDate)}>Создать задачу</Button>
                        </div>
                    ) : (
                        getTasksForDate(currentDate).map(task => (
                            <div 
                                key={task.id}
                                onClick={() => openEditDialog(task)}
                                className={cn(
                                    "group flex items-start gap-4 p-4 rounded-xl border bg-card hover:bg-accent/50 transition-all cursor-pointer hover:shadow-sm hover:border-primary/20",
                                    task.isCompleted && "opacity-60"
                                )}
                            >
                                <div className="flex flex-col items-center gap-1 min-w-[60px] pt-0.5">
                                    <span className="font-mono text-lg font-medium text-primary">
                                        {task.dueDate ? format(task.dueDate, 'HH:mm') : '--:--'}
                                    </span>
                                </div>
                                
                                <div className="flex-1 min-w-0">
                                    <div className={cn("font-medium text-lg leading-none mb-1.5", task.isCompleted && "line-through decoration-muted-foreground")}>
                                        {task.content}
                                    </div>
                                    {task.description && (
                                        <p className="text-sm text-muted-foreground line-clamp-2">
                                            {task.description}
                                        </p>
                                    )}
                                    {task.notify && (
                                        <div className="flex items-center gap-1 mt-2 text-xs text-blue-500/80">
                                            <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                                            Уведомление включено
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))
                    )}
                </div>
             </div>
        </div>
      )}

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
            <DialogHeader>
                <DialogTitle>
                    {editingTask ? 'Редактировать задачу' : `Добавить задачу на ${selectedDate ? format(selectedDate, 'd MMMM', { locale: ru }) : ''}`}
                </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSaveTask} className="flex flex-col gap-4 mt-4">
                <Input 
                    value={newTaskContent}
                    onChange={(e) => setNewTaskContent(e.target.value)}
                    placeholder="Текст задачи..."
                    autoFocus
                />
                <Textarea
                    value={newTaskDescription}
                    onChange={(e) => setNewTaskDescription(e.target.value)}
                    placeholder="Описание (необязательно)..."
                    className="min-h-[80px]"
                />
                <div className="flex flex-col gap-2">
                  <div className="grid grid-cols-2 gap-2">
                    <div className="flex flex-col gap-1">
                         <Label className="text-xs text-muted-foreground">Время</Label>
                         <Input 
                            type="time" 
                            value={newTaskTime} 
                            onChange={(e) => setNewTaskTime(e.target.value)}
                         />
                    </div>
                  </div>
                  <div className="flex items-center space-x-2 mt-2">
                    <Checkbox id="notify" checked={notify} onCheckedChange={(c) => setNotify(!!c)} />
                    <Label htmlFor="notify">Уведомить в Telegram</Label>
                  </div>
                  {notify && (
                    <p className="text-[10px] text-muted-foreground ml-6">
                      Вы получите уведомление за 1 час до установленного времени (или начала дня).
                    </p>
                  )}
                </div>
                <div className="flex gap-2 justify-end">
                  {editingTask && (
                    <Button type="button" variant="destructive" onClick={handleDeleteTask}>
                      Удалить
                    </Button>
                  )}
                  <Button type="submit">{editingTask ? 'Сохранить' : 'Создать'}</Button>
                </div>
            </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
