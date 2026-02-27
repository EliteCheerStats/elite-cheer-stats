import { supabase } from "@/lib/supabaseClient";

export default async function EventsPage() {
  const TABLE = "events"; // <-- CHANGE THIS if your table is named differently

  const { data, error } = await supabase.from(TABLE).select("*").limit(25);

  return (
    <main style={{ padding: 24, fontFamily: "system-ui" }}>
      <h1 style={{ fontSize: 24, fontWeight: 700 }}>Table: {TABLE}</h1>

      {error ? (
        <>
          <p style={{ color: "crimson" }}>Error:</p>
          <pre>{JSON.stringify(error, null, 2)}</pre>
        </>
      ) : (
        <pre>{JSON.stringify(data, null, 2)}</pre>
      )}
    </main>
  );
}
