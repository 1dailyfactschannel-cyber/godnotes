
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
import { useFileSystem, ThemeType, compareItems } from "@/lib/mock-fs"
import { DialogProps } from "@radix-ui/react-dialog"
import { isHotkeyMatch } from "@/lib/utils"

export function CommandPalette() {
  const [open, setOpen] = React.useState(false)
  
  // Optimized selectors to prevent re-renders on content change
  const items = useFileSystem(state => state.items, compareItems)
  const hotkeys = useFileSystem(state => state.hotkeys)
  const activeFileId = useFileSystem(state => state.activeFileId)
  
  // Actions are stable, can be read from state or picked
  const selectFile = useFileSystem(state => state.selectFile)
  const addFile = useFileSystem(state => state.addFile)
  const addFolder = useFileSystem(state => state.addFolder)
  const setTheme = useFileSystem(state => state.setTheme)
  const theme = useFileSystem(state => state.theme)

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
    if (activeItem) {
      if (activeItem.type === 'folder') return activeItem.id;
      return activeItem.parentId;
    }
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
