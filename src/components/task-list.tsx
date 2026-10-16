import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { BadgeCheck, Clock, Eye, PlayCircle, X } from "lucide-react";
import { toast } from "sonner";
import { Empty } from "@/components/common";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { errMsg, money, useMySubmissions, useTasks } from "@/lib/data";
import { readDemoUser } from "@/lib/demo-auth";
import { completeDemoTask } from "@/lib/demo-tasks";
import { cn } from "@/lib/utils";

const AD_SECONDS = 15;
type Task = NonNullable<ReturnType<typeof useTasks>["data"]>[number];

// Banner styles rotate per task — each card gets its own color banner.
const BANNERS = [
  { bg: "linear-gradient(135deg, oklch(0.45 0.11 163), oklch(0.62 0.12 150))", deco: "oklch(0.98 0.01 150 / 18%)" },
  { bg: "linear-gradient(135deg, oklch(0.55 0.14 240), oklch(0.7 0.12 230))", deco: "oklch(0.98 0.01 240 / 20%)" },
  { bg: "linear-gradient(135deg, oklch(0.62 0.15 70), oklch(0.78 0.13 80))", deco: "oklch(0.98 0.02 80 / 25%)" },
  { bg: "linear-gradient(135deg, oklch(0.5 0.13 300), oklch(0.65 0.12 290))", deco: "oklch(0.98 0.01 300 / 20%)" },
  { bg: "linear-gradient(135deg, oklch(0.55 0.16 30), oklch(0.7 0.14 40))", deco: "oklch(0.98 0.01 40 / 22%)" },
];

function Banner({ index, title, reward }: { index: number; title: string; reward: number }) {
  const b = BANNERS[index % BANNERS.length] ?? BANNERS[0]!;
  return (
    <div className="relative h-24 overflow-hidden" style={{ background: b.bg }}>
      {/* decorative shapes */}
      <span className="absolute -left-6 -top-8 h-24 w-24 rounded-full" style={{ background: b.deco }} />
      <span className="absolute -bottom-10 right-8 h-28 w-28 rounded-full" style={{ background: b.deco }} />
      <span className="absolute right-24 top-3 h-8 w-8 rotate-45 rounded-lg" style={{ background: b.deco }} />
      <span className="absolute left-1/3 bottom-2 h-4 w-4 rounded-full" style={{ background: b.deco }} />
      <div className="absolute inset-x-4 bottom-3 flex items-end justify-between gap-2">
        <p className="line-clamp-1 font-display text-lg font-bold text-white drop-shadow-sm">{title}</p>
        <span className="shrink-0 rounded-full bg-white/90 px-2.5 py-1 text-xs font-bold text-foreground shadow-sm">+{money(reward)}</span>
      </div>
    </div>
  );
}

export function TaskList({ limit }: { limit?: number }) {
  const { data: tasks, isLoading } = useTasks();
  const { data: subs } = useMySubmissions();
  const [open, setOpen] = useState<Task | null>(null);
  const done = new Map(subs?.map((s) => [s.task_id, "reward_amount" in s ? s.reward_amount : (s.tasks?.reward_amount ?? 0)]));
  const list = limit ? tasks?.slice(0, limit) : tasks;

  if (isLoading) return <div className="space-y-3">{[0, 1, 2].map((k) => <Skeleton key={k} className="h-40 rounded-2xl" />)}</div>;
  if (!list?.length) return <Empty icon={<PlayCircle />} title="No tasks right now" text="Check back soon." />;

  return (
    <>
      <div className="space-y-4">
        {list.map((t, i) => {
          const earned = done.get(t.id);
          const isDone = earned !== undefined;
          return (
            <div key={t.id} className={cn("overflow-hidden rounded-2xl border bg-card shadow-card", isDone && "border-success/40")}>
              <Banner index={i} title={t.title} reward={t.reward_amount} />
              <div className="space-y-3 p-4">
                <p className="line-clamp-2 text-sm text-muted-foreground">{t.description || "Watch the full ad to earn this reward."}</p>
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" /> {AD_SECONDS}s ad</span>
                  <span className="flex items-center gap-1"><Eye className="h-3.5 w-3.5" /> Watch fully to earn</span>
                </div>
                {isDone ? (
                  <div className="flex items-center gap-2 rounded-xl bg-success/10 px-3 py-2.5 text-sm font-semibold text-success">
                    <BadgeCheck className="h-5 w-5" /> Completed · You earned {money(earned)}
                  </div>
                ) : (
                  <Button variant="hero" className="w-full" onClick={() => setOpen(t)}>
                    <PlayCircle /> Start Task · Earn {money(t.reward_amount)}
                  </Button>
                )}
              </div>
            </div>
          );
        })}
      </div>
      {open && <AdPlayer task={open} onClose={() => setOpen(null)} />}
    </>
  );
}

function AdPlayer({ task, onClose }: { task: Task; onClose: () => void }) {
  const qc = useQueryClient();
  const [left, setLeft] = useState(AD_SECONDS);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (left <= 0) return;
    const id = setTimeout(() => setLeft((x) => x - 1), 1000);
    return () => clearTimeout(id);
  }, [left]);

  async function claim() {
    setBusy(true);
    if (readDemoUser()) {
      completeDemoTask(task.id, task.reward_amount);
      toast.success(`${money(task.reward_amount)} earned! Task completed.`);
    } else {
      const { error } = await supabase.rpc("submit_task", { _task_id: task.id, _evidence: `Ad watched fully (${AD_SECONDS}s) at ${new Date().toISOString()}` });
      if (error) { setBusy(false); toast.error(errMsg(error)); return; }
      toast.success(`${money(task.reward_amount)} added to pending — credited after review`);
    }
    setBusy(false);
    qc.invalidateQueries({ queryKey: ["my-subs"] });
    qc.invalidateQueries({ queryKey: ["balances"] });
    onClose();
  }

  const pct = ((AD_SECONDS - left) / AD_SECONDS) * 100;
  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-foreground text-background">
      <div className="flex items-center justify-between gap-3 p-4">
        <div>
          <p className="text-xs opacity-70">You will earn</p>
          <p className="font-display text-2xl font-bold text-accent">{money(task.reward_amount)}</p>
        </div>
        <div className="rounded-full bg-background/15 px-3 py-1 text-sm font-semibold">{left > 0 ? `Ad · ${left}s` : "Done"}</div>
        <button onClick={onClose} aria-label="Close" className="grid h-10 w-10 place-items-center rounded-full bg-background/15"><X className="h-5 w-5" /></button>
      </div>
      <div className="h-1 bg-background/20"><div className="h-full bg-accent transition-all duration-1000" style={{ width: `${pct}%` }} /></div>
      <div className="grid flex-1 place-items-center p-6">
        {/* Simulated ad — replace with a real ad network later */}
        <div className="w-full max-w-md overflow-hidden rounded-3xl bg-hero p-8 text-center text-primary-foreground">
          <p className="text-xs uppercase tracking-widest opacity-70">Sponsored</p>
          <h3 className="mt-3 animate-rise font-display text-3xl font-extrabold">{task.title}</h3>
          <p className="mt-2 text-sm opacity-90">{task.description || "Thanks for watching!"}</p>
        </div>
      </div>
      <div className="p-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
        <Button className="w-full" size="lg" disabled={left > 0 || busy} onClick={claim}>
          {left > 0 ? `Wait ${left}s to claim` : busy ? "Claiming…" : `Claim ${money(task.reward_amount)}`}
        </Button>
        {left > 0 && <p className="mt-2 text-center text-xs opacity-60">Closing now will not give the reward.</p>}
      </div>
    </div>
  );
}
