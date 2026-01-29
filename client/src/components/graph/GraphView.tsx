import React, { useMemo, useCallback, useRef, useState, useEffect } from 'react';
import ForceGraph2D from 'react-force-graph-2d';
import { useFileSystem } from '@/lib/data-store';
import { Button } from '@/components/ui/button';
import { X, ZoomIn, ZoomOut, Maximize2, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';

interface GraphNode {
  id: string;
  name: string;
  val: number;
  color?: string;
}

interface GraphLink {
  source: string;
  target: string;
}

interface GraphViewProps {
  onClose: () => void;
  className?: string;
}

export function GraphView({ onClose, className }: GraphViewProps) {
  const { items, activeFileId, selectFile } = useFileSystem();
  const graphRef = useRef<any>(null);
  const [isHovered, setIsHovered] = useState<string | null>(null);
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });
  const containerRef = useRef<HTMLDivElement>(null);

  // Update container size on mount and resize
  useEffect(() => {
    const updateSize = () => {
      if (containerRef.current) {
        setContainerSize({
          width: containerRef.current.clientWidth,
          height: containerRef.current.clientHeight
        });
      }
    };

    updateSize();
    window.addEventListener('resize', updateSize);
    return () => window.removeEventListener('resize', updateSize);
  }, []);

  const graphData = useMemo(() => {
    const nodes: GraphNode[] = items
      .filter(i => i.type === 'file')
      .map(i => ({
        id: i.id,
        name: i.name,
        val: 1 + (i.backlinks?.length || 0) * 0.5,
        color: i.id === activeFileId ? '#3b82f6' : '#94a3b8'
      }));

    const links: GraphLink[] = [];
    items.forEach(item => {
      if (item.type === 'file' && item.backlinks) {
        item.backlinks.forEach(sourceId => {
          if (items.find(i => i.id === sourceId)) {
            links.push({
              source: sourceId,
              target: item.id
            });
          }
        });
      }
    });

    return { nodes, links };
  }, [items, activeFileId]);

  const handleNodeClick = useCallback((node: any) => {
    selectFile(node.id);
    onClose();
  }, [selectFile, onClose]);

  const centerGraph = useCallback(() => {
    if (graphRef.current) {
      graphRef.current.zoomToFit(400);
    }
  }, []);

  return (
    <div className={cn("fixed inset-0 z-[100] bg-background flex flex-col", className)}>
      <div className="flex items-center justify-between p-4 border-b bg-sidebar shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
            <RefreshCw className="h-4 w-4 text-primary animate-spin-slow" />
          </div>
          <div>
            <h2 className="text-lg font-bold leading-none mb-1">Граф связей</h2>
            <p className="text-xs text-muted-foreground">Визуализация структуры ваших заметок</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center bg-secondary/50 rounded-lg p-1 border">
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => graphRef.current?.zoom(graphRef.current.zoom() * 1.2)}>
              <ZoomIn className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => graphRef.current?.zoom(graphRef.current.zoom() * 0.8)}>
              <ZoomOut className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={centerGraph}>
              <Maximize2 className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => graphRef.current?.d3ReheatSimulation()}>
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
          <div className="w-px h-6 bg-border mx-1" />
          <Button variant="outline" size="sm" className="gap-2" onClick={onClose}>
            <X className="h-4 w-4" />
            Закрыть
          </Button>
        </div>
      </div>
      
      <div ref={containerRef} className="flex-1 relative overflow-hidden bg-slate-50/50 dark:bg-slate-950/50">
        {containerSize.width > 0 && (
          <ForceGraph2D
            ref={graphRef}
            width={containerSize.width}
            height={containerSize.height}
            graphData={graphData}
            nodeLabel="name"
            nodeColor={node => {
              if (node.id === activeFileId) return '#3b82f6';
              if (node.id === isHovered) return '#60a5fa';
              return '#94a3b8';
            }}
            nodeRelSize={6}
            linkDirectionalParticles={2}
            linkDirectionalParticleSpeed={0.005}
            linkColor={() => 'rgba(148, 163, 184, 0.2)'}
            onNodeClick={handleNodeClick}
            onNodeHover={node => setIsHovered(node?.id || null)}
            cooldownTicks={100}
            onEngineStop={() => {
              if (graphRef.current && !graphRef.current.__initialZoomDone) {
                graphRef.current.zoomToFit(400);
                graphRef.current.__initialZoomDone = true;
              }
            }}
            nodeCanvasObject={(node: any, ctx, globalScale) => {
              const label = node.name;
              const fontSize = 12 / globalScale;
              ctx.font = `${fontSize}px Inter, sans-serif`;
              const textWidth = ctx.measureText(label).width;
              const bckgDimensions = [textWidth, fontSize].map(n => n + fontSize * 0.2);

              // Node circle
              const radius = Math.sqrt(node.val) * 4;
              ctx.beginPath();
              ctx.arc(node.x, node.y, radius, 0, 2 * Math.PI, false);
              ctx.fillStyle = node.id === activeFileId ? '#3b82f6' : (node.id === isHovered ? '#60a5fa' : '#94a3b8');
              ctx.fill();
              
              if (node.id === activeFileId) {
                ctx.strokeStyle = '#fff';
                ctx.lineWidth = 2 / globalScale;
                ctx.stroke();
              }

              // Label
              if (globalScale > 1.5 || node.id === activeFileId || node.id === isHovered) {
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillStyle = node.id === activeFileId ? '#3b82f6' : 'rgba(100, 116, 139, 0.8)';
                ctx.fillText(label, node.x, node.y + radius + fontSize);
              }
            }}
          />
        )}
        
        <div className="absolute bottom-6 left-6 flex flex-col gap-3 bg-background/80 backdrop-blur-md p-4 rounded-xl text-xs text-muted-foreground border shadow-xl max-w-xs">
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <div className="w-3 h-3 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.5)]" />
              <span className="font-medium text-foreground">Текущая заметка</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-3 h-3 rounded-full bg-slate-400" />
              <span className="font-medium">Другие заметки</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-8 h-[1px] bg-slate-300" />
              <span className="font-medium italic">Связи (Wiki-ссылки)</span>
            </div>
          </div>
          <div className="h-px bg-border w-full my-1" />
          <p className="leading-relaxed opacity-80">
            Используйте <strong>[[название]]</strong> в тексте заметки, чтобы создать связь. Нажмите на узел, чтобы открыть заметку.
          </p>
        </div>
      </div>
    </div>
  );
}
