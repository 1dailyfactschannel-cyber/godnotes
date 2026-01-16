import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import Typography from '@tiptap/extension-typography';
import { TextStyle } from '@tiptap/extension-text-style';
import { Link } from '@tiptap/extension-link';
import { Image } from '@tiptap/extension-image';
import { Youtube } from '@tiptap/extension-youtube';
import { Extension } from '@tiptap/core';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import { useEffect, useCallback, useRef, useState } from 'react';
import { useFileSystem } from '@/lib/mock-fs';
import { cn } from '@/lib/utils';
import { toast } from '@/hooks/use-toast';
import { 
  Bold,
  Italic,
  List,
  ListOrdered,
  Quote,
  Code,
  Heading1,
  Heading2,
  Undo,
  Redo,
  Download,
  Type,
  Link as LinkIcon,
  Image as ImageIcon,
  Video,
  BookOpen
} from 'lucide-react';
import { Toggle } from '@/components/ui/toggle';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
// @ts-ignore
import html2pdf from 'html2pdf.js';

const MAX_IMAGE_SIZE = 20 * 1024 * 1024;

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    fontSize: {
      setFontSize: (size: string) => ReturnType,
      unsetFontSize: () => ReturnType,
    }
  }
}

const FontSize = Extension.create({
  name: 'fontSize',
  addOptions() {
    return {
      types: ['textStyle'],
    };
  },
  addGlobalAttributes() {
    return [
      {
        types: ['textStyle'],
        attributes: {
          fontSize: {
            default: null,
            parseHTML: (element: HTMLElement) =>
              element.style.fontSize?.replace(/['"]+/g, '') ?? null,
            renderHTML: (attributes: Record<string, any>) => {
              if (!attributes.fontSize) {
                return {};
              }
              return {
                style: `font-size: ${attributes.fontSize}`,
              };
            },
          },
        },
      },
    ];
  },
  addCommands() {
    return {
      setFontSize: (fontSize: string) => ({ chain }) => {
        return chain().setMark('textStyle', { fontSize }).run();
      },
      unsetFontSize: () => ({ chain }) => {
        return chain()
          .setMark('textStyle', { fontSize: null })
          .removeEmptyTextStyle()
          .run();
      },
    };
  },
});

export default function TiptapEditor({ isReadOnly = false, searchTerm = '' }: { isReadOnly?: boolean; searchTerm?: string }) {
  const { items, activeFileId, updateFileContent } = useFileSystem();
  const activeFile = items.find(i => i.id === activeFileId);
  const titleInputRef = useRef<HTMLInputElement | null>(null);
  const [isLinkEditing, setIsLinkEditing] = useState(false);
  const [linkUrl, setLinkUrl] = useState('');
  const linkInputRef = useRef<HTMLInputElement | null>(null);
  const dropZoneRef = useRef<HTMLDivElement | null>(null);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [isSlashMenuOpen, setIsSlashMenuOpen] = useState(false);
  const [slashMenuPosition, setSlashMenuPosition] = useState<{ top: number; left: number } | null>(null);
  const slashMenuRef = useRef<HTMLDivElement | null>(null);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        // На некоторых версиях StarterKit уже включает link,
        // поэтому явно отключаем его, чтобы не было дубля.
        link: false as any,
      }),
      Typography,
      TextStyle,
      FontSize,
      TaskList,
      TaskItem.configure({
        nested: true,
        HTMLAttributes: {
          class: 'flex items-center gap-2 my-1',
        },
      }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          class: 'text-primary underline cursor-pointer',
        },
      }),
      Image.configure({
        HTMLAttributes: {
          class: 'rounded-lg max-w-full h-auto my-4',
        },
      }),
      Youtube.configure({
        HTMLAttributes: {
          class: 'rounded-lg overflow-hidden my-4',
        },
      }),
      Placeholder.configure({
        placeholder: 'Начните писать...',
      }),
    ],
    editorProps: {
      attributes: {
        class: 'prose prose-neutral dark:prose-invert max-w-none focus:outline-none min-h-[calc(100vh-250px)] px-8 py-4 text-lg leading-relaxed',
      },
      handleTextInput(view, from, to, text) {
        if (text === '/') {
          const coords = view.coordsAtPos(from);
          setSlashMenuPosition({
            top: coords.bottom,
            left: coords.left,
          });
          setIsSlashMenuOpen(true);
        }
        return false;
      },
      handleKeyDown(view, event) {
        if (event.key === 'Escape' && isSlashMenuOpen) {
          setIsSlashMenuOpen(false);
          setSlashMenuPosition(null);
          return true;
        }
        const isMod = event.metaKey || event.ctrlKey;
        if (isMod && event.key.toLowerCase() === 'b') {
          view.state.tr.setMeta('shortcut', true);
          editor?.chain().focus().toggleBold().run();
          event.preventDefault();
          return true;
        }
        if (isMod && event.key.toLowerCase() === 'i') {
          editor?.chain().focus().toggleItalic().run();
          event.preventDefault();
          return true;
        }
        if (isMod && event.key.toLowerCase() === 'k') {
          if (editor?.isActive('link')) {
            editor?.chain().focus().extendMarkRange('link').unsetLink().run();
          } else {
            setIsLinkEditing(true);
          }
          event.preventDefault();
          return true;
        }
        if (isMod && event.shiftKey && event.key === '7') {
          editor?.chain().focus().toggleOrderedList().run();
          event.preventDefault();
          return true;
        }
        return false;
      },
    },
    content: activeFile?.content || '',
    onUpdate: ({ editor }) => {
      if (activeFileId) {
        updateFileContent(activeFileId, editor.getHTML());
      }
    },
    editable: !isReadOnly,
  });

  const embedImageInline = useCallback(
    (file: File) => {
      if (!editor) return;
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result;
        if (typeof result === "string") {
          editor.chain().focus().setImage({ src: result }).run();
        }
      };
      reader.readAsDataURL(file);
    },
    [editor],
  );

  useEffect(() => {
    if (!editor || !searchTerm) return;
    const win: any = window;
    if (typeof win.find === 'function') {
      editor.commands.focus('start');
      win.find(searchTerm, false, false, true, false, false, false);
    }
  }, [editor, searchTerm, activeFileId]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (!slashMenuRef.current) return;
      if (!slashMenuRef.current.contains(event.target as Node)) {
        setIsSlashMenuOpen(false);
        setSlashMenuPosition(null);
      }
    };
    if (isSlashMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isSlashMenuOpen]);

  const applySlashCommand = (command: string) => {
    if (!editor) return;
    setIsSlashMenuOpen(false);
    setSlashMenuPosition(null);
    const chain = editor.chain().focus();
    if (command === 'heading1') {
      chain.toggleHeading({ level: 1 }).run();
      return;
    }
    if (command === 'heading2') {
      chain.toggleHeading({ level: 2 }).run();
      return;
    }
    if (command === 'bulletList') {
      chain.toggleBulletList().run();
      return;
    }
    if (command === 'orderedList') {
      chain.toggleOrderedList().run();
      return;
    }
    if (command === 'blockquote') {
      chain.toggleBlockquote().run();
      return;
    }
    if (command === 'codeBlock') {
      chain.toggleCodeBlock().run();
      return;
    }
    if (command === 'todo') {
      chain.toggleTaskList().run();
      return;
    }
    if (command === 'divider') {
      chain.setHorizontalRule().run();
      return;
    }
    if (command === 'image') {
      addImage();
      return;
    }
  };

  useEffect(() => {
    if (!editor || !dropZoneRef.current) return;

    const handleDragOver = (event: DragEvent) => {
      if (!event.dataTransfer) return;
      const hasFiles = Array.from(event.dataTransfer.items).some(
        (item) => item.kind === 'file' && item.type.startsWith('image/')
      );
      if (!hasFiles) return;
      event.preventDefault();
      event.dataTransfer.dropEffect = 'copy';
      setIsDraggingOver(true);
    };

    const handleDragLeave = (event: DragEvent) => {
      if (!dropZoneRef.current) return;
      if (!dropZoneRef.current.contains(event.relatedTarget as Node)) {
        setIsDraggingOver(false);
      }
    };

    const handleDrop = async (event: DragEvent) => {
      if (!event.dataTransfer) return;
      const files = Array.from(event.dataTransfer.files).filter((file) =>
        file.type.startsWith('image/')
      );
      if (files.length === 0) {
        setIsDraggingOver(false);
        return;
      }
      event.preventDefault();
      setIsDraggingOver(false);

      for (const file of files) {
        if (file.size > MAX_IMAGE_SIZE) {
          toast({
            variant: "destructive",
            title: "Слишком большой файл",
            description: "Максимальный размер изображения 20 МБ",
          });
          console.error("Image upload skipped: file too large", {
            name: file.name,
            size: file.size,
          });
          continue;
        }

        const formData = new FormData();
        formData.append('file', file);

        console.log("Starting image upload", {
          name: file.name,
          size: file.size,
        });

        await new Promise<void>((resolve) => {
          const xhr = new XMLHttpRequest();
          xhr.open('POST', '/api/uploads');
          xhr.withCredentials = true;

          xhr.upload.onprogress = (progressEvent) => {
            if (progressEvent.lengthComputable) {
              const percent = Math.round((progressEvent.loaded / progressEvent.total) * 100);
              setUploadProgress(percent);
            }
          };

          xhr.onload = () => {
            console.log("Image upload response", {
              status: xhr.status,
              responseText: xhr.responseText,
            });

            if (xhr.status >= 200 && xhr.status < 300) {
              try {
                const data = JSON.parse(xhr.responseText || '{}');
                if (data.url) {
                  editor.chain().focus().setImage({ src: data.url }).run();
                } else {
                  console.error("Image upload: no url in response", data);
                  embedImageInline(file);
                }
              } catch (e) {
                console.error("Image upload: failed to parse JSON", e, xhr.responseText);
                embedImageInline(file);
              }
            } else {
              try {
                const data = JSON.parse(xhr.responseText || '{}');
                const message = typeof data.message === 'string'
                  ? data.message
                  : "Не удалось загрузить изображение";
                console.error("Image upload failed", {
                  status: xhr.status,
                  data,
                });
                toast({
                  variant: "destructive",
                  title: "Ошибка загрузки",
                  description: message,
                });
                embedImageInline(file);
              } catch (e) {
                console.error("Image upload failed, response parse error", e, xhr.responseText);
                embedImageInline(file);
              }
            }
            setUploadProgress(null);
            resolve();
          };

          xhr.onerror = () => {
            console.error("Image upload network error", {
              status: xhr.status,
            });
            toast({
              variant: "destructive",
              title: "Ошибка сети",
              description: "Не удалось загрузить изображение",
            });
            embedImageInline(file);
            setUploadProgress(null);
            resolve();
          };

          setUploadProgress(0);
          xhr.send(formData);
        });
      }
    };

    const element = dropZoneRef.current;
    element.addEventListener('dragover', handleDragOver);
    element.addEventListener('dragleave', handleDragLeave);
    element.addEventListener('drop', handleDrop);

    return () => {
      element.removeEventListener('dragover', handleDragOver);
      element.removeEventListener('dragleave', handleDragLeave);
      element.removeEventListener('drop', handleDrop);
    };
  }, [editor]);

  useEffect(() => {
    if (editor) {
      editor.setEditable(!isReadOnly);
    }
  }, [isReadOnly, editor]);

  useEffect(() => {
    if (editor && activeFile) {
      if (editor.getHTML() !== activeFile.content) {
         editor.commands.setContent(activeFile.content || '');
      }
    }
  }, [activeFileId, editor, activeFile]);

  useEffect(() => {
    if (!editor || !activeFileId || isReadOnly) return;
    const { lastCreatedFileId } = useFileSystem.getState();
    if (lastCreatedFileId === activeFileId) {
      if (titleInputRef.current) {
        titleInputRef.current.focus();
        titleInputRef.current.select();
      }
      useFileSystem.setState({ lastCreatedFileId: null });
    } else {
      editor.commands.focus('end');
    }
  }, [editor, activeFileId, isReadOnly]);

  const applyLink = useCallback(() => {
    if (!editor) return;
    const url = linkUrl.trim();
    if (!url) {
      editor.chain().focus().extendMarkRange('link').unsetLink().run();
    } else {
      editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
    }
    setIsLinkEditing(false);
    setLinkUrl('');
  }, [editor, linkUrl]);

  const cancelLinkEditing = useCallback(() => {
    setIsLinkEditing(false);
    setLinkUrl('');
  }, []);

  const addImage = useCallback(() => {
    const url = window.prompt('URL изображения');

    if (url) {
      editor?.chain().focus().setImage({ src: url }).run();
    }
  }, [editor]);

  const addYoutubeVideo = useCallback(() => {
    const url = window.prompt('URL видео на YouTube');

    if (url) {
      editor?.chain().focus().setYoutubeVideo({ src: url }).run();
    }
  }, [editor]);

  const exportToPdf = () => {
    if (!activeFile) return;
    
    const element = document.createElement('div');
    element.innerHTML = `
      <div style="padding: 40px; font-family: sans-serif;">
        <h1 style="font-size: 32px; margin-bottom: 20px;">${activeFile.name}</h1>
        <div style="font-size: 16px; line-height: 1.6;">
          ${activeFile.content || ''}
        </div>
      </div>
    `;

    const opt = {
      margin:       10,
      filename:     `${activeFile.name}.pdf`,
      image:        { type: 'jpeg' as const, quality: 0.98 },
      html2canvas:  { scale: 2 },
      jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' }
    } as const;

    html2pdf().set(opt).from(element).save();
  };

  const exportToMarkdown = () => {
    if (!activeFile) return;
    const container = document.createElement('div');
    container.innerHTML = activeFile.content || '';
    const lines: string[] = [];
    const walk = (node: Node) => {
      if (node.nodeType === Node.TEXT_NODE) {
        const text = node.textContent || '';
        if (text.trim()) {
          lines.push(text);
        }
        return;
      }
      if (!(node instanceof HTMLElement)) {
        node.childNodes.forEach(walk);
        return;
      }
      const tag = node.tagName.toLowerCase();
      if (tag === 'li' && node.getAttribute('data-type') === 'taskItem') {
        const checkbox = node.querySelector('input[type="checkbox"]') as HTMLInputElement | null;
        const checked = checkbox?.checked;
        const text = node.textContent || '';
        lines.push(`- [${checked ? 'x' : ' '}] ${text}`);
      } else if (tag === 'h1') {
        lines.push('# ' + node.textContent);
      } else if (tag === 'h2') {
        lines.push('## ' + node.textContent);
      } else if (tag === 'h3') {
        lines.push('### ' + node.textContent);
      } else if (tag === 'li') {
        lines.push('- ' + node.textContent);
      } else if (tag === 'blockquote') {
        const text = node.textContent || '';
        lines.push('> ' + text);
      } else if (tag === 'code' || tag === 'pre') {
        const text = node.textContent || '';
        lines.push('```');
        lines.push(text);
        lines.push('```');
      } else if (tag === 'p') {
        const text = node.textContent || '';
        if (text.trim()) {
          lines.push(text);
          lines.push('');
        }
      } else {
        node.childNodes.forEach(walk);
        return;
      }
      node.childNodes.forEach(walk);
    };
    container.childNodes.forEach(walk);
    const markdown = lines.join('\n');
    const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${activeFile.name || 'note'}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  if (!activeFile) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-muted-foreground bg-background">
        <p className="text-sm opacity-50">Выберите или создайте заметку</p>
      </div>
    );
  }

  const fontSizes = [
    { label: 'Маленький', value: '12px' },
    { label: 'Обычный', value: '16px' },
    { label: 'Средний', value: '20px' },
    { label: 'Крупный', value: '24px' },
    { label: 'Огромный', value: '32px' },
  ];

  return (
    <div className="h-full w-full flex flex-col bg-background animate-in fade-in duration-300">
      {/* Reading Mode Overlay */}
      {isReadOnly && (
        <div className="absolute top-12 right-12 z-10 animate-in fade-in zoom-in duration-300">
          <div className="flex items-center gap-2 px-3 py-1.5 bg-primary/10 text-primary border border-primary/20 rounded-full text-[10px] font-bold uppercase tracking-widest backdrop-blur-md">
            <BookOpen className="h-3 w-3" /> Режим чтения
          </div>
        </div>
      )}

      {/* Toolbar */}
      {!isReadOnly && (
        <div className="flex items-center gap-1 p-2 border-b border-border bg-sidebar/50 backdrop-blur-sm overflow-x-auto no-scrollbar animate-in slide-in-from-top duration-300">
          <div className="flex items-center gap-0.5 shrink-0">
            <Select
              onValueChange={(value) => {
                if (value === 'unsetFontSize') {
                  (editor?.chain().focus() as any).unsetFontSize().run();
                } else {
                  (editor?.chain().focus() as any).setFontSize(value).run();
                }
              }}
            >
              <SelectTrigger className="h-8 w-[130px] text-xs bg-transparent border-none hover:bg-accent focus:ring-0">
                <Type className="h-3.5 w-3.5 mr-2" />
                <SelectValue placeholder="Размер" />
              </SelectTrigger>
              <SelectContent>
                {fontSizes.map(size => (
                  <SelectItem key={size.value} value={size.value}>
                    {size.label}
                  </SelectItem>
                ))}
                <SelectItem value="unsetFontSize">Сбросить</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Separator orientation="vertical" className="h-4 mx-1 shrink-0" />
          <div className="flex items-center gap-0.5 shrink-0">
            <Toggle 
              size="sm" 
              pressed={editor?.isActive('bold')} 
              onPressedChange={() => editor?.chain().focus().toggleBold().run()}
              className="h-8 w-8"
            >
              <Bold className="h-4 w-4" />
            </Toggle>
            <Toggle 
              size="sm" 
              pressed={editor?.isActive('italic')} 
              onPressedChange={() => editor?.chain().focus().toggleItalic().run()}
              className="h-8 w-8"
            >
              <Italic className="h-4 w-4" />
            </Toggle>
            <Toggle 
              size="sm" 
              pressed={editor?.isActive('code')} 
              onPressedChange={() => editor?.chain().focus().toggleCode().run()}
              className="h-8 w-8"
            >
              <Code className="h-4 w-4" />
            </Toggle>
            <Toggle 
              size="sm" 
              pressed={editor?.isActive('link') || isLinkEditing} 
              onPressedChange={() => {
                if (!editor) return;
                if (editor.isActive('link')) {
                  editor.chain().focus().extendMarkRange('link').unsetLink().run();
                  cancelLinkEditing();
                  return;
                }
                const previousUrl = editor.getAttributes('link').href || '';
                setLinkUrl(previousUrl);
                setIsLinkEditing(true);
                setTimeout(() => {
                  if (linkInputRef.current) {
                    linkInputRef.current.focus();
                    linkInputRef.current.select();
                  }
                }, 0);
              }}
              className="h-8 w-8"
            >
              <LinkIcon className="h-4 w-4" />
            </Toggle>
          </div>
          {isLinkEditing && (
            <div className="flex items-center gap-1 ml-2">
              <input
                ref={linkInputRef}
                type="text"
                value={linkUrl}
                onChange={(e) => setLinkUrl(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    applyLink();
                  }
                  if (e.key === 'Escape') {
                    cancelLinkEditing();
                  }
                }}
                className="h-8 w-48 text-xs px-2 py-1 rounded border border-border bg-background outline-none focus:border-primary"
                placeholder="Вставьте ссылку"
              />
              <Button
                variant="outline"
                size="sm"
                className="h-8 px-2 text-xs"
                onClick={applyLink}
              >
                ОК
              </Button>
            </div>
          )}
          <Separator orientation="vertical" className="h-4 mx-1 shrink-0" />
          <div className="flex items-center gap-0.5 shrink-0">
            <Button 
              variant="ghost" 
              size="sm" 
              className="h-8 w-8 p-0" 
              onClick={addImage}
              title="Добавить изображение"
            >
              <ImageIcon className="h-4 w-4" />
            </Button>
            <Button 
              variant="ghost" 
              size="sm" 
              className="h-8 w-8 p-0" 
              onClick={addYoutubeVideo}
              title="Добавить YouTube видео"
            >
              <Video className="h-4 w-4" />
            </Button>
          </div>
          <Separator orientation="vertical" className="h-4 mx-1 shrink-0" />
          <div className="flex items-center gap-0.5 shrink-0">
            <Toggle 
              size="sm" 
              pressed={editor?.isActive('heading', { level: 1 })} 
              onPressedChange={() => editor?.chain().focus().toggleHeading({ level: 1 }).run()}
              className="h-8 w-8"
            >
              <Heading1 className="h-4 w-4" />
            </Toggle>
            <Toggle 
              size="sm" 
              pressed={editor?.isActive('heading', { level: 2 })} 
              onPressedChange={() => editor?.chain().focus().toggleHeading({ level: 2 }).run()}
              className="h-8 w-8"
            >
              <Heading2 className="h-4 w-4" />
            </Toggle>
          </div>
          <Separator orientation="vertical" className="h-4 mx-1 shrink-0" />
          <div className="flex items-center gap-0.5 shrink-0">
            <Toggle 
              size="sm" 
              pressed={editor?.isActive('bulletList')} 
              onPressedChange={() => editor?.chain().focus().toggleBulletList().run()}
              className="h-8 w-8"
            >
              <List className="h-4 w-4" />
            </Toggle>
            <Toggle 
              size="sm" 
              pressed={editor?.isActive('orderedList')} 
              onPressedChange={() => editor?.chain().focus().toggleOrderedList().run()}
              className="h-8 w-8"
            >
              <ListOrdered className="h-4 w-4" />
            </Toggle>
            <Toggle 
              size="sm" 
              pressed={editor?.isActive('blockquote')} 
              onPressedChange={() => editor?.chain().focus().toggleBlockquote().run()}
              className="h-8 w-8"
            >
              <Quote className="h-4 w-4" />
            </Toggle>
          </div>
          <div className="ml-auto flex items-center gap-2 shrink-0">
            <div className="flex items-center gap-0.5 mr-2">
              <button 
                onClick={() => editor?.chain().focus().undo().run()}
                disabled={!editor?.can().undo()}
                className="h-8 w-8 flex items-center justify-center hover:bg-accent rounded disabled:opacity-30 transition-colors"
                title="Отменить"
              >
                <Undo className="h-4 w-4" />
              </button>
              <button 
                onClick={() => editor?.chain().focus().redo().run()}
                disabled={!editor?.can().redo()}
                className="h-8 w-8 flex items-center justify-center hover:bg-accent rounded disabled:opacity-30 transition-colors"
                title="Вернуть"
              >
                <Redo className="h-4 w-4" />
              </button>
            </div>
            <div className="hidden md:flex items-center gap-2 text-[10px] text-muted-foreground mr-4">
              <span>Ctrl+B</span>
              <span>Ctrl+I</span>
              <span>Ctrl+K</span>
              <span>Ctrl+Shift+7</span>
            </div>
            <Button 
              variant="outline" 
              size="sm" 
              className="h-8 gap-2 text-xs"
              onClick={exportToPdf}
            >
              <Download className="h-3.5 w-3.5" />
              Экспорт PDF
            </Button>
            <Button 
              variant="outline" 
              size="sm" 
              className="h-8 gap-2 text-xs"
              onClick={exportToMarkdown}
            >
              <Download className="h-3.5 w-3.5" />
              Экспорт MD
            </Button>
          </div>
        </div>
      )}

      {/* Editor Content */}
      <div
        ref={dropZoneRef}
        className={cn(
          "flex-1 overflow-y-auto custom-scrollbar transition-colors",
          isDraggingOver ? "bg-primary/5" : ""
        )}
      >
        <div className={cn("max-w-3xl mx-auto py-12 transition-all duration-500", isReadOnly ? "opacity-100 scale-100" : "")}>
          <input
            ref={titleInputRef}
            type="text"
            value={activeFile.name}
            readOnly={isReadOnly}
            onChange={(e) => useFileSystem.getState().renameItem(activeFile.id, e.target.value)}
            className={cn(
              "text-4xl font-bold bg-transparent border-none outline-none w-full mb-4 text-foreground placeholder:text-muted-foreground/30 px-8 transition-all",
              isReadOnly ? "cursor-default select-none" : ""
            )}
            placeholder="Без названия"
          />
          {isSlashMenuOpen && !isReadOnly && slashMenuPosition && (
            <div
              ref={slashMenuRef}
              className="z-20"
              style={{
                position: 'fixed',
                top: slashMenuPosition.top,
                left: slashMenuPosition.left,
              }}
            >
              <div className="inline-flex flex-col rounded-md border bg-popover shadow-md text-xs">
                <button
                  className="px-3 py-1.5 text-left hover:bg-accent"
                  onClick={() => applySlashCommand('heading1')}
                >
                  Заголовок 1
                </button>
                <button
                  className="px-3 py-1.5 text-left hover:bg-accent"
                  onClick={() => applySlashCommand('heading2')}
                >
                  Заголовок 2
                </button>
                <button
                  className="px-3 py-1.5 text-left hover:bg-accent"
                  onClick={() => applySlashCommand('bulletList')}
                >
                  Маркированный список
                </button>
                <button
                  className="px-3 py-1.5 text-left hover:bg-accent"
                  onClick={() => applySlashCommand('orderedList')}
                >
                  Нумерованный список
                </button>
                <button
                  className="px-3 py-1.5 text-left hover:bg-accent"
                  onClick={() => applySlashCommand('blockquote')}
                >
                  Цитата
                </button>
                <button
                  className="px-3 py-1.5 text-left hover:bg-accent"
                  onClick={() => applySlashCommand('codeBlock')}
                >
                  Код
                </button>
                <button
                  className="px-3 py-1.5 text-left hover:bg-accent"
                  onClick={() => applySlashCommand('divider')}
                >
                  Разделитель
                </button>
                <button
                  className="px-3 py-1.5 text-left hover:bg-accent"
                  onClick={() => applySlashCommand('image')}
                >
                  Изображение
                </button>
              </div>
            </div>
          )}
          {uploadProgress !== null && (
            <div className="px-8 mb-4">
              <div className="h-1 w-full bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary transition-all"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                Загрузка изображения: {uploadProgress}%
              </p>
            </div>
          )}
          <EditorContent editor={editor} />
        </div>
      </div>
    </div>
  );
}
