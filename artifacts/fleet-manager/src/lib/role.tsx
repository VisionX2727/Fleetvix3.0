import { createContext, ReactNode, useContext, useEffect, useMemo, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import type { AppState } from "@/lib/store";
import { deleteOwnerDriver, saveDriverProfile, sendDriverFile, setOwnerDriverStatus, updateOwnerDriver, updateOwnerDriverRate, type DriverDocument, type DriverMembership, type WorkspaceResponse } from "@/lib/workspace";

export type WorkspaceRole = {
  role: "owner" | "driver";
  ownerUserId?: string;
  inviteCode?: string;
  member?: DriverMembership;
  ownerSettings?: AppState["settings"];
  availableVehicles?: AppState["vehicles"];
  invoices?: WorkspaceResponse["invoices"];
  members?: WorkspaceResponse["members"];
  session: Session;
  refreshWorkspace: () => Promise<void>;
};

type RoleContextValue = WorkspaceRole & {
  updateMember: (member: DriverMembership) => void;
  updateDriverProfile: (profile: DriverMembership["profile"]) => Promise<void>;
  addInvoice: (invoice: NonNullable<WorkspaceResponse["invoices"]>[number]) => void;
  removeInvoice: (invoiceId: string) => void;
  updateOwnerMember: (memberId: string, profile: DriverMembership["profile"]) => Promise<void>;
  updateOwnerMemberStatus: (memberId: string, status: "Active" | "Blocked" | "Removed") => Promise<void>;
  updateOwnerMemberRate: (memberId: string, dailyRate: number) => Promise<AppState>;
  deleteOwnerMember: (memberId: string) => Promise<void>;
  sendOwnerFile: (memberId: string, file: DriverDocument) => Promise<void>;
};

const RoleContext = createContext<RoleContextValue | null>(null);

export function RoleProvider({ value, children }: { value: WorkspaceRole; children: ReactNode }) {
  const [current, setCurrent] = useState(value);
  useEffect(() => {
    setCurrent(value);
  }, [value]);
  const updateMember = (member: DriverMembership) => setCurrent((previous) => ({ ...previous, member }));
  const updateDriverProfile = async (profile: DriverMembership["profile"]) => {
    const result = await saveDriverProfile(current.session.access_token, profile);
    updateMember(result.member);
  };
  const addInvoice = (invoice: NonNullable<WorkspaceResponse["invoices"]>[number]) => {
    setCurrent((previous) => ({ ...previous, invoices: [...(previous.invoices || []), invoice] }));
  };
  const removeInvoice = (invoiceId: string) => {
    setCurrent((previous) => ({ ...previous, invoices: (previous.invoices || []).map((invoice) => invoice.id === invoiceId ? { ...invoice, revokedAt: new Date().toISOString() } : invoice) }));
  };
  const updateOwnerMember = async (memberId: string, profile: DriverMembership["profile"]) => {
    const result = await updateOwnerDriver(current.session.access_token, memberId, profile);
    setCurrent((previous) => ({ ...previous, members: (previous.members || []).map((member) => member.id === memberId ? result.member : member) }));
  };
  const updateOwnerMemberStatus = async (memberId: string, status: "Active" | "Blocked" | "Removed") => {
    const result = await setOwnerDriverStatus(current.session.access_token, memberId, status);
    setCurrent((previous) => ({ ...previous, members: (previous.members || []).map((member) => member.id === memberId ? result.member : member) }));
  };
  const updateOwnerMemberRate = async (memberId: string, dailyRate: number) => {
    const result = await updateOwnerDriverRate(current.session.access_token, memberId, dailyRate);
    return result.state;
  };
  const deleteOwnerMember = async (memberId: string) => {
    await deleteOwnerDriver(current.session.access_token, memberId);
    setCurrent((previous) => ({ ...previous, members: (previous.members || []).filter((member) => member.id !== memberId) }));
  };
  const sendOwnerFile = async (memberId: string, file: DriverDocument) => {
    const result = await sendDriverFile(current.session.access_token, memberId, file);
    setCurrent((previous) => ({ ...previous, members: (previous.members || []).map((member) => member.id === memberId ? result.member : member) }));
  };
  const contextValue = useMemo(() => ({ ...current, updateMember, updateDriverProfile, addInvoice, removeInvoice, updateOwnerMember, updateOwnerMemberStatus, updateOwnerMemberRate, deleteOwnerMember, sendOwnerFile }), [current]);
  return <RoleContext.Provider value={contextValue}>{children}</RoleContext.Provider>;
}

export function useRole() {
  const value = useContext(RoleContext);
  if (!value) throw new Error("useRole must be used inside RoleProvider");
  return value;
}