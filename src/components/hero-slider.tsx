import { useEffect, useState } from "react";
import { SLIDES } from "@/lib/slides";
import { cn } from "@/lib/utils";

export function HeroSlider() {
  const [i, setI] = useState(0);
  useEffect(() => {
    const id = setTimeout(() => setI((x) => (x + 1) % SLIDES.length), SLIDES[i].video ? 9000 : 5000);
    return () => clearTimeout(id);
  }, [i]);

  return (
    <div className="relative aspect-[16/9] overflow-hidden rounded-3xl bg-hero text-primary-foreground shadow-elegant">
      {SLIDES.map((s, n) => (
        <div key={n} className={cn("absolute inset-0 transition-opacity duration-700", n === i ? "opacity-100" : "pointer-events-none opacity-0")}>
          {s.video ? (
            <video src={s.video} className="h-full w-full object-cover" autoPlay muted loop playsInline />
          ) : (
            <div className="relative grid h-full place-items-center overflow-hidden p-6 text-center">
              <div className="absolute -left-10 -top-10 h-40 w-40 animate-float rounded-full bg-primary-foreground/10" />
              <div className="absolute -bottom-12 right-0 h-48 w-48 animate-float rounded-full bg-accent/30 [animation-delay:1.5s]" />
              {n === i && (
                <div key={i}>
                  <h2 className="animate-rise font-display text-3xl font-extrabold sm:text-5xl">{s.title}</h2>
                  <p className="mt-2 animate-rise text-sm opacity-90 [animation-delay:.3s] sm:text-base">{s.sub}</p>
                </div>
              )}
            </div>
          )}
        </div>
      ))}
      <div className="absolute inset-x-0 bottom-3 flex justify-center gap-2">
        {SLIDES.map((_, n) => (
          <button key={n} aria-label={`Slide ${n + 1}`} onClick={() => setI(n)} className={cn("h-2 rounded-full bg-primary-foreground/50 transition-all", n === i ? "w-6 bg-primary-foreground" : "w-2")} />
        ))}
      </div>
    </div>
  );
}
