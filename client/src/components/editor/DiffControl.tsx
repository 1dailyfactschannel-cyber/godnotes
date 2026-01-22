import { Editor } from '@tiptap/react';
import { Button } from '@/components/ui/button';
import { Check, X } from 'lucide-react';
import { useEffect, useState } from 'react';

interface DiffControlProps {
  editor: Editor | null;
}

export function DiffControl({ editor }: DiffControlProps) {
  const [hasDiff, setHasDiff] = useState(false);

  useEffect(() => {
    if (!editor) return;

    const updateDiffStatus = () => {
      let found = false;
      editor.state.doc.descendants((node) => {
        if (node.marks && node.marks.find(m => m.type.name === 'diff')) {
          found = true;
          return false; // stop traversal
        }
        return true;
      });
      setHasDiff(found);
    };

    editor.on('update', updateDiffStatus);
    editor.on('selectionUpdate', updateDiffStatus);
    
    // Initial check
    updateDiffStatus();

    return () => {
      editor.off('update', updateDiffStatus);
      editor.off('selectionUpdate', updateDiffStatus);
    };
  }, [editor]);

  if (!hasDiff) return null;

  const acceptChanges = () => {
    if (!editor) return;
    
    // 1. Delete 'removed' parts
    editor.commands.command(({ tr, state, dispatch }) => {
       const rangesToDelete: { from: number; to: number }[] = [];
       state.doc.descendants((node, pos) => {
          const diffMark = node.marks.find(m => m.type.name === 'diff');
          if (diffMark && diffMark.attrs.type === 'removed') {
            rangesToDelete.push({ from: pos, to: pos + node.nodeSize });
          }
       });
       
       if (dispatch) {
         rangesToDelete.sort((a, b) => b.from - a.from).forEach(range => {
           tr.delete(range.from, range.to);
         });
       }
       return true;
    });
    
    // 2. Unmark 'added' parts (keep text)
    editor.commands.command(({ tr, state, dispatch }) => {
       const rangesToUnmark: { from: number; to: number }[] = [];
       state.doc.descendants((node, pos) => {
          const diffMark = node.marks.find(m => m.type.name === 'diff');
          if (diffMark && diffMark.attrs.type === 'added') {
            rangesToUnmark.push({ from: pos, to: pos + node.nodeSize });
          }
       });
       
       if (dispatch) {
         rangesToUnmark.forEach(range => {
           tr.removeMark(range.from, range.to, state.schema.marks.diff);
         });
       }
       return true;
    });
  };

  const rejectChanges = () => {
    if (!editor) return;
    
    // 1. Delete 'added' parts
    editor.commands.command(({ tr, state, dispatch }) => {
       const rangesToDelete: { from: number; to: number }[] = [];
       state.doc.descendants((node, pos) => {
          const diffMark = node.marks.find(m => m.type.name === 'diff');
          if (diffMark && diffMark.attrs.type === 'added') {
            rangesToDelete.push({ from: pos, to: pos + node.nodeSize });
          }
       });
       
       if (dispatch) {
         rangesToDelete.sort((a, b) => b.from - a.from).forEach(range => {
           tr.delete(range.from, range.to);
         });
       }
       return true;
    });
    
    // 2. Unmark 'removed' parts (restore text)
    editor.commands.command(({ tr, state, dispatch }) => {
       const rangesToUnmark: { from: number; to: number }[] = [];
       state.doc.descendants((node, pos) => {
          const diffMark = node.marks.find(m => m.type.name === 'diff');
          if (diffMark && diffMark.attrs.type === 'removed') {
            rangesToUnmark.push({ from: pos, to: pos + node.nodeSize });
          }
       });
       
       if (dispatch) {
         rangesToUnmark.forEach(range => {
           tr.removeMark(range.from, range.to, state.schema.marks.diff);
         });
       }
       return true;
    });
  };

  return (
    <div className="fixed bottom-8 right-8 z-50 flex gap-2 animate-in slide-in-from-bottom-5">
      <Button onClick={acceptChanges} className="bg-green-600 hover:bg-green-700 text-white gap-2 shadow-lg">
        <Check className="h-4 w-4" /> Принять изменения
      </Button>
      <Button onClick={rejectChanges} variant="destructive" className="gap-2 shadow-lg">
        <X className="h-4 w-4" /> Отклонить
      </Button>
    </div>
  );
}
