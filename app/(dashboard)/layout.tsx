"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Search, PlusSquare, Wallet, Settings, User, Sparkles, Trophy, Bell } from "lucide-react";
import { cn } from "@/lib/utils";
import { BottomNav } from "@/components/ui/bottom-nav";
import { NotificationBell } from "@/components/notifications/notification-bell";

const sidebarItems = [
    { href: "/dashboard", icon: Home, label: "Home" },
    { href: "/dashboard/explore", icon: Search, label: "Explore" },
    { href: "/dashboard/leaderboard", icon: Trophy, label: "Leaderboard" },
    { href: "/dashboard/notifications", icon: Bell, label: "Notifications" },
    { href: "/dashboard/create", icon: PlusSquare, label: "Create" },
    { href: "/dashboard/withdraw", icon: Wallet, label: "Wallet" },
    { href: "/dashboard/creator", icon: Sparkles, label: "Creator" },
    { href: "/dashboard/settings", icon: Settings, label: "Settings" },
];

export default function DashboardLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const pathname = usePathname();

    return (
        <div className="flex min-h-screen bg-background">
            {/* Desktop Sidebar */}
            <aside className="hidden md:flex md:w-64 md:flex-col md:fixed md:inset-y-0 border-r bg-card">
                {/* Logo + Notification Bell */}
                <div className="flex h-16 items-center justify-between px-6 border-b">
                    <Link href="/dashboard" className="flex items-center gap-2">
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
                            <span className="font-bold text-primary-foreground text-sm">B</span>
                        </div>
                        <span className="font-semibold text-lg">Baremint</span>
                    </Link>
                    <NotificationBell />
                </div>

                {/* Navigation */}
                <nav className="flex-1 px-3 py-4 space-y-1">
                    {sidebarItems.map((item) => {
                        const isActive =
                            pathname === item.href ||
                            (item.href !== "/dashboard" && pathname.startsWith(item.href));

                        return (
                            <Link
                                key={item.href}
                                href={item.href}
                                className={cn(
                                    "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                                    isActive
                                        ? "bg-primary/10 text-primary"
                                        : "text-muted-foreground hover:bg-accent hover:text-foreground"
                                )}
                            >
                                <item.icon className="h-5 w-5" />
                                {item.label}
                            </Link>
                        );
                    })}
                </nav>

                {/* Profile quick access */}
                <div className="border-t p-3">
                    <Link
                        href="/dashboard/profile"
                        className={cn(
                            "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                            pathname === "/dashboard/profile"
                                ? "bg-primary/10 text-primary"
                                : "text-muted-foreground hover:bg-accent hover:text-foreground"
                        )}
                    >
                        <User className="h-5 w-5" />
                        Profile
                    </Link>
                </div>
            </aside>

            {/* Main Content */}
            <main className="flex-1 md:ml-64">
                {/* Mobile notification bell */}
                <div className="flex md:hidden justify-end px-4 pt-3">
                    <NotificationBell />
                </div>
                <div className="mx-auto max-w-2xl px-4 py-6 pb-24 md:pb-6">
                    {children}
                </div>
            </main>

            {/* Mobile Bottom Nav */}
            <BottomNav />
        </div>
    );
}
