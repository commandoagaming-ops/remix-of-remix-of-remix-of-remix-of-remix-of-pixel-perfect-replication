import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Clock, PlayCircle, X } from "lucide-react";
import { toast } from "sonner";
import { Empty, StatusBadge } from "@/components/common";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { errMsg, money, useMySubmissions, useTasks } from "@/lib/data";

const AD_SECONDS = 15;
type Task = NonNullable<ReturnType<typeof useTasks>["data"]>[number];

export function TaskList({ limit }: { limit?: number }) {
  const { data: tasks, isLoading } = useTasks();
  const { data: subs } = useMySubmissions();
  const [open, setOpen] = useState<Task | null>(null);
  const byTask = new Map(subs?.map((s) => [s.task_id, s.status]));
  const list = limit ? tasks?.slice(0, limit) : tasks;

  if (isLoading) return <div className="space-y-3">{[0, 1, 2].map((k) => <Skeleton key={k} className="h-20 rounded-2xl" />)}</div>;
  if (!list?.length) return <Empty icon={<PlayCircle />} title="No tasks right now" text="Check back soon." />;

  return (
    <>
      <div className="space-y-3">
        {list.map((t) => {
          const st = byTask.get(t.id);
          return (
            <button key={t.id} disabled={!!st} onClick={() => setOpen(t)} className="flex w-full items-center gap-4 rounded-2xl border bg-card p-4 text-left shadow-card transition enabled:hover:-translate-y-0.5 disabled:opacity-80">
              <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-primary-soft text-primary">
                {st ? <CheckCircle2 className="h-6 w-6" /> : <PlayCircle className="h-6 w-6" />}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-semibold">{t.title}</span>
                <span className="flex items-center gap-1 text-xs text-muted-foreground"><Clock className="h-3 w-3" /> Watch ad · {AD_SECONDS}s</span>
              </span>
              <span className="text-right">
                <span className="block font-display font-bold text-primary">+{money(t.reward_amount)}</span>
                {st && <StatusBadge status={st} />}
              </span>
            </button>
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
    const { error } = await supabase.rpc("submit_task", { _task_id: task.id, _evidence: `Ad watched fully (${AD_SECONDS}s) at ${new Date().toISOString()}` });
    setBusy(false);
    if (error) return toast.error(errMsg(error));
    toast.success(`${money(task.reward_amount)} added to pending — credited after review`);
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
