import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";
import { authorizeAdminRequest } from "@/lib/admin/authorize-admin-request";

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export async function POST(request: NextRequest) {
  const authorization = await authorizeAdminRequest(request);

  if (!authorization.authorized) {
    return NextResponse.json(
      { error: authorization.error },
      { status: authorization.status }
    );
  }

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON request body." },
      { status: 400 }
    );
  }

  const payload =
    typeof body === "object" && body !== null
      ? (body as Record<string, unknown>)
      : {};

  const name =
    typeof payload.name === "string"
      ? payload.name.trim()
      : "";

  if (!name) {
    return NextResponse.json(
      { error: "Organization name is required." },
      { status: 400 }
    );
  }

  const slug = slugify(name);

  const { data: existing, error: existingError } =
    await supabaseServer
      .from("organizations")
      .select("id, name, slug, access_scope")
      .ilike("name", name)
      .limit(1)
      .maybeSingle();

  if (existingError) {
    return NextResponse.json(
      { error: existingError.message },
      { status: 500 }
    );
  }

  if (existing) {
    return NextResponse.json(
      {
        error: "An organization with this name already exists.",
        organization: existing,
      },
      { status: 409 }
    );
  }

  const { data: organization, error: insertError } =
    await supabaseServer
      .from("organizations")
      .insert({
        name,
        slug: slug || null,
        subscription_status: "inactive",
        access_scope: "program",
      })
      .select("id, name, slug, subscription_status, access_scope")
      .single();

  if (insertError) {
    return NextResponse.json(
      { error: insertError.message },
      { status: 500 }
    );
  }

  return NextResponse.json(
    {
      success: true,
      organization,
    },
    { status: 201 }
  );
}