import { useEffect, useState } from 'react';
import { useRoute } from 'wouter';
import { databases, DATABASE_ID, COLLECTIONS } from '@/lib/appwrite';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Typography from '@tiptap/extension-typography';
import { TextStyle } from '@tiptap/extension-text-style';
import { Link } from '@tiptap/extension-link';
import { Youtube } from '@tiptap/extension-youtube';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import { Table } from '@tiptap/extension-table';
import { TableRow } from '@tiptap/extension-table-row';
import { TableCell } from '@tiptap/extension-table-cell';
import { TableHeader } from '@tiptap/extension-table-header';
import { CodeBlockLowlight } from '@tiptap/extension-code-block-lowlight';
import Highlight from '@tiptap/extension-highlight';
import { Color } from '@tiptap/extension-color';
import { common, createLowlight } from 'lowlight';
import { WikiLinkExtension } from '@/lib/tiptap-extensions/wiki-link';
import { MermaidExtension } from '@/lib/tiptap-extensions/mermaid';
import { ResizableImage } from '@/lib/tiptap-extensions/resizable-image';
import { Logo } from '@/components/Logo';
import { Button } from '@/components/ui/button';
import { Loader2, Globe } from 'lucide-react';
import { Extension } from '@tiptap/core';

const lowlight = createLowlight(common);

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
            parseHTML: element => element.style.fontSize.replace('px', ''),
            renderHTML: attributes => {
              if (!attributes.fontSize) {
                return {};
              }
              return {
                style: `font-size: ${attributes.fontSize}px`,
              };
            },
          },
        },
      },
    ];
  },
});

export default function SharedNotePage() {
    const [, params] = useRoute('/share/:noteId');
    const noteId = params?.noteId;
    const [content, setContent] = useState<string | null>(null);
    const [title, setTitle] = useState<string>('');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!noteId) return;
        
        const fetchNote = async () => {
            try {
                const note = await databases.getDocument(
                    DATABASE_ID, 
                    COLLECTIONS.NOTES, 
                    noteId
                );
                setContent(note.content || '');
                setTitle(note.title);
            } catch (e: any) {
                console.error("Failed to load shared note:", e);
                setError("Заметка не найдена или доступ ограничен.");
            } finally {
                setLoading(false);
            }
        };

        fetchNote();
    }, [noteId]);

    const editor = useEditor({
        extensions: [
            StarterKit,
            Typography,
            TextStyle,
            Link,
            Youtube,
            TaskList,
            TaskItem,
            Table,
            TableRow,
            TableCell,
            TableHeader,
            CodeBlockLowlight.configure({ lowlight }),
            Highlight,
            Color,
            WikiLinkExtension,
            MermaidExtension,
            ResizableImage,
            FontSize
        ],
        content: content,
        editable: false,
        editorProps: {
            attributes: {
                class: 'prose prose-invert max-w-none focus:outline-none min-h-[500px] p-8',
            },
        },
    }, [content]);

    if (loading) {
        return (
            <div className="flex h-screen items-center justify-center bg-background text-foreground">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex flex-col h-screen items-center justify-center bg-background text-foreground gap-4">
                <h1 className="text-2xl font-bold">Ошибка</h1>
                <p className="text-muted-foreground">{error}</p>
                <Button variant="outline" onClick={() => window.location.href = '/'}>
                    На главную
                </Button>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-background text-foreground flex flex-col">
            <header className="border-b border-border bg-card/50 backdrop-blur sticky top-0 z-10">
                <div className="container mx-auto max-w-4xl px-4 h-14 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Logo className="h-6 w-6" />
                        <span className="font-bold">Godnotes</span>
                    </div>
                    <Button size="sm" onClick={() => window.location.href = '/'}>
                        Создать свои заметки
                    </Button>
                </div>
            </header>
            
            <main className="flex-1 container mx-auto max-w-4xl px-4 py-8">
                <div className="mb-8">
                    <div className="flex items-center gap-2 mb-2">
                        <Globe className="h-4 w-4 text-blue-500" />
                        <span className="text-xs font-medium text-blue-500 uppercase tracking-widest">Публичная заметка</span>
                    </div>
                    <h1 className="text-4xl font-bold tracking-tight mb-2">{title}</h1>
                    <p className="text-sm text-muted-foreground">
                        Опубликовано через Godnotes
                    </p>
                </div>
                
                <div className="bg-card border border-border rounded-lg shadow-sm min-h-[500px]">
                     {editor && <EditorContent editor={editor} />}
                </div>
            </main>
        </div>
    );
}
