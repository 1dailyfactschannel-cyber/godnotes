
import * as React from "react"
import {
  Calculator,
  Calendar,
  CreditCard,
  Settings,
  Smile,
  User,
  File,
  Plus,
  FolderPlus,
  Moon,
  Sun,
  Laptop,
  Search
} from "lucide-react"

import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "@/components/ui/command"
import { useFileSystem, ThemeType } from "@/lib/mock-fs"
import { DialogProps } from "@radix-ui/react-dialog"
import { isHotkeyMatch } from "@/lib/utils"

export function CommandPalette() {
  const [open, setOpen] = React.useState(false)
  const { items, selectFile, addFile, addFolder, setTheme, theme, hotkeys, activeFileId } = useFileSystem()

  React.useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.defaultPrevented) return;
      
      if (isHotkeyMatch(e, hotkeys.commandPalette || 'Ctrl+K')) {
        e.preventDefault()
        setOpen((open) => !open)
      }
    }

    document.addEventListener("keydown", down)
    return () => document.removeEventListener("keydown", down)
  }, [hotkeys])

  const runCommand = React.useCallback((command: () => unknown) => {
    setOpen(false)
    command()
  }, [])

  const getActiveParentId = () => {
    const activeItem = items.find(i => i.id === activeFileId);
    console.log('[CommandPalette] getActiveParentId - activeFileId:', activeFileId, 'activeItem:', activeItem ? activeItem.name : 'null');
    
    if (activeItem) {
      if (activeItem.type === 'folder') {
          console.log('[CommandPalette] Returning folder id:', activeItem.id);
          return activeItem.id;
      } else {
          console.log('[CommandPalette] Returning parent id:', activeItem.parentId);
          return activeItem.parentId;
      }
    }
    console.log('[CommandPalette] Returning null (no active item)');
    return null;
  };

  const files = items.filter(item => item.type === 'file' && !item.isDeleted)

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder={`Поиск файлов и команд... (${hotkeys.commandPalette || 'Ctrl+K'})`} />
      <CommandList>
        <CommandEmpty>Ничего не найдено.</CommandEmpty>
        
        <CommandGroup heading="Файлы">
          {files.map(file => (
            <CommandItem
              key={file.id}
              value={file.title || file.name}
              onSelect={() => runCommand(() => selectFile(file.id))}
            >
              <File className="mr-2 h-4 w-4" />
              <span>{file.title || file.name}</span>
            </CommandItem>
          ))}
        </CommandGroup>

        <CommandSeparator />

        <CommandGroup heading="Действия">
          <CommandItem onSelect={() => runCommand(() => addFile(getActiveParentId()))}>
            <Plus className="mr-2 h-4 w-4" />
            <span>Создать заметку</span>
            <CommandShortcut>⌘N</CommandShortcut>
          </CommandItem>
          <CommandItem onSelect={() => runCommand(() => addFolder(getActiveParentId()))}>
            <FolderPlus className="mr-2 h-4 w-4" />
            <span>Создать папку</span>
          </CommandItem>
        </CommandGroup>

        <CommandSeparator />

        <CommandGroup heading="Тема">
          <CommandItem onSelect={() => runCommand(() => setTheme('light'))}>
            <Sun className="mr-2 h-4 w-4" />
            <span>Светлая</span>
            {theme === 'light' && <CommandShortcut>✓</CommandShortcut>}
          </CommandItem>
          <CommandItem onSelect={() => runCommand(() => setTheme('dark'))}>
            <Moon className="mr-2 h-4 w-4" />
            <span>Темная</span>
            {theme === 'dark' && <CommandShortcut>✓</CommandShortcut>}
          </CommandItem>
          <CommandItem onSelect={() => runCommand(() => setTheme('system'))}>
            <Laptop className="mr-2 h-4 w-4" />
            <span>Системная</span>
            {theme === 'system' && <CommandShortcut>✓</CommandShortcut>}
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  )
}
