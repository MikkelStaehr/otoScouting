import { getTeamReport, teamReportInsights } from "@/lib/team-report";
import { TeamReportView } from "@/components/team-report-view";

export const dynamic = "force-dynamic";

export default async function TeamReportPage({ params }: { params: Promise<{ key: string }> }) {
  const { key } = await params;
  const [league, team] = decodeURIComponent(key).split("::");
  const report = league && team ? getTeamReport(league, team) : null;
  if (!report) {
    return (
      <div className="mx-auto max-w-2xl p-10 text-center font-mono text-sm text-muted">
        Hold ikke fundet.
      </div>
    );
  }
  return <TeamReportView report={report} insights={teamReportInsights(report)} />;
}
