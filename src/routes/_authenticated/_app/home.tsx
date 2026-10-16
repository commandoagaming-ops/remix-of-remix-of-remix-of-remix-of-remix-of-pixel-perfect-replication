import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Wallet } from "lucide-react";
import { HeroSlider } from "@/components/hero-slider";
import { TaskList } from "@/components/task-list";
import { money, useBalances, useProfile } from "@/lib/data";

export const Route = createFileRoute("/_authenticated/_app/home")({
  head: () => ({ meta: [{ title: "Home — Unto Together" }, { name: "description", content: "Watch, complete tasks and earn rewards." }, { property: "og:title", content: "Home — Unto Together" }, { property: "og:description", content: "Watch, complete tasks and earn rewards." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }] }),
  component: HomePage,
});

function HomePage() {
  const { data: p } = useProfile();
  const { data: b } = useBalances();
  return (
    <div className="space-y-6">
      <HeroSlider />
      <Link to="/account" className="flex items-center justify-between rounded-2xl border bg-card p-4 shadow-card">
        <div>
          <p className="text-xs text-muted-foreground">Hi {p?.full_name?.split(" ")[0]} · Available balance</p>
          <p className="font-display text-2xl font-bold">{money(b?.available)}</p>
          <p className="text-xs text-muted-foreground">Pending {money(b?.pending)} · Earned {money(b?.total_earned)}</p>
        </div>
        <span className="flex items-center gap-1 rounded-xl bg-primary-soft px-3 py-2 text-sm font-semibold text-primary"><Wallet className="h-4 w-4" /> Withdraw</span>
      </Link>
      <div>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-semibold">Tasks</h2>
          <Link to="/tasks" className="flex items-center gap-1 text-sm text-primary">See all <ArrowRight className="h-4 w-4" /></Link>
        </div>
        <TaskList limit={5} />
      </div>
    </div>
  );
}
