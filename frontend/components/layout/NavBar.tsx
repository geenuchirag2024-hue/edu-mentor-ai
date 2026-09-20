"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/chat", label: "Tutor" },
  { href: "/quiz", label: "Quiz" },
  { href: "/interview", label: "Interview" },
  { href: "/notes", label: "Notes" },
  { href: "/progress", label: "Progress" },
];

export default function NavBar() {
  const pathname = usePathname();

  return (
    <nav
      className="flex flex-1 flex-wrap justify-center gap-0.5 rounded-full bg-slate-100/80 p-1"
      aria-label="Main"
    >
      {LINKS.map((link) => {
        const active = pathname === link.href || pathname.startsWith(`${link.href}/`);
        return (
          <Link
            key={link.href}
            href={link.href}
            className={`rounded-full px-3.5 py-1.5 text-[13px] font-medium transition-colors ${
              active
                ? "bg-white text-slate-900 shadow-sm"
                : "text-slate-500 hover:text-slate-800"
            }`}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
