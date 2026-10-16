import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LangSelect, Logo } from "@/components/common";
import { supabase } from "@/integrations/supabase/client";
import { useT } from "@/lib/i18n";
import { GoogleIcon, googleSignIn } from "@/components/google";

export const Route = createFileRoute("/auth")({
  validateSearch: (s: Record<string, unknown>) => ({ mode: s.mode === "signup" ? ("signup" as const) : ("login" as const) }),
  head: () => ({
    meta: [
      { title: "Log in or sign up — Unto Together" },
      { name: "description", content: "Access your Unto Together account." },
      { property: "og:title", content: "Log in — Unto Together" },
      { property: "og:description", content: "Access your Unto Together account." },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const { mode } = Route.useSearch();
  const { t } = useT();
  const nav = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => data.session && nav({ to: "/home" }));
    const { data } = supabase.auth.onAuthStateChange((_e, s) => s && nav({ to: "/home" }));
    return () => data.subscription.unsubscribe();
  }, [nav]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({ email, password, options: { emailRedirectTo: window.location.origin } });
        if (error) throw error;
        setSent(true);
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-soft">
      <header className="mx-auto flex max-w-md items-center justify-between px-5 py-5"><Logo /><LangSelect /></header>
      <main className="mx-auto max-w-md px-5 pb-16">
        <div className="rounded-3xl border bg-card p-6 shadow-card">
          <h1 className="text-2xl font-bold">{mode === "signup" ? "Create your account" : t("login")}</h1>
          {sent ? (
            <p className="mt-4 rounded-xl bg-primary-soft p-4 text-sm text-primary">Check your email and click the confirmation link to activate your account.</p>
          ) : (
            <>
              <Button variant="outline" size="lg" className="mt-5 w-full" onClick={googleSignIn}><GoogleIcon /> Continue with Google</Button>
              <div className="my-5 flex items-center gap-3 text-xs text-muted-foreground"><span className="h-px flex-1 bg-border" />or<span className="h-px flex-1 bg-border" /></div>
              <form onSubmit={submit} className="space-y-4">
                <div className="space-y-1.5"><Label htmlFor="email">{t("email")}</Label><Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></div>
                <div className="space-y-1.5"><Label htmlFor="pw">Password</Label><Input id="pw" type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} /></div>
                <Button type="submit" variant="hero" size="lg" className="w-full" disabled={busy}>{busy ? "…" : mode === "signup" ? "Sign up" : t("login")}</Button>
              </form>
            </>
          )}
          <p className="mt-5 text-center text-sm text-muted-foreground">
            {mode === "signup" ? (
              <>{t("haveAccount")} <Link to="/auth" search={{ mode: "login" }} className="font-semibold text-primary">{t("login")}</Link></>
            ) : (
              <>New here? <Link to="/auth" search={{ mode: "signup" }} className="font-semibold text-primary">Create an account</Link></>
            )}
          </p>
        </div>
      </main>
    </div>
  );
}
