import { NextResponse } from "next/server";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const teamId = body?.teamId;

    if (!teamId) {
      return NextResponse.json({ error: "Missing teamId" }, { status: 400 });
    }

    const cookieStore = await cookies();

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return cookieStore.get(name)?.value;
          },
          set(name: string, value: string, options: CookieOptions) {
            try {
              cookieStore.set({ name, value, ...options });
            } catch {}
          },
          remove(name: string, options: CookieOptions) {
            try {
              cookieStore.set({ name, value: "", ...options });
            } catch {}
          },
        },
      }
    );

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError) {
      return NextResponse.json(
        { error: `Auth error: ${userError.message}` },
        { status: 401 }
      );
    }

    if (!user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const { error: deleteError } = await supabase
      .from("user_followed_teams")
      .delete()
      .eq("user_id", user.id)
      .eq("team_id", teamId);

    if (deleteError) {
      return NextResponse.json(
        { error: `Delete error: ${deleteError.message}` },
        { status: 400 }
      );
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? `Server error: ${error.message}` : "Unknown server error",
      },
      { status: 500 }
    );
  }
}