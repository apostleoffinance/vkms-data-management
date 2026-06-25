"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  CalendarCheck,
  ClipboardList,
  Home,
  LogOut,
  Moon,
  Sun,
  UserCheck,
  UserPlus,
  Users,
  Upload,
} from "lucide-react";
import { useTheme } from "next-themes";

import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/auth-context";
import { BRAND } from "@/lib/brand";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: Home, roles: ["admin", "worker"] },
  { href: "/attendance/check-in", label: "Check In", icon: UserCheck, roles: ["admin", "worker"] },
  { href: "/attendance/check-out", label: "Check Out", icon: ClipboardList, roles: ["admin", "worker"] },
  { href: "/worker-attendance", label: "Worker Attendance", icon: CalendarCheck, roles: ["admin"] },
  { href: "/children/new", label: "Register Child", icon: UserPlus, roles: ["admin"] },
  { href: "/admin/bulk-import", label: "Bulk Import", icon: Upload, roles: ["admin"] },
  { href: "/admin/workers", label: "Manage Workers", icon: Users, roles: ["admin"] },
  { href: "/parents", label: "Parents", icon: Users, roles: ["admin", "worker"] },
  { href: "/reports", label: "Reports", icon: BarChart3, roles: ["admin"] },
  { href: "/admin/users", label: "Manage Users", icon: Users, roles: ["admin"] },
  { href: "/admin/services", label: "Services", icon: CalendarCheck, roles: ["admin"] },
];

export function Sidebar() {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const { theme, setTheme } = useTheme();

  const filteredNav = navItems.filter((item) => user && item.roles.includes(user.role));

  return (
    <aside
      className="flex h-screen w-72 shrink-0 flex-col border-r border-black/10"
      style={{ backgroundColor: BRAND.yellow, color: BRAND.black }}
      aria-label="Main navigation"
    >
      <div className="border-b border-black/10 px-6 py-6">
        <h1 className="text-xl font-bold tracking-tight" style={{ color: BRAND.black }}>
          VKMS
        </h1>
        <p className="mt-1 text-sm opacity-70" style={{ color: BRAND.black }}>
          Votage Kids Management
        </p>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto px-4 py-5" aria-label="Sidebar navigation">
        {filteredNav.map((item) => {
          const Icon = item.icon;
          const active = pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-base font-medium transition-all duration-150",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/30 focus-visible:ring-offset-2",
                active
                  ? "bg-black text-white dark:bg-black dark:text-white"
                  : "text-black hover:bg-black/10 hover:text-black dark:text-black dark:hover:bg-black/10 dark:hover:text-black",
              )}
            >
              <Icon className="h-5 w-5 shrink-0" aria-hidden="true" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-black/10 px-4 py-5 space-y-1">
        {user && (
          <div className="mb-3 rounded-lg bg-black/5 px-3 py-3" style={{ color: BRAND.black }}>
            <p className="text-sm font-semibold">
              {user.first_name} {user.last_name}
            </p>
            <p className="text-sm opacity-70 capitalize">{user.role}</p>
          </div>
        )}
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start text-base font-medium text-black hover:bg-black/10 hover:text-black dark:text-black dark:hover:bg-black/10 dark:hover:text-black"
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
        >
          {theme === "dark" ? <Sun className="h-5 w-5 mr-3" /> : <Moon className="h-5 w-5 mr-3" />}
          Toggle Theme
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start text-base font-medium text-red-700 hover:bg-black/10 hover:text-red-800 dark:text-red-700 dark:hover:text-red-800"
          onClick={logout}
        >
          <LogOut className="h-5 w-5 mr-3" />
          Logout
        </Button>
      </div>
    </aside>
  );
}
