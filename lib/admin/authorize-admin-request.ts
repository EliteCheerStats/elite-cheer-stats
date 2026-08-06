import type { User } from "@supabase/supabase-js";
import { supabaseServer } from "@/lib/supabaseServer";

const ADMIN_EMAILS = new Set(["itrevinoz2@aol.com"]);

type AdminAuthorizationResult =
  | {
      authorized: true;
      user: User;
    }
  | {
      authorized: false;
      error: string;
      status: number;
    };

export async function authorizeAdminRequest(
  request: Request
): Promise<AdminAuthorizationResult> {
  const authorization = request.headers.get("authorization");

  if (!authorization?.startsWith("Bearer ")) {
    return {
      authorized: false,
      error: "Missing authorization token.",
      status: 401,
    };
  }

  const accessToken = authorization.slice("Bearer ".length).trim();

  if (!accessToken) {
    return {
      authorized: false,
      error: "Missing authorization token.",
      status: 401,
    };
  }

  const {
    data: { user },
    error,
  } = await supabaseServer.auth.getUser(accessToken);

  if (error || !user?.email) {
    return {
      authorized: false,
      error: "Invalid or expired session.",
      status: 401,
    };
  }

  if (!ADMIN_EMAILS.has(user.email.toLowerCase())) {
    return {
      authorized: false,
      error: "Administrator access is required.",
      status: 403,
    };
  }

  return {
    authorized: true,
    user,
  };
}