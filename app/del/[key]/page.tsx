import { getPlayerDetail } from "@/lib/similar";
import { shareCaption } from "@/lib/share";
import { ShareSlides } from "@/components/share-card";

export const dynamic = "force-dynamic";

export default async function SharePage({ params }: { params: Promise<{ key: string }> }) {
  const { key } = await params;
  const detail = getPlayerDetail(decodeURIComponent(key));
  if (!detail) {
    return (
      <div className="mx-auto max-w-2xl p-10 text-center font-mono text-sm text-muted">
        Spiller ikke fundet.
      </div>
    );
  }
  return (
    <div className="min-h-dvh py-6">
      <div className="mx-auto max-w-[560px] px-4">
        <a href={`/report/${encodeURIComponent(detail.key)}`} className="font-mono text-xs text-muted hover:text-fg">
          ← rapport
        </a>
      </div>
      <ShareSlides detail={detail} caption={shareCaption(detail)} />
    </div>
  );
}
