"use client";
import React, { useState, useEffect } from "react";
import {
  Settings,
  User,
  Building2,
  Users,
  Shield,
  Database,
  FileText,
  Save,
  Plus,
  Edit,
  Trash2,
  Check,
  X,
  Copy,
  Mail,
  Link as LinkIcon,
  ToggleLeft,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

// Types for settings data
interface CompanySettings {
  name: string;
  address: string;
  postcode: string;
  phone: string;
  website: string;
}

interface UserSettings {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  role: "Manager" | "HR" | "Sales" | "Production" | "Staff" | string;
  is_active: boolean;
  is_invited?: boolean;
  invitation_token?: string;
}

interface CurrentUser {
  role: string;
  [key: string]: any; // Allow other properties
}

interface InviteFormData {
  first_name: string;
  last_name: string;
  email: string;
  role: string;
}

export default function SettingsPage() {
  // State management
  const [activeTab, setActiveTab] = useState("company");
  const [companySettings, setCompanySettings] = useState<CompanySettings>({
    name: "Aztec Interiors",
    address: "127 Barkby Road, Leicester",
    postcode: "LE4 9LG",
    phone: "0116 276 4516",
    website: "www.aztecinteriors.co.uk",
  });

  const [users, setUsers] = useState<UserSettings[]>([]);
  const [editingUser, setEditingUser] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [isLoadingUser, setIsLoadingUser] = useState(true);

  const [showInviteForm, setShowInviteForm] = useState(false);
  const [inviteForm, setInviteForm] = useState<InviteFormData>({
    first_name: "",
    last_name: "",
    email: "",
    role: "Staff",
  });
  const [generatedInviteLink, setGeneratedInviteLink] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Load settings from API
  useEffect(() => {
    fetchCurrentUser();
    fetchSettings();
  }, []);

  const fetchCurrentUser = async () => {
    setIsLoadingUser(true);
    try {
      // Get the token with correct key
      const token = localStorage.getItem("auth_token");
      
      if (!token) {
        console.error("No auth_token found in localStorage");
        setCurrentUser(null);
        setIsLoadingUser(false);
        return;
      }

      // Auth endpoints use Next.js API routes, not the Render backend
      const basePath = process.env.NEXT_PUBLIC_BASE_PATH || '';
      const url = `${basePath}/api/auth/me`;
      
      const res = await fetch(url, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        }
      });
      
      if (res.ok) {
        const data = await res.json();
        console.log("Current user loaded:", data.user?.email, "Role:", data.user?.role);
        setCurrentUser(data.user);
      } else {
        const errorText = await res.text();
        console.error("Failed to fetch current user, status:", res.status);
        console.error("Error:", errorText.substring(0, 100));
        setCurrentUser(null);
      }
    } catch (err) {
      console.error("Error fetching current user:", err);
      setCurrentUser(null);
    } finally {
      setIsLoadingUser(false);
    }
  };

  const fetchSettings = async () => {
    try {
      const token = localStorage.getItem("auth_token");
      if (!token) {
        console.warn("No auth token found, cannot fetch users.");
        return;
      }

      // Try Next.js API route first
      const basePath = process.env.NEXT_PUBLIC_BASE_PATH || '';
      let url = `${basePath}/api/auth/users`;
      
      console.log("Fetching users from:", url);
      
      let usersRes = await fetch(url, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        }
      });

      // If Next.js route doesn't exist (404), try the Render backend
      if (!usersRes.ok && usersRes.status === 404) {
        console.log("Next.js API route not found, trying Render backend...");
        const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:5000";
        url = `${backendUrl}/auth/users`;
        console.log("Fetching users from backend:", url);
        
        usersRes = await fetch(url, {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`
          }
        });
      }

      if (!usersRes.ok) {
        const errorText = await usersRes.text();
        console.error("Failed to fetch users. Status:", usersRes.status);
        console.error("Error response:", errorText);
        throw new Error(`Failed to fetch users: ${usersRes.status}`);
      }

      const contentType = usersRes.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
        const text = await usersRes.text();
        console.error("Response is not JSON:", text.substring(0, 200));
        throw new Error("API returned HTML instead of JSON - endpoint may not exist");
      }

      const usersData = await usersRes.json();
      console.log("Users data received:", usersData);
      setUsers(usersData.users || []);

      console.log("Users loaded successfully");
    } catch (err) {
      console.error("Error loading settings:", err);
      alert("Error loading users. Check console for details.");
    }
  };

  const saveCompanySettings = async () => {
    try {
      const token = localStorage.getItem("auth_token");
      if (!token) throw new Error("Not authenticated");

      const basePath = process.env.NEXT_PUBLIC_BASE_PATH || '';
      const url = `${basePath}/api/settings/company`;
      
      const res = await fetch(url, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({ address: companySettings.address }),
      });

      if (!res.ok) throw new Error("Failed to save company settings");
      alert("Company settings saved successfully!");
    } catch (err) {
      console.error("Save error:", err);
      alert("Error saving company settings");
    }
  };

  // Check if current user has permission to manage users
  const canManageUsers = () => {
    if (isLoadingUser || !currentUser) {
      return false;
    }
    
    // Try to get role from different possible locations
    const role = currentUser.role || currentUser.Role || (currentUser as any).user_role;
    
    if (!role) {
      return false;
    }

    // Normalize the role for comparison
    const userRoleLower = String(role).toLowerCase().trim();
    
    return userRoleLower === "manager" || userRoleLower === "hr";
  };

  const handleInviteUser = () => {
    if (!canManageUsers()) {
      alert("You don't have permission to invite users");
      return;
    }
    setShowInviteForm(true);
    setGeneratedInviteLink("");
  };

  const updateInviteForm = (field: keyof InviteFormData, value: string) => {
    setInviteForm({ ...inviteForm, [field]: value });
  };

  const sendInvitation = async () => {
    // Validation
    if (!inviteForm.first_name || !inviteForm.last_name || !inviteForm.email) {
      alert("Please fill in all required fields");
      return;
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(inviteForm.email)) {
      alert("Please enter a valid email address");
      return;
    }

    setIsSubmitting(true);

    try {
      const token = localStorage.getItem("auth_token");
      if (!token) throw new Error("Not authenticated");

      const basePath = process.env.NEXT_PUBLIC_BASE_PATH || '';
      let url = `${basePath}/api/auth/invite-user`;
      
      console.log("Sending invitation to:", url);
      
      let res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify(inviteForm),
      });

      // If Next.js route doesn't exist (404), try the Render backend
      if (!res.ok && res.status === 404) {
        console.log("Next.js API route not found, trying Render backend...");
        const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:5000";
        url = `${backendUrl}/auth/invite-user`;
        console.log("Sending invitation to backend:", url);
        
        res = await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`
          },
          body: JSON.stringify(inviteForm),
        });
      }

      if (!res.ok) {
        const contentType = res.headers.get("content-type");
        if (contentType && contentType.includes("application/json")) {
          const error = await res.json();
          throw new Error(error.message || "Failed to send invitation");
        } else {
          const text = await res.text();
          console.error("Non-JSON error response:", text.substring(0, 200));
          throw new Error(`API returned HTML instead of JSON (status ${res.status}) - endpoint may not exist`);
        }
      }

      // Check content-type before parsing success response
      const contentType = res.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
        const text = await res.text();
        console.error("Non-JSON success response:", text.substring(0, 200));
        throw new Error("API returned HTML instead of JSON - endpoint configuration issue");
      }

      const data = await res.json();
      
      // Generate the invitation link
      const baseUrl = window.location.origin;
      const inviteLink = `${baseUrl}${basePath}/register?token=${data.invitation_token}`;
      
      setGeneratedInviteLink(inviteLink);
      
      // Reset form
      setInviteForm({
        first_name: "",
        last_name: "",
        email: "",
        role: "Staff",
      });

      // Refresh user list
      fetchSettings();

      alert("Invitation created successfully! Copy the link and send it to the user.");
    } catch (err: any) {
      console.error("Invitation error:", err);
      alert(err.message || "Error sending invitation");
    } finally {
      setIsSubmitting(false);
    }
  };

  const copyInviteLink = () => {
    navigator.clipboard.writeText(generatedInviteLink);
    alert("Invitation link copied to clipboard!");
  };

  const resendInvitation = async (userId: string) => {
    if (!canManageUsers()) {
      alert("You don't have permission to resend invitations");
      return;
    }

    try {
      const token = localStorage.getItem("auth_token");
      if (!token) throw new Error("Not authenticated");

      const basePath = process.env.NEXT_PUBLIC_BASE_PATH || '';
      const url = `${basePath}/api/auth/resend-invitation/${userId}`;
      
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || "Failed to resend invitation");
      }

      const data = await res.json();
      const baseUrl = window.location.origin;
      const inviteLink = `${baseUrl}${basePath}/register?token=${data.invitation_token}`;
      
      setGeneratedInviteLink(inviteLink);
      alert("New invitation link generated! Copy and send it to the user.");
    } catch (err: any) {
      console.error("Resend invitation error:", err);
      alert(err.message || "Error resending invitation");
    }
  };

  const updateUser = (id: string, field: keyof UserSettings, value: any) => {
    setUsers(users.map((user) => (user.id === id ? { ...user, [field]: value } : user)));
  };

  const saveUserChanges = async (id: string) => {
    if (!canManageUsers()) {
      alert("You don't have permission to update users");
      return;
    }

    const user = users.find((u) => u.id === id);
    if (!user) return;

    try {
      const token = localStorage.getItem("auth_token");
      if (!token) throw new Error("Not authenticated");

      const basePath = process.env.NEXT_PUBLIC_BASE_PATH || '';
      const url = `${basePath}/api/auth/users/${id}`;
      
      const res = await fetch(url, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({
          first_name: user.first_name,
          last_name: user.last_name,
          email: user.email,
          role: user.role,
        }),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || "Failed to update user");
      }

      alert("User updated successfully!");
      setEditingUser(null);
      fetchSettings();
    } catch (err: any) {
      console.error("Update user error:", err);
      alert(err.message || "Error updating user");
    }
  };

  const cancelEdit = (id: string) => {
    setEditingUser(null);
    fetchSettings(); // Refresh to revert changes
  };

  const deleteUser = async (id: string) => {
    if (!canManageUsers()) {
      alert("You don't have permission to delete users");
      return;
    }

    if (!confirm("Are you sure you want to delete this user?")) return;

    try {
      const token = localStorage.getItem("auth_token");
      if (!token) throw new Error("Not authenticated");

      const basePath = process.env.NEXT_PUBLIC_BASE_PATH || '';
      const url = `${basePath}/api/auth/users/${id}`;
      
      const res = await fetch(url, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || "Failed to delete user");
      }

      setUsers(users.filter((u) => u.id !== id));
      alert("User deleted successfully!");
    } catch (err: any) {
      console.error("Delete error:", err);
      alert(err.message || "Error deleting user");
    }
  };

  const toggleUserStatus = async (id: string, newStatus: boolean) => {
    if (!canManageUsers()) {
      alert("You don't have permission to change user status");
      return;
    }

    // Optimistically update the UI
    updateUser(id, "is_active", newStatus);

    try {
      const token = localStorage.getItem("auth_token");
      if (!token) throw new Error("Not authenticated");

      const basePath = process.env.NEXT_PUBLIC_BASE_PATH || '';
      const url = `${basePath}/api/auth/users/${id}/toggle-status`;
      
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({ is_active: newStatus }),
      });

      if (!res.ok) throw new Error("Failed to toggle status");
      console.log("User status toggled successfully");
    } catch (err) {
      console.error("Error toggling user status:", err);
      // Revert the UI update if the API call fails
      updateUser(id, "is_active", !newStatus); 
      alert("Error updating user status");
    }
  };
  
  // Conditional rendering function to show a loading indicator or the permission message
  const renderUsersContent = () => {
    if (isLoadingUser) {
      return <div className="p-4 text-center text-gray-500">Loading user permissions...</div>;
    }

    return (
      <div className="space-y-6">
        {/* User Invitation Card - Only shown if canManageUsers is TRUE */}
        {canManageUsers() && (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Invite New User</CardTitle>
                  <CardDescription>
                    Send an invitation link to new users to complete their registration
                  </CardDescription>
                </div>
                {!showInviteForm && (
                  <Button onClick={handleInviteUser}>
                    <Plus className="mr-2 h-4 w-4" />
                    Invite User
                  </Button>
                )}
              </div>
            </CardHeader>
            {showInviteForm && (
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>First Name *</Label>
                    <Input
                      value={inviteForm.first_name}
                      onChange={(e) => updateInviteForm("first_name", e.target.value)}
                      placeholder="John"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Last Name *</Label>
                    <Input
                      value={inviteForm.last_name}
                      onChange={(e) => updateInviteForm("last_name", e.target.value)}
                      placeholder="Doe"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Email *</Label>
                    <Input
                      type="email"
                      value={inviteForm.email}
                      onChange={(e) => updateInviteForm("email", e.target.value)}
                      placeholder="john@example.com"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Role *</Label>
                    <Select value={inviteForm.role} onValueChange={(value) => updateInviteForm("role", value)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Manager">Manager</SelectItem>
                        <SelectItem value="HR">HR</SelectItem>
                        <SelectItem value="Sales">Sales</SelectItem>
                        <SelectItem value="Production">Production</SelectItem>
                        <SelectItem value="Staff">Staff</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {generatedInviteLink && (
                  <div className="rounded-lg bg-green-50 p-4 space-y-3">
                    <div className="flex items-center gap-2 text-green-800 font-medium">
                      <Check className="h-5 w-5" />
                      Invitation Created Successfully!
                    </div>
                    <div className="space-y-2">
                      <Label>Registration Link (copy and send to user)</Label>
                      <div className="flex gap-2"> 
                        <Input value={generatedInviteLink} readOnly className="font-mono text-sm" />
                        <Button onClick={copyInviteLink} variant="outline" size="sm">
                          <Copy className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                )}

                <div className="flex gap-2 justify-end">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setShowInviteForm(false);
                      setGeneratedInviteLink("");
                      setInviteForm({
                        first_name: "",
                        last_name: "",
                        email: "",
                        role: "Staff",
                      });
                    }}
                    disabled={isSubmitting}
                  >
                    Cancel
                  </Button>
                  <Button onClick={sendInvitation} disabled={isSubmitting}>
                    <Mail className="mr-2 h-4 w-4" />
                    {isSubmitting ? "Creating..." : "Create Invitation"}
                  </Button>
                </div>
              </CardContent>
            )}
          </Card>
        )}

        {/* Users List */}
        <Card>
          <CardHeader>
            <CardTitle>All Users</CardTitle>
            <CardDescription>Manage existing user accounts and permissions</CardDescription>
          </CardHeader>
          <CardContent>
            {/* ONLY show the permission warning if not loading AND the user cannot manage */}
            {!canManageUsers() && (
              <div className="mb-4 rounded-lg bg-yellow-50 p-4 text-sm text-yellow-800">
                You don't have permission to manage users. Only <strong>Manager</strong> and <strong>HR</strong> roles can invite, edit, or delete
                users.
              </div>
            )}
            <div className="space-y-4">
              {users.map((user) => (
                <div key={user.id} className="rounded-lg border p-4">
                  {editingUser === user.id && canManageUsers() ? ( 
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>First Name *</Label>
                          <Input
                            value={user.first_name}
                            onChange={(e) => updateUser(user.id, "first_name", e.target.value)}
                            placeholder="First Name"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Last Name *</Label>
                          <Input
                            value={user.last_name}
                            onChange={(e) => updateUser(user.id, "last_name", e.target.value)}
                            placeholder="Last Name"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>Email *</Label>
                          <Input
                            type="email"
                            value={user.email}
                            onChange={(e) => updateUser(user.id, "email", e.target.value)}
                            placeholder="email@example.com"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Role *</Label>
                          <Select value={user.role} onValueChange={(value) => updateUser(user.id, "role", value)}>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="Manager">Manager</SelectItem>
                              <SelectItem value="HR">HR</SelectItem>
                              <SelectItem value="Sales">Sales</SelectItem>
                              <SelectItem value="Production">Production</SelectItem>
                              <SelectItem value="Staff">Staff</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      <div className="flex gap-2 justify-end">
                        <Button size="sm" variant="outline" onClick={() => cancelEdit(user.id)}>
                          <X className="mr-2 h-4 w-4" />
                          Cancel
                        </Button>
                        <Button size="sm" onClick={() => saveUserChanges(user.id)}>
                          <Check className="mr-2 h-4 w-4" />
                          Save
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-6">
                        <div className="min-w-[200px]">
                          <div className="font-medium">
                            {user.first_name} {user.last_name}
                          </div>
                          <div className="text-sm text-gray-600">{user.email}</div>
                        </div>
                        <div>
                          <span className="inline-flex rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-800">
                            {user.role}
                          </span>
                        </div>
                        <div>
                          {user.is_invited ? (
                            <span className="inline-flex rounded-full bg-orange-100 px-3 py-1 text-xs font-semibold text-orange-800">
                              Pending Registration
                            </span>
                          ) : (
                            <span
                              className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${
                                user.is_active ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"
                              }`}
                            >
                              {user.is_active ? "Active" : "Inactive"}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        {user.is_invited && canManageUsers() && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => resendInvitation(user.id)}
                            title="Resend invitation link"
                          >
                            <LinkIcon className="h-4 w-4 mr-1" />
                            Resend Link
                          </Button>
                        )}
                        {!user.is_invited && canManageUsers() && (
                            <Switch 
                                checked={user.is_active}
                                onCheckedChange={(newStatus) => toggleUserStatus(user.id, newStatus)}
                                aria-label={`Toggle status for ${user.first_name}`}
                            />
                        )}
                        {canManageUsers() && (
                          <>
                            <Button size="sm" variant="ghost" onClick={() => setEditingUser(user.id)} title="Edit User">
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => deleteUser(user.id)} title="Delete User">
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  };
  
  return (
    <div className="w-full p-6">
      {/* Header */}
      <div className="mb-6 flex items-center gap-3">
        <Settings className="h-8 w-8" />
        <h1 className="text-3xl font-bold">Settings</h1>
      </div>

      {/* Settings Tabs */}
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
            {/* Backup & Data */}
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

            {/* Security Settings */}
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