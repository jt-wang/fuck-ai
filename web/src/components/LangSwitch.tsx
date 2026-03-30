"use client";

import { type Locale, locales } from "@/lib/i18n";

const labels: Record<Locale, string> = { en: "EN", zh: "中", ja: "日" };

export default function LangSwitch({
  current,
  onChange,
}: {
  current: Locale;
  onChange: (l: Locale) => void;
}) {
  return (
    <div className="flex gap-2 text-xs">
      {locales.map((l) => (
        <button
          key={l}
          onClick={() => onChange(l)}
          className={`transition-colors ${
            l === current
              ? "text-neutral-200 dark:text-neutral-200"
              : "text-neutral-500 hover:text-neutral-300"
          }`}
        >
          {labels[l]}
        </button>
      ))}
    </div>
  );
}
