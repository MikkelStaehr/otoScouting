import { getPlayerDetail } from "@/lib/similar";
import { reportInsights } from "@/lib/report";
import { ReportView } from "@/components/report-view";

export const dynamic = "force-dynamic";

export default async function ReportPage({ params }: { params: Promise<{ key: string }> }) {
  const { key } = await params;
  const detail = getPlayerDetail(decodeURIComponent(key));
  if (!detail) {
    return (
      <div className="mx-auto max-w-2xl p-10 text-center font-mono text-sm text-muted">
        Spiller ikke fundet.
      </div>
    );
  }
  return <ReportView detail={detail} insights={reportInsights(detail)} />;
}
