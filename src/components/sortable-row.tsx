import { CSSProperties, ReactNode } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";

type Props = {
  id: string;
  disabled?: boolean;
  children: (handleProps: { handle: ReactNode; isDragging: boolean }) => ReactNode;
  className?: string;
};

export function SortableRow({ id, disabled, children, className }: Props) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id, disabled });

  const style: CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    position: "relative",
    zIndex: isDragging ? 10 : undefined,
  };

  const handle = (
    <button
      type="button"
      ref={setNodeRef as any}
      {...attributes}
      {...listeners}
      disabled={disabled}
      aria-label="Drag to reorder"
      className="cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed p-1"
      onClick={(e) => e.preventDefault()}
    >
      <GripVertical className="h-3.5 w-3.5" />
    </button>
  );

  // We attach the ref to the handle button so dragging the handle moves the row.
  // The row wrapper uses style/transform but needs its own ref via a div.
  return (
    <tr
      style={style}
      className={className}
      data-sortable-id={id}
    >
      {children({ handle, isDragging })}
    </tr>
  );
}
