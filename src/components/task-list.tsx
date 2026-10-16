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

// Cooldown rule: the 2 lowest-paying ads repeat after 1 hour,
// the next one after 2.5 hours, the highest-paying ones after 3 hours.
export function cooldownMinutes(rank: number) {
  if (rank < 2) return 60;
  if (rank === 2) return 150;
  return 180;
}

function fmtLeft(ms: number) {
  const t = Math.max(0, Math.ceil(ms / 1000));
  const h = Math.floor(t / 3600), m = Math.floor((t % 3600) / 60), sec = t % 60;
  return `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}

function useNow() {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const id = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(id); }, []);
  return now;
}

export function TaskList({ limit }: { limit?: number }) {
  const { data: tasks, isLoading } = useTasks();
  const { data: subs } = useMySubmissions();
  const [open, setOpen] = useState<Task | null>(null);
  const now = useNow();
  const stats = new Map<string, { earned: number; last: number }>();
  for (const s of subs ?? []) {
    const amt = Number("reward_amount" in s ? s.reward_amount : (s.tasks?.reward_amount ?? 0));
    const at = new Date(s.submitted_at as string).getTime();
    const cur = stats.get(s.task_id) ?? { earned: 0, last: 0 };
    stats.set(s.task_id, { earned: cur.earned + amt, last: Math.max(cur.last, at) });
  }
  const rankOf = new Map([...(tasks ?? [])].sort((a, b) => a.reward_amount - b.reward_amount).map((t, i) => [t.id, i]));
  const list = limit ? tasks?.slice(0, limit) : tasks;

  if (isLoading) return <div className="space-y-3">{[0, 1, 2].map((k) => <Skeleton key={k} className="h-40 rounded-2xl" />)}</div>;
  if (!list?.length) return <Empty icon={<PlayCircle />} title="No tasks right now" text="Check back soon." />;

  return (
    <>
      <div className="space-y-4">
        {list.map((t, i) => {
          const st = stats.get(t.id);
          const cd = cooldownMinutes(rankOf.get(t.id) ?? 0);
          const readyAt = st ? st.last + cd * 60_000 : 0;
          const isDone = !!st && now < readyAt;
          const earned = st?.earned ?? 0;
          return (
            <div key={t.id} className={cn("overflow-hidden rounded-2xl border bg-card shadow-card", isDone && "border-success/40")}>
              <Banner index={i} title={t.title} reward={t.reward_amount} />
              <div className="space-y-3 p-4">
                <p className="line-clamp-2 text-sm text-muted-foreground">{t.description || "Watch the full ad to earn this reward."}</p>
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" /> {AD_SECONDS}s ad</span>
                  <span className="flex items-center gap-1"><Eye className="h-3.5 w-3.5" /> Repeats every {cd % 60 ? `${(cd / 60).toFixed(1)}h` : `${cd / 60}h`}</span>
                </div>
                {isDone ? (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 rounded-xl bg-success/10 px-3 py-2.5 text-sm font-semibold text-success">
                      <BadgeCheck className="h-5 w-5" /> Completed · You earned {money(earned)}
                    </div>
                    <div className="flex items-center justify-center gap-2 rounded-xl bg-muted px-3 py-2 text-sm font-medium text-muted-foreground">
                      <Clock className="h-4 w-4" /> Available again in <span className="font-mono font-bold text-foreground">{fmtLeft(readyAt - now)}</span>
                    </div>
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

// A random theme is picked each time an ad opens.
const AD_THEMES = [
  { name: "blue", bg: "linear-gradient(160deg, oklch(0.32 0.09 255), oklch(0.5 0.14 245))", card: "linear-gradient(135deg, oklch(0.6 0.15 240), oklch(0.72 0.12 225))", btn: "oklch(0.62 0.17 245)", fg: "oklch(0.98 0 0)" },
  { name: "green", bg: "linear-gradient(160deg, oklch(0.3 0.07 160), oklch(0.45 0.11 155))", card: "linear-gradient(135deg, oklch(0.55 0.13 160), oklch(0.68 0.13 145))", btn: "oklch(0.6 0.15 150)", fg: "oklch(0.98 0 0)" },
  { name: "cream", bg: "linear-gradient(160deg, oklch(0.95 0.035 85), oklch(0.88 0.06 75))", card: "linear-gradient(135deg, oklch(0.75 0.13 70), oklch(0.85 0.1 85))", btn: "oklch(0.55 0.12 60)", fg: "oklch(0.25 0.03 60)" },
  { name: "discord", bg: "linear-gradient(160deg, oklch(0.25 0.02 270), oklch(0.32 0.03 275))", card: "linear-gradient(135deg, oklch(0.55 0.2 275), oklch(0.65 0.17 280))", btn: "oklch(0.58 0.2 275)", fg: "oklch(0.98 0 0)" },
];

function playClaps() {
  try {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new Ctx();
    const len = Math.floor(ctx.sampleRate * 0.06);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3);
    // Many overlapping claps = applause, ~3 seconds
    for (let i = 0; i < 70; i++) {
      const src = ctx.createBufferSource();
      src.buffer = buf;
      const f = ctx.createBiquadFilter(); f.type = "bandpass"; f.frequency.value = 1000 + Math.random() * 1500;
      const g = ctx.createGain(); const t = ctx.currentTime + Math.random() * 2.8;
      g.gain.value = 0.25 + Math.random() * 0.35;
      src.connect(f).connect(g).connect(ctx.destination);
      src.start(t);
    }
    setTimeout(() => ctx.close(), 4000);
  } catch { /* sound not supported */ }
}

function Celebration({ amount, fg }: { amount: number; fg: string }) {
  const bits = Array.from({ length: 40 }, (_, i) => i);
  const colors = ["#FFD54A", "#FF6B6B", "#4ADE80", "#60A5FA", "#F472B6", "#FFFFFF"];
  return (
    <div className="pointer-events-none fixed inset-0 z-[60] grid place-items-center overflow-hidden bg-black/40">
      <style>{`
        @keyframes cel-fall { 0% { transform: translateY(-10vh) rotate(0deg); opacity: 1 } 100% { transform: translateY(110vh) rotate(720deg); opacity: .8 } }
        @keyframes cel-pop { 0% { transform: scale(.3); opacity: 0 } 60% { transform: scale(1.12); opacity: 1 } 100% { transform: scale(1) } }
        @keyframes cel-twinkle { 0%,100% { transform: scale(.6); opacity: .4 } 50% { transform: scale(1.3); opacity: 1 } }
      `}</style>
      {bits.map((i) => (
        <span key={i} className="absolute top-0 text-xl" style={{ left: `${(i * 37) % 100}%`, color: colors[i % colors.length], animation: `cel-fall ${2 + (i % 5) * 0.4}s ${(i % 8) * 0.12}s linear forwards` }}>
          {i % 3 === 0 ? "★" : i % 3 === 1 ? "✦" : "●"}
        </span>
      ))}
      <div className="text-center" style={{ animation: "cel-pop .6s ease-out both", color: fg }}>
        <div className="text-6xl">🎉</div>
        <p className="mt-2 font-display text-4xl font-extrabold text-white drop-shadow">Congrats!</p>
        <p className="mt-1 text-xl font-bold text-white drop-shadow">+{money(amount)} earned</p>
        <div className="mt-3 flex justify-center gap-2 text-2xl text-yellow-300">
          {[0, 1, 2, 3, 4].map((k) => <span key={k} style={{ animation: `cel-twinkle 1s ${k * 0.15}s ease-in-out infinite` }}>★</span>)}
        </div>
      </div>
    </div>
  );
}

function AdPlayer({ task, onClose }: { task: Task; onClose: () => void }) {
  const qc = useQueryClient();
  const [left, setLeft] = useState(AD_SECONDS);
  const [busy, setBusy] = useState(false);
  const [celebrate, setCelebrate] = useState(false);
  const [theme] = useState(() => AD_THEMES[Math.floor(Math.random() * AD_THEMES.length)]!);
  useEffect(() => {
    if (left <= 0) return;
    const id = setTimeout(() => setLeft((x) => x - 1), 1000);
    return () => clearTimeout(id);
  }, [left]);

  async function claim() {
    setBusy(true);
    if (readDemoUser()) {
      completeDemoTask(task.id, task.reward_amount);
    } else {
      const { error } = await supabase.rpc("submit_task", { _task_id: task.id, _evidence: `Ad watched fully (${AD_SECONDS}s) at ${new Date().toISOString()}` });
      if (error) { setBusy(false); toast.error(errMsg(error)); return; }
      toast.success(`${money(task.reward_amount)} added to pending — credited after review`);
    }
    setCelebrate(true);
    playClaps();
    setTimeout(() => {
      setBusy(false);
      qc.invalidateQueries({ queryKey: ["my-subs"] });
      qc.invalidateQueries({ queryKey: ["balances"] });
      onClose();
    }, 3500);
  }

  const pct = ((AD_SECONDS - left) / AD_SECONDS) * 100;
  return (
    <div className="fixed inset-0 z-50 flex flex-col" style={{ background: theme.bg, color: theme.fg }}>
      {celebrate && <Celebration amount={task.reward_amount} fg={theme.fg} />}
      <div className="flex items-center justify-between gap-3 p-4">
        <div>
          <p className="text-xs opacity-70">You will earn</p>
          <p className="font-display text-2xl font-bold">{money(task.reward_amount)}</p>
        </div>
        <div className="rounded-full bg-white/20 px-3 py-1 text-sm font-semibold">{left > 0 ? `Ad · ${left}s` : "Done"}</div>
        <button onClick={onClose} aria-label="Close" className="grid h-10 w-10 place-items-center rounded-full bg-white/20"><X className="h-5 w-5" /></button>
      </div>
      <div className="h-1 bg-white/25"><div className="h-full transition-all duration-1000" style={{ width: `${pct}%`, background: theme.btn }} /></div>{false && <div style={{ width: `${pct}%` }} /></div>
      <div className="grid flex-1 place-items-center p-6">
        {/* Simulated ad — replace with a real ad network later */}
        <div className="w-full max-w-md overflow-hidden rounded-3xl p-8 text-center text-white shadow-2xl" style={{ background: theme.card }}>
          <p className="text-xs uppercase tracking-widest opacity-70">Sponsored</p>
          <h3 className="mt-3 animate-rise font-display text-3xl font-extrabold">{task.title}</h3>
          <p className="mt-2 text-sm opacity-90">{task.description || "Thanks for watching!"}</p>
        </div>
      </div>
      <div className="p-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
        <Button className="w-full border-0 text-white hover:opacity-90" style={{ background: theme.btn }} size="lg" disabled={left > 0 || busy} onClick={claim}>
          {left > 0 ? `Wait ${left}s to claim` : busy ? "Claiming…" : `Claim ${money(task.reward_amount)}`}
        </Button>
        {left > 0 && <p className="mt-2 text-center text-xs opacity-60">Closing now will not give the reward.</p>}
      </div>
    </div>
  );
}
