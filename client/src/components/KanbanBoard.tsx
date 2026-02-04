import React, { useMemo, useState } from 'react';
import { 
  DndContext, 
  DragOverlay, 
  closestCorners, 
  KeyboardSensor, 
  PointerSensor, 
  useDroppable,
  useSensor, 
  useSensors, 
  DragStartEvent, 
  DragOverEvent, 
  DragEndEvent,
  defaultDropAnimationSideEffects,
  DropAnimation
} from '@dnd-kit/core';
import { 
  SortableContext, 
  sortableKeyboardCoordinates, 
  verticalListSortingStrategy,
  horizontalListSortingStrategy,
  useSortable,
  arrayMove
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Task, TaskStatus, useTasks, Priority } from '@/lib/tasks-store';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';
import { Calendar as CalendarIcon, Flame, Zap, Coffee, GripVertical, MoreHorizontal, Plus, Trash2, Pencil } from 'lucide-react';

// Helper to get status safely
const getTaskStatus = (task: Task): TaskStatus => {
  if (task.status) return task.status;
  return task.isCompleted ? 'done' : 'todo';
};

const PriorityIcon = ({ priority, className }: { priority?: Priority, className?: string }) => {
  switch (priority) {
    case 'high': return <Flame className={cn("text-red-500", className)} />;
    case 'medium': return <Zap className={cn("text-yellow-500", className)} />;
    case 'low': return <Coffee className={cn("text-blue-500", className)} />;
    default: return <Coffee className={cn("text-muted-foreground", className)} />;
  }
};

interface SortableTaskItemProps {
  task: Task;
  onTaskClick?: (task: Task) => void;
}

const TaskCard = ({
  task,
  className,
  onClick,
  dragHandleProps,
}: {
  task: Task;
  className?: string;
  onClick?: () => void;
  dragHandleProps?: {
    ref?: React.Ref<HTMLDivElement>;
    attributes?: any;
    listeners?: any;
  };
}) => {
  return (
    <div
      className={cn(
        "bg-card hover:bg-accent/50 p-3 rounded-lg border border-border shadow-sm group relative flex flex-col gap-2",
        onClick ? "cursor-pointer" : "",
        className,
      )}
      onClick={onClick}
    >
      <div className="flex items-start justify-between gap-2">
        <span
          className={cn(
            "text-sm font-medium line-clamp-2",
            task.isCompleted && "line-through text-muted-foreground",
          )}
        >
          {task.content}
        </span>
        <div
          ref={dragHandleProps?.ref as any}
          {...(dragHandleProps?.attributes || {})}
          {...(dragHandleProps?.listeners || {})}
          className={cn(
            "p-1 -m-1 rounded hover:bg-background/50 select-none",
            dragHandleProps ? "cursor-grab active:cursor-grabbing" : "",
          )}
          onClickCapture={(e) => e.stopPropagation()}
          onDoubleClickCapture={(e) => e.stopPropagation()}
          style={{ touchAction: "none" }}
        >
          <GripVertical className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-50" />
        </div>
      </div>

      <div className="flex items-center justify-between mt-1">
        <div className="flex items-center gap-1">
          {task.priority && task.priority !== "medium" && (
            <PriorityIcon priority={task.priority} className="h-3 w-3" />
          )}
          {task.tags && task.tags.length > 0 && (
            <Badge
              variant="outline"
              className="text-[10px] h-4 px-1 py-0 max-w-[60px] truncate"
            >
              {task.tags[0]}
            </Badge>
          )}
        </div>

        {task.dueDate && (
          <div
            className={cn(
              "flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full whitespace-nowrap",
              task.dueDate < Date.now() && !task.isCompleted
                ? "text-destructive bg-destructive/10"
                : "text-muted-foreground bg-secondary",
            )}
          >
            <CalendarIcon className="h-2.5 w-2.5" />
            {format(task.dueDate, "d MMM", { locale: ru })}
          </div>
        )}
      </div>
    </div>
  );
};

const SortableTaskItem = ({ task, onTaskClick }: SortableTaskItemProps) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: task.id, data: { type: 'Task', task } });

  const style = {
    transform: CSS.Translate.toString(transform),
    transition,
  };

  if (isDragging) {
    return (
      <div
        ref={setNodeRef}
        style={style}
        className="opacity-50 bg-accent/30 border-2 border-dashed border-primary/40 rounded-lg p-3 h-[100px]"
      />
    );
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
    >
      <TaskCard
        task={task}
        onClick={() => onTaskClick?.(task)}
        dragHandleProps={{
          ref: setActivatorNodeRef,
          attributes,
          listeners,
        }}
      />
    </div>
  );
};

interface ColumnContentProps {
    id: string;
    title: string;
    tasks: Task[];
    className?: string;
    style?: React.CSSProperties;
    dragHandleProps?: any;
    dragRef?: React.Ref<HTMLDivElement>;
    onRename?: (id: string, title: string) => void;
    onDelete?: (id: string) => void;
    onTaskClick?: (task: Task) => void;
}

// Presentation Component
const ColumnContent = ({ id, title, tasks, className, style, dragHandleProps, dragRef, onRename, onDelete, onTaskClick }: ColumnContentProps) => {
    const [isEditing, setIsEditing] = useState(false);
    const [editTitle, setEditTitle] = useState(title);
    const { setNodeRef: setDropRef, isOver: isDropOver } = useDroppable({
        id: `column-drop-${id}`,
        data: { type: 'ColumnDrop', id },
    });

    React.useEffect(() => {
        setEditTitle(title);
    }, [title]);

    const handleRename = () => {
        setIsEditing(false);
        if (editTitle.trim() && editTitle !== title) {
            onRename?.(id, editTitle);
        } else {
            setEditTitle(title);
        }
    };

    return (
        <div 
            ref={dragRef}
            style={style}
            className={cn(
                "flex flex-col h-full min-w-[280px] w-[300px] bg-secondary/20 rounded-xl border border-border/50 group/column transition-colors",
                isDropOver && "ring-2 ring-primary/30 border-primary/40 bg-secondary/30",
                className
            )}
        >
          <div 
            className="p-3 flex items-center justify-between border-b border-border/50 bg-secondary/30 rounded-t-xl backdrop-blur-sm"
          >
            <div className="flex items-center gap-2 flex-1 min-w-0">
                <div {...dragHandleProps} className="cursor-grab active:cursor-grabbing p-1 hover:bg-background/50 rounded transition-colors">
                    <GripVertical className="h-4 w-4 text-muted-foreground" />
                </div>
                
                {isEditing ? (
                    <Input 
                        value={editTitle}
                        onChange={(e) => setEditTitle(e.target.value)}
                        onBlur={handleRename}
                        onKeyDown={(e) => e.key === 'Enter' && handleRename()}
                        autoFocus
                        className="h-7 text-sm px-2 bg-background"
                        onPointerDown={(e) => e.stopPropagation()} 
                    />
                ) : (
                    <h3 className="font-semibold text-sm flex items-center gap-2 truncate flex-1" onDoubleClick={() => setIsEditing(true)}>
                        <span className="truncate">{title}</span>
                        <Badge variant="secondary" className="text-[10px] h-5 px-1.5 bg-background/50 shrink-0">
                            {tasks.length}
                        </Badge>
                    </h3>
                )}
            </div>

            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover/column:opacity-100 transition-opacity">
                        <MoreHorizontal className="h-4 w-4" />
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => setIsEditing(true)}>
                        <Pencil className="mr-2 h-4 w-4" />
                        Переименовать
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => onDelete?.(id)} className="text-destructive focus:text-destructive">
                        <Trash2 className="mr-2 h-4 w-4" />
                        Удалить
                    </DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>
          </div>
          <div ref={setDropRef} className="flex-1">
            <ScrollArea className="h-full p-2">
              <SortableContext items={tasks.map(t => t.id)} strategy={verticalListSortingStrategy}>
                <div className="flex flex-col gap-2 min-h-[100px]">
                  {tasks.map((task) => (
                    <SortableTaskItem key={task.id} task={task} onTaskClick={onTaskClick} />
                  ))}
                </div>
              </SortableContext>
            </ScrollArea>
          </div>
        </div>
      );
}

interface ColumnProps {
  id: TaskStatus;
  title: string;
  tasks: Task[];
  onRename?: (id: string, title: string) => void;
  onDelete?: (id: string) => void;
  onTaskClick?: (task: Task) => void;
}

const SortableColumn = ({ id, title, tasks, onRename, onDelete, onTaskClick }: ColumnProps) => {
  const { 
    setNodeRef, 
    attributes, 
    listeners, 
    transform, 
    transition, 
    isDragging 
  } = useSortable({ id: id, data: { type: 'Column', id } });

  const style = {
    transform: CSS.Translate.toString(transform),
    transition,
  };

  if (isDragging) {
    return (
        <div 
            ref={setNodeRef} 
            style={style}
            className="flex flex-col h-full min-w-[280px] w-[300px] bg-secondary/20 rounded-xl border border-primary/50 opacity-30"
        />
    );
  }

  return (
    <ColumnContent 
        id={id}
        dragRef={setNodeRef}
        style={style}
        title={title}
        tasks={tasks}
        dragHandleProps={{...attributes, ...listeners}}
        onRename={onRename}
        onDelete={onDelete}
        onTaskClick={onTaskClick}
    />
  );
};

export function KanbanBoard({ tasks, onTaskClick }: { tasks: Task[]; onTaskClick?: (task: Task) => void }) {
  const { moveTask, columnOrder, setColumnOrder, columns, addColumn, updateColumn, deleteColumn } = useTasks();
  
  const [activeId, setActiveId] = useState<string | null>(null);
  const [activeColumn, setActiveColumn] = useState<{id: TaskStatus, title: string} | null>(null);

  // Fallback columns if store is not yet initialized or empty
  const defaultColumns = [
    { id: 'todo', title: 'Нужно сделать' },
    { id: 'in_progress', title: 'В процессе' },
    { id: 'done', title: 'Готово' }
  ];

  const currentColumns = columns && columns.length > 0 ? columns : defaultColumns;

  // Ensure columnOrder exists, fallback if not (migration safety)
  const safeColumnOrder = useMemo(() => {
     if (columnOrder && columnOrder.length > 0) return columnOrder;
     return currentColumns.map(c => c.id);
  }, [columnOrder, currentColumns]);

  const orderedColumns = useMemo(() => {
    // Create a map for quick lookup
    const colMap = new Map(currentColumns.map(c => [c.id, c]));
    
    // Map order to columns, filter out undefined
    const ordered = safeColumnOrder.map(id => colMap.get(id)).filter(Boolean) as typeof currentColumns;
    
    // Append any new columns that are not in order yet
    const knownIds = new Set(safeColumnOrder);
    const unknownCols = currentColumns.filter(c => !knownIds.has(c.id));
    
    return [...ordered, ...unknownCols];
  }, [currentColumns, safeColumnOrder]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
        activationConstraint: {
            distance: 3,
        },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const tasksByStatus = useMemo(() => {
    const grouped: Record<string, Task[]> = {};
    // Initialize groups
    orderedColumns.forEach(col => {
        grouped[col.id] = [];
    });

    tasks.forEach(task => {
        if (task.parentId) return;

        const status = getTaskStatus(task);
        if (grouped[status]) {
            grouped[status].push(task);
        } else {
             // If status doesn't match any column (legacy or deleted), put in first column or todo
             const fallbackId = orderedColumns.find(c => c.id === 'todo')?.id || orderedColumns[0]?.id;
             if (fallbackId) {
                 if (!grouped[fallbackId]) grouped[fallbackId] = [];
                 grouped[fallbackId].push(task);
             }
        }
    });

    return grouped;
  }, [tasks, orderedColumns]);

  const onDragStart = (event: DragStartEvent) => {
    if (event.active.data.current?.type === 'Column') {
        const col = currentColumns.find(c => c.id === event.active.id);
        setActiveColumn({
            id: event.active.id as string,
            title: col?.title || ''
        });
        setActiveId(event.active.id as string);
        return;
    }
    setActiveId(event.active.id as string);
  };

  const onDragOver = (event: DragOverEvent) => {
    const { active, over } = event;
    if (!over) return;

    const overId = over.id;

    if (activeId === overId) return;

    const isActiveTask = active.data.current?.type === 'Task';
    const isOverTask = over.data.current?.type === 'Task';
    const isOverColumn = over.data.current?.type === 'Column';
    const isOverColumnDrop = over.data.current?.type === 'ColumnDrop';

    if (!isActiveTask) return;

    // Moving task over another task
    if (isActiveTask && isOverTask) {
        // Visual reordering logic would go here if we supported it
    }

    // Moving task over a column
    if (isActiveTask && (isOverColumn || isOverColumnDrop)) {
        // Visual drop logic
    }
  };

  const onDragEnd = (event: DragEndEvent) => {
    setActiveId(null);
    setActiveColumn(null);
    const { active, over } = event;

    if (!over) return;

    const activeId = active.id as string;
    const overId = over.id as string;

    // Handle Column Reordering
    if (active.data.current?.type === 'Column') {
        if (over.data.current?.type !== 'Column') return;
        if (activeId !== overId) {
            const oldIndex = safeColumnOrder.indexOf(activeId as string);
            const newIndex = safeColumnOrder.indexOf(overId as string);
            setColumnOrder(arrayMove(safeColumnOrder, oldIndex, newIndex));
        }
        return;
    }

    // Handle Task Reordering/Moving
    const activeTask = tasks.find(t => t.id === activeId);
    if (!activeTask) return;

    // Find drop target column
    let targetStatus: TaskStatus | undefined;

    if (over.data.current?.type === 'Column') {
        targetStatus = over.id as TaskStatus;
    } else if (over.data.current?.type === 'ColumnDrop') {
        targetStatus = over.data.current?.id as TaskStatus;
    } else if (over.data.current?.type === 'Task') {
        const overTask = tasks.find(t => t.id === overId);
        if (overTask) {
            targetStatus = getTaskStatus(overTask);
        }
    }

    if (targetStatus && getTaskStatus(activeTask) !== targetStatus) {
        moveTask(activeId, targetStatus);
    }
  };

  const dropAnimation: DropAnimation = {
    sideEffects: defaultDropAnimationSideEffects({
      styles: {
        active: {
          opacity: '0.5',
        },
      },
    }),
  };

  const activeTask = tasks.find(t => t.id === activeId);

  return (
    <div className="flex h-full gap-4 overflow-x-auto pb-4 pt-2 px-2 items-start">
      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={onDragStart}
        onDragOver={onDragOver}
        onDragEnd={onDragEnd}
      >
        <SortableContext items={orderedColumns.map(c => c.id)} strategy={horizontalListSortingStrategy}>
            <div className="flex gap-4 h-full">
                {orderedColumns.map((col) => (
                <SortableColumn
                    key={col.id}
                    id={col.id}
                    title={col.title}
                    tasks={tasksByStatus[col.id] || []}
                    onRename={updateColumn}
                    onDelete={deleteColumn}
                    onTaskClick={onTaskClick}
                />
                ))}
                
                <div className="min-w-[280px] w-[300px]">
                   <Button 
                        variant="outline" 
                        className="w-full h-[50px] border-dashed bg-transparent hover:bg-secondary/50 text-muted-foreground hover:text-foreground"
                        onClick={() => addColumn('Новая колонка')}
                   >
                        <Plus className="mr-2 h-4 w-4" />
                        Добавить колонку
                   </Button>
               </div>
            </div>
        </SortableContext>
        <DragOverlay dropAnimation={dropAnimation} adjustScale={true}>
            {activeColumn ? (
                <ColumnContent
                    id={activeColumn.id}
                    title={activeColumn.title}
                    tasks={tasksByStatus[activeColumn.id] || []}
                    className="opacity-80"
                />
            ) : activeTask ? (
                <TaskCard task={activeTask} className="opacity-95 shadow-2xl border-primary/50 ring-2 ring-primary/20 rotate-[0.5deg] scale-[1.03]" />
            ) : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
}
