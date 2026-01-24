import React, { useState } from 'react';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Bold, Italic, List, ListOrdered, CheckSquare, Link, Image, Video, Code, 
  Table, Workflow, Palette, Eraser, 
  Sidebar, Plus, Search, Calendar, ListTodo, Trash2, Settings,
  Flame, Zap, Coffee, Tag, RotateCw, ExternalLink,
  ChevronLeft, ChevronRight, MousePointerClick,
  FileText, FolderOpen, Save, Send,
  Bot, Sparkles, Shield, Lock, Fingerprint,
  Share2, Star, Hash, PanelLeft,
  Quote, Minus,
  GitCompare, Globe, RefreshCw, Copy, Check, Tags, FileSearch,
  MessageSquare, Bell, Command, Laptop, Sun, Moon,
  Keyboard, Monitor, Cloud, CloudCheck, User, Settings2,
  Layout, PanelRight, ChevronDown, CheckCircle2,
  LayoutTemplate, History
} from 'lucide-react';

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
    title: 'Интерфейс и Навигация',
    items: [
      { icon: PanelLeft, title: 'Боковая панель', description: 'Сверните или разверните панель для фокусировки на тексте.' },
      { icon: Search, title: 'Поиск (Ctrl+F)', description: 'Глобальный поиск по названиям и содержимому всех ваших заметок.' },
      { icon: Share2, title: 'Граф заметок', description: 'Визуальное представление связей между вашими заметками (Wiki-ссылки).' },
      { icon: Star, title: 'Избранное', description: 'Быстрый доступ к самым важным документам, отмеченным звездочкой.' },
      { icon: ListTodo, title: 'Задачи', description: 'Единый список дел из всех заметок с возможностью фильтрации.' },
      { icon: Calendar, title: 'Дневник', description: 'Быстрый переход к ежедневным заметкам для планирования и рефлексии.' },
      { icon: Trash2, title: 'Корзина', description: 'Удаленные заметки хранятся здесь 30 дней, прежде чем будут стерты навсегда.' },
    ]
  },
  {
    title: 'Редактор и Форматирование',
    items: [
      { icon: Bold, title: 'Панель инструментов', description: 'Жирный, курсив, списки, цитаты и код. Все стандартные инструменты форматирования под рукой.' },
      { icon: LayoutTemplate, title: 'Шаблоны', description: 'Используйте готовые шаблоны для планов встреч, списков дел и ТЗ, чтобы сэкономить время.' },
      { icon: Workflow, title: 'Mermaid диаграммы', description: 'Рисуйте схемы и графики прямо в тексте с помощью простого кода (Workflow).' },
      { icon: History, title: 'История версий', description: 'Просматривайте предыдущие версии заметки и восстанавливайте данные, если что-то пошло не так.' },
      { icon: Image, title: 'Drag & Drop файлов', description: 'Просто перетащите картинку или файл в редактор для их мгновенной загрузки.' },
      { icon: Hash, title: 'Теги', description: 'Добавляйте #теги прямо в текст для автоматической категоризации заметок.' },
      { icon: Link, title: 'Wiki-ссылки', description: 'Используйте [[Название заметки]] для создания связей между документами.' },
      { icon: Lock, title: 'Защита (Master Password)', description: 'Нажмите на иконку замка, чтобы зашифровать заметку. Она будет доступна только по вашему паролю.' },
    ]
  },
  {
    title: 'Продвинутые возможности',
    items: [
      { icon: Command, title: 'Slash-меню (/)', description: 'Введите "/" в новой строке для быстрого доступа к командам вставки (заголовки, таблицы, изображения).' },
      { icon: Sparkles, title: 'Bubble Menu', description: 'Выделите любой текст, чтобы мгновенно вызвать меню форматирования и AI ассистента.' },
      { icon: Video, title: 'YouTube вставки', description: 'Просто вставьте ссылку на видео, и оно отобразится прямо внутри вашей заметки.' },
      { icon: Table, title: 'Таблицы', description: 'Создавайте и редактируйте таблицы для структурирования сложных данных.' },
    ]
  },
  {
    title: 'AI Ассистент (Возможности)',
    items: [
      { icon: Globe, title: 'Глобальный контекст (RAG)', description: 'AI может отвечать на вопросы, основываясь на всей вашей базе знаний, а не только на текущей заметке.' },
      { icon: GitCompare, title: 'Умный Diff', description: 'Сравнивайте предложенные AI изменения с вашим текстом и применяйте их одним кликом.' },
      { icon: Tags, title: 'Авто-тегирование', description: 'AI проанализирует текст и предложит наиболее подходящие ключевые слова.' },
      { icon: FileSearch, title: 'Саммари', description: 'Быстрое создание краткого содержания длинных документов или протоколов встреч.' },
      { icon: RefreshCw, title: 'Очистка истории', description: 'Сбрасывайте контекст чата для начала новой темы обсуждения.' },
    ]
  },
  {
    title: 'Настройки и Интеграции',
    items: [
      { icon: MessageSquare, title: 'Telegram Bot', description: 'Подключите бота для получения уведомлений о задачах и быстрой отправки заметок в GodNotes.' },
      { icon: Laptop, title: 'Темы оформления', description: 'Светлая, темная или системная тема. Настройте внешний вид под свои предпочтения.' },
      { icon: Keyboard, title: 'Горячие клавиши', description: 'Настройте сочетания клавиш для всех основных действий в разделе "Горячие клавиши".' },
      { icon: User, title: 'Аккаунт', description: 'Управление профилем, смена пароля и управление сессиями на разных устройствах.' },
    ]
  },
  {
    title: 'Безопасность (Важно)',
    items: [
      { icon: Shield, title: 'Локальное шифрование', description: 'Мастер-пароль используется для генерации ключа AES-256. Ваши защищенные данные не могут быть прочитаны даже нами.' },
      { icon: Fingerprint, title: 'Конфиденциальность', description: 'Ваши ключи API (OpenAI/Anthropic) хранятся локально и никогда не передаются на наши сервера.' },
    ]
  },
  {
    title: 'Полезные горячие клавиши',
    items: [
      { icon: Zap, title: 'Ctrl + P', description: 'Командная панель (быстрый поиск файлов и команд).' },
      { icon: Command, title: 'Ctrl + S', description: 'Принудительное сохранение и синхронизация (хотя автосохранение включено).' },
      { icon: Plus, title: 'Ctrl + N', description: 'Мгновенное создание новой заметки.' },
      { icon: Layout, title: 'Ctrl + \\', description: 'Скрыть/показать боковую панель.' },
      { icon: Sparkles, title: 'Ctrl + J', description: 'Открыть чат с AI помощником.' },
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
