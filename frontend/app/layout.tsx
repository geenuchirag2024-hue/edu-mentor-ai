import type { Metadata } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import StudySessionTracker from "@/components/study/StudySessionTracker";
import "./globals.css";

const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["500", "600", "700", "800"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Edu Mentor AI",
  description: "AI voice mentor for Machine Learning",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){
              try {
                var t = localStorage.getItem('edu_mentor_theme');
                var d = t === 'dark' || (t === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
                if (d) document.documentElement.classList.add('dark');
              } catch (e) {}
            })();`,
          }}
        />
      </head>
      <body className={jakarta.className}>
        <StudySessionTracker />
        {children}
      </body>
    </html>
  );
}
