import { Suspense } from "react";
import CompetitionReportClient from "./CompetitionReportClient";

function ReportLoading() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 text-slate-950">
      <div className="rounded-2xl border border-slate-200 bg-white p-6 font-semibold shadow-sm">
        Loading Competition Intelligence Report...
      </div>
    </div>
  );
}

export default function CompetitionIntelligenceReportPage() {
  return (
    <Suspense fallback={<ReportLoading />}>
      <CompetitionReportClient />
    </Suspense>
  );
}