"use client";

import Link from "next/link";
import {
  CalendarCheck,
  ClipboardList,
  UserCheck,
  UserPlus,
  Users,
} from "lucide-react";

import { useAuth } from "@/contexts/auth-context";
import { cn } from "@/lib/utils";

const actions = [
  {
    href: "/attendance/check-in",
    label: "Check In Child",
    description: "Search and check in",
    icon: UserCheck,
    roles: ["admin", "worker"],
    primary: true,
  },
  {
    href: "/attendance/check-out",
    label: "Check Out Child",
    description: "Release by tag number",
    icon: ClipboardList,
    roles: ["admin", "worker"],
    primary: true,
  },
  {
    href: "/children",
    label: "Children",
    description: "Search & pickup photos",
    icon: Users,
    roles: ["admin", "worker"],
  },
  {
    href: "/children/new",
    label: "Register Child",
    description: "Add new child & parent",
    icon: UserPlus,
    roles: ["admin"],
  },
  {
    href: "/parents",
    label: "Parent Directory",
    description: "View & search parents",
    icon: Users,
    roles: ["admin", "worker"],
  },
  {
    href: "/worker-attendance",
    label: "Worker Attendance",
    description: "Mark workers present",
    icon: CalendarCheck,
    roles: ["admin"],
  },
];

export function QuickActions() {
  const { user } = useAuth();
  const visible = actions.filter((a) => user && a.roles.includes(user.role));

  return (
    <section aria-label="Quick actions">
      <h2 className="text-2xl font-semibold tracking-tight mb-4">Quick Actions</h2>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {visible.map((action) => {
          const Icon = action.icon;
          return (
            <Link
              key={action.href}
              href={action.href}
              className={cn(
                "group flex flex-col gap-3 rounded-xl border p-5 transition-all duration-200",
                "hover:shadow-md hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                action.primary
                  ? "border-primary/20 bg-primary text-primary-foreground hover:bg-primary/90"
                  : "border-border bg-card hover:border-primary/30 hover:bg-accent/50",
              )}
            >
              <div
                className={cn(
                  "flex h-11 w-11 items-center justify-center rounded-lg transition-colors",
                  action.primary
                    ? "bg-white/15 group-hover:bg-white/20"
                    : "bg-primary/10 text-primary group-hover:bg-primary/15",
                )}
              >
                <Icon className="h-5 w-5" aria-hidden="true" />
              </div>
              <div>
                <p className="text-base font-semibold leading-tight">{action.label}</p>
                <p
                  className={cn(
                    "mt-1 text-sm",
                    action.primary ? "text-primary-foreground/80" : "text-muted-foreground",
                  )}
                >
                  {action.description}
                </p>
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
