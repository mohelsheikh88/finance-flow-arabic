import { CSSProperties, ReactNode } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, ChevronUp, ChevronDown } from "lucide-react";

type Props = {
  id: string;
  disabled?: boolean;
  className?: string;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  canMoveUp?: boolean;
  canMoveDown?: boolean;
  children: (args: { handle: ReactNode; isDragging: boolean }) => ReactNode;
};

export function SortableRow({
  id,
  disabled,
  className,
  onMoveUp,
  onMoveDown,
  canMoveUp,
  canMoveDown,
  children,
}: Props) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } =
    useSortable({ id, disabled });

  const style: CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    background: isDragging ? "var(--color-muted)" : undefined,
    position: "relative",
    zIndex: isDragging ? 10 : undefined,
  };

  const handle = (
    <div className="inline-flex items-center gap-0.5">
      <button
        type="button"
        ref={setActivatorNodeRef}
        {...attributes}
        {...listeners}
        disabled={disabled}
        aria-label="Drag to reorder"
        className="cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed p-1 inline-flex"
      >
        <GripVertical className="h-3.5 w-3.5" />
      </button>
      {(onMoveUp || onMoveDown) && (
        <div className="inline-flex flex-col -gap-0.5">
          <button
            type="button"
            onClick={onMoveUp}
            disabled={disabled || !canMoveUp || !onMoveUp}
            aria-label="Move up"
            className="text-muted-foreground hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed inline-flex leading-none"
          >
            <ChevronUp className="h-3 w-3" />
          </button>
          <button
            type="button"
            onClick={onMoveDown}
            disabled={disabled || !canMoveDown || !onMoveDown}
            aria-label="Move down"
            className="text-muted-foreground hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed inline-flex leading-none"
          >
            <ChevronDown className="h-3 w-3" />
          </button>
        </div>
      )}
    </div>
  );

  return (
    <tr ref={setNodeRef} style={style} className={className} data-sortable-id={id}>
      {children({ handle, isDragging })}
    </tr>
  );
}
