"use client";
import React, { useState, useEffect } from "react";
import {
  Settings,
  Building2,
  Users,
  Shield,
  Database,
  FileText,
  Save,
  Plus,
  Check,
  Copy,
  Mail,
  Trash2,
  Link as LinkIcon,
  Search,
  Info,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const API_BASE_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:5000";

// ─── Types ───────────────────────────────────────────────────────────────────

interface CompanySettings {
  name: string;
  address: string;
  postcode: string;
  phone: string;
  website: string;
}

interface TeamMember {
  employee_id: number;
  employee_name: string;
  email: string | null;
  phone: string | null;
  user_id: number | null;
  username: string | null;
  role: string | null;
  role_id: number | null;
  is_invite_pending: boolean;
  invite_link: string | null;
}

interface SearchPermissionUser {
  user_id: number;
  employee_id: number;
  employee_name: string;
  username: string | null;
  role: string | null;
  can_search_all_leads: boolean;
  can_search_all_renewals: boolean;
}

interface InviteFormData {
  employee_name: string;
  username: string;
  email: string;
  phone: string;
  role_id: string;
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState("company");
  const [companySettings, setCompanySettings] = useState<CompanySettings>({
    name: "Business Gas",
    address: "Studio 1 - 3, Morledge Street, Leicester",
    postcode: "LE1 1TA",
    phone: "0203 752 9755",
    website: "www.switchmyutility.co.uk",
  });

  // Users tab state
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [currentUserRole, setCurrentUserRole] = useState<string | null>(null);
  const [isLoadingRole, setIsLoadingRole] = useState(true);
  const [isLoadingMembers, setIsLoadingMembers] = useState(false);
  const [showInviteForm, setShowInviteForm] = useState(false);
  const [inviteForm, setInviteForm] = useState<InviteFormData>({
    employee_name: "", username: "", email: "", phone: "", role_id: "",
  });
  const [generatedInviteLink, setGeneratedInviteLink] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [resendingUserId, setResendingUserId] = useState<number | null>(null);
  const [deletingEmployeeId, setDeletingEmployeeId] = useState<number | null>(null);
  const [updatingRoleEmployeeId, setUpdatingRoleEmployeeId] = useState<number | null>(null);

   // Search Permissions state
  const [searchPermissionUsers, setSearchPermissionUsers] = useState<SearchPermissionUser[]>([]);
  const [searchPermissionSearch, setSearchPermissionSearch] = useState("");
  const [searchPermissionDraft, setSearchPermissionDraft] = useState<
    Record<number, { leads: boolean; renewals: boolean }>
  >({});
  const [searchPermissionOriginal, setSearchPermissionOriginal] = useState<
    Record<number, { leads: boolean; renewals: boolean }>
  >({});
  const [isLoadingSearchPermissions, setIsLoadingSearchPermissions] = useState(false);
  const [isSavingSearchPermissions, setIsSavingSearchPermissions] = useState(false);

  // ── Bootstrap ───────────────────────────────────────────────────────────────

  useEffect(() => {
    fetchCurrentUser();
  }, []);

  useEffect(() => {
    if (
      currentUserRole === "Platform Admin" ||
      currentUserRole === "Tenant Super Admin"
    ) {
      loadSearchPermissions();
    }
  }, [currentUserRole]);

  const fetchCurrentUser = async () => {
    setIsLoadingRole(true);
    try {
      const userStr = localStorage.getItem("auth_user");
      if (userStr) {
        const user = JSON.parse(userStr);
        setCurrentUserRole(user.role || null);
      }
    } catch {
      setCurrentUserRole(null);
    } finally {
      setIsLoadingRole(false);
    }
  };

  const loadMembers = async () => {
    setIsLoadingMembers(true);
    try {
      const token = localStorage.getItem("auth_token");
      const res = await fetch(`${API_BASE_URL}/auth/invite/list`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to load team");

      const data = await res.json();
      const mappedMembers = (data.members || []).map((m: any) => ({
        ...m,
      }));

      setMembers(mappedMembers);

    } catch (err: any) {
      alert(err.message || "Failed to load team members");
    } finally {
      setIsLoadingMembers(false);
    }
  };

  const loadSearchPermissions = async () => {
  setIsLoadingSearchPermissions(true);

  try {
    const token = localStorage.getItem("auth_token");

    if (!token) {
      throw new Error("Not authenticated");
    }

    const res = await fetch(
      `${API_BASE_URL}/auth/search-permissions/users`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );

    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.error || "Failed to load search permissions");
    }

    const users: SearchPermissionUser[] = (data.users || []).filter(
      (user: SearchPermissionUser) =>
        user.role !== "Platform Admin" &&
        user.role !== "Tenant Super Admin"
    );

    setSearchPermissionUsers(users);

    const permissions: Record<
      number,
      { leads: boolean; renewals: boolean }
    > = {};

    users.forEach((user) => {
      permissions[user.user_id] = {
        leads: Boolean(user.can_search_all_leads),
        renewals: Boolean(user.can_search_all_renewals),
      };
    });

    setSearchPermissionDraft(permissions);
    setSearchPermissionOriginal(structuredClone(permissions));
  } catch (err: any) {
    alert(err.message || "Failed to load search permissions");
  } finally {
    setIsLoadingSearchPermissions(false);
  }
};

  // ── Company ─────────────────────────────────────────────────────────────────

  const saveCompanySettings = async () => {
    try {
      const token = localStorage.getItem("auth_token");
      if (!token) throw new Error("Not authenticated");
      const res = await fetch(`${API_BASE_URL}/auth/settings/company`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ address: companySettings.address }),
      });
      if (!res.ok) throw new Error("Failed to save company settings");
      alert("Company settings saved successfully!");
    } catch (err) {
      alert("Error saving company settings");
    }
  };

  // ── Invite ──────────────────────────────────────────────────────────────────

  const isAdmin =
    currentUserRole === "Platform Admin" || currentUserRole === "Tenant Super Admin";

  const handleCreateInvite = async () => {
    if (!inviteForm.employee_name.trim()) return alert("Full name is required");
    if (!inviteForm.username.trim()) return alert("Username is required");
    if (!inviteForm.role_id) return alert("Role is required");

    setIsSubmitting(true);
    try {
      const token = localStorage.getItem("auth_token");
      const res = await fetch(`${API_BASE_URL}/auth/invite/create`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          employee_name: inviteForm.employee_name.trim(),
          username: inviteForm.username.trim(),
          email: inviteForm.email.trim() || undefined,
          phone: inviteForm.phone.trim() || undefined,
          role_id: parseInt(inviteForm.role_id),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create invite");

      setGeneratedInviteLink(data.invite.invite_link);
      setInviteForm({ employee_name: "", username: "", email: "", phone: "", role_id: "" });
      loadMembers();
    } catch (err: any) {
      alert(err.message || "Failed to create invite");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResendInvite = async (userId: number) => {
    setResendingUserId(userId);
    try {
      const token = localStorage.getItem("auth_token");
      const res = await fetch(`${API_BASE_URL}/auth/invite/resend/${userId}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to resend");
      setGeneratedInviteLink(data.invite_link);
      alert("New invite link generated! Copy it below.");
    } catch (err: any) {
      alert(err.message || "Failed to resend invite");
    } finally {
      setResendingUserId(null);
    }
  };

  const copyInviteLink = (link?: string) => {
    navigator.clipboard.writeText(link || generatedInviteLink);
    alert("Link copied to clipboard!");
  };

  const handleUpdateMemberRole = async (member: TeamMember, roleId: string) => {
    if (!member.user_id || String(member.role_id || "") === roleId) return;
    setUpdatingRoleEmployeeId(member.employee_id);
    try {
      const token = localStorage.getItem("auth_token");
      const res = await fetch(`${API_BASE_URL}/auth/invite/update-role/${member.employee_id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ role_id: parseInt(roleId) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update role");
      setMembers((current) =>
        current.map((item) =>
          item.employee_id === member.employee_id
            ? { ...item, role_id: data.role_id, role: data.role }
            : item,
        ),
      );
      alert("User permissions updated");
    } catch (err: any) {
      alert(err.message || "Failed to update user permissions");
    } finally {
      setUpdatingRoleEmployeeId(null);
    }
  };

  const updateSearchPermission = (
  userId: number,
  field: "leads" | "renewals",
  value: boolean
) => {
  setSearchPermissionDraft((current) => ({
    ...current,
    [userId]: {
      ...current[userId],
      [field]: value,
    },
  }));
};

const hasSearchPermissionChanges = () => {
  const userIds = Object.keys(searchPermissionDraft);

  return userIds.some((id) => {
    const userId = Number(id);

    return (
      searchPermissionDraft[userId]?.leads !==
        searchPermissionOriginal[userId]?.leads ||
      searchPermissionDraft[userId]?.renewals !==
        searchPermissionOriginal[userId]?.renewals
    );
  });
};

const cancelSearchPermissionChanges = () => {
  setSearchPermissionDraft(structuredClone(searchPermissionOriginal));
};

const saveSearchPermissions = async () => {
  if (!hasSearchPermissionChanges()) return;

  setIsSavingSearchPermissions(true);

  try {
    const token = localStorage.getItem("auth_token");

    if (!token) {
      throw new Error("Not authenticated");
    }

    const changedUsers = searchPermissionUsers.filter((user) => {
      const current = searchPermissionDraft[user.user_id];
      const original = searchPermissionOriginal[user.user_id];

      return (
        current?.leads !== original?.leads ||
        current?.renewals !== original?.renewals
      );
    });

    for (const user of changedUsers) {
      const current = searchPermissionDraft[user.user_id];

      const res = await fetch(
        `${API_BASE_URL}/auth/search-permissions/users/${user.user_id}`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            can_search_all_leads: current.leads,
            can_search_all_renewals: current.renewals,
          }),
        }
      );

      const data = await res.json();

      if (!res.ok) {
        throw new Error(
          data.error || `Failed to update ${user.employee_name}`
        );
      }
    }

    setSearchPermissionOriginal(structuredClone(searchPermissionDraft));

    alert("Search permissions saved successfully.");
  } catch (err: any) {
    alert(err.message || "Failed to save search permissions");
  } finally {
    setIsSavingSearchPermissions(false);
  }
};

  const handleDeleteMember = async (employeeId: number, employeeName: string) => {
    if (!confirm(`Are you sure you want to delete ${employeeName}? This cannot be undone.`)) return;

    setDeletingEmployeeId(employeeId);
    try {
      const token = localStorage.getItem("auth_token");
      const res = await fetch(`${API_BASE_URL}/auth/invite/delete/${employeeId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to delete");
      alert("Team member deleted successfully");
      loadMembers();
    } catch (err: any) {
      alert(err.message || "Failed to delete team member");
    } finally {
      setDeletingEmployeeId(null);
    }
  };

  // ── Render: Users Tab ───────────────────────────────────────────────────────

  const renderUsersContent = () => {
    if (isLoadingRole) {
      return <div className="p-4 text-center text-gray-500 dark:text-slate-400">Loading permissions...</div>;
    }

    if (!isAdmin) {
      return (
        <Card className="border-slate-200 dark:border-slate-800 dark:bg-slate-900">
          <CardContent className="py-12 text-center text-gray-500 dark:text-slate-400">
            <Shield className="h-10 w-10 mx-auto mb-3 text-gray-300 dark:text-slate-600" />
            <p className="font-medium text-slate-900 dark:text-slate-100">Platform Admin access required</p>
            <p className="text-sm mt-1">Only Platform Admins can manage team members.</p>
          </CardContent>
        </Card>
      );
    }

    return (
      <div className="space-y-6">
        {/* Invite Card */}
        <Card className="border-slate-200 dark:border-slate-800 dark:bg-slate-900">
          <CardHeader>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <CardTitle className="text-slate-950 dark:text-slate-50">Invite Team Member</CardTitle>
                <CardDescription className="dark:text-slate-400">
                  Create a username for your team member and share the invite link so
                  they can set their password and log in.
                </CardDescription>

              </div>
              {!showInviteForm && (
                <Button
                  onClick={() => { setShowInviteForm(true); setGeneratedInviteLink(""); }}
                  className="w-full sm:w-auto dark:bg-slate-100 dark:text-slate-950 dark:hover:bg-slate-200"
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Invite Member
                </Button>
              )}
            </div>
          </CardHeader>

          {showInviteForm && (
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="dark:text-slate-300">Full Name <span className="text-red-500">*</span></Label>
                  <Input
                    placeholder="e.g. Sarah Jones"
                    value={inviteForm.employee_name}
                    onChange={(e) => setInviteForm({ ...inviteForm, employee_name: e.target.value })}
                    className="dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-500"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="dark:text-slate-300">Username <span className="text-red-500">*</span></Label>
                  <Input
                    placeholder="e.g. sarah.jones"
                    value={inviteForm.username}
                    onChange={(e) => setInviteForm({ ...inviteForm, username: e.target.value })}
                    className="dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-500"
                  />
                  <p className="text-xs text-gray-500 dark:text-slate-400">They will use this to log in</p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="dark:text-slate-300">Email <span className="text-gray-400 dark:text-slate-500 font-normal">(optional)</span></Label>
                  <Input
                    type="email"
                    placeholder="sarah@company.com"
                    value={inviteForm.email}
                    onChange={(e) => setInviteForm({ ...inviteForm, email: e.target.value })}
                    className="dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-500"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="dark:text-slate-300">Phone <span className="text-gray-400 dark:text-slate-500 font-normal">(optional)</span></Label>
                  <Input
                    placeholder="07700 000000"
                    value={inviteForm.phone}
                    onChange={(e) => setInviteForm({ ...inviteForm, phone: e.target.value })}
                    className="dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-500"
                  />
                </div>
              </div>

              <div className="space-y-2 w-full sm:max-w-xs">
                <Label className="dark:text-slate-300">Role <span className="text-red-500">*</span></Label>
                <Select
                  value={inviteForm.role_id}
                  onValueChange={(v) => setInviteForm({ ...inviteForm, role_id: v })}
                >
                  <SelectTrigger className="dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100">
                    <SelectValue placeholder="Select role" />
                  </SelectTrigger>
                  <SelectContent className="dark:border-slate-800 dark:bg-slate-900">
                    <SelectItem value="2" className="dark:hover:bg-slate-800">Platform Admin</SelectItem>
                    <SelectItem value="3" className="dark:hover:bg-slate-800">Salesperson</SelectItem>
                    <SelectItem value="5" className="dark:hover:bg-slate-800">Leads Offshore</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {generatedInviteLink && (
                <div className="rounded-lg bg-green-50 p-4 space-y-3 dark:border dark:border-green-900/50 dark:bg-green-950/30">
                  <div className="flex items-center gap-2 text-green-800 dark:text-green-300 font-medium">
                    <Check className="h-5 w-5 shrink-0" />
                    Invite created! Share this link:
                  </div>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <Input
                      value={generatedInviteLink}
                      readOnly
                      className="font-mono text-xs dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100"
                    />
                    <Button variant="outline" size="sm" onClick={() => copyInviteLink()} className="self-end sm:self-auto dark:border-slate-700 dark:hover:bg-slate-800">
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                  <p className="text-xs text-green-700 dark:text-green-400">
                    They visit this link, set a password, and can log in immediately.
                  </p>
                </div>
              )}

              <div className="flex flex-col-reverse sm:flex-row gap-2 justify-end pt-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowInviteForm(false);
                    setGeneratedInviteLink("");
                    setInviteForm({ employee_name: "", username: "", email: "", phone: "", role_id: "" });
                  }}
                  disabled={isSubmitting}
                  className="w-full sm:w-auto dark:border-slate-700 dark:hover:bg-slate-800"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleCreateInvite}
                  disabled={isSubmitting}
                  className="w-full sm:w-auto dark:bg-slate-100 dark:text-slate-950 dark:hover:bg-slate-200"
                >
                  <Mail className="mr-2 h-4 w-4" />
                  {isSubmitting ? "Creating..." : "Create Invite"}
                </Button>
              </div>
            </CardContent>
          )}
        </Card>

        {/* Search Permissions */}
<Card className="border-slate-200 dark:border-slate-800 dark:bg-slate-900">
  <CardHeader>
    <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
      <div>
        <CardTitle className="text-slate-950 dark:text-slate-50">
          Search Permissions Control
        </CardTitle>

        <CardDescription className="dark:text-slate-400">
          Configure whether team members can search all records across the
          tenant or only their own assigned items.
        </CardDescription>
      </div>

      <div className="relative w-full lg:w-64">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />

        <Input
          value={searchPermissionSearch}
          onChange={(e) => setSearchPermissionSearch(e.target.value)}
          placeholder="Search team member..."
          className="pl-9 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100"
        />
      </div>
    </div>
  </CardHeader>

  <CardContent>
    {isLoadingSearchPermissions ? (
      <div className="py-10 text-center text-gray-500 dark:text-slate-400">
        Loading search permissions...
      </div>
    ) : (
      <>
        <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-800">
          <table className="w-full min-w-[650px]">
            <thead className="bg-slate-50 dark:bg-slate-900">
              <tr className="border-b border-slate-200 dark:border-slate-800">
                <th className="px-5 py-4 text-left text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-400">
                  Team Member
                </th>

                <th className="px-5 py-4 text-center text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-400">
                  <div>Leads</div>
                  <div className="normal-case font-normal text-slate-400">
                    (search all)
                  </div>
                </th>

                <th className="px-5 py-4 text-center text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-400">
                  <div>Renewals</div>
                  <div className="normal-case font-normal text-slate-400">
                    (search all)
                  </div>
                </th>
              </tr>
            </thead>

            <tbody>
              {searchPermissionUsers
                .filter((user) => {
                  const search = searchPermissionSearch
                    .trim()
                    .toLowerCase();

                  if (!search) return true;

                  return (
                    user.employee_name.toLowerCase().includes(search) ||
                    (user.username || "").toLowerCase().includes(search) ||
                    (user.role || "").toLowerCase().includes(search)
                  );
                })
                .map((user) => {
                  const permissions =
                    searchPermissionDraft[user.user_id] || {
                      leads: false,
                      renewals: false,
                    };

                  return (
                    <tr
                      key={user.user_id}
                      className="border-b border-slate-100 last:border-b-0 dark:border-slate-800"
                    >
                      <td className="px-5 py-4">
                        <div className="font-medium text-slate-950 dark:text-slate-50">
                          {user.employee_name}
                        </div>

                        <div className="text-sm text-slate-500 dark:text-slate-400">
                          {user.role || "User"}
                          {user.username && ` · ${user.username}`}
                        </div>
                      </td>

                      <td className="px-5 py-4 text-center">
                        <input
                          type="checkbox"
                          checked={permissions.leads}
                          onChange={(e) =>
                            updateSearchPermission(
                              user.user_id,
                              "leads",
                              e.target.checked
                            )
                          }
                          className="h-4 w-4 cursor-pointer accent-blue-600"
                        />
                      </td>

                      <td className="px-5 py-4 text-center">
                        <input
                          type="checkbox"
                          checked={permissions.renewals}
                          onChange={(e) =>
                            updateSearchPermission(
                              user.user_id,
                              "renewals",
                              e.target.checked
                            )
                          }
                          className="h-4 w-4 cursor-pointer accent-blue-600"
                        />
                      </td>
                    </tr>
                  );
                })}

              {searchPermissionUsers.length === 0 && (
                <tr>
                  <td
                    colSpan={3}
                    className="px-5 py-8 text-center text-sm text-slate-500"
                  >
                    No team members found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="mt-5 flex gap-3 rounded-lg border border-blue-100 bg-blue-50 p-4 dark:border-blue-900/50 dark:bg-blue-950/30">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-blue-600 dark:text-blue-400" />

          <p className="text-sm text-blue-700 dark:text-blue-300">
            Enabling checkboxes allows team members to look up records across
            the entire tenant. When disabled, searches are restricted strictly
            to items assigned to that specific user. Normal list pages remain
            unchanged.
          </p>
        </div>

        <div className="mt-5 flex justify-end gap-3">
          <Button
            variant="outline"
            onClick={cancelSearchPermissionChanges}
            disabled={
              isSavingSearchPermissions || !hasSearchPermissionChanges()
            }
            className="dark:border-slate-700 dark:hover:bg-slate-800"
          >
            Cancel
          </Button>

          <Button
            onClick={saveSearchPermissions}
            disabled={
              isSavingSearchPermissions || !hasSearchPermissionChanges()
            }
            className="dark:bg-slate-100 dark:text-slate-950 dark:hover:bg-slate-200"
          >
            <Save className="mr-2 h-4 w-4" />

            {isSavingSearchPermissions
              ? "Saving..."
              : "Save Changes"}
          </Button>
        </div>
      </>
    )}
  </CardContent>
</Card>

 </div>
    );
  };

  // ── Main Render ─────────────────────────────────────────────────────────────

  return (
    <div className="w-full max-w-7xl mx-auto p-4 sm:p-6 text-slate-900 dark:text-slate-100">
      <div className="mb-6 flex items-center gap-3">
        <Settings className="h-8 w-8 text-slate-950 dark:text-slate-50 shrink-0" />
        <h1 className="text-2xl sm:text-3xl font-bold text-slate-950 dark:text-slate-50">Settings</h1>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-3 h-auto p-1 bg-slate-100 dark:border dark:border-slate-800 dark:bg-slate-900">
          <TabsTrigger value="company" className="py-2.5 flex items-center justify-center gap-2 text-xs sm:text-sm dark:data-[state=active]:bg-slate-800 dark:data-[state=active]:text-slate-100">
            <Building2 className="h-4 w-4 shrink-0" />
            Company
          </TabsTrigger>
          <TabsTrigger value="users" className="py-2.5 flex items-center justify-center gap-2 text-xs sm:text-sm dark:data-[state=active]:bg-slate-800 dark:data-[state=active]:text-slate-100">
            <Users className="h-4 w-4 shrink-0" />
            Users & Search Permissions
          </TabsTrigger>
          <TabsTrigger value="system" className="py-2.5 flex items-center justify-center gap-2 text-xs sm:text-sm dark:data-[state=active]:bg-slate-800 dark:data-[state=active]:text-slate-100">
            <Database className="h-4 w-4 shrink-0" />
            System
          </TabsTrigger>
        </TabsList>

        {/* Company Settings */}
        <TabsContent value="company">
          <Card className="border-slate-200 dark:border-slate-800 dark:bg-slate-900">
            <CardHeader>
              <CardTitle className="text-slate-950 dark:text-slate-50">Company Information</CardTitle>
              <CardDescription className="dark:text-slate-400">Update your company details and branding information</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="company-name" className="dark:text-slate-300">Company Name</Label>
                  <Input
                    id="company-name"
                    value={companySettings.name}
                    readOnly
                    className="bg-gray-100 dark:border-slate-800 dark:bg-slate-950/60 dark:text-slate-400"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="company-phone" className="dark:text-slate-300">Phone Number</Label>
                  <Input
                    id="company-phone"
                    value={companySettings.phone}
                    readOnly
                    className="bg-gray-100 dark:border-slate-800 dark:bg-slate-950/60 dark:text-slate-400"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="company-website" className="dark:text-slate-300">Website</Label>
                  <Input
                    id="company-website"
                    value={companySettings.website}
                    readOnly
                    className="bg-gray-100 dark:border-slate-800 dark:bg-slate-950/60 dark:text-slate-400"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="company-postcode" className="dark:text-slate-300">Postcode</Label>
                  <Input
                    id="company-postcode"
                    value={companySettings.postcode}
                    readOnly
                    className="bg-gray-100 dark:border-slate-800 dark:bg-slate-950/60 dark:text-slate-400"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="company-address" className="dark:text-slate-300">Address</Label>
                <Textarea
                  id="company-address"
                  value={companySettings.address}
                  onChange={(e) => setCompanySettings({ ...companySettings, address: e.target.value })}
                  placeholder="Enter company address"
                  className="dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-500"
                />
              </div>

              <div className="flex justify-end">
                <Button onClick={saveCompanySettings} className="w-full sm:w-auto dark:bg-slate-100 dark:text-slate-950 dark:hover:bg-slate-200">
                  <Save className="mr-2 h-4 w-4" />
                  Save Address
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* User Management */}
        <TabsContent value="users">
          {renderUsersContent()}
        </TabsContent>

        {/* System Settings */}
        <TabsContent value="system">
          <div className="space-y-6">
            <Card className="border-slate-200 dark:border-slate-800 dark:bg-slate-900">
              <CardHeader>
                <CardTitle className="text-slate-950 dark:text-slate-50">Data Management</CardTitle>
                <CardDescription className="dark:text-slate-400">Backup and data management options</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <h4 className="font-medium text-slate-900 dark:text-slate-100">Database Backup</h4>
                    <p className="text-sm text-gray-500 dark:text-slate-400">Create a backup of all customer and project data</p>
                  </div>
                  <Button variant="outline" className="w-full sm:w-auto dark:border-slate-700 dark:hover:bg-slate-800">
                    <Database className="mr-2 h-4 w-4" />
                    Create Backup
                  </Button>
                </div>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <h4 className="font-medium text-slate-900 dark:text-slate-100">Export Customer Data</h4>
                    <p className="text-sm text-gray-500 dark:text-slate-400">Export customer data as CSV file</p>
                  </div>
                  <Button variant="outline" className="w-full sm:w-auto dark:border-slate-700 dark:hover:bg-slate-800">
                    <FileText className="mr-2 h-4 w-4" />
                    Export CSV
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card className="border-slate-200 dark:border-slate-800 dark:bg-slate-900">
              <CardHeader>
                <CardTitle className="text-slate-950 dark:text-slate-50">Security Settings</CardTitle>
                <CardDescription className="dark:text-slate-400">Configure security and access control settings</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between gap-4">
                  <div className="space-y-0.5">
                    <Label className="dark:text-slate-200">Require Two-Factor Authentication</Label>
                    <p className="text-sm text-gray-500 dark:text-slate-400">Require 2FA for all user accounts</p>
                  </div>
                  <Switch className="shrink-0" />
                </div>
                <div className="flex items-center justify-between gap-4">
                  <div className="space-y-0.5">
                    <Label className="dark:text-slate-200">Auto-logout after inactivity</Label>
                    <p className="text-sm text-gray-500 dark:text-slate-400">Automatically log out users after 30 minutes</p>
                  </div>
                  <Switch defaultChecked className="shrink-0" />
                </div>
                <div className="flex items-center justify-between gap-4">
                  <div className="space-y-0.5">
                    <Label className="dark:text-slate-200">Password Complexity Requirements</Label>
                    <p className="text-sm text-gray-500 dark:text-slate-400">Enforce strong password policies</p>
                  </div>
                  <Switch defaultChecked className="shrink-0" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="session-timeout" className="dark:text-slate-300">Session Timeout (minutes)</Label>
                  <Input
                    id="session-timeout"
                    type="number"
                    defaultValue="30"
                    className="w-full sm:w-32 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100"
                  />
                </div>
                <div className="flex justify-end">
                  <Button className="w-full sm:w-auto dark:bg-slate-100 dark:text-slate-950 dark:hover:bg-slate-200">
                    <Shield className="mr-2 h-4 w-4" />
                    Save Security Settings
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}