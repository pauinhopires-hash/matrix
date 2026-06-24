import { useAuth } from "@/lib/auth";
import { Flame } from "lucide-react";

export function AppHeader({ title }: { title?: string }) {
  const { user } = useAuth();
  return (
    <header className="sticky top-0 z-30 border-b border-border bg-background/90 backdrop-blur">
      <div className="mx-auto flex max-w-md items-center justify-between px-4 py-3">
        <div className="flex items-center gap-2">
          <img src="/LOGO.png" alt="Misturaria" className="h-9 w-9 rounded-md object-contain" />
          <div className="leading-tight">
            <p className="font-display text-sm font-semibold">Misturaria Control</p>
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground">{title ?? "Matrix"}</p>
          </div>
        </div>
        {user && (
          <div className="flex items-center gap-2">
            {user.fotoDataUrl ? (
              <img src={user.fotoDataUrl} alt={user.nome} className="h-9 w-9 rounded-full object-cover" />
            ) : (
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-muted text-sm font-semibold uppercase">
                {user.nome.slice(0, 1)}
              </div>
            )}
          </div>
        )}
      </div>
    </header>
  );
}
