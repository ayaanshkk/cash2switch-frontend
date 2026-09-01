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


  // ── Bootstrap ───────────────────────────────────────────────────────────────

  useEffect(() => {
    fetchCurrentUser();
  }, []);

  useEffect(() => {
    if (currentUserRole === "Platform Admin" || currentUserRole === "Tenant Super Admin") {
      loadMembers();
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
      setMembers(data.members || []);
    } catch (err: any) {
      alert(err.message || "Failed to load team members");
    } finally {
      setIsLoadingMembers(false);
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
      return <div className="p-4 text-center text-gray-500">Loading permissions...</div>;
    }

    if (!isAdmin) {
      return (
        <Card>
          <CardContent className="py-12 text-center text-gray-500">
            <Shield className="h-10 w-10 mx-auto mb-3 text-gray-300" />
            <p className="font-medium">Platform Admin access required</p>
            <p className="text-sm mt-1">Only Platform Admins can manage team members.</p>
          </CardContent>
        </Card>
      );
    }

return (
  <div className="space-y-6">
    {/* Invite Card */}
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Invite Team Member</CardTitle>
            <CardDescription>
              Create a username for your team member and share the invite link so
              they can set their password and log in.
            </CardDescription>
          </div>
          {!showInviteForm && (
            <Button onClick={() => { setShowInviteForm(true); setGeneratedInviteLink(""); }}>
              <Plus className="mr-2 h-4 w-4" />
              Invite Member
            </Button>
          )}
        </div>
      </CardHeader>

      {showInviteForm && (
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Full Name <span className="text-red-500">*</span></Label>
              <Input
                placeholder="e.g. Sarah Jones"
                value={inviteForm.employee_name}
                onChange={(e) => setInviteForm({ ...inviteForm, employee_name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Username <span className="text-red-500">*</span></Label>
              <Input
                placeholder="e.g. sarah.jones"
                value={inviteForm.username}
                onChange={(e) => setInviteForm({ ...inviteForm, username: e.target.value })}
              />
              <p className="text-xs text-gray-500">They will use this to log in</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Email <span className="text-gray-400 font-normal">(optional)</span></Label>
              <Input
                type="email"
                placeholder="sarah@company.com"
                value={inviteForm.email}
                onChange={(e) => setInviteForm({ ...inviteForm, email: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Phone <span className="text-gray-400 font-normal">(optional)</span></Label>
              <Input
                placeholder="07700 000000"
                value={inviteForm.phone}
                onChange={(e) => setInviteForm({ ...inviteForm, phone: e.target.value })}
              />
            </div>
          </div>

          <div className="space-y-2 max-w-xs">
            <Label>Role <span className="text-red-500">*</span></Label>
            <Select
              value={inviteForm.role_id}
              onValueChange={(v) => setInviteForm({ ...inviteForm, role_id: v })}
            >
              <SelectTrigger><SelectValue placeholder="Select role" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="2">Platform Admin</SelectItem>
                <SelectItem value="3">Salesperson</SelectItem>
                <SelectItem value="5">Leads Offshore</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {generatedInviteLink && (
            <div className="rounded-lg bg-green-50 p-4 space-y-3">
              <div className="flex items-center gap-2 text-green-800 font-medium">
                <Check className="h-5 w-5" />
                Invite created! Share this link:
              </div>
              <div className="flex gap-2">
                <Input value={generatedInviteLink} readOnly className="font-mono text-xs" />
                <Button variant="outline" size="sm" onClick={() => copyInviteLink()}>
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
              <p className="text-xs text-green-700">
                They visit this link, set a password, and can log in immediately.
              </p>
            </div>
          )}

          <div className="flex gap-2 justify-end">
            <Button
              variant="outline"
              onClick={() => {
                setShowInviteForm(false);
                setGeneratedInviteLink("");
                setInviteForm({ employee_name: "", username: "", email: "", phone: "", role_id: "" });
              }}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button onClick={handleCreateInvite} disabled={isSubmitting}>
              <Mail className="mr-2 h-4 w-4" />
              {isSubmitting ? "Creating..." : "Create Invite"}
            </Button>
          </div>
        </CardContent>
      )}
    </Card>

    {/* Team Members List */}
    <Card>
      <CardHeader>
        <CardTitle>All Users</CardTitle>
        <CardDescription>Manage existing team members and permissions</CardDescription>
      </CardHeader>
      <CardContent>
        {isLoadingMembers ? (
          <div className="text-center py-8 text-gray-400">Loading members...</div>
        ) : members.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            No team members yet. Invite your first member above.
          </div>
        ) : (
          <div className="space-y-3">
            {members.map((member) => (
              <div key={member.employee_id} className="rounded-lg border p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-6">
                    <div className="min-w-[200px]">
                      <div className="font-medium">{member.employee_name}</div>
                      <div className="text-sm text-gray-600">
                        {member.username
                          ? `@${member.username}`
                          : <span className="italic text-gray-400">No username</span>}
                        {member.email && <span className="ml-2">· {member.email}</span>}
                      </div>
                    </div>

                    <div className="w-44">
                      <Select
                        value={member.role_id ? String(member.role_id) : ""}
                        onValueChange={(roleId) => handleUpdateMemberRole(member, roleId)}
                        disabled={!member.user_id || updatingRoleEmployeeId === member.employee_id}
                      >
                        <SelectTrigger className="h-9">
                          <SelectValue placeholder={member.role || "Select role"} />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="2">Platform Admin</SelectItem>
                          <SelectItem value="3">Salesperson</SelectItem>
                          <SelectItem value="5">Leads Offshore</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {member.is_invite_pending ? (
                      <span className="inline-flex rounded-full bg-orange-100 px-3 py-1 text-xs font-semibold text-orange-800">
                        Pending Registration
                      </span>
                    ) : member.user_id ? (
                      <span className="inline-flex rounded-full bg-green-100 px-3 py-1 text-xs font-semibold text-green-800">
                        Active
                      </span>
                    ) : (
                      <span className="inline-flex rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-500">
                        No account
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    {member.is_invite_pending && member.invite_link && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => copyInviteLink(member.invite_link!)}
                        title="Copy invite link"
                      >
                        <Copy className="h-4 w-4 mr-1" />
                        Copy Link
                      </Button>
                    )}
                    {member.is_invite_pending && member.user_id && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleResendInvite(member.user_id!)}
                        disabled={resendingUserId === member.user_id}
                        title="Generate new invite link"
                      >
                        <LinkIcon className="h-4 w-4 mr-1" />
                        {resendingUserId === member.user_id ? "..." : "New Link"}
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleDeleteMember(member.employee_id, member.employee_name)}
                      disabled={deletingEmployeeId === member.employee_id}
                      title="Delete team member"
                      className="text-red-600 border-red-200 hover:bg-red-50"
                    >
                      <Trash2 className="h-4 w-4 mr-1" />
                      {deletingEmployeeId === member.employee_id ? "..." : "Delete"}
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  </div>
);
};

  // ── Main Render ─────────────────────────────────────────────────────────────

  return (
    <div className="w-full p-6">
      <div className="mb-6 flex items-center gap-3">
        <Settings className="h-8 w-8" />
        <h1 className="text-3xl font-bold">Settings</h1>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="company" className="flex items-center gap-2">
            <Building2 className="h-4 w-4" />
            Company
          </TabsTrigger>
          <TabsTrigger value="users" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            Users
          </TabsTrigger>
          <TabsTrigger value="system" className="flex items-center gap-2">
            <Database className="h-4 w-4" />
            System
          </TabsTrigger>
        </TabsList>

        {/* Company Settings */}
        <TabsContent value="company">
          <Card>
            <CardHeader>
              <CardTitle>Company Information</CardTitle>
              <CardDescription>Update your company details and branding information</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="company-name">Company Name</Label>
                  <Input id="company-name" value={companySettings.name} readOnly className="bg-gray-100" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="company-phone">Phone Number</Label>
                  <Input id="company-phone" value={companySettings.phone} readOnly className="bg-gray-100" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="company-website">Website</Label>
                  <Input id="company-website" value={companySettings.website} readOnly className="bg-gray-100" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="company-postcode">Postcode</Label>
                  <Input id="company-postcode" value={companySettings.postcode} readOnly className="bg-gray-100" />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="company-address">Address</Label>
                <Textarea
                  id="company-address"
                  value={companySettings.address}
                  onChange={(e) => setCompanySettings({ ...companySettings, address: e.target.value })}
                  placeholder="Enter company address"
                />
              </div>

              <div className="flex justify-end">
                <Button onClick={saveCompanySettings}>
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
            <Card>
              <CardHeader>
                <CardTitle>Data Management</CardTitle>
                <CardDescription>Backup and data management options</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-medium">Database Backup</h4>
                    <p className="text-sm text-gray-500">Create a backup of all customer and project data</p>
                  </div>
                  <Button variant="outline">
                    <Database className="mr-2 h-4 w-4" />
                    Create Backup
                  </Button>
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-medium">Export Customer Data</h4>
                    <p className="text-sm text-gray-500">Export customer data as CSV file</p>
                  </div>
                  <Button variant="outline">
                    <FileText className="mr-2 h-4 w-4" />
                    Export CSV
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Security Settings</CardTitle>
                <CardDescription>Configure security and access control settings</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Require Two-Factor Authentication</Label>
                    <p className="text-sm text-gray-500">Require 2FA for all user accounts</p>
                  </div>
                  <Switch />
                </div>
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Auto-logout after inactivity</Label>
                    <p className="text-sm text-gray-500">Automatically log out users after 30 minutes</p>
                  </div>
                  <Switch defaultChecked />
                </div>
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Password Complexity Requirements</Label>
                    <p className="text-sm text-gray-500">Enforce strong password policies</p>
                  </div>
                  <Switch defaultChecked />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="session-timeout">Session Timeout (minutes)</Label>
                  <Input id="session-timeout" type="number" defaultValue="30" className="w-32" />
                </div>
                <div className="flex justify-end">
                  <Button>
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
