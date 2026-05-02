import Link from "next/link";
import { ArrowRight, Sparkles, ImageIcon, Brain, Cloud, Layers } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getCurrentUser } from "@/lib/auth";

export default async function Home() {
  const user = await getCurrentUser();
  return (
    <div className="min-h-screen">
      <header className="px-6 py-5 flex items-center justify-between max-w-6xl mx-auto">
        <Link href="/" className="font-display text-xl font-bold tracking-tight">
          <span>marketing</span>
          <span className="accent-text">en</span>
        </Link>
        <nav className="flex items-center gap-3">
          {user ? (
            <Button asChild>
              <Link href="/app">Open dashboard</Link>
            </Button>
          ) : (
            <>
              <Button asChild variant="ghost">
                <Link href="/login">Sign in</Link>
              </Button>
              <Button asChild>
                <Link href="/register">Get started</Link>
              </Button>
            </>
          )}
        </nav>
      </header>

      <main className="max-w-6xl mx-auto px-6 pt-20 pb-32">
        <section>
          <div className="eyebrow mb-6">
            <Sparkles className="w-3.5 h-3.5" />
            AI-powered social campaigns
          </div>
          <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold tracking-tight leading-[0.95] mb-6 max-w-4xl">
            Generate full social campaigns from <span className="accent-text">one idea</span>.
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl leading-relaxed mb-10">
            Set your brand once. Add ideas to a queue. The AI generates on-brand posts that
            never repeat themselves, renders the slides as images, and stores them in your cloud.
          </p>
          <div className="flex gap-3">
            <Button asChild size="lg">
              <Link href="/register">
                Start your campaign <ArrowRight className="w-4 h-4" />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link href="/login">Sign in</Link>
            </Button>
          </div>
        </section>

        <section className="mt-24 grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <FeatureCard
            icon={Brain}
            title="Brand-aware AI"
            body="Configure once — colors, voice, audience, pricing. Every post matches automatically."
          />
          <FeatureCard
            icon={Layers}
            title="Campaign memory"
            body="The AI sees your last 8 posts and rotates content pillars. No repeats."
          />
          <FeatureCard
            icon={ImageIcon}
            title="Auto-rendered slides"
            body="7 slide types. Playwright renders to PNG. Captions ready to paste."
          />
          <FeatureCard
            icon={Cloud}
            title="Cloudflare R2 storage"
            body="Your images live on R2. Public URLs, low cost, your account."
          />
        </section>
      </main>
    </div>
  );
}

function FeatureCard({
  icon: Icon,
  title,
  body,
}: {
  icon: typeof Sparkles;
  title: string;
  body: string;
}) {
  return (
    <div className="card-surface p-6">
      <div className="w-10 h-10 rounded-xl bg-accent/10 border border-accent/20 flex items-center justify-center mb-4">
        <Icon className="w-5 h-5 text-accent" />
      </div>
      <h3 className="font-semibold mb-2">{title}</h3>
      <p className="text-sm text-muted-foreground leading-relaxed">{body}</p>
    </div>
  );
}
