"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";

import { PageLoader } from "@/components/ui/loading";
import { Sidebar } from "@/components/layout/sidebar";
import { useAuth } from "@/contexts/auth-context";

export function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!loading && !user) {
      router.push("/login");
    }
  }, [user, loading, router]);

  useEffect(() => {
    if (!loading && user?.must_change_password && pathname !== "/change-password") {
      router.push("/change-password");
    }
  }, [user, loading, pathname, router]);

  if (loading) return <PageLoader />;
  if (!user) return null;
  if (user.must_change_password) return <PageLoader />;

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-[1600px] px-6 py-8 lg:px-8">{children}</div>
      </main>
    </div>
  );
}
