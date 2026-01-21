import { NodeViewWrapper, ReactNodeViewRenderer } from '@tiptap/react';
import { Image } from '@tiptap/extension-image';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';

const ResizableImageComponent = (props: any) => {
  const { node, updateAttributes, selected } = props;
  const [isResizing, setIsResizing] = useState(false);
  const imageRef = useRef<HTMLImageElement>(null);
  const [width, setWidth] = useState(node.attrs.width);

  useEffect(() => {
    setWidth(node.attrs.width);
  }, [node.attrs.width]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsResizing(true);

    const startX = e.clientX;
    const startWidth = imageRef.current?.offsetWidth || 0;

    const onMouseMove = (e: MouseEvent) => {
      const currentX = e.clientX;
      const diffX = currentX - startX;
      const newWidth = Math.max(50, startWidth + diffX); // Minimum 50px
      setWidth(newWidth);
    };

    const onMouseUp = (e: MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsResizing(false);
      
      const currentX = e.clientX;
      const diffX = currentX - startX;
      const newWidth = Math.max(50, startWidth + diffX);
      
      updateAttributes({ width: newWidth });
      
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  }, [updateAttributes]);

  return (
    <NodeViewWrapper className={cn("relative inline-block leading-none my-4", selected && "ring-2 ring-primary rounded-lg")}>
      <img
        ref={imageRef}
        src={node.attrs.src}
        alt={node.attrs.alt}
        title={node.attrs.title}
        className="rounded-lg max-w-full h-auto block"
        style={{ width: typeof width === 'number' ? `${width}px` : width }}
      />
      
      {/* Resize Handle */}
      {selected && (
        <div
          className="absolute bottom-2 right-2 w-4 h-4 bg-primary rounded-full cursor-ew-resize border-2 border-background shadow-sm hover:scale-110 transition-transform z-10 flex items-center justify-center"
          onMouseDown={handleMouseDown}
          title="Изменить размер"
        >
          <div className="w-1.5 h-1.5 bg-background rounded-full" />
        </div>
      )}
    </NodeViewWrapper>
  );
};

export const ResizableImage = Image.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      width: {
        default: '100%',
        renderHTML: (attributes) => {
          return {
            width: attributes.width,
            style: `width: ${typeof attributes.width === 'number' ? attributes.width + 'px' : attributes.width}`,
          };
        },
      },
    };
  },
  
  addNodeView() {
    return ReactNodeViewRenderer(ResizableImageComponent);
  },
});
