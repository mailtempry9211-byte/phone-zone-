import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Users, UserPlus, Shield, Activity, Clock, CheckCircle2, Lock, Edit2, KeyRound, Trash2, XCircle } from "lucide-react";
import { toast } from "sonner";

interface UserItem {
  id: string;
  email: string;
  display_name?: string;
  shop_id?: string;
  roles?: string[];
  is_active: number;
  created_at: string;
}

interface AuditLog {
  id: string;
  user_id?: string;
  action: string;
  entity?: string;
  entity_id?: string;
  created_at: string;
}

export default function UsersTab() {
  const [users, setUsers] = useState<UserItem[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeSubTab, setActiveSubTab] = useState<"users" | "logs">("users");

  // Create user form state
  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newDisplayName, setNewDisplayName] = useState("");
  const [newRole, setNewRole] = useState("staff");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Edit user state
  const [editingUser, setEditingUser] = useState<UserItem | null>(null);
  const [editDisplayName, setEditDisplayName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editRole, setEditRole] = useState("staff");
  const [editIsActive, setEditIsActive] = useState(true);
  const [isUpdating, setIsUpdating] = useState(false);

  // Change password state
  const [passwordUser, setPasswordUser] = useState<UserItem | null>(null);
  const [targetNewPassword, setTargetNewPassword] = useState("");
  const [isResettingPassword, setIsResettingPassword] = useState(false);

  // Delete user state
  const [deletingUser, setDeletingUser] = useState<UserItem | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    fetchUsers();
    fetchAuditLogs();
  }, []);

  const fetchUsers = async () => {
    try {
      const res = await fetch("/api/users", { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        setUsers(data || []);
      }
    } catch {
      // ignore
    } finally {
      setIsLoading(false);
    }
  };

  const fetchAuditLogs = async () => {
    try {
      const res = await fetch("/api/audit-logs", { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        setAuditLogs(data || []);
      }
    } catch {
      // ignore
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEmail || !newPassword) {
      toast.error("Username and password are required");
      return;
    }
    if (newPassword.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          email: newEmail.trim().toLowerCase(),
          password: newPassword,
          displayName: newDisplayName.trim() || newEmail.trim(),
          role: newRole,
        }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Failed to create user");
      }

      toast.success(`User "${newEmail}" created successfully with role ${newRole}`);
      setNewEmail("");
      setNewPassword("");
      setNewDisplayName("");
      setNewRole("staff");
      fetchUsers();
    } catch (err: any) {
      toast.error(err.message || "Failed to create user");
    } finally {
      setIsSubmitting(false);
    }
  };

  const startEditUser = (u: UserItem) => {
    setEditingUser(u);
    setEditDisplayName(u.display_name || "");
    setEditEmail(u.email);
    setEditRole(u.roles?.[0] || "staff");
    setEditIsActive(Boolean(u.is_active));
  };

  const handleUpdateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;
    setIsUpdating(true);
    try {
      const res = await fetch(`/api/users/${editingUser.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          displayName: editDisplayName.trim(),
          email: editEmail.trim().toLowerCase(),
          role: editRole,
          isActive: editIsActive,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Failed to update user");
      }
      toast.success("User account updated successfully");
      setEditingUser(null);
      fetchUsers();
    } catch (err: any) {
      toast.error(err.message || "Failed to update user");
    } finally {
      setIsUpdating(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!passwordUser) return;
    if (targetNewPassword.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }
    setIsResettingPassword(true);
    try {
      const res = await fetch(`/api/users/${passwordUser.id}/password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ newPassword: targetNewPassword }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Failed to update password");
      }
      toast.success(`Password for "${passwordUser.email}" has been reset.`);
      setPasswordUser(null);
      setTargetNewPassword("");
    } catch (err: any) {
      toast.error(err.message || "Failed to reset password");
    } finally {
      setIsResettingPassword(false);
    }
  };

  const handleDeleteUser = async () => {
    if (!deletingUser) return;
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/users/${deletingUser.id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Failed to delete user");
      }
      toast.success(`User "${deletingUser.email}" removed successfully`);
      setDeletingUser(null);
      fetchUsers();
    } catch (err: any) {
      toast.error(err.message || "Failed to delete user");
    } finally {
      setIsDeleting(false);
    }
  };

  const roleBadge = (role?: string) => {
    switch (role) {
      case "master_admin":
      case "admin":
        return <Badge className="bg-amber-600">Admin</Badge>;
      case "sales_admin":
        return <Badge className="bg-blue-600">Sales Admin</Badge>;
      case "repair_admin":
        return <Badge className="bg-purple-600">Repair Admin</Badge>;
      case "technician":
        return <Badge className="bg-indigo-600">Technician</Badge>;
      case "viewer":
        return <Badge variant="outline">Viewer</Badge>;
      default:
        return <Badge className="bg-slate-600">Staff</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Sub-tab navigation */}
      <div className="flex gap-2 border-b pb-2">
        <Button
          variant={activeSubTab === "users" ? "default" : "outline"}
          size="sm"
          onClick={() => setActiveSubTab("users")}
        >
          <Users className="h-4 w-4 mr-2" /> Staff & Roles ({users.length})
        </Button>
        <Button
          variant={activeSubTab === "logs" ? "default" : "outline"}
          size="sm"
          onClick={() => { setActiveSubTab("logs"); fetchAuditLogs(); }}
        >
          <Activity className="h-4 w-4 mr-2" /> Activity Log ({auditLogs.length})
        </Button>
      </div>

      {activeSubTab === "users" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Create User Card */}
          <Card className="lg:col-span-1">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <UserPlus className="h-4 w-4" /> Add New Staff / Technician
              </CardTitle>
              <CardDescription>
                Create staff accounts with specific role and permission boundaries.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleCreateUser} className="space-y-4">
                <div>
                  <Label htmlFor="newEmail">Username / Login ID *</Label>
                  <Input
                    id="newEmail"
                    placeholder="e.g. rahul, tech1, or sales@shop.com"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="newDisplayName">Full Name</Label>
                  <Input
                    id="newDisplayName"
                    placeholder="e.g. Rahul Sharma"
                    value={newDisplayName}
                    onChange={(e) => setNewDisplayName(e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="newPassword">Password *</Label>
                  <Input
                    id="newPassword"
                    type="password"
                    placeholder="Min 6 characters"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="newRole">Role & Permissions</Label>
                  <select
                    id="newRole"
                    className="w-full h-10 px-3 py-2 border rounded-md text-sm bg-background"
                    value={newRole}
                    onChange={(e) => setNewRole(e.target.value)}
                  >
                    <option value="sales_admin">Sales Admin (Buy, Sell, Invoicing)</option>
                    <option value="repair_admin">Repair Admin (Full Repair Dept Control)</option>
                    <option value="technician">Technician (Repair Jobs & Diagnostic Update)</option>
                    <option value="staff">General Staff (Counter Sales & Lookups)</option>
                    <option value="viewer">Viewer (Read-Only)</option>
                    <option value="master_admin">Master Admin (Full System Control)</option>
                  </select>
                </div>
                <Button type="submit" className="w-full" disabled={isSubmitting}>
                  {isSubmitting ? "Creating..." : "Create Account"}
                </Button>
              </form>
            </CardContent>
          </Card>

          {/* User List Card */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Shield className="h-4 w-4" /> Active Staff Accounts
              </CardTitle>
              <CardDescription>
                Users who can sign into this PhoneZone terminal. Click Edit, Reset Password, or Delete to manage.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <p className="text-sm text-gray-500 py-4 text-center">Loading accounts...</p>
              ) : users.length === 0 ? (
                <p className="text-sm text-gray-500 py-4 text-center">No staff accounts registered yet.</p>
              ) : (
                <div className="border rounded-md divide-y overflow-hidden">
                  {users.map((u) => (
                    <div key={u.id} className="p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50">
                      <div>
                        <div className="font-semibold text-sm flex items-center gap-2">
                          {u.display_name || u.email}
                          {roleBadge(u.roles?.[0])}
                          {u.is_active ? (
                            <span className="text-[11px] text-green-700 flex items-center gap-0.5 font-medium bg-green-50 px-1.5 py-0.2 rounded border border-green-200">
                              <CheckCircle2 className="h-3 w-3" /> Active
                            </span>
                          ) : (
                            <span className="text-[11px] text-gray-500 flex items-center gap-0.5 font-medium bg-gray-100 px-1.5 py-0.2 rounded border border-gray-200">
                              <XCircle className="h-3 w-3" /> Inactive
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-gray-500 mt-0.5">
                          Login ID: <span className="font-mono">{u.email}</span> &middot; Added {new Date(u.created_at).toLocaleDateString()}
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 self-end sm:self-auto">
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 px-2.5 text-xs text-blue-700 hover:text-blue-800 hover:bg-blue-50"
                          onClick={() => startEditUser(u)}
                          title="Edit User Info"
                        >
                          <Edit2 className="h-3.5 w-3.5 mr-1" /> Edit
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 px-2.5 text-xs text-amber-700 hover:text-amber-800 hover:bg-amber-50"
                          onClick={() => { setPasswordUser(u); setTargetNewPassword(""); }}
                          title="Reset Password"
                        >
                          <KeyRound className="h-3.5 w-3.5 mr-1" /> Password
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 px-2.5 text-xs text-rose-700 hover:text-rose-800 hover:bg-rose-50"
                          onClick={() => setDeletingUser(u)}
                          title="Delete Account"
                        >
                          <Trash2 className="h-3.5 w-3.5 mr-1" /> Delete
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Edit User Dialog */}
      <Dialog open={!!editingUser} onOpenChange={(open) => !open && setEditingUser(null)}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Edit User Account</DialogTitle>
            <DialogDescription>
              Update staff details, role permissions, or toggle account status.
            </DialogDescription>
          </DialogHeader>
          {editingUser && (
            <form onSubmit={handleUpdateUser} className="space-y-4 py-2">
              <div>
                <Label htmlFor="editDisplayName">Full Name</Label>
                <Input
                  id="editDisplayName"
                  value={editDisplayName}
                  onChange={(e) => setEditDisplayName(e.target.value)}
                  placeholder="Full Name"
                />
              </div>
              <div>
                <Label htmlFor="editEmail">Username / Login ID</Label>
                <Input
                  id="editEmail"
                  value={editEmail}
                  onChange={(e) => setEditEmail(e.target.value)}
                  placeholder="Username"
                  required
                />
              </div>
              <div>
                <Label htmlFor="editRole">Role & Permissions</Label>
                <select
                  id="editRole"
                  className="w-full h-10 px-3 py-2 border rounded-md text-sm bg-background mt-1"
                  value={editRole}
                  onChange={(e) => setEditRole(e.target.value)}
                >
                  <option value="sales_admin">Sales Admin (Buy, Sell, Invoicing)</option>
                  <option value="repair_admin">Repair Admin (Full Repair Dept Control)</option>
                  <option value="technician">Technician (Repair Jobs & Diagnostic Update)</option>
                  <option value="staff">General Staff (Counter Sales & Lookups)</option>
                  <option value="viewer">Viewer (Read-Only)</option>
                  <option value="master_admin">Master Admin (Full System Control)</option>
                </select>
              </div>
              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="editIsActive"
                  checked={editIsActive}
                  onChange={(e) => setEditIsActive(e.target.checked)}
                  className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <Label htmlFor="editIsActive" className="text-sm font-medium cursor-pointer">
                  Account is Active (Can log in)
                </Label>
              </div>
              <DialogFooter className="pt-2">
                <Button type="button" variant="outline" onClick={() => setEditingUser(null)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={isUpdating}>
                  {isUpdating ? "Saving..." : "Save Changes"}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* Reset Password Dialog */}
      <Dialog open={!!passwordUser} onOpenChange={(open) => !open && setPasswordUser(null)}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Reset Password</DialogTitle>
            <DialogDescription>
              Set a new password for account: <strong>{passwordUser?.email}</strong>
            </DialogDescription>
          </DialogHeader>
          {passwordUser && (
            <form onSubmit={handleResetPassword} className="space-y-4 py-2">
              <div>
                <Label htmlFor="targetNewPassword">New Password (Min 6 characters)</Label>
                <Input
                  id="targetNewPassword"
                  type="password"
                  value={targetNewPassword}
                  onChange={(e) => setTargetNewPassword(e.target.value)}
                  placeholder="Enter new password"
                  required
                  autoFocus
                />
              </div>
              <DialogFooter className="pt-2">
                <Button type="button" variant="outline" onClick={() => setPasswordUser(null)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={isResettingPassword} className="bg-amber-600 hover:bg-amber-700">
                  {isResettingPassword ? "Updating..." : "Update Password"}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deletingUser} onOpenChange={(open) => !open && setDeletingUser(null)}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle className="text-rose-600 flex items-center gap-2">
              <Trash2 className="h-5 w-5" /> Delete User Account
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to permanently delete the staff account for <strong>{deletingUser?.display_name || deletingUser?.email}</strong> ({deletingUser?.email})?
              <br /><br />
              This will revoke all active sessions immediately.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="pt-2">
            <Button type="button" variant="outline" onClick={() => setDeletingUser(null)}>
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={isDeleting}
              onClick={handleDeleteUser}
            >
              {isDeleting ? "Deleting..." : "Confirm Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {activeSubTab === "logs" && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Clock className="h-4 w-4" /> Activity & Audit Trails
            </CardTitle>
            <CardDescription>
              Chronological log of logins, phone purchases, sales, repairs, and system actions.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {auditLogs.length === 0 ? (
              <p className="text-sm text-gray-500 py-4 text-center">No activity recorded yet.</p>
            ) : (
              <div className="border rounded-md divide-y max-h-[500px] overflow-y-auto">
                {auditLogs.map((log) => (
                  <div key={log.id} className="p-3 text-xs flex items-center justify-between hover:bg-slate-50">
                    <div>
                      <span className="font-semibold text-slate-800">{log.action}</span>
                      {log.entity && <span className="text-gray-500"> on {log.entity}</span>}
                    </div>
                    <div className="text-gray-400 font-mono text-[11px]">
                      {new Date(log.created_at).toLocaleString()}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
