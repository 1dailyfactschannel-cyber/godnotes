import { Node, mergeAttributes } from '@tiptap/core';
import { ReactNodeViewRenderer, NodeViewWrapper } from '@tiptap/react';
import { useEffect, useRef, useState } from 'react';
import mermaid from 'mermaid';

mermaid.initialize({
  startOnLoad: false,
  theme: 'dark',
});

const MermaidComponent = ({ node, updateAttributes }: any) => {
  const [content, setContent] = useState(node.textContent);
  const [svg, setSvg] = useState('');
  const [error, setError] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const renderRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setContent(node.textContent);
  }, [node.textContent]);

  useEffect(() => {
    const renderDiagram = async () => {
      try {
        if (!content.trim()) return;
        
        const id = `mermaid-${Math.random().toString(36).substr(2, 9)}`;
        const { svg } = await mermaid.render(id, content);
        setSvg(svg);
        setError('');
      } catch (e) {
        console.error('Mermaid render error:', e);
        setError('Ошибка рендеринга диаграммы. Проверьте синтаксис.');
        // Keep the old SVG if possible or clear it?
        // setSvg(''); 
      }
    };

    renderDiagram();
  }, [content]);

  const handleDoubleClick = () => {
    setIsEditing(true);
    setTimeout(() => {
      textareaRef.current?.focus();
    }, 0);
  };

  const handleBlur = () => {
    setIsEditing(false);
    updateAttributes({ content }); // This might not be right way to update node content for a leaf node
    // For a code block, the content is the text content of the node.
    // But we are making a custom node.
  };

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setContent(e.target.value);
    // We need to update the node's text content.
    // But standard updateAttributes updates attributes, not content.
    // If this is a text-based node, we should handle it differently.
    // Let's assume we store the code in an attribute 'code' for simplicity, 
    // OR we can make it a wrapper around a code block.
    
    // Actually, for this implementation, let's use an attribute 'code'.
    updateAttributes({ code: e.target.value });
  };

  return (
    <NodeViewWrapper className="mermaid-wrapper my-4">
      <div 
        className="relative border rounded-md p-2 bg-background hover:ring-2 ring-primary/20 transition-all cursor-pointer"
        onDoubleClick={handleDoubleClick}
      >
        {!isEditing && (
          <div 
            ref={renderRef} 
            className="flex justify-center min-h-[50px] overflow-auto"
            dangerouslySetInnerHTML={{ __html: svg }} 
          />
        )}
        
        {error && <div className="text-destructive text-sm mt-2">{error}</div>}

        <div className={isEditing ? 'block' : 'hidden'}>
          <textarea
            ref={textareaRef}
            value={node.attrs.code}
            onChange={handleChange}
            onBlur={handleBlur}
            className="w-full h-40 font-mono text-sm p-2 bg-muted rounded-md resize-y outline-none focus:ring-1 ring-primary"
            placeholder="graph TD; A-->B;"
          />
          <div className="text-xs text-muted-foreground mt-1">
            Нажмите вне области для предпросмотра
          </div>
        </div>
        
        {!isEditing && !svg && !error && (
            <div className="text-center text-muted-foreground py-8">
                Double click to edit mermaid diagram
            </div>
        )}
      </div>
    </NodeViewWrapper>
  );
};

export const MermaidExtension = Node.create({
  name: 'mermaid',

  group: 'block',

  atom: true,

  addAttributes() {
    return {
      code: {
        default: 'graph TD;\nA-->B;',
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'div[data-type="mermaid"]',
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { 'data-type': 'mermaid' })];
  },

  addNodeView() {
    return ReactNodeViewRenderer(MermaidComponent);
  },
  
  addCommands() {
      return {
          setMermaid: () => ({ commands }: { commands: any }) => {
              return commands.insertContent({
                  type: this.name,
              })
          }
      } as any;
  }
});
