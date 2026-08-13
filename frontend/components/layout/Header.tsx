import LanguageSelector from "@/components/language/LanguageSelector";

export default function Header() {
  return (
    <header className="border-b border-slate-200 bg-white px-6 py-4 flex items-center justify-between">
      <div>
        <h1 className="text-xl font-bold text-indigo-700">Edu Mentor AI</h1>
        <p className="text-xs text-slate-500">
          Your AI voice mentor for Machine Learning
        </p>
      </div>
      <LanguageSelector />
    </header>
  );
}
