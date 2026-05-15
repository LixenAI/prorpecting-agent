import { cn } from "@/lib/utils";

export type Tone = "ok" | "warn" | "block" | "info" | "neutral";

const toneClass: Record<Tone, string> = {
  ok: "bg-emerald-50 text-emerald-700 border-emerald-200",
  warn: "bg-amber-50 text-amber-800 border-amber-200",
  block: "bg-rose-50 text-rose-700 border-rose-200",
  info: "bg-[hsl(211_60%_95%)] text-[hsl(217_80%_24%)] border-[hsl(211_70%_85%)]",
  neutral: "bg-muted text-muted-foreground border-muted-border",
};

export function StatusBadge({
  tone = "neutral",
  children,
  className,
}: {
  tone?: Tone;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border",
        toneClass[tone],
        className
      )}
    >
      {children}
    </span>
  );
}

export function PageHeader({
  title,
  subtitle,
  right,
}: {
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-xl font-semibold text-[hsl(217_80%_24%)] tracking-tight">{title}</h1>
        {subtitle && (
          <p className="text-sm text-muted-foreground mt-1 max-w-2xl">{subtitle}</p>
        )}
      </div>
      {right}
    </div>
  );
}
