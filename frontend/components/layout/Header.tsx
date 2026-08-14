import LanguageSelector from "@/components/language/LanguageSelector";
import NavBar from "./NavBar";

export default function Header() {
  return (
    <header className="border-b border-slate-200 bg-white px-4 py-3 md:px-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-indigo-700">Edu Mentor AI</h1>
          <p className="text-xs text-slate-500">
            An interactive AI tutor — teaches, listens, evaluates, and adapts
          </p>
        </div>
        <LanguageSelector />
      </div>
      <div className="mt-3">
        <NavBar />
      </div>
    </header>
  );
}
