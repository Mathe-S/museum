import Link from "next/link";

export function HeroSection() {
  return (
    <section className="relative isolate flex min-h-screen flex-col items-center justify-center overflow-hidden bg-[#050312] text-center text-white">
      {/* Background Gradients */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(112,63,255,0.2),_transparent_45%),radial-gradient(circle_at_bottom,_rgba(14,184,255,0.2),_transparent_40%)]" />

      {/* Content */}
      <div className="relative z-10 flex max-w-4xl flex-col items-center gap-8 px-6">
        <h1 className="text-5xl font-bold tracking-tight sm:text-7xl bg-gradient-to-b from-white to-white/70 bg-clip-text text-transparent">
          Museum of Digital Memories
        </h1>

        <p className="max-w-xl text-lg text-white/60 sm:text-xl">
          Reimagining the way we experience and share our digital memories.
        </p>

        <div className="flex gap-4">
          <Link
            href="/museum"
            className="inline-flex items-center justify-center rounded-full bg-white px-8 py-4 text-lg font-medium text-black transition-all hover:bg-white/90 hover:scale-105"
          >
            Enter Museum
          </Link>
        </div>
      </div>
    </section>
  );
}
