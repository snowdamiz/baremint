export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen">
      {/* Sidebar placeholder -- will be expanded with wallet widget in Plan 02 */}
      <aside className="hidden md:flex w-64 flex-col border-r bg-sidebar text-sidebar-foreground">
        <div className="flex h-14 items-center border-b px-4">
          <span className="text-lg font-semibold">Baremint</span>
        </div>
        <nav className="flex-1 p-4 space-y-1">
          <a
            href="/dashboard"
            className="flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium bg-sidebar-accent text-sidebar-accent-foreground"
          >
            Dashboard
          </a>
        </nav>
      </aside>

      {/* Main content */}
      <main className="flex-1">
        <div className="flex h-14 items-center border-b px-6 md:hidden">
          <span className="text-lg font-semibold">Baremint</span>
        </div>
        <div className="p-6">{children}</div>
      </main>
    </div>
  );
}
