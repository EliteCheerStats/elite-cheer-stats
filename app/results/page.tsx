"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

type Row = Record<string, any>;

export default function ResultsPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [error, setError] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      const { data, error } = await supabase
        .from("v_event_results_with_week")
        .select("*")
        .limit(50);

      if (cancelled) return;

      if (error) setError(error);
      else setRows(data ?? []);

      setLoading(false);
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const columns = useMemo(() => {
    return rows.length ? Object.keys(rows[0]) : [];
  }, [rows]);

  return (
    <main style={{ padding: 24, fontFamily: "system-ui" }}>
      <h1 style={{ fontSize: 28, fontWeight: 800, marginBottom: 12 }}>
        results_clean
      </h1>

      {loading && <p>Loading…</p>}

      {error && (
        <>
          <p style={{ color: "crimson" }}>Error:</p>
          <pre>{JSON.stringify(error, null, 2)}</pre>
        </>
      )}

      {!loading && !error && rows.length === 0 && <p>No rows returned.</p>}

      {!loading && !error && rows.length > 0 && (
        <div style={{ overflowX: "auto" }}>
          <table cellPadding={10} style={{ borderCollapse: "collapse", width: "100%" }}>
            <thead>
              <tr style={{ textAlign: "left", borderBottom: "2px solid #ddd" }}>
                {columns.map((c) => (
                  <th key={c}>{c}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r, idx) => (
                <tr key={r.id ?? idx} style={{ borderBottom: "1px solid #eee" }}>
                  {columns.map((c) => (
                    <td key={c} style={{ whiteSpace: "nowrap" }}>
                      {r[c] === null || r[c] === undefined ? "—" : String(r[c])}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
