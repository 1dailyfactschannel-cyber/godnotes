

import { useEditor, EditorContent, ReactRenderer } from '@tiptap/react';
import { BubbleMenu } from '@tiptap/react/menus';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import Typography from '@tiptap/extension-typography';
import { TextStyle } from '@tiptap/extension-text-style';
import { Link } from '@tiptap/extension-link';
import { TemplatesManager } from '@/components/templates/TemplatesManager';
import { TextAlign } from '@tiptap/extension-text-align';
// import { Image } from '@tiptap/extension-image';
import { Youtube } from '@tiptap/extension-youtube';
import Heading from '@tiptap/extension-heading';
import { Extension, Editor, Range } from '@tiptap/core';

// Custom Heading with ID support for anchor links
const CustomHeading = Heading.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      id: {
        default: null,
        parseHTML: element => element.getAttribute('id'),
        renderHTML: attributes => {
          if (!attributes.id) {
            return {};
          }
          return { id: attributes.id };
        },
      },
    };
  },
}).configure({
  levels: [1, 2, 3],
});
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import { Table } from '@tiptap/extension-table';
import { TableRow } from '@tiptap/extension-table-row';
import { TableCell } from '@tiptap/extension-table-cell';
import { TableHeader } from '@tiptap/extension-table-header';
import { CodeBlockLowlight } from '@tiptap/extension-code-block-lowlight';

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    mermaid: {
      setMermaid: (options?: { src: string }) => ReturnType;
    };
  }
}

import Highlight from '@tiptap/extension-highlight';
import { Color } from '@tiptap/extension-color';

import { common, createLowlight } from 'lowlight';
import { WikiLinkExtension, WikiLinkList } from '@/lib/tiptap-extensions/wiki-link';
import { MermaidExtension } from '@/lib/tiptap-extensions/mermaid';
import { ResizableImage } from '@/lib/tiptap-extensions/resizable-image';
import { DiffMark } from '@/lib/tiptap-extensions/diff-mark';
import { DiffControl } from '@/components/editor/DiffControl';
import tippy from 'tippy.js';
import 'tippy.js/dist/tippy.css';
import { useEffect, useCallback, useRef, useState } from 'react';
import { useFileSystem } from '@/lib/data-store';
import { cn, isHotkeyMatch } from '@/lib/utils';
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
  BookOpen,
  Tag,
  Table as TableIcon,
  Workflow,
  Plus,
  Trash2,
  CheckSquare,
  File as FileIcon,
  Folder as FolderIcon,
  PaintBucket,
  Palette,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Search,
  History, 
  Sparkles,
  ListTree,
  LayoutTemplate,
  Check
} from 'lucide-react';

const lowlight = createLowlight(common);
import { Toggle } from '@/components/ui/toggle';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TagsDialog } from '@/components/tags/TagsDialog';
import { VersionHistoryDialog } from '@/components/editor/VersionHistoryDialog';
import { AIAssistantBubbleMenu } from '@/components/editor/AIAssistantBubbleMenu';
import { useEditorStore } from '@/lib/editor-store';
import { Logo } from '@/components/Logo';
import { LockScreen } from '@/components/protection/LockScreen';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ToastAction } from '@/components/ui/toast';
import { API_BASE_URL } from '@/lib/api';

const MAX_IMAGE_SIZE = 20 * 1024 * 1024;
const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

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

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import TurndownService from 'turndown';

export default function TiptapEditor({ isReadOnly = false, searchTerm = '' }: { isReadOnly?: boolean; searchTerm?: string }) {
  const { items, activeFileId, updateFileContent, applyTemplate, selectFile, hotkeys, unlockedNotes, lastSavedAt, lastSavedFileId, isOfflineMode } = useFileSystem();
  const { setEditor } = useEditorStore();
  const activeFile = items.find(i => i.id === activeFileId);

  // Handle WikiLink clicks and hovers
  useEffect(() => {
    const handleWikiLinkClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target.classList.contains('wiki-link')) {
        e.preventDefault();
        const id = target.getAttribute('data-id');
        if (id) {
          selectFile(id);
        }
      }
    };

    const handleMouseOver = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const wikiLink = target.closest('.wiki-link');
      if (wikiLink) {
        const id = wikiLink.getAttribute('data-id');
        if (id && id !== activeFileId) {
          const rect = wikiLink.getBoundingClientRect();
          if (previewTimerRef.current) clearTimeout(previewTimerRef.current);
          previewTimerRef.current = setTimeout(() => {
            setPreviewNoteId(id);
            setPreviewPosition({ top: rect.bottom + 5, left: rect.left });
          }, 400); // 400ms delay for hover
        }
      }
    };

    const handleMouseOut = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest('.wiki-link')) {
        if (previewTimerRef.current) clearTimeout(previewTimerRef.current);
        setPreviewNoteId(null);
      }
    };

    document.addEventListener('click', handleWikiLinkClick);
    document.addEventListener('mouseover', handleMouseOver);
    document.addEventListener('mouseout', handleMouseOut);
    return () => {
      document.removeEventListener('click', handleWikiLinkClick);
      document.removeEventListener('mouseover', handleMouseOver);
      document.removeEventListener('mouseout', handleMouseOut);
    };
  }, [selectFile, activeFileId]);
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
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [isTagsDialogOpen, setIsTagsDialogOpen] = useState(false);
  const [templates, setTemplates] = useState([
    {
      id: 'meeting-plan',
      name: 'План встречи',
      content: '<h2>План встречи</h2><p><strong>Дата:</strong> ${new Date().toLocaleDateString()}</p><p><strong>Участники:</strong> </p><h3>Повестка дня</h3><ul><li></li></ul><h3>Итоги</h3><ul><li></li></ul><h3>Задачи</h3><ul data-type="taskList"><li data-checked="false"></li></ul>',
      createdAt: Date.now(),
      updatedAt: Date.now()
    },
    {
      id: 'todo-list',
      name: 'Список дел',
      content: '<h2>✅ Список дел</h2><ul data-type="taskList"><li data-checked="false">Приоритет 1</li><li data-checked="false">Приоритет 2</li><li data-checked="false"></li></ul>',
      createdAt: Date.now(),
      updatedAt: Date.now()
    },
    {
      id: 'book-review',
      name: 'Рецензия на книгу',
      content: '<h2>📚 Рецензия на книгу</h2><p><strong>Автор:</strong> </p><p><strong>Оценка:</strong> ⭐⭐⭐⭐⭐</p><h3>Основные мысли</h3><blockquote></blockquote><h3>Что применить</h3><ul><li></li></ul>',
      createdAt: Date.now(),
      updatedAt: Date.now()
    },
    {
      id: 'technical-spec',
      name: 'Техническое задание',
      content: '<h2>📋 Техническое задание</h2><h3>1. Описание проекта</h3><p></p><h3>2. Функциональные требования</h3><ul><li></li></ul><h3>3. Стек технологий</h3><p></p>',
      createdAt: Date.now(),
      updatedAt: Date.now()
    }
  ]);

  const handleSaveTemplates = (newTemplates: typeof templates) => {
    setTemplates(newTemplates);
    localStorage.setItem('godnotes-templates', JSON.stringify(newTemplates));
  };

  // Загрузка шаблонов из localStorage при монтировании
  useEffect(() => {
    const savedTemplates = localStorage.getItem('godnotes-templates');
    if (savedTemplates) {
      try {
        setTemplates(JSON.parse(savedTemplates));
      } catch (e) {
        console.error('Failed to load templates from localStorage:', e);
      }
    }
  }, []);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [localSearchQuery, setLocalSearchQuery] = useState('');
  const [previewNoteId, setPreviewNoteId] = useState<string | null>(null);
  const [previewPosition, setPreviewPosition] = useState<{ top: number; left: number } | null>(null);
  const [headings, setHeadings] = useState<{ level: number; text: string; pos: number; id: string }[]>([]);
  const previewTimerRef = useRef<NodeJS.Timeout | null>(null);
  const [isSavedVisible, setIsSavedVisible] = useState(false);

  useEffect(() => {
    if (lastSavedFileId && activeFileId && lastSavedFileId === activeFileId && lastSavedAt) {
      setIsSavedVisible(true);
      const t = setTimeout(() => setIsSavedVisible(false), 2000);
      return () => clearTimeout(t);
    }
  }, [lastSavedAt, lastSavedFileId, activeFileId]);



  

  const findNext = () => {
    const win: any = window;
    if (typeof win.find === 'function' && localSearchQuery) {
      win.find(localSearchQuery, false, false, true, false, false, false);
    }
  };

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        // На некоторых версиях StarterKit уже включает link,
        // поэтому явно отключаем его, чтобы не было дубля.
        heading: false,
        link: false as any,
        codeBlock: false, // Disable default codeBlock to use lowlight
      }),
      CustomHeading,
      Typography,
      TextStyle,
      Color,
      FontSize,
      TextAlign.configure({
        types: ['heading', 'paragraph'],
      }),
      Highlight.configure({ multicolor: true }),
      TaskList,
      TaskItem.configure({
        nested: true,
        HTMLAttributes: {
          class: 'flex items-start gap-2 my-1',
        },
      }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          class: 'text-primary underline decoration-primary/30 underline-offset-4 hover:decoration-primary transition-colors cursor-pointer',
        },
      }),
      ResizableImage.configure({
        allowBase64: true,
      }),
      Youtube.configure({
        HTMLAttributes: {
          class: 'rounded-lg overflow-hidden my-4',
        },
        width: 480,
        height: 320,
      }),
      Placeholder.configure({
        placeholder: 'Начните писать...',
      }),
      Table.configure({
        resizable: true,
      }),
      TableRow,
      TableHeader,
      TableCell,
      CodeBlockLowlight.configure({
        lowlight,
      }),
      MermaidExtension,
      DiffMark,
      WikiLinkExtension.configure({
        suggestion: {
          render: () => {
            let component: any;
            let popup: any;

            return {
              onStart: (props: any) => {
                component = new ReactRenderer(WikiLinkList, {
                  props,
                  editor: props.editor,
                });

                if (!props.clientRect) {
                  return;
                }

                popup = tippy('body', {
                  getReferenceClientRect: props.clientRect,
                  appendTo: () => document.body,
                  content: component.element,
                  showOnCreate: true,
                  interactive: true,
                  trigger: 'manual',
                  placement: 'bottom-start',
                });
              },

              onUpdate(props: any) {
                component.updateProps(props);

                if (!props.clientRect) {
                  return;
                }

                popup[0].setProps({
                  getReferenceClientRect: props.clientRect,
                });
              },

              onKeyDown(props: any) {
                if (props.event.key === 'Escape') {
                  popup[0].hide();

                  return true;
                }

                return component.ref?.onKeyDown(props);
              },

              onExit() {
                popup[0].destroy();
                component.destroy();
              },
            };
          },
          items: ({ query }: { query: string }) => {
            return useFileSystem.getState().items
              .filter(item => item.name.toLowerCase().includes(query.toLowerCase()) && item.type === 'file')
              .slice(0, 5);
          },
        },
      }),
    ],
    editorProps: {
      attributes: {
        class: 'prose prose-neutral dark:prose-invert max-w-none focus:outline-none min-h-[calc(100vh-250px)] px-8 py-4 text-base leading-relaxed',
      },
      handleTextInput(view, from, to, text) {
        if (text === '/') {
          const coords = view.coordsAtPos(from);
          setTimeout(() => {
            setSlashMenuPosition({
              top: coords.bottom,
              left: coords.left,
            });
            setIsSlashMenuOpen(true);
          }, 0);
        }
        return false;
      },
      handleKeyDown(view, event) {
        if (event.key === 'Escape' && isSlashMenuOpen) {
          setTimeout(() => {
            setIsSlashMenuOpen(false);
            setSlashMenuPosition(null);
          }, 0);
          return true;
        }

        if (isHotkeyMatch(event, hotkeys.bold || 'Ctrl+B')) {
          view.state.tr.setMeta('shortcut', true);
          editor?.chain().focus().toggleBold().run();
          event.preventDefault();
          return true;
        }

        if (isHotkeyMatch(event, hotkeys.italic || 'Ctrl+I')) {
          editor?.chain().focus().toggleItalic().run();
          event.preventDefault();
          return true;
        }

        if (isHotkeyMatch(event, hotkeys.link || 'Ctrl+L')) {
          if (editor?.isActive('link')) {
            editor?.chain().focus().extendMarkRange('link').unsetLink().run();
          } else {
            setIsLinkEditing(true);
          }
          event.preventDefault();
          return true;
        }

        if (isHotkeyMatch(event, hotkeys.taskList || 'Ctrl+Shift+9')) {
          editor?.chain().focus().toggleTaskList().run();
          event.preventDefault();
          return true;
        }

        const isMod = event.metaKey || event.ctrlKey;
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
      updateHeadings();
    },
    editable: !isReadOnly,
  });

  useEffect(() => {
    setEditor(editor);
    return () => setEditor(null);
  }, [editor, setEditor]);

  const updateHeadings = useCallback(() => {
    if (!editor) return;
    const items: { level: number; text: string; pos: number; id: string }[] = [];
    editor.state.doc.descendants((node, pos) => {
      if (node.type.name === 'heading') {
        const text = node.textContent;
        const id = node.attrs.id || text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
        
        if (!node.attrs.id && id) {
          editor.commands.command(({ tr }) => {
            tr.setNodeMarkup(pos, undefined, { ...node.attrs, id });
            return true;
          });
        }

        items.push({
          level: node.attrs.level,
          text,
          pos,
          id
        });
      }
    });
    setHeadings(items);
  }, [editor]);

  useEffect(() => {
    if (!editor) return;
    updateHeadings();
  }, [editor, activeFileId, updateHeadings]);

  const uploadFiles = async (files: File[]) => {
    for (const file of files) {
      if (file.size > MAX_FILE_SIZE) {
        toast({
          variant: "destructive",
          title: "Слишком большой файл",
          description: "Максимальный размер файла 50 МБ",
        });
        console.error("File upload skipped: file too large", {
          name: file.name,
          size: file.size,
        });
        continue;
      }

      console.log("Starting file upload", {
        name: file.name,
        size: file.size,
        type: file.type
      });

      setUploadProgress(0);

      try {
        // Use local server upload
        const formData = new FormData();
        formData.append('file', file);

        const response = await fetch(`${API_BASE_URL}/uploads`, {
          method: 'POST',
          body: formData,
          headers: (() => {
            const token = localStorage.getItem('auth_token');
            return token ? { 'Authorization': `Bearer ${token}` } : {};
          })()
        });

        if (!response.ok) {
          if (response.status === 413) {
            toast({
              variant: "destructive",
              title: "Файл слишком большой",
              description: "Максимальный размер файла 50 МБ",
            });
          } else if (response.status === 401) {
            toast({
              variant: "destructive",
              title: "Не авторизовано",
              description: "Пожалуйста, войдите в систему снова",
            });
          } else {
            toast({
              variant: "destructive",
              title: `Ошибка загрузки (${response.status})`,
              description: "Попробуйте позже",
            });
          }
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const result = await response.json();
        const url = result.url; // This will be something like "/uploads/filename.ext"
        
        console.log("File uploaded successfully", { url });

        if (file.type.startsWith('image/')) {
            editor?.chain().focus().setImage({ src: url }).run();
        } else {
            // For non-image files, insert a link
            const linkText = file.name;
            editor
            ?.chain()
            .focus()
            .insertContent([
                {
                type: 'text',
                text: linkText,
                marks: [
                    {
                    type: 'link',
                    attrs: {
                        href: url,
                        target: '_blank',
                    },
                    },
                ],
                },
                {
                type: 'text',
                text: ' ',
                }
            ])
            .run();
        }

      } catch (error: any) {
          console.error("File upload failed", error);
          toast({
            variant: "destructive",
            title: "Ошибка загрузки",
            description: error.message || "Не удалось загрузить файл",
          });
          
          if (file.type.startsWith('image/')) {
             embedImageInline(file);
          }
      } finally {
        setUploadProgress(null);
      }
    }
  };

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
      setTimeout(() => {
        if (!editor.isDestroyed) {
          editor.commands.focus('start');
          win.find(searchTerm, false, false, true, false, false, false);
        }
      }, 0);
    }
  }, [editor, searchTerm, activeFileId]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (!slashMenuRef.current) return;
      if (!slashMenuRef.current.contains(event.target as Node)) {
        setTimeout(() => {
          setIsSlashMenuOpen(false);
          setSlashMenuPosition(null);
        }, 0);
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
    setTimeout(() => {
      setIsSlashMenuOpen(false);
      setSlashMenuPosition(null);
    }, 0);
    const chain = editor.chain().focus();
    if (command === 'heading1') {
      chain.unsetFontSize().toggleHeading({ level: 1 }).run();
      return;
    }
    if (command === 'heading2') {
      chain.unsetFontSize().toggleHeading({ level: 2 }).run();
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
    if (command === 'mermaid') {
      chain.setMermaid().run();
      return;
    }
    if (command === 'table') {
      chain.insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run();
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
        (item) => item.kind === 'file'
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
      const files = Array.from(event.dataTransfer.files);
      if (files.length === 0) {
        setIsDraggingOver(false);
        return;
      }
      event.preventDefault();
      setIsDraggingOver(false);

      await uploadFiles(files);
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
  }, [editor, uploadFiles]);

  useEffect(() => {
    if (editor) {
      setTimeout(() => {
        if (!editor.isDestroyed) {
          editor.setEditable(!isReadOnly);
        }
      }, 0);
    }
  }, [isReadOnly, editor]);

  useEffect(() => {
    if (editor && activeFile) {
      if (editor.getHTML() !== activeFile.content) {
        setTimeout(() => {
          if (!editor.isDestroyed) {
            editor.commands.setContent(activeFile.content || '');
          }
        }, 0);
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
      // Ensure editor is ready and not destroyed before focusing
      if (editor && !editor.isDestroyed) {
        try {
          setTimeout(() => {
            if (!editor.isDestroyed) {
              editor.commands.focus('end');
            }
          }, 0);
        } catch (e) {
          console.warn('Editor focus failed:', e);
        }
      }
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

  const exportToPdf = async () => {
    if (!activeFile) return;
    
    const title = activeFile.name;
    const content = activeFile.content || '';
    
    // Construct the full HTML document with styles
    const fullHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8">
          <title>${title}</title>
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
              padding: 40px;
              color: #000000;
              line-height: 1.6;
              max-width: 100%;
              overflow-x: hidden;
            }
            h1 {
              font-size: 28px;
              margin-bottom: 24px;
              color: #000000;
              border-bottom: 1px solid #eee;
              padding-bottom: 12px;
            }
            h2 { font-size: 24px; margin-top: 24px; margin-bottom: 16px; color: #000000; }
            h3 { font-size: 20px; margin-top: 20px; margin-bottom: 12px; color: #000000; }
            p { margin-bottom: 16px; color: #000000; }
            img {
              max-width: 100%;
              height: auto;
              margin: 16px 0;
            }
            a {
              color: #000000;
              text-decoration: underline;
            }
            blockquote {
              border-left: 3px solid #ccc;
              margin-left: 0;
              padding-left: 1em;
              color: #444;
              font-style: italic;
            }
            code {
              background-color: #f5f5f5;
              padding: 0.2em 0.4em;
              border-radius: 3px;
              font-family: monospace;
              font-size: 0.9em;
            }
            pre {
              background-color: #f5f5f5;
              padding: 1em;
              border-radius: 5px;
              overflow-x: auto;
              margin-bottom: 16px;
            }
            pre code {
              background-color: transparent;
              padding: 0;
            }
            ul, ol {
              margin-bottom: 16px;
              padding-left: 24px;
            }
            li { margin-bottom: 8px; }
            ul[data-type="taskList"] {
              list-style: none;
              padding: 0;
            }
            li[data-type="taskItem"] {
              display: flex;
              align-items: flex-start;
              margin-bottom: 0.5rem;
            }
            input[type="checkbox"] {
                margin-right: 0.5rem;
                margin-top: 0.3rem;
            }
            table {
              border-collapse: collapse;
              width: 100%;
              margin-bottom: 16px;
            }
            th, td {
              border: 1px solid #ddd;
              padding: 8px;
              text-align: left;
            }
            th {
              background-color: #f5f5f5;
              font-weight: bold;
            }
            .mermaid {
              display: flex;
              justify-content: center;
              margin: 16px 0;
            }
          </style>
        </head>
        <body>
          <h1>${title}</h1>
          <div class="content">
            ${content}
          </div>
        </body>
      </html>
    `;

    try {
        if (window.electron && window.electron.exportToPdf) {
             const result = await window.electron.exportToPdf(fullHtml, `${activeFile.name}.pdf`);
             if (result.success) {
                 toast({
                     title: "Экспорт завершен",
                     description: `Файл сохранен: ${result.filePath}`,
                 });
             } else {
                 if (result.error !== 'Cancelled') {
                     toast({
                         title: "Ошибка экспорта",
                         description: result.error || "Не удалось сохранить файл",
                         variant: "destructive",
                     });
                 }
             }
        } else {
            // Fallback for web mode (print)
             const iframe = document.createElement('iframe');
             iframe.style.position = 'fixed';
             iframe.style.right = '0';
             iframe.style.bottom = '0';
             iframe.style.width = '0';
             iframe.style.height = '0';
             iframe.style.border = '0';
             document.body.appendChild(iframe);
         
             const iframeWindow = iframe.contentWindow;
             if (!iframeWindow) {
                 document.body.removeChild(iframe);
                 return;
             }
         
             iframeWindow.document.open();
             iframeWindow.document.write(fullHtml);
             iframeWindow.document.close();
         
             iframeWindow.onload = () => {
                 iframeWindow.focus();
                 iframeWindow.print();
                 setTimeout(() => {
                     document.body.removeChild(iframe);
                 }, 1000);
             };
        }
    } catch (error) {
        console.error('Export failed:', error);
        toast({
            title: "Ошибка",
            description: "Произошла ошибка при экспорте",
            variant: "destructive",
        });
    }
  };

  const handleExportMarkdown = () => {
    if (!editor || !activeFile) return;

    const html = editor.getHTML();
    const turndownService = new TurndownService({
      headingStyle: 'atx',
      codeBlockStyle: 'fenced',
      hr: '---',
      bulletListMarker: '-',
      strongDelimiter: '**',
      emDelimiter: '_',
    });

    // Добавляем правило для сохранения переносов строк (br)
    turndownService.addRule('br', {
      filter: 'br',
      replacement: () => '  \n'
    });

    // Правило для пустых параграфов, чтобы они не пропадали
    turndownService.addRule('emptyParagraph', {
      filter: (node) => {
        return node.nodeName === 'P' && node.innerHTML === '<br>';
      },
      replacement: () => '\n\n'
    });

    const markdown = turndownService.turndown(html);
    
    const blob = new Blob([markdown], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${activeFile.name}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };


  const fontSizes = [
    { label: 'Маленький', value: '12px' },
    { label: 'Обычный', value: '16px' },
    { label: 'Средний', value: '20px' },
    { label: 'Крупный', value: '24px' },
    { label: 'Огромный', value: '32px' },
  ];

  if (!activeFile) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-muted-foreground bg-background/50 animate-in fade-in duration-500">
        <div className="w-16 h-16 mb-4 opacity-10">
          <Logo className="w-full h-full" />
        </div>
        <p className="text-sm font-medium tracking-tight opacity-40 uppercase">Godnotes</p>
        <p className="text-[11px] opacity-30 mt-1">Выберите заметку в дереве файлов или создайте новую</p>
      </div>
    );
  }

  if (activeFile.type === 'folder') {
    return (
      <div className="flex flex-col items-center justify-center h-full text-muted-foreground bg-background/50 animate-in fade-in duration-500">
        <FolderIcon className="w-16 h-16 mb-4 opacity-10" />
        <h2 className="text-xl font-medium tracking-tight opacity-40 uppercase">{activeFile.name}</h2>
        <p className="text-[11px] opacity-30 mt-1">Папка выбрана. Создайте файл внутри.</p>
      </div>
    );
  }

  if (activeFile?.isProtected && !unlockedNotes.includes(activeFile.id)) {
    return (
        <div className="h-full w-full bg-background relative flex items-center justify-center">
            <LockScreen noteId={activeFile.id} />
        </div>
    );
  }

  return (
    <div className="h-full w-full flex flex-col bg-background animate-in fade-in duration-300">
      <TagsDialog 
        itemId={activeFileId} 
        open={isTagsDialogOpen} 
        onOpenChange={setIsTagsDialogOpen} 
      />

      <VersionHistoryDialog 
        fileId={activeFileId || ''}
        open={isHistoryOpen}
        onOpenChange={setIsHistoryOpen}
      />

      {/* Reading Mode Overlay */}
      {isReadOnly && (
        <div className="absolute top-12 right-12 z-10 animate-in fade-in zoom-in duration-300">
          <div className="flex items-center gap-2 px-3 py-1.5 bg-primary/10 text-primary border border-primary/20 rounded-full text-[10px] font-bold uppercase tracking-widest backdrop-blur-md">
            <BookOpen className="h-3 w-3" /> Режим чтения
          </div>
        </div>
      )}
      
      {!isReadOnly && isSavedVisible && (
        <div className="absolute bottom-12 right-48 z-10 animate-in fade-in zoom-in duration-300">
          <div className="flex items-center gap-2 px-3 py-1.5 bg-secondary/30 border border-border rounded-full text-xs">
            <Check className="h-4 w-4 text-green-600" />
            данные сохранены
          </div>
        </div>
      )}

      {/* Toolbar */}
      {!isReadOnly && (
        <div className="flex items-center gap-1 p-2 border-b border-border bg-sidebar/50 backdrop-blur-sm overflow-x-auto no-scrollbar animate-in slide-in-from-top duration-300">
          <div className="flex items-center gap-0.5 shrink-0">
            <Popover>
              <Tooltip>
                <TooltipTrigger asChild>
                  <PopoverTrigger asChild>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="h-8 w-8 p-0"
                    >
                      <LayoutTemplate className="h-4 w-4" />
                    </Button>
                  </PopoverTrigger>
                </TooltipTrigger>
                <TooltipContent>Вставить шаблон</TooltipContent>
              </Tooltip>
              <PopoverContent align="start" className="w-56 p-2 bg-popover/95 backdrop-blur-sm border-sidebar-border shadow-xl">
                <div className="text-[10px] font-bold text-muted-foreground px-2 py-1 uppercase tracking-widest mb-1">
                  Выберите шаблон
                </div>
                <div className="flex flex-col gap-1 mb-2">
                  {templates.map((template) => (
                    <Button
                      key={template.id}
                      variant="ghost"
                      size="sm"
                      className="justify-start font-normal text-xs h-8"
                      onClick={() => {
                        if (activeFileId) {
                          // Process template variables
                          const processedContent = template.content.replace(/\$\{([^}]+)\}/g, (match, expr) => {
                            try {
                              return eval(expr);
                            } catch (e) {
                              return match; // Return original if evaluation fails
                            }
                          });
                          
                          applyTemplate(activeFileId, processedContent);
                          toast({
                            title: "Шаблон применен",
                            description: `Добавлен шаблон: ${template.name}`
                          });
                        }
                      }}
                    >
                      {template.name}
                    </Button>
                  ))}
                </div>
                <Separator className="my-2" />
                <TemplatesManager 
                  templates={templates} 
                  onSaveTemplates={handleSaveTemplates}
                />
              </PopoverContent>
            </Popover>
          </div>
          <Separator orientation="vertical" className="h-4 mx-1 shrink-0" />
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
             <Button 
              variant="ghost" 
              size="sm" 
              className="h-8 w-8 p-0" 
              onClick={() => editor?.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}
              title="Добавить таблицу"
            >
              <TableIcon className="h-4 w-4" />
            </Button>
            <Button 
              variant="ghost" 
              size="sm" 
              className="h-8 w-8 p-0" 
              onClick={() => editor?.chain().focus().setMermaid().run()}
              title="Добавить диаграмму Mermaid"
            >
              <Workflow className="h-4 w-4" />
            </Button>
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
            
            {/* Выравнивание текста */}
            <Separator orientation="vertical" className="h-4 mx-1" />
            <Toggle 
              size="sm" 
              pressed={editor?.isActive({ textAlign: 'left' })} 
              onPressedChange={() => editor?.chain().focus().setTextAlign('left').run()}
              className="h-8 w-8"
              title="Выравнять по левому краю"
            >
              <AlignLeft className="h-4 w-4" />
            </Toggle>
            <Toggle 
              size="sm" 
              pressed={editor?.isActive({ textAlign: 'center' })} 
              onPressedChange={() => editor?.chain().focus().setTextAlign('center').run()}
              className="h-8 w-8"
              title="Выравнять по центру"
            >
              <AlignCenter className="h-4 w-4" />
            </Toggle>
            <Toggle 
              size="sm" 
              pressed={editor?.isActive({ textAlign: 'right' })} 
              onPressedChange={() => editor?.chain().focus().setTextAlign('right').run()}
              className="h-8 w-8"
              title="Выравнять по правому краю"
            >
              <AlignRight className="h-4 w-4" />
            </Toggle>
            
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className={cn("h-8 w-8 p-0", editor?.getAttributes('textStyle').color ? "bg-accent" : "")}
                  title="Цвет текста"
                >
                  <Palette className="h-4 w-4" style={{ color: editor?.getAttributes('textStyle').color }} />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-2" align="start">
                <div className="flex gap-1 flex-wrap max-w-[160px]">
                  {['#000000', '#64748b', '#ef4444', '#f97316', '#f59e0b', '#22c55e', '#3b82f6', '#a855f7', '#ec4899', 'reset'].map((color) => (
                    <button
                      key={color}
                      onClick={() => {
                        if (color === 'reset') {
                          editor?.chain().focus().unsetColor().run();
                        } else {
                          editor?.chain().focus().setColor(color).run();
                        }
                      }}
                      className={cn(
                        "w-6 h-6 rounded border cursor-pointer hover:scale-110 transition-transform",
                        color === 'reset' ? "bg-background relative after:content-[''] after:absolute after:inset-0 after:m-auto after:w-full after:h-[1px] after:bg-red-500 after:rotate-45" : ""
                      )}
                      style={{ backgroundColor: color !== 'reset' ? color : undefined }}
                      title={color === 'reset' ? "Сбросить цвет" : color}
                    />
                  ))}
                </div>
              </PopoverContent>
            </Popover>

            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className={cn("h-8 w-8 p-0", editor?.isActive('highlight') ? "text-yellow-500 bg-accent" : "")}
                  title="Цвет выделения"
                >
                  <PaintBucket className="h-4 w-4" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-2" align="start">
                <div className="flex gap-1">
                  {['#fef08a', '#bbf7d0', '#bfdbfe', '#fbcfe8', '#ddd6fe', 'transparent'].map((color) => (
                    <button
                      key={color}
                      onClick={() => {
                        if (color === 'transparent') {
                          editor?.chain().focus().unsetHighlight().run();
                        } else {
                          editor?.chain().focus().toggleHighlight({ color }).run();
                        }
                      }}
                      className={cn(
                        "w-6 h-6 rounded border cursor-pointer hover:scale-110 transition-transform",
                        color === 'transparent' ? "bg-background relative after:content-[''] after:absolute after:inset-0 after:m-auto after:w-full after:h-[1px] after:bg-red-500 after:rotate-45" : ""
                      )}
                      style={{ backgroundColor: color !== 'transparent' ? color : undefined }}
                      title={color === 'transparent' ? "Убрать выделение" : color}
                    />
                  ))}
                </div>
              </PopoverContent>
            </Popover>

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
              onPressedChange={() => editor?.chain().focus().unsetFontSize().toggleHeading({ level: 1 }).run()}
              className="h-8 w-8"
            >
              <Heading1 className="h-4 w-4" />
            </Toggle>
            <Toggle 
              size="sm" 
              pressed={editor?.isActive('heading', { level: 2 })} 
              onPressedChange={() => editor?.chain().focus().unsetFontSize().toggleHeading({ level: 2 }).run()}
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
              pressed={editor?.isActive('taskList')} 
              onPressedChange={() => editor?.chain().focus().toggleTaskList().run()}
              className="h-8 w-8"
            >
              <CheckSquare className="h-4 w-4" />
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
          <div className="ml-auto flex items-center gap-0.5 shrink-0">
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
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 px-0"
              onClick={() => setIsHistoryOpen(true)}
              title="История версий"
            >
              <History className="h-4 w-4" />
            </Button>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="ghost" size="sm" className="h-8 w-8 px-0" title="Поиск в заметке">
                  <Search className="h-4 w-4" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-80 p-2" align="end">
                <div className="flex gap-2">
                  <Input 
                    placeholder="Найти в заметке..." 
                    value={localSearchQuery}
                    onChange={(e) => setLocalSearchQuery(e.target.value)}
                    onKeyDown={(e) => {
                       if (e.key === 'Enter') {
                         findNext();
                       }
                    }}
                    className="h-8 text-xs"
                    autoFocus
                  />
                  <Button size="sm" className="h-8" onClick={findNext}>Найти</Button>
                </div>
              </PopoverContent>
            </Popover>

            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className={cn(
                    "h-8 w-8 px-0",
                    headings.length > 0 && "text-primary"
                  )}
                  title="Оглавление"
                >
                  <ListTree className="h-4 w-4" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-64 p-0" align="end">
                <div className="p-3 border-b border-border/50 bg-muted/20">
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Оглавление</h4>
                </div>
                <ScrollArea className="max-h-[400px]">
                  <div className="p-2">
                    {headings.length === 0 ? (
                      <div className="p-4 text-center text-xs text-muted-foreground italic">
                        Заголовки не найдены
                      </div>
                    ) : (
                      headings.map((heading, index) => (
                        <button
                          key={`${heading.pos}-${index}`}
                          onClick={() => {
                            // Focus the editor
                            editor?.commands.focus();
                            
                            // Scroll to the heading by its ID
                            const element = document.getElementById(heading.id);
                            if (element) {
                              element.scrollIntoView({ behavior: 'smooth', block: 'center' });
                              
                              // Highlight the heading temporarily
                              element.classList.add('bg-primary/20');
                              setTimeout(() => element.classList.remove('bg-primary/20'), 2000);
                            } else {
                              // Fallback to position if ID not found
                              editor?.commands.focus(heading.pos);
                            }
                          }}
                          className={cn(
                            "w-full text-left px-2 py-1.5 rounded-md text-xs transition-colors hover:bg-accent hover:text-accent-foreground flex items-center gap-2",
                            heading.level === 1 && "font-semibold",
                            heading.level === 2 && "pl-4",
                            heading.level === 3 && "pl-8"
                          )}
                        >
                          <span className="opacity-40 font-mono text-[10px]">H{heading.level}</span>
                          <span className="truncate">{heading.text}</span>
                        </button>
                      ))
                    )}
                  </div>
                </ScrollArea>
              </PopoverContent>
            </Popover>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 px-0"
              onClick={() => setIsTagsDialogOpen(true)}
              title="Теги"
            >
              <Tag className={cn("h-4 w-4", activeFile?.tags?.length ? "text-blue-400 fill-blue-400" : "")} />
            </Button>
            <Separator orientation="vertical" className="h-4 mx-1" />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 px-0"
                  title="Экспорт"
                >
                  <Download className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={exportToPdf}>
                  Скачать PDF
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleExportMarkdown}>
                  Скачать Markdown
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
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
        {editor && (
          <>
          <DiffControl editor={editor} />
          <AIAssistantBubbleMenu editor={editor} />
          <BubbleMenu editor={editor} shouldShow={({ editor }) => editor.isActive('table')}>
            <div className="flex items-center gap-1 p-1 rounded-md border bg-popover shadow-md overflow-hidden">
              <Button 
                variant="ghost" 
                size="sm" 
                className="h-8 px-2 text-xs" 
                onClick={() => editor.chain().focus().addColumnBefore().run()}
                title="Добавить колонку слева"
              >
                +Кол.Сл
              </Button>
              <Button 
                variant="ghost" 
                size="sm" 
                className="h-8 px-2 text-xs" 
                onClick={() => editor.chain().focus().addColumnAfter().run()}
                title="Добавить колонку справа"
              >
                +Кол.Сп
              </Button>
              <Button 
                variant="ghost" 
                size="sm" 
                className="h-8 px-2 text-xs" 
                onClick={() => editor.chain().focus().deleteColumn().run()}
                title="Удалить колонку"
              >
                -Кол
              </Button>
              <Separator orientation="vertical" className="h-4 mx-1" />
              <Button 
                variant="ghost" 
                size="sm" 
                className="h-8 px-2 text-xs" 
                onClick={() => editor.chain().focus().addRowBefore().run()}
                title="Добавить строку сверху"
              >
                +Стр.Вв
              </Button>
              <Button 
                variant="ghost" 
                size="sm" 
                className="h-8 px-2 text-xs" 
                onClick={() => editor.chain().focus().addRowAfter().run()}
                title="Добавить строку снизу"
              >
                +Стр.Низ
              </Button>
              <Button 
                variant="ghost" 
                size="sm" 
                className="h-8 px-2 text-xs" 
                onClick={() => editor.chain().focus().deleteRow().run()}
                title="Удалить строку"
              >
                -Стр
              </Button>
              <Separator orientation="vertical" className="h-4 mx-1" />
              <Button 
                variant="ghost" 
                size="sm" 
                className="h-8 px-2 text-xs" 
                onClick={() => editor.chain().focus().mergeCells().run()}
                title="Объединить ячейки"
              >
                Merge
              </Button>
              <Button 
                variant="ghost" 
                size="sm" 
                className="h-8 w-8 p-0 text-destructive hover:text-destructive" 
                onClick={() => editor.chain().focus().deleteTable().run()}
                title="Удалить таблицу"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </BubbleMenu>
          </>
        )}

        <div className={cn("max-w-3xl mx-auto py-12 transition-all duration-500", isReadOnly ? "opacity-100 scale-100" : "")}>
          <input
            type="file"
            ref={fileInputRef}
            className="hidden"
            onChange={(e) => {
              const files = e.target.files ? Array.from(e.target.files) : [];
              if (files.length > 0) {
                uploadFiles(files);
              }
              // Reset input value to allow selecting the same file again
              if (fileInputRef.current) {
                fileInputRef.current.value = '';
              }
            }}
          />
          <input
            ref={titleInputRef}
            type="text"
            value={activeFile.name}
            readOnly={isReadOnly}
            onChange={(e) => useFileSystem.getState().renameItem(activeFile.id, e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                e.stopPropagation();
                if (!isReadOnly) {
                  editor?.commands.focus('start');
                }
              }
            }}
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
                  onClick={() => applySlashCommand('mermaid')}
                >
                  Диаграмма Mermaid
                </button>
                <button
                  className="px-3 py-1.5 text-left hover:bg-accent"
                  onClick={() => applySlashCommand('table')}
                >
                  Таблица
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
          
          {/* Backlinks Section */}
          {activeFile.backlinks && activeFile.backlinks.length > 0 && (
            <div className="mt-12 pt-8 border-t border-border/50 px-8">
              <div className="flex items-center gap-2 mb-4 text-muted-foreground">
                <LinkIcon className="h-4 w-4" />
                <h3 className="text-sm font-semibold uppercase tracking-wider">Обратные ссылки ({activeFile.backlinks.length})</h3>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {activeFile.backlinks.map(backlinkId => {
                  const backlinkFile = items.find(i => i.id === backlinkId);
                  if (!backlinkFile) return null;
                  return (
                    <button
                      key={backlinkId}
                      onClick={() => selectFile(backlinkId)}
                      className="flex items-start gap-3 p-3 rounded-lg border border-border/40 bg-muted/30 hover:bg-accent/50 hover:border-accent transition-all text-left group"
                    >
                      <div className="mt-0.5">
                        <FileIcon className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
                      </div>
                      <div className="flex-1 overflow-hidden">
                        <div className="text-sm font-medium truncate group-hover:text-primary transition-colors">
                          {backlinkFile.name}
                        </div>
                        {backlinkFile.content && (
                          <div className="text-xs text-muted-foreground line-clamp-1 mt-0.5 opacity-70">
                            {backlinkFile.content.replace(/<[^>]*>/g, ' ').substring(0, 100)}
                          </div>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {previewNoteId && previewPosition && (
        <NotePreview id={previewNoteId} position={previewPosition} />
      )}
    </div>
  );
}

// Hover Preview Component
function NotePreview({ id, position }: { id: string; position: { top: number; left: number } }) {
  const { items } = useFileSystem();
  const note = items.find(i => i.id === id);

  if (!note) return null;

  return (
    <div 
      className="fixed z-[1000] w-72 bg-popover border border-border shadow-xl rounded-lg overflow-hidden animate-in fade-in zoom-in-95 duration-200 pointer-events-none"
      style={{ top: position.top, left: position.left }}
    >
      <div className="p-3 border-b border-border/50 bg-muted/30">
        <div className="flex items-center gap-2">
          <FileIcon className="h-4 w-4 text-primary" />
          <span className="text-sm font-semibold truncate">{note.name}</span>
        </div>
      </div>
      <div className="p-3 max-h-48 overflow-hidden">
        <div 
          className="text-[10px] leading-relaxed text-muted-foreground line-clamp-6 prose-xs dark:prose-invert"
          dangerouslySetInnerHTML={{ __html: note.content || 'Нет содержимого' }}
        />
      </div>
      {note.tags && note.tags.length > 0 && (
        <div className="px-3 pb-3 flex flex-wrap gap-1">
          {note.tags.map(tag => (
            <span key={tag} className="text-[9px] px-1 py-0.5 bg-primary/10 text-primary rounded-md">
              #{tag}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
