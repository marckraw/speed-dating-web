import VideoCallInterface from "@/components/VideoCallInterface";

export default function DatingPage() {
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
