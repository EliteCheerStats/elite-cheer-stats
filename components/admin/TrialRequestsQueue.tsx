"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

type TrialRequest = {
  id: string;
  request_type: string;
  status: string;
  gym_name: string;
  gym_location: string;
  requester_name: string;
  requester_email: string;
  requester_role: string;
  is_multi_location: boolean;
  team_list_text: string | null;
  user_id: string | null;
  organization_id: string | null;
  admin_notes: string | null;
  provisioned_by: string | null;
  provisioned_at: string | null;
  created_at: string;
  updated_at: string;
};

type OrganizationResult = {
  id: string;
  name: string;
  slug: string | null;
  subscriptionStatus: string | null;
};

type ProgramResult = {
  id: string;
  name: string;
  match_key: string;
};

type TeamResult = {
  id: string;
  program_id: string;
  name: string;
  match_key: string;
};

function formatStatus(status: string) {
  return status.replaceAll("_", " ");
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function getStatusClasses(status: string) {
  switch (status) {
    case "pending":
      return "border-amber-200 bg-amber-50 text-amber-800";
    case "awaiting_information":
      return "border-blue-200 bg-blue-50 text-blue-800";
    case "ready_to_provision":
      return "border-purple-200 bg-purple-50 text-purple-800";
    case "provisioned":
      return "border-emerald-200 bg-emerald-50 text-emerald-800";
    case "declined":
    case "cancelled":
      return "border-red-200 bg-red-50 text-red-800";
    default:
      return "border-slate-200 bg-slate-50 text-slate-700";
  }
}

export default function TrialRequestsQueue() {
  const [requests, setRequests] = useState<TrialRequest[]>([]);
  const [selectedRequest, setSelectedRequest] =
    useState<TrialRequest | null>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [draftStatus, setDraftStatus] = useState("pending");
  const [draftNotes, setDraftNotes] = useState("");
  const [savingDetails, setSavingDetails] = useState(false);
  const [saveMessage, setSaveMessage] = useState("");

  const [showProvisioning, setShowProvisioning] = useState(false);

  const [orgQuery, setOrgQuery] = useState("");
  const [orgResults, setOrgResults] = useState<OrganizationResult[]>([]);
  const [selectedOrg, setSelectedOrg] =
    useState<OrganizationResult | null>(null);
  const [orgLoading, setOrgLoading] = useState(false);
  const [orgCreating, setOrgCreating] = useState(false);
  const [orgSearchComplete, setOrgSearchComplete] = useState(false);

  const [provisionRole, setProvisionRole] = useState("owner");
  const [trialDays, setTrialDays] = useState(7);

  const [provisioning, setProvisioning] = useState(false);
  const [provisionMessage, setProvisionMessage] = useState("");

  const [programQuery, setProgramQuery] = useState("");
  const [programResults, setProgramResults] = useState<ProgramResult[]>([]);
  const [selectedProgram, setSelectedProgram] =
    useState<ProgramResult | null>(null);
  const [programLoading, setProgramLoading] = useState(false);

  const [teamQuery, setTeamQuery] = useState("");
  const [teamResults, setTeamResults] = useState<TeamResult[]>([]);
  const [selectedTeams, setSelectedTeams] = useState<TeamResult[]>([]);
  const [teamLoading, setTeamLoading] = useState(false);

  const [locationOrganizationName, setLocationOrganizationName] =
    useState("");

  useEffect(() => {
    void loadRequests();
  }, []);

  useEffect(() => {
    if (!selectedRequest) {
      setDraftStatus("pending");
      setDraftNotes("");
      setSaveMessage("");
      setShowProvisioning(false);

      setSelectedOrg(null);
      setOrgQuery("");
      setOrgResults([]);
      setOrgSearchComplete(false);
      setProvisionMessage("");

      setProgramQuery("");
      setProgramResults([]);
      setSelectedProgram(null);

      setTeamQuery("");
      setTeamResults([]);
      setSelectedTeams([]);

      setLocationOrganizationName("");

      return;
    }

    setDraftStatus(selectedRequest.status);
    setDraftNotes(selectedRequest.admin_notes ?? "");
    setSaveMessage("");

    setShowProvisioning(false);

    setSelectedOrg(null);
    setOrgQuery("");
    setOrgResults([]);
    setOrgSearchComplete(false);

    setProvisionMessage("");

    setProgramQuery("");
    setProgramResults([]);
    setSelectedProgram(null);

    setTeamQuery("");
    setTeamResults([]);
    setSelectedTeams([]);

    setLocationOrganizationName(
      selectedRequest.is_multi_location
        ? selectedRequest.gym_name
        : ""
    );
  }, [selectedRequest]);

  useEffect(() => {
    if (
      !showProvisioning ||
      selectedRequest?.is_multi_location ||
      selectedOrg ||
      orgQuery.trim().length < 3
    ) {
      setOrgResults([]);
      setOrgSearchComplete(false);
      return;
    }

    const controller = new AbortController();

    const timeout = setTimeout(async () => {
      setOrgLoading(true);
      setOrgSearchComplete(false);

      try {
        const authHeaders = await getAdminHeaders();

        const response = await fetch(
          `/api/admin/organizations/search?q=${encodeURIComponent(
            orgQuery.trim()
          )}`,
          {
            headers: authHeaders,
            signal: controller.signal,
          }
        );

        const payload = await response.json();

        if (!response.ok) {
          throw new Error(
            payload.error ?? "Unable to search organizations."
          );
        }

        setOrgResults(payload.organizations ?? []);
        setOrgSearchComplete(true);
      } catch (searchError) {
        if ((searchError as Error).name !== "AbortError") {
          setProvisionMessage(
            searchError instanceof Error
              ? searchError.message
              : "Unable to search organizations."
          );
          setOrgSearchComplete(true);
        }
      } finally {
        setOrgLoading(false);
      }
    }, 300);

    return () => {
      controller.abort();
      clearTimeout(timeout);
    };
  }, [
    orgQuery,
    showProvisioning,
    selectedRequest?.is_multi_location,
    selectedOrg,
  ]);

  useEffect(() => {
    if (
      !showProvisioning ||
      selectedProgram ||
      programQuery.trim().length < 2
    ) {
      setProgramResults([]);
      return;
    }

    const controller = new AbortController();

    const timeout = setTimeout(async () => {
      setProgramLoading(true);

      try {
        const authHeaders = await getAdminHeaders();

        const response = await fetch(
          `/api/admin/programs/search?q=${encodeURIComponent(
            programQuery.trim()
          )}`,
          {
            headers: authHeaders,
            signal: controller.signal,
          }
        );

        const payload = await response.json();

        if (!response.ok) {
          throw new Error(
            payload.error ?? "Unable to search programs."
          );
        }

        setProgramResults(payload.programs ?? []);
      } catch (searchError) {
        if ((searchError as Error).name !== "AbortError") {
          setProvisionMessage(
            searchError instanceof Error
              ? searchError.message
              : "Unable to search programs."
          );
        }
      } finally {
        setProgramLoading(false);
      }
    }, 300);

    return () => {
      controller.abort();
      clearTimeout(timeout);
    };
  }, [programQuery, showProvisioning, selectedProgram]);

  useEffect(() => {
    if (
      !showProvisioning ||
      !selectedRequest?.is_multi_location ||
      !selectedProgram
    ) {
      setTeamResults([]);
      return;
    }

    const controller = new AbortController();

    const timeout = setTimeout(async () => {
      setTeamLoading(true);

      try {
        const authHeaders = await getAdminHeaders();

        const params = new URLSearchParams({
          programId: selectedProgram.id,
        });

        if (teamQuery.trim()) {
          params.set("q", teamQuery.trim());
        }

        const response = await fetch(
          `/api/admin/teams/search?${params.toString()}`,
          {
            headers: authHeaders,
            signal: controller.signal,
          }
        );

        const payload = await response.json();

        if (!response.ok) {
          throw new Error(
            payload.error ?? "Unable to load teams."
          );
        }

        setTeamResults(payload.teams ?? []);
      } catch (searchError) {
        if ((searchError as Error).name !== "AbortError") {
          setProvisionMessage(
            searchError instanceof Error
              ? searchError.message
              : "Unable to load teams."
          );
        }
      } finally {
        setTeamLoading(false);
      }
    }, 250);

    return () => {
      controller.abort();
      clearTimeout(timeout);
    };
  }, [
    teamQuery,
    selectedProgram,
    showProvisioning,
    selectedRequest?.is_multi_location,
  ]);

  async function getAdminHeaders() {
    const {
      data: { session },
      error: sessionError,
    } = await supabase.auth.getSession();

    if (sessionError) {
      throw new Error(sessionError.message);
    }

    if (!session?.access_token) {
      throw new Error(
        "Your session has expired. Please log in again."
      );
    }

    return {
      Authorization: `Bearer ${session.access_token}`,
    };
  }

  function addTeam(team: TeamResult) {
    setSelectedTeams((current) => {
      if (current.some((selected) => selected.id === team.id)) {
        return current;
      }

      return [...current, team];
    });
  }

  function removeTeam(teamId: string) {
    setSelectedTeams((current) =>
      current.filter((team) => team.id !== teamId)
    );
  }

  async function loadRequests() {
    setLoading(true);
    setError("");

    try {
      const authHeaders = await getAdminHeaders();

      const response = await fetch("/api/admin/trial-requests", {
        headers: authHeaders,
      });

      const payload = await response.json();

      if (!response.ok) {
        throw new Error(
          payload.error ?? "Unable to load trial requests."
        );
      }

      const loadedRequests =
        (payload.requests ?? []) as TrialRequest[];

      setRequests(loadedRequests);

      setSelectedRequest((currentRequest) => {
        if (!currentRequest) {
          return null;
        }

        return (
          loadedRequests.find(
            (request) => request.id === currentRequest.id
          ) ?? null
        );
      });
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Unable to load trial requests."
      );
    } finally {
      setLoading(false);
    }
  }

  async function saveRequestDetails() {
    if (!selectedRequest) return;

    setSavingDetails(true);
    setSaveMessage("");

    try {
      const authHeaders = await getAdminHeaders();

      const response = await fetch("/api/admin/trial-requests", {
        method: "PATCH",
        headers: {
          ...authHeaders,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          requestId: selectedRequest.id,
          status: draftStatus,
          adminNotes: draftNotes,
        }),
      });

      const payload = await response.json();

      if (!response.ok) {
        throw new Error(
          payload.error ?? "Unable to save request."
        );
      }

      const updatedRequest = payload.request as TrialRequest;

      setRequests((currentRequests) =>
        currentRequests.map((request) =>
          request.id === updatedRequest.id
            ? updatedRequest
            : request
        )
      );

      setSelectedRequest(updatedRequest);
      setSaveMessage("Request updated.");
    } catch (saveError) {
      setSaveMessage(
        saveError instanceof Error
          ? saveError.message
          : "Unable to save request."
      );
    } finally {
      setSavingDetails(false);
    }
  }

  async function createOrganization() {
    const organizationName = orgQuery.trim();

    if (!organizationName) {
      return;
    }

    setOrgCreating(true);
    setProvisionMessage("");

    try {
      const authHeaders = await getAdminHeaders();

      const response = await fetch(
        "/api/admin/organizations/create",
        {
          method: "POST",
          headers: {
            ...authHeaders,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            name: organizationName,
          }),
        }
      );

      const payload = await response.json();

      if (!response.ok) {
        throw new Error(
          payload.error ?? "Unable to create organization."
        );
      }

      const created = payload.organization;

      const organization: OrganizationResult = {
        id: created.id,
        name: created.name,
        slug: created.slug ?? null,
        subscriptionStatus:
          created.subscriptionStatus ??
          created.subscription_status ??
          null,
      };

      setSelectedOrg(organization);
      setOrgQuery(organization.name);
      setOrgResults([]);
      setOrgSearchComplete(false);

      setProvisionMessage(
        `${organization.name} created and selected.`
      );
    } catch (createError) {
      setProvisionMessage(
        createError instanceof Error
          ? createError.message
          : "Unable to create organization."
      );
    } finally {
      setOrgCreating(false);
    }
  }

  async function provisionTrial() {
    if (
      !selectedRequest ||
      !selectedOrg ||
      !selectedProgram
    ) {
      return;
    }

    setProvisioning(true);
    setProvisionMessage("");

    try {
      const authHeaders = await getAdminHeaders();

      const response = await fetch(
        "/api/admin/trial-requests/provision",
        {
          method: "POST",
          headers: {
            ...authHeaders,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            requestId: selectedRequest.id,
            organizationId: selectedOrg.id,
            programId: selectedProgram.id,
            role: provisionRole,
            trialDays,
          }),
        }
      );

      const payload = await response.json();

      if (!response.ok) {
        throw new Error(
          payload.error ?? "Unable to provision trial."
        );
      }

      setProvisionMessage(
        "Gym Dashboard trial provisioned successfully."
      );

      setShowProvisioning(false);

      setSelectedOrg(null);
      setOrgQuery("");
      setOrgResults([]);
      setOrgSearchComplete(false);

      setSelectedProgram(null);
      setProgramQuery("");
      setProgramResults([]);

      await loadRequests();
    } catch (provisionError) {
      setProvisionMessage(
        provisionError instanceof Error
          ? provisionError.message
          : "Unable to provision trial."
      );
    } finally {
      setProvisioning(false);
    }
  }

  async function provisionMultiLocationTrial() {
    if (
      !selectedRequest ||
      !selectedProgram ||
      selectedTeams.length === 0 ||
      !locationOrganizationName.trim()
    ) {
      return;
    }

    setProvisioning(true);
    setProvisionMessage("");

    try {
      const authHeaders = await getAdminHeaders();

      const response = await fetch(
        "/api/admin/trial-requests/provision-multi-location",
        {
          method: "POST",
          headers: {
            ...authHeaders,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            requestId: selectedRequest.id,
            organizationName:
              locationOrganizationName.trim(),
            programId: selectedProgram.id,
            teamIds: selectedTeams.map((team) => team.id),
            role: provisionRole,
            trialDays,
          }),
        }
      );

      const payload = await response.json();

      if (!response.ok) {
        throw new Error(
          payload.error ??
            "Unable to provision multi-location trial."
        );
      }

      setProvisionMessage(
        "Multi-location Gym Dashboard trial provisioned successfully."
      );

      await loadRequests();
    } catch (provisionError) {
      setProvisionMessage(
        provisionError instanceof Error
          ? provisionError.message
          : "Unable to provision multi-location trial."
      );
    } finally {
      setProvisioning(false);
    }
  }

  if (loading) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-6 text-slate-700 shadow-sm">
        Loading trial requests...
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-red-700">
        {error}
      </div>
    );
  }

  return (
    <div className="grid gap-5 2xl:grid-cols-[minmax(0,1fr)_380px]">
      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-4">
          <div>
            <h2 className="font-bold text-slate-950">
              Trial Request Queue
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              {requests.length} request
              {requests.length === 1 ? "" : "s"}
            </p>
          </div>

          <button
            type="button"
            onClick={() => void loadRequests()}
            className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            Refresh
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead className="bg-slate-100">
              <tr className="text-left text-sm font-semibold text-slate-700">
                <th className="px-4 py-4">Gym</th>
                <th className="px-4 py-4">Type</th>
                <th className="px-4 py-4">Requester</th>
                <th className="px-4 py-4">Status</th>
                <th className="px-4 py-4">Submitted</th>
              </tr>
            </thead>

            <tbody>
              {requests.map((request) => {
                const isSelected =
                  selectedRequest?.id === request.id;

                return (
                  <tr
                    key={request.id}
                    onClick={() =>
                      setSelectedRequest(request)
                    }
                    className={`cursor-pointer border-t border-slate-100 transition ${
                      isSelected
                        ? "bg-blue-50"
                        : "hover:bg-slate-50"
                    }`}
                  >
                    <td className="px-4 py-4">
                      <div className="font-semibold text-slate-950">
                        {request.gym_name}
                      </div>

                      <div className="mt-1 text-sm text-slate-500">
                        {request.gym_location}
                      </div>
                    </td>

                    <td className="px-4 py-4">
                      <span
                        className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${
                          request.is_multi_location
                            ? "border-purple-200 bg-purple-50 text-purple-800"
                            : "border-emerald-200 bg-emerald-50 text-emerald-800"
                        }`}
                      >
                        {request.is_multi_location
                          ? "Multi-location"
                          : "Standard"}
                      </span>
                    </td>

                    <td className="px-4 py-4">
                      <div className="font-medium text-slate-900">
                        {request.requester_name}
                      </div>

                      <div className="mt-1 text-sm text-slate-500">
                        {request.requester_role}
                      </div>
                    </td>

                    <td className="px-4 py-4">
                      <span
                        className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold capitalize ${getStatusClasses(
                          request.status
                        )}`}
                      >
                        {formatStatus(request.status)}
                      </span>
                    </td>

                    <td className="px-4 py-4 text-sm text-slate-500">
                      {formatDate(request.created_at)}
                    </td>
                  </tr>
                );
              })}

              {requests.length === 0 && (
                <tr>
                  <td
                    colSpan={5}
                    className="px-5 py-12 text-center text-slate-500"
                  >
                    No trial requests found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <aside className="self-start rounded-2xl border border-slate-200 bg-white p-6 shadow-sm xl:sticky xl:top-6">
        {!selectedRequest ? (
          <div className="flex min-h-[320px] items-center justify-center text-center">
            <div>
              <div className="text-lg font-bold text-slate-900">
                Select a request
              </div>

              <p className="mt-2 text-sm leading-6 text-slate-500">
                Choose a trial request from the table to review the
                requester, gym details, and submitted team list.
              </p>
            </div>
          </div>
        ) : (
          <div>
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-xs font-bold uppercase tracking-wide text-blue-600">
                  Trial Request
                </div>

                <h2 className="mt-2 text-2xl font-bold text-slate-950">
                  {selectedRequest.gym_name}
                </h2>

                <p className="mt-1 text-sm text-slate-500">
                  {selectedRequest.gym_location}
                </p>
              </div>

              <button
                type="button"
                onClick={() => setSelectedRequest(null)}
                className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-semibold text-slate-500 hover:bg-slate-50"
              >
                Close
              </button>
            </div>

            <div className="mt-5 flex flex-wrap gap-2">
              <span
                className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${
                  selectedRequest.is_multi_location
                    ? "border-purple-200 bg-purple-50 text-purple-800"
                    : "border-emerald-200 bg-emerald-50 text-emerald-800"
                }`}
              >
                {selectedRequest.is_multi_location
                  ? "Multi-location"
                  : "Standard"}
              </span>

              <span
                className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold capitalize ${getStatusClasses(
                  selectedRequest.status
                )}`}
              >
                {formatStatus(selectedRequest.status)}
              </span>
            </div>

            <div className="mt-6 space-y-6">
              <Detail label="Requester">
                <div className="font-semibold text-slate-950">
                  {selectedRequest.requester_name}
                </div>

                <div className="mt-1 text-sm text-slate-600">
                  {selectedRequest.requester_email}
                </div>

                <div className="mt-1 text-sm text-slate-500">
                  {selectedRequest.requester_role}
                </div>
              </Detail>

              <Detail label="Request Type">
                <div className="text-sm font-medium capitalize text-slate-800">
                  {selectedRequest.request_type}
                </div>
              </Detail>

              {selectedRequest.is_multi_location && (
                <Detail label="Submitted Teams">
                  <div className="whitespace-pre-line rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm leading-7 text-slate-700">
                    {selectedRequest.team_list_text ||
                      "No teams were provided."}
                  </div>
                </Detail>
              )}

              <Detail label="Submitted">
                <div className="text-sm text-slate-700">
                  {formatDateTime(
                    selectedRequest.created_at
                  )}
                </div>
              </Detail>

              {selectedRequest.admin_notes && (
                <Detail label="Admin Notes">
                  <div className="whitespace-pre-line rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
                    {selectedRequest.admin_notes}
                  </div>
                </Detail>
              )}

              {selectedRequest.organization_id && (
                <Detail label="Linked Organization">
                  <code className="block break-all rounded-lg bg-slate-100 px-3 py-2 text-xs text-slate-700">
                    {selectedRequest.organization_id}
                  </code>
                </Detail>
              )}

              {selectedRequest.user_id && (
                <Detail label="Linked User">
                  <code className="block break-all rounded-lg bg-slate-100 px-3 py-2 text-xs text-slate-700">
                    {selectedRequest.user_id}
                  </code>
                </Detail>
              )}

              {selectedRequest.provisioned_at && (
                <Detail label="Provisioned">
                  <div className="text-sm text-slate-700">
                    {formatDateTime(
                      selectedRequest.provisioned_at
                    )}
                  </div>
                </Detail>
              )}
            </div>

            <div className="mt-8 border-t border-slate-200 pt-6">
              <div className="space-y-5">
                <div>
                  <label className="mb-2 block text-xs font-bold uppercase tracking-wide text-slate-500">
                    Status
                  </label>

                  <select
                    value={draftStatus}
                    onChange={(event) =>
                      setDraftStatus(event.target.value)
                    }
                    className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-950 outline-none ring-blue-500 focus:ring-2"
                  >
                    <option value="pending">Pending</option>
                    <option value="awaiting_information">
                      Awaiting Information
                    </option>
                    <option value="ready_to_provision">
                      Ready to Provision
                    </option>
                    <option value="provisioned">
                      Provisioned
                    </option>
                    <option value="declined">
                      Declined
                    </option>
                    <option value="cancelled">
                      Cancelled
                    </option>
                  </select>
                </div>

                <div>
                  <label className="mb-2 block text-xs font-bold uppercase tracking-wide text-slate-500">
                    Admin Notes
                  </label>

                  <textarea
                    value={draftNotes}
                    onChange={(event) =>
                      setDraftNotes(event.target.value)
                    }
                    rows={5}
                    placeholder="Add onboarding notes..."
                    className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-950 placeholder:text-slate-400 outline-none ring-blue-500 focus:ring-2"
                  />
                </div>

                <button
                  type="button"
                  onClick={() =>
                    void saveRequestDetails()
                  }
                  disabled={savingDetails}
                  className="w-full rounded-xl bg-blue-600 px-5 py-3 font-semibold text-white transition hover:bg-blue-700 disabled:opacity-50"
                >
                  {savingDetails
                    ? "Saving..."
                    : "Save Request"}
                </button>

                {saveMessage && (
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
                    {saveMessage}
                  </div>
                )}
              </div>
            </div>

            <div className="mt-8 border-t border-slate-200 pt-5">
              {selectedRequest.status ===
              "provisioned" ? (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold text-emerald-800">
                  This request has already been provisioned.
                </div>
              ) : selectedRequest.is_multi_location &&
                !showProvisioning ? (
                <button
                  type="button"
                  onClick={() => {
                    setShowProvisioning(true);
                    setLocationOrganizationName(
                      selectedRequest.gym_name
                    );
                  }}
                  className="w-full rounded-xl bg-purple-600 px-5 py-3 font-semibold text-white transition hover:bg-purple-700"
                >
                  Open Multi-Location Provisioning
                </button>
              ) : selectedRequest.is_multi_location &&
                showProvisioning ? (
                <div className="space-y-6">
                  <div>
                    <div className="text-xs font-bold uppercase tracking-wide text-purple-700">
                      Multi-Location Provisioning
                    </div>

                    <h3 className="mt-1 text-lg font-bold text-slate-950">
                      {selectedRequest.gym_name}
                    </h3>
                  </div>

                  <div>
                    <label className="mb-2 block text-xs font-bold uppercase tracking-wide text-slate-500">
                      Location Organization Name
                    </label>

                    <input
                      type="text"
                      value={locationOrganizationName}
                      onChange={(event) =>
                        setLocationOrganizationName(
                          event.target.value
                        )
                      }
                      className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-950 outline-none ring-purple-500 focus:ring-2"
                    />

                    <p className="mt-2 text-xs leading-5 text-slate-500">
                      This is the customer-facing
                      organization, such as Top Gun Savannah
                      or Cheer Athletics Plano.
                    </p>
                  </div>

                  <ProgramSelector
                    programQuery={programQuery}
                    setProgramQuery={setProgramQuery}
                    selectedProgram={selectedProgram}
                    setSelectedProgram={setSelectedProgram}
                    programResults={programResults}
                    setProgramResults={setProgramResults}
                    programLoading={programLoading}
                    onResetTeams={() => {
                      setSelectedTeams([]);
                      setTeamResults([]);
                      setTeamQuery("");
                    }}
                    label="Parent ECS Program"
                    placeholder="Search Top Gun, Cheer Athletics..."
                  />

                  {selectedProgram && (
                    <>
                      <div>
                        <div className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">
                          Customer Submitted Teams
                        </div>

                        <div className="whitespace-pre-line rounded-xl border border-purple-200 bg-purple-50 p-4 text-sm leading-7 text-purple-900">
                          {selectedRequest.team_list_text ||
                            "No submitted teams were provided."}
                        </div>

                        <p className="mt-2 text-xs text-slate-500">
                          Use this list as your reference
                          while selecting the actual ECS
                          teams below.
                        </p>
                      </div>

                      <div>
                        <label className="mb-2 block text-xs font-bold uppercase tracking-wide text-slate-500">
                          Search ECS Teams
                        </label>

                        <input
                          type="text"
                          value={teamQuery}
                          onChange={(event) =>
                            setTeamQuery(
                              event.target.value
                            )
                          }
                          placeholder="Search team name..."
                          className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-950 placeholder:text-slate-400 outline-none ring-purple-500 focus:ring-2"
                        />

                        {teamLoading && (
                          <p className="mt-2 text-sm text-slate-500">
                            Loading teams...
                          </p>
                        )}

                        {!teamLoading &&
                          teamResults.length > 0 && (
                            <div className="mt-3 max-h-72 overflow-y-auto rounded-xl border border-slate-200">
                              {teamResults.map((team) => {
                                const alreadySelected =
                                  selectedTeams.some(
                                    (selected) =>
                                      selected.id ===
                                      team.id
                                  );

                                return (
                                  <button
                                    key={team.id}
                                    type="button"
                                    disabled={
                                      alreadySelected
                                    }
                                    onClick={() =>
                                      addTeam(team)
                                    }
                                    className="flex w-full items-center justify-between border-b border-slate-100 bg-white px-4 py-3 text-left last:border-b-0 hover:bg-slate-50 disabled:bg-slate-50 disabled:opacity-50"
                                  >
                                    <div>
                                      <div className="font-semibold text-slate-950">
                                        {team.name}
                                      </div>

                                      <div className="mt-1 text-xs text-slate-500">
                                        {
                                          team.match_key
                                        }
                                      </div>
                                    </div>

                                    <div className="text-sm font-semibold text-purple-700">
                                      {alreadySelected
                                        ? "Added"
                                        : "+ Add"}
                                    </div>
                                  </button>
                                );
                              })}
                            </div>
                          )}
                      </div>

                      <div>
                        <div className="mb-2 flex items-center justify-between">
                          <div className="text-xs font-bold uppercase tracking-wide text-slate-500">
                            Selected Teams
                          </div>

                          <div className="text-xs font-semibold text-slate-500">
                            {selectedTeams.length} selected
                          </div>
                        </div>

                        {selectedTeams.length === 0 ? (
                          <div className="rounded-xl border border-dashed border-slate-300 p-4 text-sm text-slate-500">
                            No teams selected yet.
                          </div>
                        ) : (
                          <div className="space-y-2">
                            {selectedTeams.map((team) => (
                              <div
                                key={team.id}
                                className="flex items-center justify-between rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3"
                              >
                                <div className="font-semibold text-slate-950">
                                  {team.name}
                                </div>

                                <button
                                  type="button"
                                  onClick={() =>
                                    removeTeam(team.id)
                                  }
                                  className="text-sm font-semibold text-red-600 hover:text-red-700"
                                >
                                  Remove
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </>
                  )}

                  {provisionMessage && (
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
                      {provisionMessage}
                    </div>
                  )}

                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={() => {
                        setShowProvisioning(false);
                        setProgramQuery("");
                        setProgramResults([]);
                        setSelectedProgram(null);
                        setTeamQuery("");
                        setTeamResults([]);
                        setSelectedTeams([]);
                        setProvisionMessage("");
                      }}
                      disabled={provisioning}
                      className="flex-1 rounded-xl border border-slate-300 bg-white px-4 py-3 font-semibold text-slate-700"
                    >
                      Cancel
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        void provisionMultiLocationTrial()
                      }
                      disabled={
                        !locationOrganizationName.trim() ||
                        !selectedProgram ||
                        selectedTeams.length === 0 ||
                        provisioning
                      }
                      className="flex-1 rounded-xl bg-purple-600 px-4 py-3 font-semibold text-white transition hover:bg-purple-700 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      {provisioning
                        ? "Provisioning..."
                        : "Provision Multi-Location Trial"}
                    </button>
                  </div>
                </div>
              ) : !showProvisioning ? (
                <button
                  type="button"
                  onClick={() => {
                    setShowProvisioning(true);
                    setOrgQuery(
                      selectedRequest.gym_name
                    );
                  }}
                  className="w-full rounded-xl bg-purple-600 px-5 py-3 font-semibold text-white transition hover:bg-purple-700"
                >
                  Open Provisioning
                </button>
              ) : (
                <div className="space-y-5">
                  <div>
                    <div className="text-xs font-bold uppercase tracking-wide text-purple-700">
                      Provision Trial
                    </div>

                    <h3 className="mt-1 text-lg font-bold text-slate-950">
                      {selectedRequest.gym_name}
                    </h3>
                  </div>

                  <div>
                    <label className="mb-2 block text-xs font-bold uppercase tracking-wide text-slate-500">
                      Organization
                    </label>

                    <input
                      type="text"
                      value={orgQuery}
                      onChange={(event) => {
                        setOrgQuery(
                          event.target.value
                        );
                        setSelectedOrg(null);
                        setOrgSearchComplete(false);
                        setProvisionMessage("");
                      }}
                      placeholder="Search existing organization..."
                      className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-950 placeholder:text-slate-400 outline-none ring-purple-500 focus:ring-2"
                    />

                    {orgLoading && (
                      <div className="mt-2 text-sm text-slate-500">
                        Searching...
                      </div>
                    )}

                    {!selectedOrg &&
                      orgResults.length > 0 && (
                        <div className="mt-2 overflow-hidden rounded-xl border border-slate-200">
                          {orgResults.map(
                            (organization) => (
                              <button
                                key={organization.id}
                                type="button"
                                onClick={() => {
                                  setSelectedOrg(
                                    organization
                                  );
                                  setOrgQuery(
                                    organization.name
                                  );
                                  setOrgResults([]);
                                  setOrgSearchComplete(
                                    false
                                  );
                                  setProvisionMessage("");
                                }}
                                className="block w-full border-b border-slate-100 bg-white px-4 py-3 text-left last:border-b-0 hover:bg-slate-50"
                              >
                                <div className="font-semibold text-slate-950">
                                  {
                                    organization.name
                                  }
                                </div>

                                <div className="mt-1 text-xs text-slate-500">
                                  {organization.slug ||
                                    organization.id}
                                </div>
                              </button>
                            )
                          )}
                        </div>
                      )}

                    {!selectedOrg &&
                      !orgLoading &&
                      orgSearchComplete &&
                      orgQuery.trim().length >= 3 &&
                      orgResults.length === 0 && (
                        <div className="mt-3 rounded-xl border border-purple-200 bg-purple-50 p-4">
                          <div className="text-sm font-semibold text-slate-800">
                            No matching organization
                            found.
                          </div>

                          <p className="mt-1 text-xs leading-5 text-slate-600">
                            Create a new standard
                            organization using this name.
                          </p>

                          <button
                            type="button"
                            onClick={() =>
                              void createOrganization()
                            }
                            disabled={orgCreating}
                            className="mt-3 w-full rounded-xl bg-purple-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-purple-700 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {orgCreating
                              ? "Creating Organization..."
                              : `Create New Organization: ${orgQuery.trim()}`}
                          </button>
                        </div>
                      )}

                    {selectedOrg && (
                      <div className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 p-3">
                        <div className="text-xs font-semibold uppercase tracking-wide text-emerald-700">
                          Organization Selected
                        </div>

                        <div className="mt-1 font-semibold text-slate-950">
                          {selectedOrg.name}
                        </div>
                      </div>
                    )}
                  </div>

                  {selectedOrg && (
                    <ProgramSelector
                      programQuery={programQuery}
                      setProgramQuery={
                        setProgramQuery
                      }
                      selectedProgram={
                        selectedProgram
                      }
                      setSelectedProgram={
                        setSelectedProgram
                      }
                      programResults={
                        programResults
                      }
                      setProgramResults={
                        setProgramResults
                      }
                      programLoading={
                        programLoading
                      }
                      label="ECS Program"
                      placeholder="Search the ECS program..."
                    />
                  )}

                  <div>
                    <label className="mb-2 block text-xs font-bold uppercase tracking-wide text-slate-500">
                      Role
                    </label>

                    <select
                      value={provisionRole}
                      onChange={(event) =>
                        setProvisionRole(
                          event.target.value
                        )
                      }
                      className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-950 outline-none ring-purple-500 focus:ring-2"
                    >
                      <option value="owner">
                        Owner
                      </option>
                      <option value="admin">
                        Admin
                      </option>
                      <option value="member">
                        Member
                      </option>
                    </select>
                  </div>

                  <div>
                    <label className="mb-2 block text-xs font-bold uppercase tracking-wide text-slate-500">
                      Trial Length
                    </label>

                    <select
                      value={trialDays}
                      onChange={(event) =>
                        setTrialDays(
                          Number(event.target.value)
                        )
                      }
                      className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-950 outline-none ring-purple-500 focus:ring-2"
                    >
                      <option value={7}>
                        7 Days
                      </option>
                      <option value={14}>
                        14 Days
                      </option>
                      <option value={30}>
                        30 Days
                      </option>
                    </select>
                  </div>

                  {provisionMessage && (
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
                      {provisionMessage}
                    </div>
                  )}

                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={() => {
                        setShowProvisioning(false);

                        setSelectedOrg(null);
                        setOrgQuery("");
                        setOrgResults([]);
                        setOrgSearchComplete(false);

                        setSelectedProgram(null);
                        setProgramQuery("");
                        setProgramResults([]);

                        setProvisionMessage("");
                      }}
                      disabled={
                        provisioning ||
                        orgCreating
                      }
                      className="flex-1 rounded-xl border border-slate-300 bg-white px-4 py-3 font-semibold text-slate-700"
                    >
                      Cancel
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        void provisionTrial()
                      }
                      disabled={
                        !selectedOrg ||
                        !selectedProgram ||
                        provisioning ||
                        orgCreating
                      }
                      className="flex-1 rounded-xl bg-purple-600 px-4 py-3 font-semibold text-white transition hover:bg-purple-700 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      {provisioning
                        ? "Provisioning..."
                        : "Start Trial"}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </aside>
    </div>
  );
}

function ProgramSelector({
  programQuery,
  setProgramQuery,
  selectedProgram,
  setSelectedProgram,
  programResults,
  setProgramResults,
  programLoading,
  onResetTeams,
  label,
  placeholder,
}: {
  programQuery: string;
  setProgramQuery: (value: string) => void;
  selectedProgram: ProgramResult | null;
  setSelectedProgram: (
    value: ProgramResult | null
  ) => void;
  programResults: ProgramResult[];
  setProgramResults: (value: ProgramResult[]) => void;
  programLoading: boolean;
  onResetTeams?: () => void;
  label: string;
  placeholder: string;
}) {
  return (
    <div>
      <label className="mb-2 block text-xs font-bold uppercase tracking-wide text-slate-500">
        {label}
      </label>

      <input
        type="text"
        value={programQuery}
        onChange={(event) => {
          setProgramQuery(event.target.value);

          if (selectedProgram) {
            setSelectedProgram(null);
            setProgramResults([]);

            if (onResetTeams) {
              onResetTeams();
            }
          }
        }}
        placeholder={placeholder}
        className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-950 placeholder:text-slate-400 outline-none ring-purple-500 focus:ring-2"
      />

      {programLoading && (
        <p className="mt-2 text-sm text-slate-500">
          Searching programs...
        </p>
      )}

      {!selectedProgram &&
        programResults.length > 0 && (
          <div className="mt-2 overflow-hidden rounded-xl border border-slate-200">
            {programResults.map((program) => (
              <button
                key={program.id}
                type="button"
                onClick={() => {
                  setSelectedProgram(program);
                  setProgramQuery(program.name);
                  setProgramResults([]);

                  if (onResetTeams) {
                    onResetTeams();
                  }
                }}
                className="block w-full border-b border-slate-100 bg-white px-4 py-3 text-left last:border-b-0 hover:bg-slate-50"
              >
                <div className="font-semibold text-slate-950">
                  {program.name}
                </div>

                <div className="mt-1 text-xs text-slate-500">
                  {program.match_key}
                </div>
              </button>
            ))}
          </div>
        )}

      {selectedProgram && (
        <div className="mt-3 rounded-xl border border-purple-200 bg-purple-50 p-3">
          <div className="text-xs font-semibold uppercase tracking-wide text-purple-700">
            Program Selected
          </div>

          <div className="mt-1 font-semibold text-slate-950">
            {selectedProgram.name}
          </div>
        </div>
      )}
    </div>
  );
}

function Detail({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">
        {label}
      </div>

      {children}
    </div>
  );
}