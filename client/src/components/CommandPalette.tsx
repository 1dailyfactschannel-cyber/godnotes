
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
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "@/components/ui/command"
import { Dialog, DialogContent } from "@/components/ui/dialog"
import { useFileSystem, ThemeType, compareItems, FileSystemItem } from "@/lib/mock-fs"
import { DialogProps } from "@radix-ui/react-dialog"
import { isHotkeyMatch } from "@/lib/utils"

export function CommandPalette() {
  const [open, setOpen] = React.useState(false)
  const [query, setQuery] = React.useState("")
  const [searchResults, setSearchResults] = React.useState<FileSystemItem[]>([])
  const [isSearching, setIsSearching] = React.useState(false)
  
  // Optimized selectors to prevent re-renders on content change
  const items = useFileSystem(state => state.items)
  const hotkeys = useFileSystem(state => state.hotkeys)
  const activeFileId = useFileSystem(state => state.activeFileId)
  const searchGlobal = useFileSystem(state => state.searchGlobal)
  
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

  React.useEffect(() => {
    if (!open) {
      setQuery("")
      setSearchResults([])
      return
    }
  }, [open])

  React.useEffect(() => {
    const search = async () => {
       setIsSearching(true)
       try {
         const res = await searchGlobal(query)
         setSearchResults(res)
       } catch (e) {
         console.error(e)
       } finally {
         setIsSearching(false)
       }
    }
    const timer = setTimeout(search, 300)
    return () => clearTimeout(timer)
  }, [query, searchGlobal])

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

  // If query is empty, show all files (filtered by type)
  // If query is present, show searchResults
  const displayFiles = query ? searchResults : items.filter(item => item.type === 'file' && !item.tags?.some(t => t.startsWith('deleted:')))

  // Filter actions manually
  const filterAction = (name: string) => {
    if (!query) return true;
    return name.toLowerCase().includes(query.toLowerCase());
  }

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
          <CommandInput 
            placeholder={`Поиск файлов и команд... (${hotkeys.commandPalette || 'Ctrl+K'})`}
            value={query}
            onValueChange={setQuery}
          />
          <CommandList>
            <CommandEmpty>Ничего не найдено.</CommandEmpty>
            
            <CommandGroup heading="Файлы">
              {displayFiles.map(file => (
                <CommandItem
                  key={file.id}
                  value={file.name}
                  onSelect={() => runCommand(() => selectFile(file.id))}
                >
                  <File className="mr-2 h-4 w-4" />
                  <div className="flex flex-col">
                    <span>{file.name}</span>
                    {query && file.content && (
                      <span className="text-xs text-muted-foreground truncate max-w-[400px]">
                        {file.content.replace(/<[^>]*>?/gm, '').substring(0, 50)}...
                      </span>
                    )}
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>

            <CommandSeparator />

            <CommandGroup heading="Действия">
              {filterAction("Создать файл") && (
                <CommandItem onSelect={() => runCommand(() => addFile(getActiveParentId()))}>
                  <Plus className="mr-2 h-4 w-4" />
                  <span>Создать файл</span>
                </CommandItem>
              )}

              <CommandItem onSelect={() => runCommand(() => addFolder(getActiveParentId()))}>
                <FolderPlus className="mr-2 h-4 w-4" />
                <span>Создать папку</span>
              </CommandItem>
            </CommandGroup>

            <CommandSeparator />

            <CommandGroup heading="Тема">
              <CommandItem onSelect={() => runCommand(() => setTheme('light-mode'))}>
                <Sun className="mr-2 h-4 w-4" />
                <span>Светлая</span>
                {theme === 'light-mode' && <CommandShortcut>✓</CommandShortcut>}
              </CommandItem>
              <CommandItem onSelect={() => runCommand(() => setTheme('obsidian-dark'))}>
                <Moon className="mr-2 h-4 w-4" />
                <span>Темная (Obsidian)</span>
                {theme === 'obsidian-dark' && <CommandShortcut>✓</CommandShortcut>}
              </CommandItem>
              <CommandItem onSelect={() => runCommand(() => setTheme('midnight-blue'))}>
                <Moon className="mr-2 h-4 w-4" />
                <span>Midnight Blue</span>
                {theme === 'midnight-blue' && <CommandShortcut>✓</CommandShortcut>}
              </CommandItem>
            </CommandGroup>
          </CommandList>
    </CommandDialog>
  )
}
