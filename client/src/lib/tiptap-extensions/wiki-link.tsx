import { Extension, InputRule } from '@tiptap/core';
import Suggestion from '@tiptap/suggestion';
import { PluginKey } from 'prosemirror-state';
import tippy, { Instance as TippyInstance } from 'tippy.js';
import { ReactRenderer } from '@tiptap/react';
import { forwardRef, useEffect, useImperativeHandle, useState } from 'react';
import { File, Folder } from 'lucide-react';
import { FileSystemItem } from '@/lib/mock-fs';

export const WikiLinkExtension = Extension.create({
  name: 'wikiLink',

  addOptions() {
    return {
      suggestion: {
        char: '[[',
        pluginKey: new PluginKey('wikiLink'),
        command: ({ editor, range, props }) => {
          // increase range.to by 1 when the second bracket is missing
          const { state } = editor;
          const { tr } = state;
          
          // Insert the link
          editor
            .chain()
            .focus()
            .deleteRange(range)
            .insertContent([
              {
                type: 'text',
                text: props.label,
                marks: [
                  {
                    type: 'link',
                    attrs: {
                      href: `godnotes://open?id=${props.id}`,
                      target: '_blank',
                      class: 'wiki-link',
                      'data-id': props.id,
                    },
                  },
                ],
              },
            ])
            .run();
        },
      },
      items: [], // Function to get items
    };
  },

  addProseMirrorPlugins() {
    return [
      Suggestion({
        editor: this.editor,
        ...this.options.suggestion,
      }),
    ];
  },
});

export const WikiLinkList = forwardRef((props: any, ref) => {
  const [selectedIndex, setSelectedIndex] = useState(0);

  const selectItem = (index: number) => {
    const item = props.items[index];
    if (item) {
      props.command({ id: item.id, label: item.name });
    }
  };

  useEffect(() => {
    setSelectedIndex(0);
  }, [props.items]);

  useImperativeHandle(ref, () => ({
    onKeyDown: ({ event }: { event: KeyboardEvent }) => {
      if (event.key === 'ArrowUp') {
        setSelectedIndex((selectedIndex + props.items.length - 1) % props.items.length);
        return true;
      }
      if (event.key === 'ArrowDown') {
        setSelectedIndex((selectedIndex + 1) % props.items.length);
        return true;
      }
      if (event.key === 'Enter') {
        selectItem(selectedIndex);
        return true;
      }
      return false;
    },
  }));

  return (
    <div className="z-50 min-w-[8rem] overflow-hidden rounded-md border bg-popover p-1 text-popover-foreground shadow-md animate-in fade-in-80 zoom-in-95">
      {props.items.length ? (
        props.items.map((item: FileSystemItem, index: number) => (
          <button
            key={item.id}
            className={`relative flex w-full cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none ${
              index === selectedIndex ? 'bg-accent text-accent-foreground' : ''
            }`}
            onClick={() => selectItem(index)}
          >
            {item.type === 'folder' ? (
              <Folder className="mr-2 h-4 w-4" />
            ) : (
              <File className="mr-2 h-4 w-4" />
            )}
            <span>{item.name}</span>
          </button>
        ))
      ) : (
        <div className="px-2 py-1.5 text-sm text-muted-foreground">Нет результатов</div>
      )}
    </div>
  );
});

WikiLinkList.displayName = 'WikiLinkList';
