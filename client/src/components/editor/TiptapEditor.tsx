import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import Typography from '@tiptap/extension-typography';
import { useEffect } from 'react';
import { useFileSystem } from '@/lib/mock-fs';
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
  Redo 
} from 'lucide-react';
import { Toggle } from '@/components/ui/toggle';
import { Separator } from '@/components/ui/separator';

export default function TiptapEditor() {
  const { items, activeFileId, updateFileContent } = useFileSystem();
  const activeFile = items.find(i => i.id === activeFileId);

  const editor = useEditor({
    extensions: [
      StarterKit,
      Typography,
      Placeholder.configure({
        placeholder: 'Начните писать...',
      }),
    ],
    editorProps: {
      attributes: {
        class: 'prose prose-neutral dark:prose-invert max-w-none focus:outline-none min-h-[calc(100vh-250px)] px-8 py-4 text-lg leading-relaxed',
      },
    },
    content: activeFile?.content || '',
    onUpdate: ({ editor }) => {
      if (activeFileId) {
        updateFileContent(activeFileId, editor.getHTML());
      }
    },
  });

  useEffect(() => {
    if (editor && activeFile) {
      if (editor.getHTML() !== activeFile.content) {
         editor.commands.setContent(activeFile.content || '');
      }
    }
  }, [activeFileId, editor, activeFile]);

  if (!activeFile) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-muted-foreground bg-background">
        <p className="text-sm opacity-50">Выберите или создайте заметку</p>
      </div>
    );
  }

  return (
    <div className="h-full w-full flex flex-col bg-background animate-in fade-in duration-300">
      {/* Toolbar */}
      <div className="flex items-center gap-1 p-2 border-b border-border bg-sidebar/50 backdrop-blur-sm">
        <div className="flex items-center gap-0.5">
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
        </div>
        <Separator orientation="vertical" className="h-4 mx-1" />
        <div className="flex items-center gap-0.5">
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
        <Separator orientation="vertical" className="h-4 mx-1" />
        <div className="flex items-center gap-0.5">
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
        <div className="ml-auto flex items-center gap-0.5">
          <button 
            onClick={() => editor?.chain().focus().undo().run()}
            disabled={!editor?.can().undo()}
            className="h-8 w-8 flex items-center justify-center hover:bg-accent rounded disabled:opacity-30 transition-colors"
          >
            <Undo className="h-4 w-4" />
          </button>
          <button 
            onClick={() => editor?.chain().focus().redo().run()}
            disabled={!editor?.can().redo()}
            className="h-8 w-8 flex items-center justify-center hover:bg-accent rounded disabled:opacity-30 transition-colors"
          >
            <Redo className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Editor Content */}
      <div className="flex-1 overflow-y-auto custom-scrollbar">
        <div className="max-w-3xl mx-auto py-12">
          <input
            type="text"
            value={activeFile.name}
            onChange={(e) => useFileSystem.getState().renameItem(activeFile.id, e.target.value)}
            className="text-4xl font-bold bg-transparent border-none outline-none w-full mb-8 text-foreground placeholder:text-muted-foreground/30 px-8"
            placeholder="Без названия"
          />
          <EditorContent editor={editor} />
        </div>
      </div>
    </div>
  );
}
