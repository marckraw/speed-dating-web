import Link from "next/link";

export default function Home() {
  return (
    <main className="container py-12 space-y-8">
      <div className="text-center space-y-6">
        <h1 className="text-4xl font-bold bg-gradient-to-r from-pink-500 to-red-500 bg-clip-text text-transparent">
          Speed Dating App
        </h1>
        <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
          Connect with new people through quick video chats. Find your match in
          just a few minutes!
        </p>
        <div className="flex justify-center gap-4 pt-6">
          <Link
            href="/dating"
            className="bg-gradient-to-r from-pink-500 to-red-500 text-white px-8 py-3 rounded-lg font-semibold hover:opacity-90 transition-opacity"
          >
            Start Dating 💕
          </Link>
        </div>
      </div>
    </main>
  );
}
