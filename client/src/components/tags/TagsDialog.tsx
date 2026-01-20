import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useFileSystem } from "@/lib/mock-fs";
import { X, Plus, Tag } from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";

interface TagsDialogProps {
  itemId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function TagsDialog({ itemId, open, onOpenChange }: TagsDialogProps) {
  const { items, updateTags } = useFileSystem();
  const item = items.find((i) => i.id === itemId);
  const [newTag, setNewTag] = useState("");

  if (!item) return null;

  const tags = item.tags || [];

  const handleAddTag = (e?: React.FormEvent) => {
    e?.preventDefault();
    const tag = newTag.trim();
    if (tag && !tags.includes(tag)) {
      updateTags(item.id, [...tags, tag]);
      setNewTag("");
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    updateTags(item.id, tags.filter((t) => t !== tagToRemove));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Tag className="h-5 w-5" />
            Теги: {item.name}
          </DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <form onSubmit={handleAddTag} className="flex gap-2">
            <Input
              value={newTag}
              onChange={(e) => setNewTag(e.target.value)}
              placeholder="Добавить тег..."
              className="flex-1"
            />
            <Button type="submit" size="sm" disabled={!newTag.trim()}>
              <Plus className="h-4 w-4" />
            </Button>
          </form>
          
          <div className="flex flex-wrap gap-2 min-h-[100px] content-start p-2 border rounded-md bg-muted/20">
            {tags.length === 0 && (
              <span className="text-sm text-muted-foreground w-full text-center py-8">
                Нет тегов
              </span>
            )}
            {tags.map((tag) => (
              <Badge key={tag} variant="secondary" className="flex items-center gap-1 pl-2 pr-1 py-1">
                {tag}
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-4 w-4 ml-1 hover:bg-destructive/20 hover:text-destructive rounded-full"
                  onClick={() => handleRemoveTag(tag)}
                >
                  <X className="h-3 w-3" />
                </Button>
              </Badge>
            ))}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
