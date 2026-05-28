import { CSSProperties, ReactNode } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";

type Props = {
  id: string;
  disabled?: boolean;
  className?: string;
  children: (args: { handle: ReactNode; isDragging: boolean }) => ReactNode;
};

export function SortableRow({ id, disabled, className, children }: Props) {
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
  );

  return (
    <tr ref={setNodeRef} style={style} className={className} data-sortable-id={id}>
      {children({ handle, isDragging })}
    </tr>
  );
}
