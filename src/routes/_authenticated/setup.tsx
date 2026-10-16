import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Camera, Check, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { LangSelect, Logo } from "@/components/common";
import { supabase } from "@/integrations/supabase/client";
import { useProfile, errMsg } from "@/lib/data";
import { LANGS, useT, type Lang } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { fileToAvatar } from "@/lib/avatar";
import { clearPending, readPending } from "@/lib/pending-signup";
import { demoSignIn, readDemoUser } from "@/lib/demo-auth";

export const Route = createFileRoute("/_authenticated/setup")({
  head: () => ({ meta: [{ title: "Complete your profile — Unto Together" }, { name: "description", content: "Set up your Unto Together profile." }, { property: "og:title", content: "Profile setup — Unto Together" }, { property: "og:description", content: "Set up your profile." }] }),
  component: Setup,
});

function Setup() {
  const { t, setLang } = useT();
  const nav = useNavigate();
  const qc = useQueryClient();
  const { data: p } = useProfile();
  const [step, setStep] = useState(0);
  const [f, setF] = useState({ full_name: "", phone: "", country: "India", preferred_language: "en", avatar_url: "" as string | null });
  const [email, setEmail] = useState("");
  const [agree, setAgree] = useState(false);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (p) {
      const pend = readPending();
      setF({ full_name: p.full_name || pend.full_name || "", phone: p.phone || pend.phone || "", country: p.country ?? "India", preferred_language: p.preferred_language ?? "en", avatar_url: p.avatar_url || pend.avatar_url || null });
      setEmail(p.email ?? "");
    }
  }, [p]);

  const valid0 = !!f.avatar_url;
  const valid1 = f.full_name.trim().length >= 2 && /^\+?[0-9 ]{8,16}$/.test(f.phone.trim()) && f.country.trim();

  async function finish() {
    setBusy(true);
    if (readDemoUser()) {
      // Demo mode: no backend — save details locally and go Home.
      demoSignIn({ full_name: f.full_name.trim(), phone: f.phone.trim(), ...(f.avatar_url ? { avatar_url: f.avatar_url } : {}), email });
      setBusy(false);
      clearPending();
      setLang(f.preferred_language as Lang);
      nav({ to: "/home" });
      return;
    }
    const { error } = await supabase.from("profiles").update({ ...f, full_name: f.full_name.trim(), phone: f.phone.trim(), profile_completed: true }).eq("id", p!.id);
    setBusy(false);
    if (error) { toast.error(errMsg(error)); return; }
    clearPending();
    setLang(f.preferred_language as Lang);
    await qc.invalidateQueries({ queryKey: ["profile"] });
    nav({ to: "/home" });
  }

  const steps = [t("photo"), t("personal"), t("review")];
  return (
    <div className="min-h-screen bg-soft">
      <header className="mx-auto flex max-w-lg items-center justify-between px-5 py-5"><Logo /><LangSelect /></header>
      <main className="mx-auto max-w-lg px-5 pb-16">
        <h1 className="text-2xl font-bold">{t("setupTitle")}</h1>
        <div className="my-5 flex gap-2">
          {steps.map((s, i) => (
            <div key={s} className="flex-1">
              <div className={cn("h-1.5 rounded-full", i <= step ? "bg-primary" : "bg-border")} />
              <p className={cn("mt-1.5 text-xs", i === step ? "font-semibold text-foreground" : "text-muted-foreground")}>{s}</p>
            </div>
          ))}
        </div>
        <div className="rounded-3xl border bg-card p-6 shadow-card">
          {step === 0 && (
            <div className="flex flex-col items-center gap-4">
              <div className="grid h-32 w-32 place-items-center overflow-hidden rounded-full bg-primary-soft text-primary">
                {f.avatar_url ? <img src={f.avatar_url} alt="Preview" className="h-full w-full object-cover" /> : <Camera className="h-10 w-10" />}
              </div>
              <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={async (e) => {
                const file = e.target.files?.[0]; if (!file) return;
                try { setF({ ...f, avatar_url: await fileToAvatar(file) }); } catch (err) { toast.error(errMsg(err)); }
              }} />
              <div className="flex gap-2">
                <Button variant="soft" onClick={() => fileRef.current?.click()}><Camera /> {f.avatar_url ? "Change" : "Upload"}</Button>
                {f.avatar_url && <Button variant="ghost" onClick={() => setF({ ...f, avatar_url: null })}><Trash2 /> Remove</Button>}
              </div>
              <p className="text-xs text-muted-foreground">JPG, PNG or WEBP · up to 5 MB · required</p>
            </div>
          )}
          {step === 1 && (
            <div className="space-y-4">
              <Field label={t("fullName")}><Input value={f.full_name} onChange={(e) => setF({ ...f, full_name: e.target.value })} maxLength={80} /></Field>
              <Field label={t("email")}><Input value={email} disabled /></Field>
              <Field label={t("mobile")}><Input value={f.phone} placeholder="+91 98765 43210" onChange={(e) => setF({ ...f, phone: e.target.value })} /></Field>
              <Field label={t("country")}><Input value={f.country} onChange={(e) => setF({ ...f, country: e.target.value })} maxLength={56} /></Field>
              <Field label={t("language")}>
                <select className="h-10 w-full rounded-xl border border-input bg-card px-3 text-sm" value={f.preferred_language} onChange={(e) => setF({ ...f, preferred_language: e.target.value })}>
                  {LANGS.map((l) => <option key={l.code} value={l.code}>{l.label}</option>)}
                </select>
              </Field>
            </div>
          )}
          {step === 2 && (
            <div className="space-y-3 text-sm">
              {[[t("fullName"), f.full_name], [t("email"), email], [t("mobile"), f.phone], [t("country"), f.country], [t("language"), LANGS.find((l) => l.code === f.preferred_language)?.label]].map(([k, v]) => (
                <div key={k} className="flex justify-between border-b pb-2"><span className="text-muted-foreground">{k}</span><span className="font-medium">{v}</span></div>
              ))}
              <label className="flex items-start gap-3 pt-2">
                <Checkbox checked={agree} onCheckedChange={(v) => setAgree(!!v)} />
                <span>{t("acceptTerms")}</span>
              </label>
            </div>
          )}
          <div className="mt-6 flex justify-between gap-2">
            <Button variant="ghost" disabled={step === 0} onClick={() => setStep(step - 1)}>{t("back")}</Button>
            {step < 2 ? (
              <Button onClick={() => setStep(step + 1)} disabled={(step === 0 && !valid0) || (step === 1 && !valid1)}>{t("next")}</Button>
            ) : (
              <Button variant="hero" disabled={!agree || busy || !valid0 || !valid1} onClick={finish}><Check /> {t("toDashboard")}</Button>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-1.5"><Label>{label}</Label>{children}</div>;
}
