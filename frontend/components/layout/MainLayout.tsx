import Header from "./Header";

export default function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="mx-auto flex h-screen w-full max-w-7xl flex-col px-3 md:px-4">
      <Header />
      <main className="flex-1 overflow-hidden flex flex-col">{children}</main>
    </div>
  );
}
