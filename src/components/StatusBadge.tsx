import { cn } from "@/lib/utils";

export type Status = "done" | "pending" | "late" | "idle";

const styles: Record<Status, string> = {
  done: "bg-success/15 text-success border-success/30",
  pending: "bg-warning/15 text-warning border-warning/30",
  late: "bg-destructive/15 text-destructive border-destructive/30",
  idle: "bg-muted text-muted-foreground border-border",
};

const labels: Record<Status, string> = {
  done: "Concluído",
  pending: "Pendente",
  late: "Atrasado",
  idle: "Não iniciado",
};

export function StatusBadge({ status, className }: { status: Status; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-medium",
        styles[status],
        className
      )}
    >
      {labels[status]}
    </span>
  );
}
