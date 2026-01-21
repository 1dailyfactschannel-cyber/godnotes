import React, { useState } from 'react';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Bold, Italic, List, ListOrdered, CheckSquare, Link, Image, Video, Code, 
  Table, Workflow, Palette, Eraser, 
  Sidebar, Plus, Search, Calendar, ListTodo, Trash2, Settings,
  Flame, Zap, Coffee, Tag, RotateCw, ExternalLink,
  ChevronLeft, ChevronRight, MousePointerClick,
  FileText, FolderOpen, Save
} from 'lucide-react';
import { cn } from '@/lib/utils';

type HelpItem = {
  icon: React.ElementType;
  title: string;
  description: string;
};

type HelpCategory = {
  title: string;
  items: HelpItem[];
};

const helpData: HelpCategory[] = [
  {
    title: 'Навигация и Интерфейс',
    items: [
      { icon: Sidebar, title: 'Боковая панель', description: 'Скрыть или показать боковую панель (Ctrl+\\).' },
      { icon: Plus, title: 'Новая заметка/Пространство', description: 'Создать новую заметку или добавить рабочее пространство.' },
      { icon: Search, title: 'Поиск', description: 'Глобальный поиск по всем заметкам и файлам (Ctrl+P).' },
      { icon: Calendar, title: 'Календарь', description: 'Переход к календарю для планирования задач.' },
      { icon: ListTodo, title: 'Задачи', description: 'Переход к списку всех задач (Todo).' },
      { icon: Trash2, title: 'Корзина', description: 'Просмотр удаленных файлов. Файлы можно восстановить или удалить навсегда.' },
      { icon: Settings, title: 'Настройки', description: 'Открыть настройки приложения (темы, горячие клавиши, Telegram).' },
      { icon: FolderOpen, title: 'Пространства', description: 'Переключение между разными папками-хранилищами заметок.' },
    ]
  },
  {
    title: 'Редактор текста',
    items: [
      { icon: Bold, title: 'Жирный', description: 'Сделать текст жирным (Ctrl+B).' },
      { icon: Italic, title: 'Курсив', description: 'Сделать текст курсивным (Ctrl+I).' },
      { icon: List, title: 'Маркированный список', description: 'Создать простой список с точками.' },
      { icon: ListOrdered, title: 'Нумерованный список', description: 'Создать список с нумерацией.' },
      { icon: CheckSquare, title: 'Список задач', description: 'Создать список с чекбоксами (Ctrl+Shift+9).' },
      { icon: Link, title: 'Ссылка', description: 'Вставить ссылку на веб-сайт (Ctrl+L).' },
      { icon: Image, title: 'Изображение', description: 'Вставить изображение по ссылке или перетаскиванием.' },
      { icon: Video, title: 'Видео', description: 'Вставить видео с YouTube.' },
      { icon: Code, title: 'Код', description: 'Вставить блок кода с подсветкой синтаксиса.' },
      { icon: Table, title: 'Таблица', description: 'Вставить таблицу (3x3 по умолчанию).' },
      { icon: Workflow, title: 'Mermaid', description: 'Вставить диаграмму Mermaid.' },
      { icon: Palette, title: 'Цвет текста', description: 'Изменить цвет выделенного текста.' },
      { icon: Eraser, title: 'Очистить формат', description: 'Убрать все форматирование с выделенного текста.' },
      { icon: FileText, title: 'Wiki-ссылка', description: 'Используйте [[ ]] для ссылки на другую заметку.' },
    ]
  },
  {
    title: 'Управление задачами',
    items: [
      { icon: CheckSquare, title: 'Выполнение', description: 'Нажмите на чекбокс, чтобы отметить задачу выполненной.' },
      { icon: Flame, title: 'Высокий приоритет', description: 'Помечает задачу как важную (красный огонек).' },
      { icon: Zap, title: 'Средний приоритет', description: 'Обычный приоритет (желтая молния).' },
      { icon: Coffee, title: 'Низкий приоритет', description: 'Несрочная задача (синяя чашка).' },
      { icon: Calendar, title: 'Дата и время', description: 'Установить срок выполнения задачи.' },
      { icon: Tag, title: 'Теги', description: 'Добавить метки для фильтрации задач.' },
      { icon: RotateCw, title: 'Повтор', description: 'Сделать задачу повторяющейся (ежедневно, еженедельно и т.д.).' },
      { icon: ExternalLink, title: 'Отдельное окно', description: 'Открыть задачу в отдельном окне (только Desktop).' },
    ]
  },
  {
    title: 'Календарь',
    items: [
      { icon: ChevronLeft, title: 'Предыдущий месяц', description: 'Перейти к просмотру прошлого месяца.' },
      { icon: ChevronRight, title: 'Следующий месяц', description: 'Перейти к просмотру следующего месяца.' },
      { icon: MousePointerClick, title: 'Создание задачи', description: 'Кликните на любой день, чтобы добавить задачу на эту дату.' },
    ]
  }
];

export function HelpSettings() {
  const [searchQuery, setSearchQuery] = useState('');

  const filteredData = helpData.map(category => ({
    ...category,
    items: category.items.filter(item => 
      item.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
      item.description.toLowerCase().includes(searchQuery.toLowerCase())
    )
  })).filter(category => category.items.length > 0);

  return (
    <div className="space-y-4 h-full flex flex-col">
      <div>
        <h3 className="text-lg font-medium mb-4">Как пользоваться</h3>
        <div className="relative">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Поиск по справке..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-8"
          />
        </div>
      </div>

      <ScrollArea className="flex-1 pr-4 -mr-4">
        <div className="space-y-8 pb-4">
          {filteredData.length === 0 ? (
            <div className="text-center text-muted-foreground py-8">
              Ничего не найдено
            </div>
          ) : (
            filteredData.map((category, index) => (
              <div key={index} className="space-y-3">
                <h4 className="font-medium text-sm text-primary border-b pb-1 border-border/50">
                  {category.title}
                </h4>
                <div className="grid grid-cols-1 gap-3">
                  {category.items.map((item, itemIndex) => (
                    <div key={itemIndex} className="flex items-start gap-3 p-2 rounded-lg hover:bg-accent/50 transition-colors">
                      <div className="mt-1 p-1.5 bg-background rounded-md border border-border shrink-0 text-muted-foreground">
                        <item.icon className="h-4 w-4" />
                      </div>
                      <div>
                        <div className="font-medium text-sm">{item.title}</div>
                        <div className="text-sm text-muted-foreground leading-relaxed">
                          {item.description}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
