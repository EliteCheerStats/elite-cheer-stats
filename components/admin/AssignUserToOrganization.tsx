"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

type UserResult = {
  id: string;
  email: string;
  fullName: string | null;
  memberships: Array<{
    organizationId: string;
    organizationName: string;
    role: string;
  }>;
};

type OrganizationResult = {
  id: string;
  name: string;
  slug: string | null;
  subscriptionStatus: string | null;
};
async function getAdminRequestHeaders() {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.access_token) {
    throw new Error("Your session has expired. Please log in again.");
  }

  return {
    Authorization: `Bearer ${session.access_token}`,
  };
}
export default function AssignUserToOrganization() {
  const [email, setEmail] = useState("");
  const [user, setUser] = useState<UserResult | null>(null);
  const [userStatus, setUserStatus] = useState<
    "idle" | "loading" | "found" | "missing" | "error"
  >("idle");

  const [orgQuery, setOrgQuery] = useState("");
  const [orgResults, setOrgResults] = useState<OrganizationResult[]>([]);
  const [selectedOrg, setSelectedOrg] = useState<OrganizationResult | null>(null);
  const [orgLoading, setOrgLoading] = useState(false);

  const [showConfirm, setShowConfirm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const normalizedEmail = useMemo(() => email.trim().toLowerCase(), [email]);

  async function lookupUser() {
    setMessage(null);
    setUser(null);

    if (!normalizedEmail || !normalizedEmail.includes("@")) {
      setUserStatus("error");
      setMessage("Enter a valid email address.");
      return;
    }

    setUserStatus("loading");

    try {
      const authHeaders = await getAdminRequestHeaders();

const response = await fetch(
  `/api/admin/users/lookup?email=${encodeURIComponent(normalizedEmail)}`,
  {
    headers: authHeaders,
  }
);
      const payload = await response.json();

      if (response.status === 404) {
        setUserStatus("missing");
        return;
      }

      if (!response.ok) {
        throw new Error(payload.error || "Unable to look up user.");
      }

      setUser(payload.user);
      setUserStatus("found");
    } catch (error) {
      setUserStatus("error");
      setMessage(error instanceof Error ? error.message : "Unable to look up user.");
    }
  }

  useEffect(() => {
    setSelectedOrg(null);

    if (orgQuery.trim().length < 3) {
      setOrgResults([]);
      return;
    }

    const controller = new AbortController();
    const timeout = setTimeout(async () => {
      setOrgLoading(true);

      try {
        const authHeaders = await getAdminRequestHeaders();

const response = await fetch(
  `/api/admin/organizations/search?q=${encodeURIComponent(orgQuery.trim())}`,
  {
    signal: controller.signal,
    headers: authHeaders,
  }
);
        const payload = await response.json();

        if (!response.ok) {
          throw new Error(payload.error || "Unable to search organizations.");
        }

        setOrgResults(payload.organizations || []);
      } catch (error) {
        if ((error as Error).name !== "AbortError") {
          setMessage(
            error instanceof Error
              ? error.message
              : "Unable to search organizations."
          );
        }
      } finally {
        setOrgLoading(false);
      }
    }, 300);

    return () => {
      controller.abort();
      clearTimeout(timeout);
    };
  }, [orgQuery]);

  async function assignAccess() {
    if (!user || !selectedOrg) return;

    setSaving(true);
    setMessage(null);

    try {
      const authHeaders = await getAdminRequestHeaders();

const response = await fetch("/api/admin/organization-users", {
  method: "POST",
  headers: {
    ...authHeaders,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    userId: user.id,
    organizationId: selectedOrg.id,
    role: "owner",
  }),
});

      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error || "Unable to assign organization access.");
      }

      setMessage(
        `${user.email} now has owner access to ${selectedOrg.name}.`
      );
      setShowConfirm(false);
      await lookupUser();
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Unable to assign organization access."
      );
    } finally {
      setSaving(false);
    }
  }

  const alreadyAssigned =
    !!user &&
    !!selectedOrg &&
    user.memberships.some(
      (membership) => membership.organizationId === selectedOrg.id
    );

  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-5">
          <h2 className="text-lg font-bold text-slate-950">1. Find user</h2>
          <p className="mt-1 text-sm text-slate-600">
            The user must already have an ECS account.
          </p>
        </div>

        <label className="text-sm font-semibold text-slate-800">User email</label>
        <div className="mt-2 flex gap-3">
          <input
            type="email"
            value={email}
            onChange={(event) => {
              setEmail(event.target.value);
              setUser(null);
              setUserStatus("idle");
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter") void lookupUser();
            }}
            placeholder="user@example.com"
            className="min-w-0 flex-1 rounded-xl border border-slate-300 px-4 py-3 outline-none ring-blue-500 transition focus:ring-2"
          />
          <button
            type="button"
            onClick={lookupUser}
            disabled={userStatus === "loading"}
            className="rounded-xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white disabled:opacity-50"
          >
            {userStatus === "loading" ? "Searching..." : "Find user"}
          </button>
        </div>

        {userStatus === "missing" && (
          <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            No ECS account was found for <strong>{normalizedEmail}</strong>.
            Ask the user to create an account, then try again.
          </div>
        )}

        {user && (
          <div className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50 p-4">
            <div className="text-sm font-semibold text-emerald-900">
              User found
            </div>
            <div className="mt-2 text-lg font-bold text-slate-950">
              {user.fullName || user.email}
            </div>
            <div className="text-sm text-slate-600">{user.email}</div>

            <div className="mt-4 border-t border-emerald-200 pt-4">
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Existing organization access
              </div>

              {user.memberships.length === 0 ? (
                <div className="mt-2 text-sm text-slate-600">None</div>
              ) : (
                <div className="mt-2 space-y-2">
                  {user.memberships.map((membership) => (
                    <div
                      key={membership.organizationId}
                      className="rounded-lg bg-white px-3 py-2 text-sm text-slate-700"
                    >
                      <span className="font-semibold">
                        {membership.organizationName}
                      </span>
                      <span className="ml-2 text-slate-500">
                        {membership.role}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-5">
          <h2 className="text-lg font-bold text-slate-950">
            2. Select organization
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            Enter at least 3 characters. Results load on demand.
          </p>
        </div>

        <label className="text-sm font-semibold text-slate-800">
          Organization
        </label>

        <input
          type="text"
          value={orgQuery}
          onChange={(event) => setOrgQuery(event.target.value)}
          placeholder="Start typing an organization name..."
          className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 outline-none ring-blue-500 transition focus:ring-2"
        />

        {orgQuery.trim().length > 0 && orgQuery.trim().length < 3 && (
          <p className="mt-2 text-sm text-slate-500">
            Type at least 3 characters to search.
          </p>
        )}

        {orgLoading && (
          <p className="mt-3 text-sm text-slate-500">Searching organizations...</p>
        )}

        {!selectedOrg && orgResults.length > 0 && (
          <div className="mt-3 overflow-hidden rounded-xl border border-slate-200">
            {orgResults.map((organization) => (
              <button
                key={organization.id}
                type="button"
                onClick={() => {
                  setSelectedOrg(organization);
                  setOrgQuery(organization.name);
                  setOrgResults([]);
                }}
                className="block w-full border-b border-slate-100 px-4 py-3 text-left last:border-b-0 hover:bg-slate-50"
              >
                <div className="font-semibold text-slate-950">
                  {organization.name}
                </div>
                <div className="mt-1 text-xs text-slate-500">
                  {organization.slug || organization.id}
                  {organization.subscriptionStatus
                    ? ` • ${organization.subscriptionStatus}`
                    : ""}
                </div>
              </button>
            ))}
          </div>
        )}

        {selectedOrg && (
          <div className="mt-5 rounded-xl border border-blue-200 bg-blue-50 p-4">
            <div className="text-sm font-semibold text-blue-900">
              Selected organization
            </div>
            <div className="mt-2 text-lg font-bold text-slate-950">
              {selectedOrg.name}
            </div>
            <div className="text-sm text-slate-600">
              {selectedOrg.slug || selectedOrg.id}
            </div>
          </div>
        )}

        <button
          type="button"
          disabled={!user || !selectedOrg || alreadyAssigned}
          onClick={() => setShowConfirm(true)}
          className="mt-6 w-full rounded-xl bg-blue-600 px-5 py-3 font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {alreadyAssigned ? "User already assigned" : "Review assignment"}
        </button>
      </section>

      {message && (
        <div className="xl:col-span-2 rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-800">
          {message}
        </div>
      )}

      {showConfirm && user && selectedOrg && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/60 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl">
            <div className="text-sm font-semibold uppercase tracking-wide text-blue-600">
              Confirm assignment
            </div>
            <h3 className="mt-2 text-2xl font-bold text-slate-950">
              Add organization access?
            </h3>

            <div className="mt-5 space-y-4 rounded-xl bg-slate-50 p-4">
              <div>
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  User
                </div>
                <div className="mt-1 font-semibold text-slate-950">
                  {user.fullName || user.email}
                </div>
                <div className="text-sm text-slate-600">{user.email}</div>
              </div>

              <div>
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Organization
                </div>
                <div className="mt-1 font-semibold text-slate-950">
                  {selectedOrg.name}
                </div>
              </div>

              <div>
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Role
                </div>
                <div className="mt-1 font-semibold text-slate-950">Owner</div>
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowConfirm(false)}
                disabled={saving}
                className="rounded-xl border border-slate-300 px-4 py-3 font-semibold text-slate-700"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={assignAccess}
                disabled={saving}
                className="rounded-xl bg-blue-600 px-4 py-3 font-semibold text-white disabled:opacity-50"
              >
                {saving ? "Assigning..." : "Confirm assignment"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
