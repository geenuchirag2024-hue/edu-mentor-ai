import LanguageSelector from "@/components/language/LanguageSelector";

export default function Header() {
  return (
    <header className="glass-bar flex h-14 shrink-0 items-center justify-between gap-3 px-3 md:px-4">
      <div className="flex min-w-0 items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500 to-indigo-600 text-white shadow-md shadow-violet-500/30">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
            <path d="M12 3 2 8l10 5 8-4v6h2V8L12 3zm-6 9.2V16c0 2.2 2.7 4 6 4s6-1.8 6-4v-3.8l-6 3-6-3z" />
          </svg>
        </div>
        <div className="min-w-0">
          <h1 className="truncate text-[18px] font-bold tracking-tight text-slate-900">
            Edu Mentor AI
          </h1>
          <p className="hidden text-[11px] font-medium tracking-wide text-slate-400 sm:block">
            Learn • Ask • Practice • Grow
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2.5">
        <LanguageSelector />
        <div className="hidden items-center gap-1.5 rounded-full border border-emerald-100 bg-emerald-50/90 px-2.5 py-1 text-xs font-semibold text-emerald-700 sm:flex">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 mira-status-pulse" />
          Online
        </div>
        <div
          className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-violet-400 to-indigo-600 text-[11px] font-semibold text-white shadow-sm ring-2 ring-white"
          title="Learner"
        >
          You
        </div>
      </div>
    </header>
  );
}
