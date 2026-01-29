import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Plus, Edit3, Trash2, Save, X } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface Template {
  id: string;
  name: string;
  content: string;
  createdAt: number;
  updatedAt: number;
}

interface TemplatesManagerProps {
  templates: Template[];
  onSaveTemplates: (templates: Template[]) => void;
}

export function TemplatesManager({ templates, onSaveTemplates }: TemplatesManagerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<Template | null>(null);
  const [newTemplateName, setNewTemplateName] = useState('');
  const [newTemplateContent, setNewTemplateContent] = useState('');
  const { toast } = useToast();

  const handleAddTemplate = () => {
    if (!newTemplateName.trim() || !newTemplateContent.trim()) {
      toast({
        title: "Ошибка",
        description: "Название и содержимое шаблона не могут быть пустыми",
        variant: "destructive"
      });
      return;
    }

    const newTemplate: Template = {
      id: Date.now().toString(),
      name: newTemplateName.trim(),
      content: newTemplateContent,
      createdAt: Date.now(),
      updatedAt: Date.now()
    };

    const updatedTemplates = [...templates, newTemplate];
    onSaveTemplates(updatedTemplates);
    
    setNewTemplateName('');
    setNewTemplateContent('');
    
    toast({
      title: "Шаблон добавлен",
      description: `Шаблон "${newTemplate.name}" успешно создан`
    });
  };

  const handleEditTemplate = (template: Template) => {
    setEditingTemplate(template);
    setNewTemplateName(template.name);
    setNewTemplateContent(template.content);
  };

  const handleUpdateTemplate = () => {
    if (!editingTemplate || !newTemplateName.trim() || !newTemplateContent.trim()) {
      toast({
        title: "Ошибка",
        description: "Название и содержимое шаблона не могут быть пустыми",
        variant: "destructive"
      });
      return;
    }

    const updatedTemplates = templates.map(t => 
      t.id === editingTemplate.id 
        ? { 
            ...t, 
            name: newTemplateName.trim(), 
            content: newTemplateContent,
            updatedAt: Date.now()
          }
        : t
    );

    onSaveTemplates(updatedTemplates);
    setEditingTemplate(null);
    setNewTemplateName('');
    setNewTemplateContent('');
    
    toast({
      title: "Шаблон обновлен",
      description: `Шаблон "${newTemplateName}" успешно сохранен`
    });
  };

  const handleDeleteTemplate = (templateId: string) => {
    const templateToDelete = templates.find(t => t.id === templateId);
    if (!templateToDelete) return;

    const updatedTemplates = templates.filter(t => t.id !== templateId);
    onSaveTemplates(updatedTemplates);
    
    toast({
      title: "Шаблон удален",
      description: `Шаблон "${templateToDelete.name}" удален`
    });
  };

  const handleCancelEdit = () => {
    setEditingTemplate(null);
    setNewTemplateName('');
    setNewTemplateContent('');
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="h-8">
          <Edit3 className="h-4 w-4 mr-2" />
          Управление шаблонами
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Управление шаблонами заметок</DialogTitle>
          <DialogDescription>
            Создавайте, редактируйте и удаляйте шаблоны для быстрого создания заметок
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 flex-1 min-h-0">
          {/* Left column - Template list */}
          <div className="flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-sm">Существующие шаблоны</h3>
              <span className="text-xs text-muted-foreground">{templates.length} шаблонов</span>
            </div>
            
            <ScrollArea className="flex-1 border rounded-md p-2">
              {templates.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <p>Нет созданных шаблонов</p>
                  <p className="text-xs mt-1">Создайте первый шаблон справа</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {templates.map((template) => (
                    <div 
                      key={template.id} 
                      className="p-3 border rounded hover:bg-accent transition-colors group"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          <h4 className="font-medium text-sm truncate">{template.name}</h4>
                          <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                            {template.content.replace(/<[^>]*>/g, '').substring(0, 100)}...
                          </p>
                          <div className="text-xs text-muted-foreground mt-2">
                            Создан: {new Date(template.createdAt).toLocaleDateString('ru-RU')}
                          </div>
                        </div>
                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7"
                            onClick={() => handleEditTemplate(template)}
                          >
                            <Edit3 className="h-3 w-3" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7 text-destructive hover:text-destructive hover:bg-destructive/10"
                            onClick={() => handleDeleteTemplate(template.id)}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </div>

          {/* Right column - Template editor */}
          <div className="flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-sm">
                {editingTemplate ? 'Редактирование шаблона' : 'Создание нового шаблона'}
              </h3>
              {editingTemplate && (
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={handleCancelEdit}
                  className="h-7 text-xs"
                >
                  <X className="h-3 w-3 mr-1" />
                  Отмена
                </Button>
              )}
            </div>

            <div className="space-y-4 flex-1">
              <div className="space-y-2">
                <Label htmlFor="template-name">Название шаблона</Label>
                <Input
                  id="template-name"
                  value={newTemplateName}
                  onChange={(e) => setNewTemplateName(e.target.value)}
                  placeholder="Введите название шаблона"
                  className="text-sm"
                />
              </div>

              <div className="space-y-2 flex-1 flex flex-col">
                <Label htmlFor="template-content">Содержимое шаблона</Label>
                <Textarea
                  id="template-content"
                  value={newTemplateContent}
                  onChange={(e) => setNewTemplateContent(e.target.value)}
                  placeholder="Введите HTML содержимое шаблона. Можно использовать теги: h1, h2, h3, p, ul, ol, li, strong, em, br"
                  className="flex-1 resize-none text-sm font-mono"
                />
                <p className="text-xs text-muted-foreground">
                  Поддерживаемые теги: h1, h2, h3, p, ul, ol, li, strong, em, br, blockquote, hr
                </p>
              </div>

              <div className="flex gap-2 pt-2">
                {editingTemplate ? (
                  <Button onClick={handleUpdateTemplate} className="flex-1">
                    <Save className="h-4 w-4 mr-2" />
                    Сохранить изменения
                  </Button>
                ) : (
                  <Button onClick={handleAddTemplate} className="flex-1" disabled={!newTemplateName.trim() || !newTemplateContent.trim()}>
                    <Plus className="h-4 w-4 mr-2" />
                    Добавить шаблон
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>

        <Separator className="my-4" />
        
        <div className="text-xs text-muted-foreground">
          <p><strong>Подсказка:</strong> Используйте переменные в формате {'${variable}'} для динамического содержимого</p>
          <p className="mt-1">Пример: {'${new Date().toLocaleDateString()}'} будет заменено на текущую дату</p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
