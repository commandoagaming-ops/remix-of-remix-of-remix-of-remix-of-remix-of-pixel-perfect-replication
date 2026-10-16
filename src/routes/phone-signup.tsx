import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LangSelect, Logo } from "@/components/common";

export const Route = createFileRoute("/phone-signup")({
  head: () => ({
    meta: [
      { title: "Sign up with mobile — Unto Together" },
      { name: "description", content: "Create your Unto Together account with your mobile number and a 4-digit OTP." },
      { property: "og:title", content: "Sign up with mobile — Unto Together" },
      { property: "og:description", content: "Verify your mobile number with a 4-digit OTP." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PhoneSignup,
});

type Country = { name: string; flag: string; dial: string; digits: number };
export const COUNTRIES: Country[] = [
  { name: "India", flag: "🇮🇳", dial: "+91", digits: 10 },
  { name: "United States", flag: "🇺🇸", dial: "+1", digits: 10 },
  { name: "United Kingdom", flag: "🇬🇧", dial: "+44", digits: 10 },
  { name: "UAE", flag: "🇦🇪", dial: "+971", digits: 9 },
  { name: "Saudi Arabia", flag: "🇸🇦", dial: "+966", digits: 9 },
  { name: "Nepal", flag: "🇳🇵", dial: "+977", digits: 10 },
  { name: "Bangladesh", flag: "🇧🇩", dial: "+880", digits: 10 },
  { name: "Pakistan", flag: "🇵🇰", dial: "+92", digits: 10 },
  { name: "Sri Lanka", flag: "🇱🇰", dial: "+94", digits: 9 },
  { name: "Singapore", flag: "🇸🇬", dial: "+65", digits: 8 },
  { name: "Australia", flag: "🇦🇺", dial: "+61", digits: 9 },
  { name: "Canada", flag: "🇨🇦", dial: "+1", digits: 10 },
  { name: "Germany", flag: "🇩🇪", dial: "+49", digits: 11 },
  { name: "Indonesia", flag: "🇮🇩", dial: "+62", digits: 10 },
  { name: "Philippines", flag: "🇵🇭", dial: "+63", digits: 10 },
  { name: "Nigeria", flag: "🇳🇬", dial: "+234", digits: 10 },
];

function PhoneSignup() {
  const nav = useNavigate();
  const [ci, setCi] = useState(0);
  const [phone, setPhone] = useState("");
  const [step, setStep] = useState<"phone" | "otp">("phone");
  const [code, setCode] = useState("");
  const [otp, setOtp] = useState(["", "", "", ""]);
  const [timer, setTimer] = useState(0);
  const refs = useRef<(HTMLInputElement | null)[]>([]);
  const c = COUNTRIES[ci] ?? COUNTRIES[0]!;

  useEffect(() => {
    if (timer <= 0) return;
    const id = setTimeout(() => setTimer(timer - 1), 1000);
    return () => clearTimeout(id);
  }, [timer]);

  function sendOtp() {
    if (phone.length !== c.digits) {
      toast.error(`Enter a ${c.digits}-digit number for ${c.name}`);
      return;
    }
    // Simulation: real SMS will be connected later via an API.
    const next = String(Math.floor(1000 + Math.random() * 9000));
    setCode(next);
    setOtp(["", "", "", ""]);
    setStep("otp");
    setTimer(30);
    toast.success(`OTP sent to ${c.dial} ${phone}`, { description: `Demo OTP: ${next}`, duration: 10000 });
    setTimeout(() => refs.current[0]?.focus(), 50);
  }

  function setDigit(i: number, v: string) {
    const d = v.replace(/\D/g, "").slice(-1);
    const n = [...otp];
    n[i] = d;
    setOtp(n);
    if (d && i < 3) refs.current[i + 1]?.focus();
  }

  function verify(e: React.FormEvent) {
    e.preventDefault();
    if (otp.join("") !== code) {
      toast.error("Wrong OTP, please try again");
      return;
    }
    toast.success("Mobile number verified");
    nav({ to: "/auth", search: { mode: "signup" } });
  }

  return (
    <div className="min-h-screen bg-soft">
      <header className="mx-auto flex max-w-md items-center justify-between px-5 py-5"><Logo /><LangSelect /></header>
      <main className="mx-auto max-w-md px-5 pb-16">
        <div className="rounded-3xl border bg-card p-6 shadow-card">
          {step === "phone" ? (
            <>
              <h1 className="text-2xl font-bold">Sign up with mobile</h1>
              <p className="mt-1 text-sm text-muted-foreground">We'll send a 4-digit OTP to your number.</p>
              <form onSubmit={(e) => { e.preventDefault(); sendOtp(); }} className="mt-5 space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="country">Country</Label>
                  <select
                    id="country"
                    value={ci}
                    onChange={(e) => { setCi(Number(e.target.value)); setPhone(""); }}
                    className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  >
                    {COUNTRIES.map((x, i) => <option key={x.name} value={i}>{x.flag} {x.name} ({x.dial})</option>)}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="phone">Mobile number</Label>
                  <div className="flex gap-2">
                    <span className="flex h-10 items-center rounded-md border bg-muted px-3 text-sm font-medium">{c.dial}</span>
                    <Input
                      id="phone"
                      inputMode="numeric"
                      placeholder={"9".repeat(c.digits)}
                      value={phone}
                      onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, c.digits))}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">{phone.length}/{c.digits} digits</p>
                </div>
                <Button type="submit" variant="hero" size="lg" className="w-full" disabled={phone.length !== c.digits}>Send OTP</Button>
              </form>
            </>
          ) : (
            <>
              <button onClick={() => setStep("phone")} className="mb-3 flex items-center gap-1 text-sm text-muted-foreground"><ArrowLeft className="h-4 w-4" /> Change number</button>
              <h1 className="text-2xl font-bold">Enter OTP</h1>
              <p className="mt-1 text-sm text-muted-foreground">Sent to {c.dial} {phone}</p>
              <form onSubmit={verify} className="mt-5 space-y-5">
                <div className="flex justify-center gap-3">
                  {otp.map((d, i) => (
                    <Input
                      key={i}
                      ref={(el) => { refs.current[i] = el; }}
                      value={d}
                      inputMode="numeric"
                      maxLength={1}
                      aria-label={`OTP digit ${i + 1}`}
                      className="h-14 w-14 text-center text-2xl font-bold"
                      onChange={(e) => setDigit(i, e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Backspace" && !otp[i] && i > 0) refs.current[i - 1]?.focus(); }}
                    />
                  ))}
                </div>
                <Button type="submit" variant="hero" size="lg" className="w-full" disabled={otp.join("").length !== 4}>Verify OTP</Button>
                <p className="text-center text-sm text-muted-foreground">
                  {timer > 0 ? `Resend OTP in ${timer}s` : <button type="button" onClick={sendOtp} className="font-semibold text-primary">Resend OTP</button>}
                </p>
              </form>
            </>
          )}
          <p className="mt-5 text-center text-sm text-muted-foreground">
            Prefer email? <Link to="/auth" search={{ mode: "signup" }} className="font-semibold text-primary">Sign up with email</Link>
          </p>
        </div>
      </main>
    </div>
  );
}
