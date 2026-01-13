import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import Typography from '@tiptap/extension-typography';
import { useEffect } from 'react';
import { useFileSystem } from '@/lib/mock-fs';

export default function TiptapEditor() {
  const { items, activeFileId, updateFileContent } = useFileSystem();
  const activeFile = items.find(i => i.id === activeFileId);

  const editor = useEditor({
    extensions: [
      StarterKit,
      Typography,
      Placeholder.configure({
        placeholder: 'Start writing...',
      }),
    ],
    editorProps: {
      attributes: {
        class: 'prose prose-invert max-w-none focus:outline-none min-h-[calc(100vh-200px)]',
      },
    },
    content: activeFile?.content || '',
    onUpdate: ({ editor }) => {
      if (activeFileId) {
        // Debounce could be good here, but for local state it's fine
        updateFileContent(activeFileId, editor.getHTML());
      }
    },
  });

  // Sync editor content when active file changes
  useEffect(() => {
    if (editor && activeFile) {
      // Only set content if it's different to prevent cursor jumps
      // A simple check might fail with rich text, but strict equality of HTML strings works for basic cases
      if (editor.getHTML() !== activeFile.content) {
         editor.commands.setContent(activeFile.content || '');
      }
    }
  }, [activeFileId, editor, activeFile]);

  if (!activeFile) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
        <p>No file selected</p>
      </div>
    );
  }

  return (
    <div className="h-full w-full overflow-y-auto bg-background p-8 animate-in fade-in duration-300">
      <div className="max-w-3xl mx-auto">
        <input
          type="text"
          value={activeFile.name}
          onChange={(e) => useFileSystem.getState().renameItem(activeFile.id, e.target.value)}
          className="text-4xl font-bold bg-transparent border-none outline-none w-full mb-8 text-foreground placeholder:text-muted-foreground/50"
          placeholder="Untitled"
        />
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}
