import { Mark, mergeAttributes } from '@tiptap/core';

export interface DiffOptions {
  HTMLAttributes: Record<string, any>;
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    diff: {
      setDiff: (attributes: { type: 'added' | 'removed' }) => ReturnType;
      unsetDiff: () => ReturnType;
    };
  }
}

export const DiffMark = Mark.create<DiffOptions>({
  name: 'diff',

  addOptions() {
    return {
      HTMLAttributes: {},
    };
  },

  addAttributes() {
    return {
      type: {
        default: 'added',
        parseHTML: (element) => element.getAttribute('data-diff-type'),
        renderHTML: (attributes) => {
          return {
            'data-diff-type': attributes.type,
            class: `diff-${attributes.type}`,
          };
        },
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'span[data-diff-type]',
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return ['span', mergeAttributes(this.options.HTMLAttributes, HTMLAttributes), 0];
  },

  addCommands() {
    return {
      setDiff:
        (attributes) =>
        ({ commands }) => {
          return commands.setMark(this.name, attributes);
        },
      unsetDiff:
        () =>
        ({ commands }) => {
          return commands.unsetMark(this.name);
        },
    };
  },
});
