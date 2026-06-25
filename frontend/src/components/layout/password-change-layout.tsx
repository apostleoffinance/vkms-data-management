"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";

import { Button } from "@/components/ui/button";
import { PageLoader } from "@/components/ui/loading";
import { useAuth } from "@/contexts/auth-context";
import { BRAND } from "@/lib/brand";

export function PasswordChangeLayout({ children }: { children: React.ReactNode }) {
  const { user, loading, logout } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.push("/login");
    }
  }, [user, loading, router]);

  useEffect(() => {
    if (!loading && user && !user.must_change_password) {
      router.push("/dashboard");
    }
  }, [user, loading, router]);

  if (loading) return <PageLoader />;
  if (!user) return null;

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header
        className="flex items-center justify-between border-b border-black/10 px-6 py-4"
        style={{ backgroundColor: BRAND.yellow, color: BRAND.black }}
      >
        <div>
          <h1 className="text-lg font-bold text-black dark:text-black">VKMS</h1>
          <p className="text-sm text-black/70 dark:text-black/70">Password change required</p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="text-black/80 hover:bg-black/10 hover:text-black dark:text-black dark:hover:bg-black/10 dark:hover:text-black"
          onClick={logout}
        >
          <LogOut className="h-4 w-4 mr-2" />
          Logout
        </Button>
      </header>
      <main className="flex flex-1 items-center justify-center p-6">{children}</main>
    </div>
  );
}
