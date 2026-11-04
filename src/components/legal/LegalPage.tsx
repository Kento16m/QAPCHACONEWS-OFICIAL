import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";

type LegalSection = {
  title: string;
  content: ReactNode;
};

export function LegalPage({
  title,
  lastUpdated,
  intro,
  sections,
}: {
  title: string;
  lastUpdated: string;
  intro: ReactNode;
  sections: LegalSection[];
}) {
  return (
    <main className="mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:py-14">
      <div className="rounded-[28px] border border-slate-200 bg-white/90 p-6 shadow-[0_12px_40px_rgba(15,23,42,0.08)] backdrop-blur-sm sm:p-8 lg:p-10">
        <div className="mb-8 flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-5">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">Legal</p>
            <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-900 sm:text-4xl">
              {title}
            </h1>
          </div>
          <Link
            to="/"
            className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-100"
          >
            Volver a la portada
          </Link>
        </div>

        <div className="mb-8 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm leading-7 text-slate-700">
          <p className="font-medium text-slate-900">Última actualización: {lastUpdated}</p>
          <div className="mt-3">{intro}</div>
        </div>

        <div className="space-y-8 text-slate-700">
          {sections.map((section, index) => (
            <section key={section.title} className="scroll-mt-24">
              <h2 className="mb-3 text-xl font-bold text-slate-900 sm:text-2xl">
                {index + 1}. {section.title}
              </h2>
              <div className="space-y-3 text-base leading-8">{section.content}</div>
            </section>
          ))}
        </div>
      </div>
    </main>
  );
}
