import { db } from "@/lib/db";
import { requireProject } from "@/lib/auth";
import { getProvider } from "@/lib/providers";
import { CalendarView, type CalendarEvent } from "./calendar-view";

export default async function CalendarPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ ym?: string }>;
}) {
  const { slug } = await params;
  const sp = await searchParams;
  const { project } = await requireProject(slug);

  // ym format: "YYYY-MM". Default to current month in server's local time —
  // matches the user's browser sufficiently well for this view.
  const now = new Date();
  let year = now.getFullYear();
  let month = now.getMonth(); // 0-indexed
  if (sp.ym && /^\d{4}-\d{2}$/.test(sp.ym)) {
    const [y, m] = sp.ym.split("-").map(Number);
    year = y;
    month = m - 1;
  }

  const monthStart = new Date(year, month, 1);
  const monthEnd = new Date(year, month + 1, 1);

  // Pull every target whose scheduled or posted date falls in the month.
  // We render one card per (post, target) combo grouped by date.
  const targets = await db.postTarget.findMany({
    where: {
      post: { projectId: project.id },
      OR: [
        { scheduledFor: { gte: monthStart, lt: monthEnd } },
        { postedAt: { gte: monthStart, lt: monthEnd } },
      ],
    },
    include: {
      post: { select: { id: true, topic: true, name: true, format: true, imageUrls: true } },
    },
  });

  const events: CalendarEvent[] = targets.map((t) => {
    const meta = getProvider(t.provider).meta;
    const date = t.postedAt ?? t.scheduledFor!;
    return {
      id: t.id,
      postId: t.postId,
      postName: t.post.name,
      topic: t.post.topic,
      coverUrl: ((t.post.imageUrls as string[]) ?? [])[0] ?? null,
      provider: t.provider,
      providerName: meta.name,
      providerColor: meta.color,
      status: t.status,
      date: date.toISOString(),
      providerUrl: t.providerUrl,
    };
  });

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-xl font-semibold">Calendar</h2>
        <p className="text-sm text-muted-foreground">
          Scheduled and posted across all channels.
        </p>
      </div>
      <CalendarView slug={slug} year={year} month={month} events={events} />
    </div>
  );
}
