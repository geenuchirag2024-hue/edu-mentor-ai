"use client";

import { useEffect, useState } from "react";

export const SUPPORTED_LANGUAGES = [
  { code: "auto", label: "Auto Detect", native: "Auto / ಸ್ವಯಂ / स्वतः", tts: true },
  { code: "en", label: "English", native: "English", tts: true },
  { code: "kn", label: "Kannada", native: "ಕನ್ನಡ", tts: false },
  { code: "hi", label: "Hindi", native: "हिन्दी", tts: true },
  { code: "ta", label: "Tamil", native: "தமிழ்", tts: false },
  { code: "te", label: "Telugu", native: "తెలుగు", tts: false },
  { code: "ml", label: "Malayalam", native: "മലയാളം", tts: false },
  { code: "bn", label: "Bengali", native: "বাংলা", tts: false },
  { code: "mr", label: "Marathi", native: "मराठी", tts: false },
  { code: "gu", label: "Gujarati", native: "ગુજરાતી", tts: false },
];

export default function LanguageSelector() {
  const [locale, setLocale] = useState("auto");

  useEffect(() => {
    try {
      const stored = localStorage.getItem("edu_mentor_language");
      if (stored) setLocale(stored);
    } catch {}

    const handleLanguageChange = (e: Event) => {
      const customEvent = e as CustomEvent<{ language: string }>;
      if (customEvent.detail?.language) {
        setLocale(customEvent.detail.language);
      }
    };

    window.addEventListener("edu_mentor_language_changed", handleLanguageChange);
    return () => {
      window.removeEventListener("edu_mentor_language_changed", handleLanguageChange);
    };
  }, []);

  const handleChange = (newLocale: string) => {
    setLocale(newLocale);
    try {
      localStorage.setItem("edu_mentor_language", newLocale);
    } catch {}
    window.dispatchEvent(
      new CustomEvent("edu_mentor_language_changed", {
        detail: { language: newLocale },
      })
    );
  };

  return (
    <label className="relative inline-flex items-center">
      <span className="pointer-events-none absolute left-2.5 text-slate-400">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="9" />
          <path d="M3 12h18M12 3a15 15 0 0 1 0 18M12 3a15 15 0 0 0 0 18" />
        </svg>
      </span>
      <select
        value={locale}
        onChange={(e) => handleChange(e.target.value)}
        className="appearance-none rounded-full border border-white/80 bg-white/90 py-1.5 pl-8 pr-7 text-xs font-semibold text-slate-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-violet-400 cursor-pointer"
        aria-label="Select language"
      >
        {SUPPORTED_LANGUAGES.map((lang) => (
          <option key={lang.code} value={lang.code}>
            {lang.label} ({lang.native})
          </option>
        ))}
      </select>
    </label>
  );
}
