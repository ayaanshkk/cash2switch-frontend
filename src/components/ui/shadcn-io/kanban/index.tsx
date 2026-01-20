'use client';

import type {
  Announcements,
  DndContextProps,
  DragEndEvent,
  DragOverEvent,
  DragStartEvent,
} from '@dnd-kit/core';
import {
  closestCenter,
  DndContext,
  DragOverlay,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  useDroppable,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import { arrayMove, SortableContext, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  createContext,
  type HTMLAttributes,
  type ReactNode,
  useContext,
  useState,
  useEffect,
} from 'react';
import { createPortal } from 'react-dom';
import tunnel from 'tunnel-rat';
import { Card } from '@/components/ui/card';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';

const t = tunnel();

export type { DragEndEvent } from '@dnd-kit/core';

type KanbanItemProps = {
  id: string;
  name: string;
  column: string;
} & Record<string, unknown>;

type KanbanColumnProps = {
  id: string;
  name: string;
} & Record<string, unknown>;

type KanbanContextProps<
  T extends KanbanItemProps = KanbanItemProps,
  C extends KanbanColumnProps = KanbanColumnProps,
> = {
  columns: C[];
  data: T[];
  activeCardId: string | null;
};

const KanbanContext = createContext<KanbanContextProps>({
  columns: [],
  data: [],
  activeCardId: null,
});

export type KanbanBoardProps = {
  id: string;
  children: ReactNode;
  className?: string;
};

export const KanbanBoard = ({ id, children, className }: KanbanBoardProps) => {
  const { isOver, setNodeRef } = useDroppable({
    id,
  });

  return (
    <div
      className={cn(
        'flex size-full min-h-40 flex-col divide-y overflow-hidden rounded-md border bg-secondary text-xs shadow-sm ring-2 transition-all',
        isOver ? 'ring-primary' : 'ring-transparent',
        className
      )}
      ref={setNodeRef}
    >
      {children}
    </div>
  );
};

export type KanbanCardProps<T extends KanbanItemProps = KanbanItemProps> = T & {
  children?: ReactNode;
  className?: string;
};

export const KanbanCard = <T extends KanbanItemProps = KanbanItemProps>({
  id,
  name,
  children,
  className,
}: KanbanCardProps<T>) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transition,
    transform,
    isDragging,
  } = useSortable({
    id,
  });
  const { activeCardId } = useContext(KanbanContext) as KanbanContextProps;

  const style = {
    transition,
    transform: CSS.Transform.toString(transform),
  };

  return (
    <>
      <div style={style} {...listeners} {...attributes} ref={setNodeRef}>
        <Card
          className={cn(
            'cursor-grab gap-4 rounded-md p-3 shadow-sm',
            isDragging && 'pointer-events-none cursor-grabbing opacity-30',
            className
          )}
        >
          {children ?? <p className="m-0 font-medium text-sm">{name}</p>}
        </Card>
      </div>
      {activeCardId === id && (
        <t.In>
          <Card
            className={cn(
              'cursor-grab gap-4 rounded-md p-3 shadow-sm ring-2 ring-primary',
              isDragging && 'cursor-grabbing',
              className
            )}
          >
            {children ?? <p className="m-0 font-medium text-sm">{name}</p>}
          </Card>
        </t.In>
      )}
    </>
  );
};

export type KanbanCardsProps<T extends KanbanItemProps = KanbanItemProps> =
  Omit<HTMLAttributes<HTMLDivElement>, 'children' | 'id'> & {
    children: (item: T) => ReactNode;
    id: string;
  };

export const KanbanCards = <T extends KanbanItemProps = KanbanItemProps>({
  children,
  className,
  ...props
}: KanbanCardsProps<T>) => {
  const { data } = useContext(KanbanContext) as KanbanContextProps<T>;
  const filteredData = data.filter((item) => item.column === props.id);
  const items = filteredData.map((item) => item.id);

  return (
    <ScrollArea className="overflow-hidden">
      <SortableContext items={items}>
        <div
          className={cn('flex flex-grow flex-col gap-2 p-2', className)}
          {...props}
        >
          {filteredData.map(children)}
        </div>
      </SortableContext>
      <ScrollBar orientation="vertical" />
    </ScrollArea>
  );
};

export type KanbanHeaderProps = HTMLAttributes<HTMLDivElement>;

export const KanbanHeader = ({ className, ...props }: KanbanHeaderProps) => (
  <div className={cn('m-0 p-2 font-semibold text-sm', className)} {...props} />
);

export type KanbanProviderProps<
  T extends KanbanItemProps = KanbanItemProps,
  C extends KanbanColumnProps = KanbanColumnProps,
> = Omit<DndContextProps, 'children'> & {
  children: (column: C) => ReactNode;
  className?: string;
  columns: C[];
  data: T[];
  onDataChange?: (data: T[]) => void;
  onDragStart?: (event: DragStartEvent) => void;
  onDragEnd?: (event: DragEndEvent) => void;
  onDragOver?: (event: DragOverEvent) => void;
};

export const KanbanProvider = <
  T extends KanbanItemProps = KanbanItemProps,
  C extends KanbanColumnProps = KanbanColumnProps,
>({
  children,
  onDragStart,
  onDragEnd,
  onDragOver,
  className,
  columns,
  data,
  onDataChange,
  ...props
}: KanbanProviderProps<T, C>) => {
  const [activeCardId, setActiveCardId] = useState<string | null>(null);
  const [localData, setLocalData] = useState<T[]>(data);
  const [isDragging, setIsDragging] = useState(false);

  // 🔑 CRITICAL FIX: Only sync external data when NOT dragging
  useEffect(() => {
    if (!isDragging) {
      console.log('📥 Syncing props to local state (not dragging)');
      setLocalData(data);
    } else {
      console.log('⏸️ Skipping sync - drag in progress');
    }
  }, [data, isDragging]);

  const sensors = useSensors(
    useSensor(MouseSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 200,
        tolerance: 8,
      },
    }),
    useSensor(KeyboardSensor)
  );

  const handleDragStart = (event: DragStartEvent) => {
    const card = localData.find((item) => item.id === event.active.id);
    if (card) {
      setIsDragging(true);
      setActiveCardId(event.active.id as string);
      console.log('🎯 Drag started:', { cardId: event.active.id, cardName: card.name });
    }
    onDragStart?.(event);
  };

  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event;

    if (!over) {
      return;
    }

    const activeItem = localData.find((item) => item.id === active.id);
    const overItem = localData.find((item) => item.id === over.id);

    if (!activeItem) {
      return;
    }

    const activeColumn = activeItem.column;
    
    // ✅ CRITICAL FIX: Safely determine overColumn without forcing to the first column (Lead)
    let overColumn = overItem?.column;

    if (!overColumn) {
      // Check if we are dragging over an empty column board itself
      const overCol = columns.find(col => col.id === over.id);
      if (overCol) {
        overColumn = overCol.id;
      } else {
        // If still no valid column, default to the ACTIVE item's current column to avoid snapping to the wrong column.
        overColumn = activeColumn; 
      }
    }

    if (activeColumn !== overColumn) {
      let newData = [...localData];
      const activeIndex = newData.findIndex((item) => item.id === active.id);
      const overIndex = newData.findIndex((item) => item.id === over.id);

      newData[activeIndex] = { ...newData[activeIndex], column: overColumn };
      
      if (overIndex !== -1) {
        newData = arrayMove(newData, activeIndex, overIndex);
      }

      setLocalData(newData);
      console.log('🔄 Drag over - visual update:', { 
        from: activeColumn, 
        to: overColumn 
      });
    }

    onDragOver?.(event);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    console.log('🎬 Drag ended:', { 
      activeId: event.active.id, 
      overId: event.over?.id 
    });

    const { active, over } = event;

    if (!over) {
      console.log('⚠️ No drop target - reverting');
      setActiveCardId(null);
      setIsDragging(false);
      setLocalData(data);
      return;
    }

    // Calculate final data
    const finalData = [...localData];
    
    if (active.id !== over.id) {
      const oldIndex = finalData.findIndex((item) => item.id === active.id);
      const newIndex = finalData.findIndex((item) => item.id === over.id);
      
      if (oldIndex !== -1 && newIndex !== -1) {
        const reorderedData = arrayMove(finalData, oldIndex, newIndex);
        
        console.log('✅ Calling onDataChange with final data');
        
        try {
          // Call the parent's data change handler (which handles the API update)
          await onDataChange?.(reorderedData);
          console.log('✅ API call completed successfully');
        } catch (error) {
          console.error('❌ API call failed:', error);
          setLocalData(data); // Revert on error
        } finally {
          setActiveCardId(null);
          setIsDragging(false);
        }
        
        onDragEnd?.(event);
        return;
      }
    }

    // If active.id === over.id, this block handles column changes (e.g., dragging to an empty column)
    console.log('✅ Calling onDataChange (column change/commit only)');
    
    try {
      await onDataChange?.(finalData);
      console.log('✅ API call completed successfully');
    } catch (error) {
      console.error('❌ API call failed:', error);
      setLocalData(data);
    } finally {
      setActiveCardId(null);
      setIsDragging(false);
    }
    
    onDragEnd?.(event);
  };

  const announcements: Announcements = {
    onDragStart({ active }) {
      const { name, column } = localData.find((item) => item.id === active.id) ?? {};

      return `Picked up the card "${name}" from the "${column}" column`;
    },
    onDragOver({ active, over }) {
      const { name } = localData.find((item) => item.id === active.id) ?? {};
      const newColumn = columns.find((column) => column.id === over?.id)?.name;

      return `Dragged the card "${name}" over the "${newColumn}" column`;
    },
    onDragEnd({ active, over }) {
      const { name } = localData.find((item) => item.id === active.id) ?? {};
      const newColumn = columns.find((column) => column.id === over?.id)?.name;

      return `Dropped the card "${name}" into the "${newColumn}" column`;
    },
    onDragCancel({ active }) {
      const { name } = localData.find((item) => item.id === active.id) ?? {};

      return `Cancelled dragging the card "${name}"`;
    },
  };

  return (
    <KanbanContext.Provider value={{ columns, data: localData, activeCardId }}>
      <DndContext
        accessibility={{ announcements }}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
        onDragOver={handleDragOver}
        onDragStart={handleDragStart}
        sensors={sensors}
        {...props}
      >
        <div
          className={cn(
            'grid size-full auto-cols-fr grid-flow-col gap-4',
            className
          )}
        >
          {columns.map((column) => children(column))}
        </div>
        {typeof window !== 'undefined' &&
          createPortal(
            <DragOverlay>
              <t.Out />
            </DragOverlay>,
            document.body
          )}
      </DndContext>
    </KanbanContext.Provider>
  );
};