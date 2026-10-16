import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, Clock, GraduationCap, History, ListChecks, User, Wallet } from "lucide-react";
import { Card } from "@/components/common";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { money, useBalances, useMySubmissions, useProfile, useSettings, useTasks } from "@/lib/data";
import { useT } from "@/lib/i18n";

export const Route = createFileRoute("/_authenticated/_app/home")({
  head: () => ({ meta: [{ title: "Dashboard — Unto Together" }, { name: "description", content: "Your rewards and activity." }, { property: "og:title", content: "Dashboard — Unto Together" }, { property: "og:description", content: "Your rewards and activity." }] }),
  component: HomePage,
});

function HomePage() {
  const { t } = useT();
  const { data: p } = useProfile();
  const { data: b, isLoading } = useBalances();
  const { data: s } = useSettings();
  const { data: subs } = useMySubmissions();
  const { data: tasks } = useTasks();
  const { data: video } = useQuery({
    queryKey: ["featured-video"],
    queryFn: async () => (await supabase.from("videos").select("*").eq("is_published", true).order("is_featured", { ascending: false }).order("display_order").limit(1).maybeSingle()).data,
  });
  const cur = s?.currency ?? "INR";
  const today = new Date().toDateString();
  const doneToday = subs?.filter((x) => new Date(x.submitted_at).toDateString() === today).length ?? 0;
  const awaiting = subs?.filter((x) => x.status === "under_review" || x.status === "submitted").length ?? 0;
  const submittedIds = new Set(subs?.map((x) => x.task_id));
  const availableCount = tasks?.filter((x) => !submittedIds.has(x.id)).length ?? 0;
  const first = p?.full_name?.split(" ")[0] ?? "";

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="h-12 w-12 overflow-hidden rounded-full bg-primary-soft">
          {p?.avatar_url ? <img src={p.avatar_url} alt="" className="h-full w-full object-cover" /> : <User className="m-3 h-6 w-6 text-primary" />}
        </div>
        <div><p className="text-sm text-muted-foreground">{t("welcome")}</p><h1 className="text-2xl font-bold">{first} 👋</h1></div>
      </div>

      <div className="relative overflow-hidden rounded-3xl bg-hero p-6 text-primary-foreground shadow-elegant">
        <p className="text-sm opacity-85">{t("available")}</p>
        {isLoading ? <Skeleton className="mt-2 h-10 w-40 bg-primary-foreground/20" /> : <p className="mt-1 font-display text-4xl font-bold">{money(b?.available, cur)}</p>}
        <div className="mt-5 flex flex-wrap gap-2">
          <Button asChild variant="glass" size="sm"><Link to="/withdraw"><Wallet /> {t("withdraw")}</Link></Button>
          <Button asChild variant="glass" size="sm"><Link to="/transactions">{t("viewDetails")} <ArrowRight /></Link></Button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <div className="flex items-center gap-2 text-sm text-muted-foreground"><Clock className="h-4 w-4" />{t("pending")}</div>
          <p className="mt-1 font-display text-2xl font-bold">{money(b?.pending, cur)}</p>
          <p className="mt-1 text-xs text-muted-foreground">{t("pendingNote")}</p>
        </Card>
        <Card>
          <div className="text-sm text-muted-foreground">{t("totalEarned")}</div>
          <p className="mt-1 font-display text-2xl font-bold">{money(b?.total_earned, cur)}</p>
          <p className="mt-1 text-xs text-muted-foreground">Paid out: {money(b?.withdrawn, cur)}</p>
        </Card>
      </div>

      <Card>
        <h2 className="mb-4 font-semibold">{t("todayActivity")}</h2>
        <div className="grid grid-cols-3 gap-3 text-center">
          {[[doneToday, t("completedToday")], [availableCount, t("availableToday")], [awaiting, t("awaiting")]].map(([n, l]) => (
            <div key={String(l)} className="rounded-xl bg-muted p-3"><p className="font-display text-2xl font-bold">{n}</p><p className="text-xs text-muted-foreground">{l}</p></div>
          ))}
        </div>
      </Card>

      <div>
        <h2 className="mb-3 font-semibold">{t("quickActions")}</h2>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {([
            ["/tasks", ListChecks, t("exploreTasks")],
            ["/learn", GraduationCap, t("watchGuide")],
            ["/transactions", History, t("txHistory")],
            ["/profile", User, t("manageProfile")],
          ] as const).map(([to, Icon, l]) => (
            <Link key={to} to={to} className="flex flex-col gap-3 rounded-2xl border bg-card p-4 shadow-card transition hover:-translate-y-0.5">
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-primary-soft text-primary"><Icon className="h-5 w-5" /></span>
              <span className="text-sm font-semibold">{l}</span>
            </Link>
          ))}
        </div>
      </div>

      {video && (
        <Card className="overflow-hidden p-0">
          <div className="aspect-video bg-muted"><iframe src={video.video_url} title={video.title} className="h-full w-full" allowFullScreen /></div>
          <div className="p-5">
            <h3 className="font-semibold">{video.title}</h3>
            <p className="mt-1 text-sm text-muted-foreground">{video.description}</p>
            <Button asChild variant="soft" size="sm" className="mt-3"><Link to="/tasks">{t("exploreTasks")} <ArrowRight /></Link></Button>
          </div>
        </Card>
      )}
    </div>
  );
}
