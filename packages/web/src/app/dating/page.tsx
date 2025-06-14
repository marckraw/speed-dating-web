"use client";

import VideoCallInterface from "@/components/VideoCallInterface";
import { useAuth } from "@/providers/AuthProvider";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function DatingPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.push("/");
    }
  }, [user, loading, router]);

  if (loading || !user) {
    return (
      <main className="container py-8 space-y-6">
        <p>Loading...</p>
      </main>
    );
  }

  return (
    <main className="container py-8 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Speed Dating Room</h1>
        <a
          href="/"
          className="text-muted-foreground hover:text-foreground transition-colors"
        >
          ← Back to Home
        </a>
      </div>

      <VideoCallInterface />
    </main>
  );
}
