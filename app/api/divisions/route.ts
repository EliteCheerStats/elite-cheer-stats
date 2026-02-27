import { supabaseServer } from "../../../lib/supabaseServer";

export async function GET() {
  const { data, error } = await supabaseServer
    .from("v_rankings_dropdown")
    .select("division_id, division_label, level, age_group, size_category, is_flex, is_d2");

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  const rows = (data ?? []).sort((a: any, b: any) => {
    const score = (d: any) => {
      let s = 0;

      if (d.level === 3) s += 1000;
      if ((d.age_group ?? "").toLowerCase().includes("junior")) s += 500;

      if (d.is_flex === false) s += 200;
      if (d.is_d2 === false) s += 100;

      return s;
    };

    return score(b) - score(a);
  });

  return Response.json({ rows });
}