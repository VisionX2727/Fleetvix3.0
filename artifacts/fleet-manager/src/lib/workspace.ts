import type { AppState, Driver } from "@/lib/store";
import type { SiteContent, SiteContentInput } from "@workspace/api-client-react";

export type DriverDocument = {
  id: string;
  name: string;
  type: string;
  dataUrl: string;
  uploadedAt: string;
};

export type DriverMembership = {
  id: string;
  ownerUserId: string;
  driverUserId: string;
  profile: {
    name: string;
    phone: string;
    address?: string;
    vehicleIds: string[];
    documents: DriverDocument[];
    sharedFiles?: DriverDocument[];
    status?: "Active" | "Blocked" | "Removed" | "Suspended";
  };
};

export type WorkspaceResponse = {
  role: "owner" | "driver" | "blocked" | "removed" | null;
  ownerUserId?: string;
  state?: AppState;
  inviteCode?: string;
  member?: DriverMembership;
  ownerSettings?: AppState["settings"];
  availableVehicles?: AppState["vehicles"];
  invoices?: Array<{ id: string; ownerUserId?: string; driverUserId?: string; title: string; html: string; revokedAt?: string | null; createdAt: string }>;
  members?: Array<{ id: string; driverUserId: string; profile: DriverMembership["profile"] }>;
};

export type SupportTicket = {
  id: string;
  userId: string;
  userEmail: string;
  userName?: string | null;
  ownerUserId?: string | null;
  category: string;
  subject: string;
  description: string;
  attachmentName?: string | null;
  attachmentUrl?: string | null;
  priority: "Low" | "Medium" | "High";
  status: "Open" | "In Progress" | "Resolved" | "Closed";
  adminReply?: string | null;
  createdAt: string;
  updatedAt: string;
  resolvedAt?: string | null;
};

export type AdminStats = {
  totalUsers: number;
  totalOwners: number;
  totalDrivers: number;
  activeSubscriptions: number;
  expiredSubscriptions: number;
  openSupportTickets: number;
  highPriorityTickets: number;
  totalTickets: number;
};

function workspaceUrl(path = "") {
  const base = (import.meta.env.BASE_URL || "/").replace(/\/?$/, "/");
  return `${base}api/workspace${path}`;
}

function apiUrl(path = "") {
  const base = (import.meta.env.BASE_URL || "/").replace(/\/?$/, "/");
  return `${base}api${path}`;
}

function workspaceUrls(path = "") {
  return [workspaceUrl(path)];
}

async function request<T>(
  path: string,
  token?: string,
  init?: RequestInit,
  scope: "workspace" | "api" = "workspace",
): Promise<T> {
  let lastError: Error | null = null;
  const urls = scope === "api" ? [apiUrl(path)] : workspaceUrls(path);
  for (const url of urls) {
    try {
      const response = await fetch(url, {
        ...init,
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...(init?.headers || {}),
        },
      });
      const raw = await response.text();
      let payload: Record<string, unknown> = {};
      try {
        payload = raw ? JSON.parse(raw) as Record<string, unknown> : {};
      } catch {
        // Keep the HTTP status useful when a proxy or server returns HTML.
      }
      if (response.ok) return payload as T;

      const serverMessage = typeof payload.error === "string" ? payload.error : "";
      lastError = new Error(
        serverMessage || `Workspace request failed (${response.status}${response.statusText ? ` ${response.statusText}` : ""})`,
      );

      if (response.status !== 404 && response.status !== 405) throw lastError;
    } catch (error) {
      if (error instanceof Error) {
        lastError = error;
        if (!error.message.includes("(404") && !error.message.includes("(405") && error.message !== "Failed to fetch") {
          throw error;
        }
      }
    }
  }
  throw lastError || new Error("Fleetvix could not reach the workspace server. Check your internet connection and try again.");
}

export function getWorkspace(token: string) {
  return request<WorkspaceResponse>("", token);
}

export function createOwnerWorkspace(token: string) {
  // Initial role selection must stay small and reliable. The server creates a
  // canonical empty workspace; the StoreProvider syncs the full state after
  // the owner workspace is established.
  return request<WorkspaceResponse>("/owner", token, { method: "POST", body: JSON.stringify({}) });
}

export function saveOwnerWorkspace(token: string, state: AppState) {
  return request<{ state: AppState }>("/owner/state", token, { method: "PUT", body: JSON.stringify({ state }) });
}

export async function uploadBusinessLogo(token: string, file: File) {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => typeof reader.result === "string" ? resolve(reader.result) : reject(new Error("Could not read the image"));
    reader.onerror = () => reject(new Error("Could not read the image"));
    reader.readAsDataURL(file);
  });
  return request<{ logoUrl: string; state: AppState }>("/logo", token, {
    method: "POST",
    body: JSON.stringify({ dataUrl }),
  });
}

export function joinOwnerWorkspace(token: string, code: string, profile: DriverMembership["profile"]) {
  return request<WorkspaceResponse>("/join", token, { method: "POST", body: JSON.stringify({ code, profile }) });
}

export function regenerateVehicleCode(token: string, vehicleId: string) {
  return request<{ vehicle: AppState["vehicles"][number]; state: AppState }>(`/owner/vehicles/${encodeURIComponent(vehicleId)}/access-code`, token, { method: "POST" });
}

export function resetOwnerWorkspace(token: string) {
  return request<{ state: AppState }>("/owner/reset-data", token, { method: "POST" });
}

export function resetDriverWorkspace(token: string) {
  return request<{ state: AppState }>("/driver/reset-data", token, { method: "POST" });
}

export function updateOwnerDriverRate(token: string, memberId: string, dailyRate: number) {
  return request<{ state: AppState }>(`/owner/members/${encodeURIComponent(memberId)}/rate`, token, {
    method: "PUT",
    body: JSON.stringify({ dailyRate }),
  });
}

export function saveDriverWorkspace(token: string, state: AppState) {
  return request<{ state: AppState }>("/driver/state", token, { method: "PUT", body: JSON.stringify({ state }) });
}

export function saveDriverProfile(token: string, profile: DriverMembership["profile"]) {
  return request<{ member: DriverMembership }>("/driver/profile", token, { method: "PUT", body: JSON.stringify({ profile }) });
}

export function sendDriverInvoice(token: string, driverUserId: string, title: string, html: string) {
  return request<{ invoice: NonNullable<WorkspaceResponse["invoices"]>[number] }>("/invoices", token, { method: "POST", body: JSON.stringify({ driverUserId, title, html }) });
}

export function revokeDriverInvoice(token: string, invoiceId: string) {
  return request(`/invoices/${invoiceId}/revoke`, token, { method: "POST" });
}

export function getDriverInvoices(token: string) {
  return request<{ invoices: WorkspaceResponse["invoices"] }>("/invoices", token);
}

export function updateOwnerDriver(token: string, memberId: string, profile: DriverMembership["profile"]) {
  return request<{ member: WorkspaceResponse["members"] extends Array<infer T> ? T : never }>("/owner/members/" + memberId, token, {
    method: "PUT",
    body: JSON.stringify({ profile }),
  });
}

export function setOwnerDriverStatus(token: string, memberId: string, status: "Active" | "Blocked" | "Removed") {
  return request<{ member: WorkspaceResponse["members"] extends Array<infer T> ? T : never }>(`/owner/members/${memberId}/status`, token, {
    method: "POST",
    body: JSON.stringify({ status }),
  });
}

export function deleteOwnerDriver(token: string, memberId: string) {
  return request<{ ok: true }>(`/owner/members/${memberId}`, token, { method: "DELETE" });
}

export function sendDriverFile(token: string, memberId: string, file: DriverDocument) {
  return request<{ member: NonNullable<WorkspaceResponse["members"]>[number] }>(`/owner/members/${memberId}/files`, token, {
    method: "POST",
    body: JSON.stringify({ file }),
  });
}

export function getSupportTickets(token: string) {
  return request<{ tickets: SupportTicket[] }>("/support", token, undefined, "api");
}

export function createSupportTicket(token: string, payload: {
  category: string;
  subject: string;
  description: string;
  priority?: "Low" | "Medium" | "High";
  attachmentDataUrl?: string;
  attachmentName?: string;
}) {
  return request<{ ticket: SupportTicket }>("/support", token, {
    method: "POST",
    body: JSON.stringify(payload),
  }, "api");
}

export function getAdminStats(token: string) {
  return request<{ stats: AdminStats }>("/admin", token, undefined, "api");
}

export function getAdminTickets(token: string, filters: { search?: string; status?: string; priority?: string; category?: string } = {}) {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (value) params.set(key, value);
  });
  return request<{ tickets: SupportTicket[] }>(`/admin/tickets${params.toString() ? `?${params.toString()}` : ""}`, token, undefined, "api");
}

export function updateAdminTicket(token: string, ticketId: string, payload: { status?: SupportTicket["status"]; priority?: SupportTicket["priority"]; adminReply?: string }) {
  return request<{ ticket: SupportTicket }>(`/admin/tickets/${encodeURIComponent(ticketId)}`, token, {
    method: "PATCH",
    body: JSON.stringify(payload),
  }, "api");
}

export function getPublicSiteContent() {
  return request<{ content: SiteContent }>("/public/legal", undefined, undefined, "api");
}

export function getAdminSiteContent(token: string) {
  return request<{ content: SiteContent }>("/admin/site-content", token, undefined, "api");
}

export function updateAdminSiteContent(token: string, payload: SiteContentInput) {
  return request<{ content: SiteContent }>("/admin/site-content", token, {
    method: "PUT",
    body: JSON.stringify(payload),
  }, "api");
}

export type FleetuMessage = { role: "user" | "model"; text: string };

export async function askFleetu(token: string, message: string, history: FleetuMessage[]) {
  const base = (import.meta.env.BASE_URL || "/").replace(/\/?$/, "/");
  const localUrl = `${base}api/fleetu/chat`;
  const urls = [localUrl];
  let lastError: Error | null = null;
  for (const url of urls) {
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ message, history }),
      });
      const payload = await response.json().catch(() => ({})) as { answer?: string; error?: string };
      if (response.ok && payload.answer) return payload.answer;
      lastError = new Error(payload.error || `Fleetu request failed (${response.status})`);
      if (response.status !== 404 && response.status !== 405) throw lastError;
    } catch (error) {
      if (error instanceof Error) {
        lastError = error;
        if (!error.message.includes("(404") && !error.message.includes("(405") && error.message !== "Failed to fetch") throw error;
      }
    }
  }
  throw lastError || new Error("Fleetu could not reach the Fleetvix assistant.");
}