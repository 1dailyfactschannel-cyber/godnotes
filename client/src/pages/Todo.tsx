import React, { useState, useMemo } from 'react';
import { useTasks, Task, Priority, RecurringInterval } from '@/lib/tasks-store';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { 
  Trash2, Plus, Calendar as CalendarIcon, CornerDownRight, FileText, ArrowLeft,
  Flame, Zap, Coffee, Tag, Search, Filter, SortAsc, SortDesc, X, GripVertical, Layers, RotateCw, LayoutList, Columns, ExternalLink
} from 'lucide-react';
import { KanbanBoard } from '@/components/KanbanBoard';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { format, isToday, isTomorrow, isPast, isAfter, startOfToday, addDays } from 'date-fns';
import { ru } from 'date-fns/locale';
import { Link } from 'wouter';
import { isElectron, electron } from '@/lib/electron';
import { useToast } from '@/hooks/use-toast';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const PriorityIcon = ({ priority, className }: { priority?: Priority, className?: string }) => {
  switch (priority) {
    case 'high': return <Flame className={cn("text-red-500", className)} />;
    case 'medium': return <Zap className={cn("text-yellow-500", className)} />;
    case 'low': return <Coffee className={cn("text-blue-500", className)} />;
    default: return <Coffee className={cn("text-muted-foreground", className)} />;
  }
};

export const TaskItem = ({ task, level = 0, hideExternalButton = false }: { task: Task; level?: number; hideExternalButton?: boolean }) => {
  const { toggleTask, deleteTask, addTask, setTaskDate, tasks, updateTask } = useTasks();
  const [isAddingSubtask, setIsAddingSubtask] = useState(false);
  const [subtaskContent, setSubtaskContent] = useState('');
  const [showDescription, setShowDescription] = useState(false);
  const [descriptionInput, setDescriptionInput] = useState(task.description || '');
  const [tagInput, setTagInput] = useState('');
  const [isEditingTags, setIsEditingTags] = useState(false);
  const { toast } = useToast();

  const handleOpenInNewWindow = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isElectron() && electron) {
      electron.openTaskWindow(task.id);
    } else {
      toast({
        title: "Недоступно в веб-версии",
        description: "Эта функция работает только в десктопной версии приложения.",
        variant: "destructive",
      });
    }
  };


  const subtasks = tasks.filter(t => t.parentId === task.id);
  const completedSubtasks = subtasks.filter(t => t.isCompleted).length;
  const progress = subtasks.length > 0 ? (completedSubtasks / subtasks.length) * 100 : 0;
  
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

  const handleAddTag = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && tagInput.trim()) {
        e.preventDefault();
        const currentTags = task.tags || [];
        if (!currentTags.includes(tagInput.trim())) {
            updateTask(task.id, { tags: [...currentTags, tagInput.trim()] });
        }
        setTagInput('');
    }
  };

  const removeTag = (tagToRemove: string) => {
    const currentTags = task.tags || [];
    updateTask(task.id, { tags: currentTags.filter(t => t !== tagToRemove) });
  };

  return (
    <div className={cn("flex flex-col gap-2", level > 0 && "ml-6 border-l pl-2 border-border/50")}>
      <div className="flex items-start gap-2 group hover:bg-accent/20 p-1 rounded-md transition-colors relative">
        <Checkbox 
          checked={task.isCompleted} 
          onCheckedChange={() => toggleTask(task.id)}
          className="mt-1"
        />
        
        <div className="flex-1 flex flex-col gap-1 min-w-0">
            <div className="flex items-center gap-2">
                <span className={cn("text-sm truncate", task.isCompleted && "line-through text-muted-foreground")}>
                  {task.content}
                </span>
                
                {task.priority && task.priority !== 'medium' && (
                    <div title={`Приоритет: ${task.priority}`}>
                         <PriorityIcon priority={task.priority} className="h-3 w-3" />
                    </div>
                )}

                {task.tags && task.tags.length > 0 && (
                    <div className="flex items-center gap-1 flex-wrap">
                        {task.tags.map(tag => (
                            <Badge key={tag} variant="outline" className="text-[10px] h-4 px-1 py-0 gap-1">
                                {tag}
                            </Badge>
                        ))}
                    </div>
                )}
            </div>
            
            {subtasks.length > 0 && (
                <div className="flex items-center gap-2 mt-0.5 w-full max-w-[200px]">
                    <div className="h-1 flex-1 bg-secondary rounded-full overflow-hidden">
                        <div 
                            className="h-full bg-primary transition-all duration-300" 
                            style={{ width: `${progress}%` }} 
                        />
                    </div>
                    <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                        {completedSubtasks}/{subtasks.length}
                    </span>
                </div>
            )}

            {task.description && !showDescription && (
                <p className="text-xs text-muted-foreground whitespace-pre-wrap line-clamp-1">{task.description}</p>
            )}
        </div>
        
        {task.dueDate && (
            <div className={cn(
                "flex items-center gap-1 text-xs px-2 py-0.5 rounded-full self-start mt-0.5 whitespace-nowrap",
                task.dueDate < Date.now() && !task.isCompleted ? "text-destructive bg-destructive/10" : "text-primary bg-primary/10"
            )}>
                {task.recurring && <RotateCw className="h-3 w-3 mr-0.5" />}
                <CalendarIcon className="h-3 w-3" />
                {format(task.dueDate, 'd MMM HH:mm', { locale: ru })}
            </div>
        )}

        {/* Hover Actions */}
        <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-0.5 self-start bg-background/80 backdrop-blur-sm rounded-md shadow-sm border border-border/50 absolute right-0 top-0 p-0.5 z-10">
          {!hideExternalButton && (
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-7 w-7" 
              title="Открыть в отдельном окне"
              onClick={handleOpenInNewWindow}
            >
              <ExternalLink className="h-3.5 w-3.5" />
            </Button>
          )}

          <Popover>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="icon" className="h-7 w-7" title="Назначить дату">
                <CalendarIcon className="h-3.5 w-3.5" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="end">
              <Calendar
                mode="single"
                selected={task.dueDate ? new Date(task.dueDate) : undefined}
                onSelect={handleDateSelect}
                initialFocus
              />
              <div className="p-3 border-t border-border space-y-2">
                <Input 
                    type="time" 
                    className="w-full"
                    value={task.dueDate ? format(task.dueDate, 'HH:mm') : '09:00'}
                    onChange={handleTimeChange}
                />
                <Select 
                    value={task.recurring || "none"} 
                    onValueChange={(v) => updateTask(task.id, { recurring: v === "none" ? undefined : v as RecurringInterval })}
                >
                    <SelectTrigger className="h-8 text-xs">
                        <SelectValue placeholder="Повтор" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="none">Не повторять</SelectItem>
                        <SelectItem value="daily">Каждый день</SelectItem>
                        <SelectItem value="weekly">Каждую неделю</SelectItem>
                        <SelectItem value="monthly">Каждый месяц</SelectItem>
                        <SelectItem value="yearly">Каждый год</SelectItem>
                    </SelectContent>
                </Select>
              </div>
            </PopoverContent>
          </Popover>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-7 w-7" title="Приоритет">
                    <PriorityIcon priority={task.priority} className="h-3.5 w-3.5" />
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => updateTask(task.id, { priority: 'high' })}>
                    <Flame className="mr-2 h-4 w-4 text-red-500" /> Высокий
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => updateTask(task.id, { priority: 'medium' })}>
                    <Zap className="mr-2 h-4 w-4 text-yellow-500" /> Средний
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => updateTask(task.id, { priority: 'low' })}>
                    <Coffee className="mr-2 h-4 w-4 text-blue-500" /> Низкий
                </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <Popover open={isEditingTags} onOpenChange={setIsEditingTags}>
             <PopoverTrigger asChild>
                <Button variant="ghost" size="icon" className="h-7 w-7" title="Теги">
                    <Tag className="h-3.5 w-3.5" />
                </Button>
             </PopoverTrigger>
             <PopoverContent className="w-60 p-3" align="end">
                 <div className="space-y-2">
                     <h4 className="font-medium text-xs leading-none">Теги</h4>
                     <div className="flex flex-wrap gap-1">
                         {task.tags?.map(tag => (
                             <Badge key={tag} variant="secondary" className="text-xs px-1 py-0 gap-1 h-5 cursor-pointer hover:bg-destructive hover:text-destructive-foreground" onClick={() => removeTag(tag)}>
                                 {tag} <X className="h-2 w-2" />
                             </Badge>
                         ))}
                     </div>
                     <Input 
                        placeholder="Новый тег (Enter)..." 
                        className="h-7 text-xs" 
                        value={tagInput}
                        onChange={(e) => setTagInput(e.target.value)}
                        onKeyDown={handleAddTag}
                     />
                 </div>
             </PopoverContent>
          </Popover>

          <Button 
            variant="ghost" 
            size="icon" 
            className={cn("h-7 w-7", task.description && "text-primary")}
            onClick={() => {
                setShowDescription(!showDescription);
                setDescriptionInput(task.description || '');
            }}
            title="Описание"
          >
            <FileText className="h-3.5 w-3.5" />
          </Button>

          <Button 
            variant="ghost" 
            size="icon" 
            className="h-7 w-7" 
            onClick={() => setIsAddingSubtask(true)}
            title="Добавить подзадачу"
          >
            <CornerDownRight className="h-3.5 w-3.5" />
          </Button>
          
          <Button 
            variant="ghost" 
            size="icon" 
            className="h-7 w-7 text-destructive hover:text-destructive hover:bg-destructive/10" 
            onClick={() => deleteTask(task.id)}
            title="Удалить"
          >
            <Trash2 className="h-3.5 w-3.5" />
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
  const { tasks, addTask, viewMode, setViewMode } = useTasks();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [newTaskContent, setNewTaskContent] = useState('');
  const [newTaskDescription, setNewTaskDescription] = useState('');
  const [newTaskCallLink, setNewTaskCallLink] = useState('');
  const [newTaskTime, setNewTaskTime] = useState('09:00');
  const [newTaskDate, setNewTaskDate] = useState<Date | undefined>(undefined);
  const [newTaskPriority, setNewTaskPriority] = useState<Priority>('medium');
  const [newTaskTags, setNewTaskTags] = useState<string[]>([]);
  const [newTaskRecurring, setNewTaskRecurring] = useState<RecurringInterval | undefined>(undefined);
  const [tagInput, setTagInput] = useState('');
  const [notify, setNotify] = useState(false);
  const { toast } = useToast();

  const handleOpenTodoInNewWindow = () => {
    if (isElectron() && electron) {
        electron.openTaskWindow('todo-window-placeholder'); // We will use a special ID or just a different method
    } else {
        toast({
            title: "Недоступно в веб-версии",
            description: "Эта функция работает только в десктопной версии приложения.",
            variant: "destructive",
        });
    }
  };
  
  // Filters & Sort State
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'completed'>('all');
  const [filterPriority, setFilterPriority] = useState<'all' | 'high' | 'medium' | 'low'>('all');
  const [sortBy, setSortBy] = useState<'createdAt' | 'dueDate' | 'priority'>('createdAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [groupBy, setGroupBy] = useState<'none' | 'date' | 'priority'>('none');

  const rootTasks = tasks.filter(t => !t.parentId);

  const filteredTasks = rootTasks.filter(task => {
    const matchesSearch = task.content.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          task.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          task.tags?.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()));
    
    const matchesStatus = filterStatus === 'all' ? true : 
                          filterStatus === 'completed' ? task.isCompleted : !task.isCompleted;
    
    const matchesPriority = filterPriority === 'all' ? true : task.priority === filterPriority;
    
    return matchesSearch && matchesStatus && matchesPriority;
  }).sort((a, b) => {
    let comparison = 0;
    
    if (sortBy === 'priority') {
        const priorityWeight = { high: 3, medium: 2, low: 1, undefined: 0 };
        const weightA = priorityWeight[a.priority || 'medium'];
        const weightB = priorityWeight[b.priority || 'medium'];
        comparison = weightA - weightB;
    } else if (sortBy === 'dueDate') {
        const dateA = a.dueDate || Number.MAX_SAFE_INTEGER;
        const dateB = b.dueDate || Number.MAX_SAFE_INTEGER;
        comparison = dateA - dateB;
    } else {
        comparison = a.createdAt - b.createdAt;
    }

    return sortOrder === 'asc' ? comparison : -comparison;
  });

  const groupedTasks = useMemo(() => {
    if (groupBy === 'none') return { 'All': filteredTasks };

    if (groupBy === 'priority') {
        return {
            'High': filteredTasks.filter(t => t.priority === 'high'),
            'Medium': filteredTasks.filter(t => t.priority === 'medium'),
            'Low': filteredTasks.filter(t => t.priority === 'low'),
            'No Priority': filteredTasks.filter(t => !t.priority), 
        };
    }

    if (groupBy === 'date') {
        const todayStart = startOfToday().getTime();
        
        return {
            'Просрочено': filteredTasks.filter(t => t.dueDate && t.dueDate < todayStart && !t.isCompleted),
            'Сегодня': filteredTasks.filter(t => t.dueDate && isToday(t.dueDate)),
            'Завтра': filteredTasks.filter(t => t.dueDate && isTomorrow(t.dueDate)),
            'Предстоящие': filteredTasks.filter(t => t.dueDate && isAfter(t.dueDate, addDays(new Date(), 1))),
            'Без даты': filteredTasks.filter(t => !t.dueDate),
        };
    }
    return {};
  }, [filteredTasks, groupBy]);

  const handleSaveTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (newTaskContent.trim()) {
      let dueDate: number | undefined = undefined;
      
      if (newTaskDate) {
        const [hours, minutes] = newTaskTime.split(':').map(Number);
        const finalDate = new Date(newTaskDate);
        finalDate.setHours(hours, minutes);
        dueDate = finalDate.getTime();
      }

      addTask(
        newTaskContent, 
        undefined, 
        dueDate, 
        notify, 
        newTaskDescription, 
        newTaskCallLink, 
        newTaskPriority, 
        newTaskTags, 
        newTaskRecurring
      );
      
      closeDialog();
    }
  };

  const closeDialog = () => {
    setNewTaskContent('');
    setNewTaskDescription('');
    setNewTaskCallLink('');
    setNewTaskTime('09:00');
    setNewTaskDate(undefined);
    setNewTaskPriority('medium');
    setNewTaskTags([]);
    setNewTaskRecurring(undefined);
    setTagInput('');
    setNotify(false);
    setIsDialogOpen(false);
  };

  const handleAddTag = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && tagInput.trim()) {
        e.preventDefault();
        if (!newTaskTags.includes(tagInput.trim())) {
            setNewTaskTags([...newTaskTags, tagInput.trim()]);
        }
        setTagInput('');
    }
  };

  const removeTag = (tagToRemove: string) => {
    setNewTaskTags(newTaskTags.filter(t => t !== tagToRemove));
  };

  const activeCount = tasks.filter(t => !t.isCompleted).length;
  const totalCount = tasks.length;
  const completedCount = tasks.filter(t => t.isCompleted).length;
  const progressPercent = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  return (
    <div className="h-full flex flex-col p-6 overflow-hidden bg-background">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
            <Link href="/">
                <Button variant="ghost" size="icon" title="Назад к заметкам">
                    <ArrowLeft className="h-5 w-5" />
                </Button>
            </Link>
            <div>
                <h1 className="text-3xl font-bold flex items-center gap-3">
                    Задачи
                    {totalCount > 0 && (
                        <div className="flex items-center gap-2 text-sm font-normal bg-secondary/50 px-2 py-1 rounded-full border border-border/50">
                            <div className="h-1.5 w-12 bg-background/80 rounded-full overflow-hidden">
                                <div className="h-full bg-primary transition-all duration-500" style={{ width: `${progressPercent}%` }} />
                            </div>
                            <span className="text-muted-foreground text-xs font-mono">{progressPercent}%</span>
                        </div>
                    )}
                </h1>
                <p className="text-sm text-muted-foreground">{activeCount} активных задач</p>
            </div>
        </div>
        
        <Button onClick={() => setIsDialogOpen(true)} size="icon" className="h-9 w-9 rounded-full shadow-sm">
            <Plus className="h-5 w-5" />
        </Button>
      </div>

      {/* Controls Bar */}
      <div className="flex flex-col md:flex-row gap-3 mb-6 bg-card p-3 rounded-lg border shadow-sm">
        <div className="relative flex-1">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input 
                placeholder="Поиск задач..." 
                className="pl-9" 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
            />
        </div>
        
        <div className="flex items-center gap-2 overflow-x-auto pb-1 md:pb-0">
            <div className="flex bg-muted p-1 rounded-md mr-2 shrink-0">
                <Button 
                    variant={viewMode === 'list' ? 'secondary' : 'ghost'} 
                    size="icon" 
                    className="h-7 w-7"
                    onClick={() => setViewMode('list')}
                    title="Список"
                >
                    <LayoutList className="h-4 w-4" />
                </Button>
                <Button 
                    variant={viewMode === 'board' ? 'secondary' : 'ghost'} 
                    size="icon" 
                    className="h-7 w-7"
                    onClick={() => setViewMode('board')}
                    title="Доска"
                >
                    <Columns className="h-4 w-4" />
                </Button>
            </div>

            <Button 
                variant="ghost" 
                size="icon" 
                className="h-9 w-9 mr-2"
                onClick={handleOpenTodoInNewWindow}
                title="Открыть в отдельном окне"
            >
                <ExternalLink className="h-4 w-4" />
            </Button>

            <Select value={filterStatus} onValueChange={(v: any) => setFilterStatus(v)}>
                <SelectTrigger className="w-[130px]">
                    <div className="flex items-center gap-2">
                        <Filter className="h-4 w-4 text-muted-foreground" />
                        <SelectValue placeholder="Статус" />
                    </div>
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="all">Все</SelectItem>
                    <SelectItem value="active">Активные</SelectItem>
                    <SelectItem value="completed">Завершенные</SelectItem>
                </SelectContent>
            </Select>

            <Select value={filterPriority} onValueChange={(v: any) => setFilterPriority(v)}>
                <SelectTrigger className="w-[130px]">
                    <div className="flex items-center gap-2">
                        <Flame className="h-4 w-4 text-muted-foreground" />
                        <SelectValue placeholder="Приоритет" />
                    </div>
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="all">Все</SelectItem>
                    <SelectItem value="high">Высокий 🔥</SelectItem>
                    <SelectItem value="medium">Средний ⚡</SelectItem>
                    <SelectItem value="low">Низкий ☕</SelectItem>
                </SelectContent>
            </Select>

            <Select value={sortBy} onValueChange={(v: any) => setSortBy(v)}>
                <SelectTrigger className="w-[140px]">
                     <div className="flex items-center gap-2">
                        {sortOrder === 'asc' ? <SortAsc className="h-4 w-4 text-muted-foreground" /> : <SortDesc className="h-4 w-4 text-muted-foreground" />}
                        <SelectValue placeholder="Сортировка" />
                    </div>
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="createdAt">Создано</SelectItem>
                    <SelectItem value="dueDate">Дедлайн</SelectItem>
                    <SelectItem value="priority">Приоритет</SelectItem>
                </SelectContent>
            </Select>

            <Button 
                variant="ghost" 
                size="icon" 
                onClick={() => setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')}
                title={sortOrder === 'asc' ? "По возрастанию" : "По убыванию"}
            >
                {sortOrder === 'asc' ? <SortAsc className="h-4 w-4" /> : <SortDesc className="h-4 w-4" />}
            </Button>

            {viewMode === 'list' && (
                <Select value={groupBy} onValueChange={(v: any) => setGroupBy(v)}>
                    <SelectTrigger className="w-[140px]">
                        <div className="flex items-center gap-2">
                            <Layers className="h-4 w-4 text-muted-foreground" />
                            <SelectValue placeholder="Группировка" />
                        </div>
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="none">Нет</SelectItem>
                        <SelectItem value="date">По дате</SelectItem>
                        <SelectItem value="priority">По приоритету</SelectItem>
                    </SelectContent>
                </Select>
            )}
        </div>
      </div>

      <div className="flex-1 flex flex-col min-h-0">
        {viewMode === 'board' ? (
            <div className="flex-1 overflow-hidden">
                <KanbanBoard tasks={filteredTasks} />
            </div>
        ) : (
        <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar space-y-1">
          {filteredTasks.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground opacity-50">
                <Search className="h-12 w-12 mb-4" />
                <p>Задачи не найдены</p>
            </div>
          ) : (
            groupBy === 'none' ? (
                filteredTasks.map(task => (
                    <TaskItem key={task.id} task={task} />
                ))
            ) : (
                Object.entries(groupedTasks).map(([group, tasks]) => (
                    tasks.length > 0 && (
                        <div key={group} className="mb-6">
                            <h3 className="font-semibold text-sm text-muted-foreground mb-2 flex items-center gap-2">
                                {group} 
                                <Badge variant="secondary" className="text-[10px] px-1 h-4">{tasks.length}</Badge>
                            </h3>
                            <div className="space-y-1 pl-1 border-l-2 border-border/50">
                                {tasks.map((task: Task) => (
                                    <TaskItem key={task.id} task={task} />
                                ))}
                            </div>
                        </div>
                    )
                ))
            )
          )}
        </div>
        )}


      </div>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-md">
            <DialogHeader>
                <DialogTitle>Новая задача</DialogTitle>
                <DialogDescription className="sr-only">
                    Форма создания новой задачи
                </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSaveTask} className="flex flex-col gap-4 mt-4">
                <Input 
                    value={newTaskContent}
                    onChange={(e) => setNewTaskContent(e.target.value)}
                    placeholder="Что нужно сделать?"
                    autoFocus
                />
                
                <Textarea
                    value={newTaskDescription}
                    onChange={(e) => setNewTaskDescription(e.target.value)}
                    placeholder="Описание (необязательно)..."
                    className="min-h-[80px]"
                />

                <Input 
                    value={newTaskCallLink}
                    onChange={(e) => setNewTaskCallLink(e.target.value)}
                    placeholder="Ссылка на звонок (необязательно)..."
                />

                <div className="grid grid-cols-2 gap-4">
                    <div className="flex flex-col gap-2">
                         <Label className="text-xs text-muted-foreground">Дата</Label>
                         <Popover>
                            <PopoverTrigger asChild>
                                <Button
                                    variant={"outline"}
                                    className={cn(
                                        "w-full justify-start text-left font-normal h-9",
                                        !newTaskDate && "text-muted-foreground"
                                    )}
                                >
                                    <CalendarIcon className="mr-2 h-4 w-4" />
                                    {newTaskDate ? format(newTaskDate, "d MMM yyyy", { locale: ru }) : <span>Выбрать дату</span>}
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="start">
                                <Calendar
                                    mode="single"
                                    selected={newTaskDate}
                                    onSelect={setNewTaskDate}
                                    initialFocus
                                />
                            </PopoverContent>
                        </Popover>
                    </div>

                    <div className="flex flex-col gap-2">
                         <Label className="text-xs text-muted-foreground">Время</Label>
                         <Input 
                            type="time" 
                            value={newTaskTime} 
                            onChange={(e) => setNewTaskTime(e.target.value)}
                            disabled={!newTaskDate}
                            className="h-9"
                         />
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div className="flex flex-col gap-2">
                         <Label className="text-xs text-muted-foreground">Приоритет</Label>
                         <Select value={newTaskPriority} onValueChange={(v: Priority) => setNewTaskPriority(v)}>
                           <SelectTrigger className="h-9">
                             <SelectValue />
                           </SelectTrigger>
                           <SelectContent>
                             <SelectItem value="high">
                                <div className="flex items-center gap-2"><Flame className="h-4 w-4 text-red-500"/> Высокий</div>
                             </SelectItem>
                             <SelectItem value="medium">
                                <div className="flex items-center gap-2"><Zap className="h-4 w-4 text-yellow-500"/> Средний</div>
                             </SelectItem>
                             <SelectItem value="low">
                                <div className="flex items-center gap-2"><Coffee className="h-4 w-4 text-blue-500"/> Низкий</div>
                             </SelectItem>
                           </SelectContent>
                         </Select>
                    </div>

                    <div className="flex flex-col gap-2">
                       <Label className="text-xs text-muted-foreground">Повтор</Label>
                       <Select value={newTaskRecurring || "none"} onValueChange={(v) => setNewTaskRecurring(v === "none" ? undefined : v as RecurringInterval)}>
                         <SelectTrigger className="h-9">
                           <SelectValue placeholder="Не повторять" />
                         </SelectTrigger>
                         <SelectContent>
                           <SelectItem value="none">Не повторять</SelectItem>
                           <SelectItem value="daily">Каждый день</SelectItem>
                           <SelectItem value="weekly">Каждую неделю</SelectItem>
                           <SelectItem value="monthly">Каждый месяц</SelectItem>
                           <SelectItem value="yearly">Каждый год</SelectItem>
                         </SelectContent>
                       </Select>
                    </div>
                </div>

                <div className="flex flex-col gap-2">
                       <Label className="text-xs text-muted-foreground">Теги</Label>
                       <div className="flex flex-wrap gap-1 mb-1 min-h-[24px] p-1 border rounded-md bg-background/50">
                           {newTaskTags.length === 0 && <span className="text-xs text-muted-foreground p-1">Нет тегов</span>}
                           {newTaskTags.map(tag => (
                               <Badge key={tag} variant="secondary" className="gap-1 pr-1">
                                   {tag}
                                   <Button type="button" variant="ghost" size="icon" className="h-3 w-3 p-0 hover:bg-transparent" onClick={() => removeTag(tag)}>
                                       <X className="h-2 w-2" />
                                   </Button>
                               </Badge>
                           ))}
                       </div>
                       <Input 
                           value={tagInput}
                           onChange={(e) => setTagInput(e.target.value)}
                           onKeyDown={handleAddTag}
                           placeholder="Добавить тег (Enter)..."
                           className="h-9"
                       />
                </div>

                <div className="flex items-center space-x-2">
                    <Checkbox id="notify-todo" checked={notify} onCheckedChange={(c) => setNotify(!!c)} disabled={!newTaskDate} />
                    <Label htmlFor="notify-todo" className={!newTaskDate ? "text-muted-foreground" : ""}>Уведомить в Telegram</Label>
                </div>
                
                <div className="flex justify-end gap-2 pt-2">
                    <Button type="button" variant="ghost" onClick={closeDialog}>Отмена</Button>
                    <Button type="submit">Создать задачу</Button>
                </div>
            </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}