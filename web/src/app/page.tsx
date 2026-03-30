"use client";

import { useState, useEffect } from "react";
import { dict, type Locale } from "@/lib/i18n";
import Dashboard from "@/components/Dashboard";
import ThemeToggle from "@/components/ThemeToggle";
import LangSwitch from "@/components/LangSwitch";

function Clock() {
  const [time, setTime] = useState("");
  useEffect(() => {
    const update = () => {
      const d = new Date();
      setTime(`${d.getHours()}:${String(d.getMinutes()).padStart(2, "0")}`);
    };
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, []);
  return <span className="font-[var(--font-mono)]">{time}</span>;
}

export default function Home() {
  const [locale, setLocale] = useState<Locale>("en");

  useEffect(() => {
    const saved = localStorage.getItem("locale") as Locale | null;
    if (saved && ["en", "zh", "ja"].includes(saved)) setLocale(saved);
  }, []);

  function changeLocale(l: Locale) {
    setLocale(l);
    localStorage.setItem("locale", l);
  }

  const t = dict[locale];

  return (
    <>
      {/* Nav */}
      <nav className="flex justify-between items-center px-4 md:px-6 py-4 border-b border-neutral-200 dark:border-neutral-800">
        <a
          href="/"
          className="font-mono text-sm font-bold tracking-tight dark:text-white text-neutral-900"
        >
          fuck-ai
        </a>
        <div className="flex items-center gap-3 md:gap-4 text-xs">
          <LangSwitch current={locale} onChange={changeLocale} />
          <ThemeToggle />
          <a
            href="https://github.com/jt-wang/fuck-ai"
            target="_blank"
            className="text-neutral-500 hover:text-neutral-300 transition-colors hidden sm:inline"
          >
            GitHub
          </a>
          <a
            href="https://x.com/thejingtao"
            target="_blank"
            className="text-neutral-500 hover:text-neutral-300 transition-colors hidden sm:inline"
          >
            X
          </a>
          <a
            href="https://www.linkedin.com/in/jingtao-wang/"
            target="_blank"
            className="text-neutral-500 hover:text-neutral-300 transition-colors hidden sm:inline"
          >
            LinkedIn
          </a>
        </div>
      </nav>

      {/* Header */}
      <header className="text-center px-4 pt-10 pb-6 md:pt-16 md:pb-8 max-w-xl mx-auto">
        <h1 className="font-mono text-4xl md:text-5xl font-extrabold tracking-tighter dark:text-white text-neutral-900">
          {t.title}
        </h1>
        <p className="mt-3 text-base md:text-lg dark:text-neutral-200 text-neutral-700">
          {t.tagline}
        </p>
        <p className="mt-2 text-sm dark:text-neutral-500 text-neutral-500">
          {t.description}
          <br />
          <code className="text-xs bg-neutral-100 dark:bg-neutral-900 px-1.5 py-0.5 rounded border border-neutral-200 dark:border-neutral-800">
            /fuck
          </code>{" "}
          — {t.cta}
        </p>
        <div className="mt-4 font-mono text-xs text-neutral-400 dark:text-neutral-600">
          <Clock />
        </div>
      </header>

      {/* Install bar */}
      <div className="text-center py-3 border-y border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950">
        <code className="text-sm bg-white dark:bg-black px-3 py-1 rounded border border-neutral-200 dark:border-neutral-800 font-mono">
          npx fk-ai
        </code>
        <span className="block text-[11px] text-neutral-400 dark:text-neutral-600 mt-1">
          {t.install}
        </span>
      </div>

      {/* Dashboard */}
      <main className="max-w-5xl mx-auto px-4 py-6 md:py-10">
        <Dashboard locale={locale} />
      </main>

      {/* Methodology */}
      <section className="max-w-5xl mx-auto px-4 py-8 md:py-12 border-t border-neutral-200 dark:border-neutral-800">
        <h3 className="text-[11px] font-semibold uppercase tracking-widest text-neutral-400 dark:text-neutral-600 mb-6">
          {t.how_it_works}
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8">
          {(["layer1", "layer2", "signal"] as const).map((key) => (
            <div key={key}>
              <div className="font-mono text-[10px] uppercase tracking-widest text-neutral-400 dark:text-neutral-600 mb-1">
                {t[`${key}_label`]}
              </div>
              <div className="text-sm font-semibold mb-1 dark:text-neutral-200 text-neutral-800">
                {t[`${key}_name`]}
              </div>
              <div className="text-xs text-neutral-500 dark:text-neutral-500 leading-relaxed">
                {t[`${key}_desc`]}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-neutral-200 dark:border-neutral-800 py-6 text-center">
        <div className="flex justify-center gap-3 text-xs text-neutral-500">
          <a
            href="https://github.com/jt-wang/fuck-ai"
            className="hover:text-neutral-300 transition-colors"
          >
            {t.source}
          </a>
          <span className="text-neutral-300 dark:text-neutral-700">&middot;</span>
          <a
            href="https://x.com/thejingtao"
            className="hover:text-neutral-300 transition-colors"
          >
            @thejingtao
          </a>
          <span className="text-neutral-300 dark:text-neutral-700">&middot;</span>
          <a
            href="https://www.linkedin.com/in/jingtao-wang/"
            className="hover:text-neutral-300 transition-colors"
          >
            LinkedIn
          </a>
        </div>
        <p className="text-[11px] text-neutral-400 dark:text-neutral-600 mt-2">
          {t.footer_open}
        </p>
      </footer>
    </>
  );
}
