"use client";

import type { ReactNode } from "react";
import { useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { MainNav } from "@/components/main-nav";
import { Header } from "@/components/header";
import { QueryProvider } from "@/providers/query-provider";
import { cn } from "@/lib/utils";

interface NavigationLayoutProps {
  children: ReactNode;
}

export function NavigationLayout({ children }: NavigationLayoutProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
  const [isSidebarExpanded, setIsSidebarExpanded] = useState(true);

  const handleLogout = async () => {
    try {
      await fetch("/api/logout", {
        method: "POST",
      });
      router.refresh();
    } catch (error) {
      console.error("Logout error:", error);
    }
  };

  // Don't show navigation on login page
  if (pathname === "/login") {
    return <>{children}</>;
  }

  return (
    <QueryProvider>
      <div className="min-h-screen flex">
        {/* Mobile overlay */}
        {isMobileNavOpen && (
          <div
            className="fixed inset-0 bg-black/50 z-30 md:hidden"
            onClick={() => setIsMobileNavOpen(false)}
          />
        )}
        <MainNav
          className={`${
            isMobileNavOpen ? "translate-x-0" : "-translate-x-full"
          } md:translate-x-0 fixed md:relative top-0 left-0 h-screen z-40 flex-shrink-0`}
          onLogout={handleLogout}
          isExpanded={isSidebarExpanded}
          onExpandedChange={setIsSidebarExpanded}
        />
        <div className="flex-1 flex flex-col min-h-screen min-w-0">
          <Header onToggleNav={() => setIsMobileNavOpen(!isMobileNavOpen)} />
          {pathname === "/figma-analyzer" || pathname === "/chat" ? (
            <main
              className={cn(
                "flex-1 min-w-0",
                pathname === "/chat" && [
                  "overflow-hidden",
                  "h-[calc(100vh-57px)]", // Full height minus header
                ],
                pathname === "/figma-analyzer" && "p-8"
              )}
            >
              {children}
            </main>
          ) : (
            <main className="flex-1 min-w-0">
              <div className="container mx-auto p-4 md:p-8">{children}</div>
            </main>
          )}
        </div>
      </div>
    </QueryProvider>
  );
}
