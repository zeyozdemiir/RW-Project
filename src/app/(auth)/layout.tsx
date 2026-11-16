import { BuildingComplex, ShieldCheck, TrendingUp } from "lucide-react";
import { Brand } from "@/components/brand";
import { APP_TAGLINE } from "@/lib/config";

const HIGHLIGHTS = [
  {
    icon: BuildingComplex,
    title: "Tüm portföy tek yerde",
    text: "Kiralık ve satılık portföyler, güncel durumları ve ilan bağlantılarıyla.",
  },
  {
    icon: ShieldCheck,
    title: "Portföy güvencesi",
    text: "Kaydı olmayan bir daireye kontrat yapıldığında üst yönetim anında haberdar olur.",
  },
  {
    icon: TrendingUp,
    title: "Şeffaf ciro ve kazanç",
    text: "Ekip ve danışman bazında kiralama, satış, ciro ve kazanç takibi.",
  },
];

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-dvh lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)]">
      <aside className="relative hidden overflow-hidden bg-ink-950 lg:flex lg:flex-col lg:justify-between lg:p-14 xl:p-20">
        <div
          aria-hidden
          className="absolute inset-0 bg-[radial-gradient(90%_70%_at_15%_0%,rgb(205_170_87/0.16),transparent_60%),radial-gradient(70%_60%_at_100%_100%,rgb(49_98_159/0.22),transparent_65%)]"
        />
        <div
          aria-hidden
          className="absolute inset-0 opacity-[0.07] [background-image:linear-gradient(to_right,white_1px,transparent_1px),linear-gradient(to_bottom,white_1px,transparent_1px)] [background-size:64px_64px] [mask-image:linear-gradient(to_bottom,black,transparent_85%)]"
        />
        <div className="relative">
          <Brand />
        </div>
        <div className="relative max-w-xl">
          <p className="eyebrow text-gold-400">{APP_TAGLINE}</p>
          <h1 className="mt-5 font-display text-[3.25rem] leading-[1.05] text-white xl:text-6xl">
            Ofisinizin tamamı,
            <br />
            <span className="text-gold-300">tek bir bakışta.</span>
          </h1>
          <div className="gold-rule my-10" />
          <ul className="space-y-7">
            {HIGHLIGHTS.map(({ icon: Icon, title, text }) => (
              <li key={title} className="flex gap-4">
                <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-white/[0.06] text-gold-300 ring-1 ring-gold-400/30">
                  <Icon className="size-5" aria-hidden />
                </span>
                <div>
                  <p className="font-medium text-white">{title}</p>
                  <p className="mt-1 text-[0.9375rem] leading-relaxed text-ink-300">{text}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
        <p className="relative text-xs text-ink-400">Verileriniz yalnızca ofisinize özeldir ve şifreli bağlantı üzerinden korunur.</p>
      </aside>

      <main className="flex flex-col">
        <div className="flex items-center bg-ink-950 px-6 py-5 lg:hidden">
          <Brand />
        </div>
        <div className="flex flex-1 items-center justify-center px-5 py-10 sm:px-10">
          <div className="w-full max-w-[26rem]">{children}</div>
        </div>
      </main>
    </div>
  );
}
