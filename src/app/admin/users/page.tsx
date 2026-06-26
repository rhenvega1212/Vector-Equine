"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { formatDate } from "@/lib/utils";
import { SuspensionChatDialog } from "@/components/admin/suspension-chat-dialog";
import {
  Loader2,
  Check,
  X,
  Shield,
  Users,
  UserCog,
  LogIn,
  FlaskConical,
  MoreVertical,
  Ban,
  ShieldCheck,
  Trash2,
  ExternalLink,
  MessageSquare,
} from "lucide-react";

interface User {
  id: string;
  email: string;
  username: string;
  display_name: string;
  avatar_url: string | null;
  role: "rider" | "trainer" | "admin";
  trainer_approved: boolean;
  is_beta_tester: boolean;
  is_suspended: boolean;
  suspended_at: string | null;
  suspension_reason: string | null;
  created_at: string;
}

export default function AdminUsersPage() {
  const { toast } = useToast();
  const router = useRouter();
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [roleFilter, setRoleFilter] = useState("all");
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Suspend dialog
  const [suspendUser, setSuspendUser] = useState<User | null>(null);
  const [suspendReason, setSuspendReason] = useState("");
  const [suspendSubmitting, setSuspendSubmitting] = useState(false);

  // Delete dialog
  const [deleteUser, setDeleteUser] = useState<User | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);

  // Suspension chat dialog
  const [chatUser, setChatUser] = useState<User | null>(null);
  const [chatOpen, setChatOpen] = useState(false);

  useEffect(() => {
    fetchUsers();
  }, [roleFilter]);

  function openChat(user: User) {
    setChatUser(user);
    setChatOpen(true);
  }

  async function submitSuspend() {
    if (!suspendUser) return;
    const reason = suspendReason.trim();
    if (!reason) return;
    setSuspendSubmitting(true);
    try {
      const res = await fetch(`/api/admin/users/${suspendUser.id}/suspend`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        toast({
          title: "Account suspended",
          description: `${suspendUser.display_name} has been suspended.`,
        });
        setSuspendUser(null);
        setSuspendReason("");
        fetchUsers();
      } else {
        toast({
          title: "Error",
          description: data.error || "Could not suspend account.",
          variant: "destructive",
        });
      }
    } finally {
      setSuspendSubmitting(false);
    }
  }

  async function handleUnsuspend(user: User) {
    setActionLoading(user.id);
    try {
      const res = await fetch(`/api/admin/users/${user.id}/suspend`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        toast({
          title: "Suspension lifted",
          description: `${user.display_name} can access the app again.`,
        });
        fetchUsers();
      } else {
        toast({
          title: "Error",
          description: data.error || "Could not lift suspension.",
          variant: "destructive",
        });
      }
    } finally {
      setActionLoading(null);
    }
  }

  async function submitDelete() {
    if (!deleteUser) return;
    setDeleteSubmitting(true);
    try {
      const res = await fetch(`/api/admin/users/${deleteUser.id}`, {
        method: "DELETE",
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        toast({
          title: "Account deleted",
          description: `${deleteUser.display_name} has been permanently removed.`,
        });
        setDeleteUser(null);
        setDeleteConfirm("");
        fetchUsers();
      } else {
        toast({
          title: "Error",
          description: data.error || "Could not delete account.",
          variant: "destructive",
        });
      }
    } finally {
      setDeleteSubmitting(false);
    }
  }

  async function fetchUsers() {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (roleFilter !== "all") {
        params.set("role", roleFilter);
      }
      const response = await fetch(`/api/admin/users?${params}`);
      if (response.ok) {
        const data = await response.json();
        setUsers(data.users);
      }
    } catch (error) {
      console.error("Failed to fetch users:", error);
    } finally {
      setIsLoading(false);
    }
  }

  async function handleApproveTrainer(userId: string, approve: boolean) {
    setActionLoading(userId);
    try {
      const response = await fetch(`/api/admin/users/${userId}/approve`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ approved: approve }),
      });

      if (response.ok) {
        toast({
          title: approve ? "Trainer approved" : "Approval revoked",
          description: approve
            ? "Trainer privileges have been granted."
            : "Trainer privileges have been revoked.",
        });
        fetchUsers();
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update trainer status.",
        variant: "destructive",
      });
    } finally {
      setActionLoading(null);
    }
  }

  async function handleChangeRole(userId: string, newRole: string) {
    setActionLoading(userId);
    try {
      const response = await fetch(`/api/admin/users/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: newRole }),
      });

      if (response.ok) {
        toast({
          title: "Role updated",
          description: `User role changed to ${newRole}.`,
        });
        fetchUsers();
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update role.",
        variant: "destructive",
      });
    } finally {
      setActionLoading(null);
    }
  }

  async function handleToggleBeta(userId: string, value: boolean) {
    setActionLoading(userId);
    // Optimistic update
    setUsers((prev) =>
      prev.map((u) => (u.id === userId ? { ...u, is_beta_tester: value } : u))
    );
    try {
      const response = await fetch(`/api/admin/users/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_beta_tester: value }),
      });
      if (!response.ok) throw new Error("Failed");
      toast({
        title: value ? "Added to beta" : "Removed from beta",
        description: value
          ? "This user now sees closed-beta features."
          : "This user no longer sees closed-beta features.",
      });
    } catch {
      // Revert on failure
      setUsers((prev) =>
        prev.map((u) =>
          u.id === userId ? { ...u, is_beta_tester: !value } : u
        )
      );
      toast({
        title: "Error",
        description: "Failed to update beta access.",
        variant: "destructive",
      });
    } finally {
      setActionLoading(null);
    }
  }

  async function handleLoginAsUser(userId: string) {
    setActionLoading(userId);
    try {
      const response = await fetch("/api/admin/impersonate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({ userId }),
      });
      const data = await response.json().catch(() => ({}));
      if (response.ok && data.redirect) {
        window.location.href = data.redirect;
        return;
      }
      if (!response.ok) {
        toast({
          title: "Connection failed",
          description: data.error || "Could not switch user. Try again.",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Connection failed",
        description: "Network error. Make sure the app is running and try again.",
        variant: "destructive",
      });
    } finally {
      setActionLoading(null);
    }
  }

  const getRoleBadgeVariant = (role: string) => {
    switch (role) {
      case "admin":
        return "destructive";
      case "trainer":
        return "default";
      default:
        return "secondary";
    }
  };

  const getRoleIcon = (role: string) => {
    switch (role) {
      case "admin":
        return <Shield className="h-3 w-3" />;
      case "trainer":
        return <UserCog className="h-3 w-3" />;
      default:
        return <Users className="h-3 w-3" />;
    }
  };

  const renderActionsMenu = (user: User) => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className="h-8 w-8"
          disabled={actionLoading === user.id}
        >
          {actionLoading === user.id ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <MoreVertical className="h-4 w-4" />
          )}
          <span className="sr-only">Actions</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        <DropdownMenuLabel>Account actions</DropdownMenuLabel>
        <DropdownMenuItem onClick={() => router.push(`/profile/${user.username}`)}>
          <ExternalLink className="h-4 w-4 mr-2" />
          View profile
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => handleLoginAsUser(user.id)}>
          <LogIn className="h-4 w-4 mr-2" />
          Login as user
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => openChat(user)}>
          <MessageSquare className="h-4 w-4 mr-2" />
          Suspension chat
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        {user.role === "admin" ? (
          <DropdownMenuItem disabled>
            <Shield className="h-4 w-4 mr-2" />
            Admins are protected
          </DropdownMenuItem>
        ) : user.is_suspended ? (
          <DropdownMenuItem onClick={() => handleUnsuspend(user)}>
            <ShieldCheck className="h-4 w-4 mr-2" />
            Lift suspension
          </DropdownMenuItem>
        ) : (
          <DropdownMenuItem
            onClick={() => {
              setSuspendReason("");
              setSuspendUser(user);
            }}
          >
            <Ban className="h-4 w-4 mr-2" />
            Suspend account
          </DropdownMenuItem>
        )}
        {user.role !== "admin" && (
          <DropdownMenuItem
            className="text-destructive focus:text-destructive"
            onClick={() => {
              setDeleteConfirm("");
              setDeleteUser(user);
            }}
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Delete account
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold">User Management</h2>
          <p className="text-sm text-muted-foreground">
            Manage users, roles, and trainer approvals
          </p>
        </div>
        <Select value={roleFilter} onValueChange={setRoleFilter}>
          <SelectTrigger className="w-full sm:w-[180px]">
            <SelectValue placeholder="Filter by role" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Roles</SelectItem>
            <SelectItem value="rider">Riders</SelectItem>
            <SelectItem value="trainer">Trainers</SelectItem>
            <SelectItem value="admin">Admins</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Loading State */}
      {isLoading ? (
        <div className="flex justify-center py-10">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <>
          {/* Mobile Card View */}
          <div className="space-y-4 md:hidden">
            {users.length === 0 ? (
              <Card>
                <CardContent className="py-10 text-center text-muted-foreground">
                  No users found.
                </CardContent>
              </Card>
            ) : (
              users.map((user) => {
                const initials = user.display_name
                  .split(" ")
                  .map((n) => n[0])
                  .join("")
                  .toUpperCase()
                  .slice(0, 2);

                return (
                  <Card key={user.id}>
                    <CardContent className="p-4">
                      {/* User Info */}
                      <div className="flex items-start gap-3 mb-4">
                        <Avatar className="h-12 w-12">
                          <AvatarImage src={user.avatar_url || undefined} />
                          <AvatarFallback>{initials}</AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold truncate">{user.display_name}</p>
                          <p className="text-sm text-muted-foreground truncate">
                            @{user.username}
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">
                            Joined {formatDate(user.created_at)}
                          </p>
                        </div>
                        <div className="flex flex-col items-end gap-1">
                          <div className="flex items-center gap-1">
                            <Badge
                              variant={getRoleBadgeVariant(user.role)}
                              className="gap-1"
                            >
                              {getRoleIcon(user.role)}
                              {user.role.charAt(0).toUpperCase() + user.role.slice(1)}
                            </Badge>
                            {renderActionsMenu(user)}
                          </div>
                          {user.is_suspended && (
                            <Badge variant="destructive" className="gap-1">
                              <Ban className="h-3 w-3" />
                              Suspended
                            </Badge>
                          )}
                        </div>
                      </div>

                      {/* Role Change */}
                      <div className="space-y-3">
                        <div>
                          <label className="text-sm font-medium mb-2 block">
                            Change Role
                          </label>
                          <Select
                            value={user.role}
                            onValueChange={(value) => handleChangeRole(user.id, value)}
                            disabled={actionLoading === user.id}
                          >
                            <SelectTrigger className="w-full">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="rider">
                                <div className="flex items-center gap-2">
                                  <Users className="h-4 w-4" />
                                  Rider
                                </div>
                              </SelectItem>
                              <SelectItem value="trainer">
                                <div className="flex items-center gap-2">
                                  <UserCog className="h-4 w-4" />
                                  Trainer
                                </div>
                              </SelectItem>
                              <SelectItem value="admin">
                                <div className="flex items-center gap-2">
                                  <Shield className="h-4 w-4" />
                                  Admin
                                </div>
                              </SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        {/* Beta tester toggle */}
                        <div className="flex items-center justify-between pt-2 border-t">
                          <div className="flex items-center gap-2">
                            <FlaskConical className="h-4 w-4 text-muted-foreground" />
                            <div>
                              <p className="text-sm font-medium">Beta tester</p>
                              <p className="text-xs text-muted-foreground">
                                Sees closed-beta features
                              </p>
                            </div>
                          </div>
                          <Switch
                            checked={user.is_beta_tester}
                            onCheckedChange={(v) => handleToggleBeta(user.id, v)}
                            disabled={actionLoading === user.id}
                          />
                        </div>

                        {/* Login as user (impersonate) */}
                        <div className="pt-2 border-t">
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="w-full gap-1"
                            onClick={() => handleLoginAsUser(user.id)}
                            disabled={actionLoading === user.id}
                          >
                            {actionLoading === user.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <>
                                <LogIn className="h-4 w-4" />
                                Login as user
                              </>
                            )}
                          </Button>
                        </div>

                        {/* Trainer Approval */}
                        {user.role === "trainer" && (
                          <div className="flex items-center justify-between pt-2 border-t">
                            <div>
                              <p className="text-sm font-medium">Trainer Status</p>
                              <Badge
                                variant={user.trainer_approved ? "default" : "secondary"}
                                className="mt-1"
                              >
                                {user.trainer_approved ? "Approved" : "Pending Approval"}
                              </Badge>
                            </div>
                            {!user.trainer_approved ? (
                              <Button
                                size="sm"
                                onClick={() => handleApproveTrainer(user.id, true)}
                                disabled={actionLoading === user.id}
                                className="touch-target"
                              >
                                {actionLoading === user.id ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <>
                                    <Check className="h-4 w-4 mr-1" />
                                    Approve
                                  </>
                                )}
                              </Button>
                            ) : (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleApproveTrainer(user.id, false)}
                                disabled={actionLoading === user.id}
                                className="touch-target"
                              >
                                {actionLoading === user.id ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <>
                                    <X className="h-4 w-4 mr-1" />
                                    Revoke
                                  </>
                                )}
                              </Button>
                            )}
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })
            )}
          </div>

          {/* Desktop Table View */}
          <Card className="hidden md:block">
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>User</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Beta</TableHead>
                      <TableHead>Joined</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {users.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-10 text-muted-foreground">
                          No users found.
                        </TableCell>
                      </TableRow>
                    ) : (
                      users.map((user) => {
                        const initials = user.display_name
                          .split(" ")
                          .map((n) => n[0])
                          .join("")
                          .toUpperCase()
                          .slice(0, 2);

                        return (
                          <TableRow key={user.id}>
                            <TableCell>
                              <div className="flex items-center gap-3">
                                <Avatar className="h-10 w-10">
                                  <AvatarImage src={user.avatar_url || undefined} />
                                  <AvatarFallback className="text-xs">
                                    {initials}
                                  </AvatarFallback>
                                </Avatar>
                                <div>
                                  <p className="font-medium">{user.display_name}</p>
                                  <p className="text-sm text-muted-foreground">
                                    @{user.username}
                                  </p>
                                </div>
                              </div>
                            </TableCell>
                            <TableCell>
                              <Select
                                value={user.role}
                                onValueChange={(value) =>
                                  handleChangeRole(user.id, value)
                                }
                                disabled={actionLoading === user.id}
                              >
                                <SelectTrigger className="w-[130px]">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="rider">
                                    <div className="flex items-center gap-2">
                                      <Users className="h-4 w-4" />
                                      Rider
                                    </div>
                                  </SelectItem>
                                  <SelectItem value="trainer">
                                    <div className="flex items-center gap-2">
                                      <UserCog className="h-4 w-4" />
                                      Trainer
                                    </div>
                                  </SelectItem>
                                  <SelectItem value="admin">
                                    <div className="flex items-center gap-2">
                                      <Shield className="h-4 w-4" />
                                      Admin
                                    </div>
                                  </SelectItem>
                                </SelectContent>
                              </Select>
                            </TableCell>
                            <TableCell>
                              <div className="flex flex-col gap-1">
                                {user.is_suspended && (
                                  <Badge variant="destructive" className="gap-1 w-fit">
                                    <Ban className="h-3 w-3" />
                                    Suspended
                                  </Badge>
                                )}
                                {user.role === "trainer" && (
                                  <Badge
                                    variant={
                                      user.trainer_approved ? "default" : "secondary"
                                    }
                                    className="w-fit"
                                  >
                                    {user.trainer_approved
                                      ? "Approved"
                                      : "Pending Approval"}
                                  </Badge>
                                )}
                                {user.role === "admin" && !user.is_suspended && (
                                  <Badge variant="destructive" className="w-fit">
                                    Full Access
                                  </Badge>
                                )}
                              </div>
                            </TableCell>
                            <TableCell>
                              <Switch
                                checked={user.is_beta_tester}
                                onCheckedChange={(v) =>
                                  handleToggleBeta(user.id, v)
                                }
                                disabled={actionLoading === user.id}
                                aria-label="Toggle beta tester"
                              />
                            </TableCell>
                            <TableCell>{formatDate(user.created_at)}</TableCell>
                            <TableCell>
                              <div className="flex items-center gap-1">
                              {user.role === "trainer" && (
                                <div className="inline-flex gap-2">
                                  {!user.trainer_approved ? (
                                    <Button
                                      size="sm"
                                      onClick={() =>
                                        handleApproveTrainer(user.id, true)
                                      }
                                      disabled={actionLoading === user.id}
                                    >
                                      {actionLoading === user.id ? (
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                      ) : (
                                        <>
                                          <Check className="h-4 w-4 mr-1" />
                                          Approve
                                        </>
                                      )}
                                    </Button>
                                  ) : (
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() =>
                                        handleApproveTrainer(user.id, false)
                                      }
                                      disabled={actionLoading === user.id}
                                    >
                                      {actionLoading === user.id ? (
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                      ) : (
                                        <>
                                          <X className="h-4 w-4 mr-1" />
                                          Revoke
                                        </>
                                      )}
                                    </Button>
                                  )}
                                </div>
                              )}
                              {renderActionsMenu(user)}
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {/* Suspend dialog */}
      <Dialog
        open={!!suspendUser}
        onOpenChange={(open) => {
          if (!open) {
            setSuspendUser(null);
            setSuspendReason("");
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Suspend {suspendUser?.display_name}
            </DialogTitle>
            <DialogDescription>
              They&apos;ll be locked out of the app and shown this reason. They can
              reply to appeal, and you can chat with them from the suspension chat.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <label className="text-sm font-medium">Reason for suspension</label>
            <Textarea
              value={suspendReason}
              onChange={(e) => setSuspendReason(e.target.value)}
              placeholder="Explain why this account is being suspended…"
              rows={4}
            />
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setSuspendUser(null);
                setSuspendReason("");
              }}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={submitSuspend}
              disabled={!suspendReason.trim() || suspendSubmitting}
              className="gap-1"
            >
              {suspendSubmitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Ban className="h-4 w-4" />
              )}
              Suspend account
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete dialog */}
      <Dialog
        open={!!deleteUser}
        onOpenChange={(open) => {
          if (!open) {
            setDeleteUser(null);
            setDeleteConfirm("");
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-destructive">
              Delete {deleteUser?.display_name}
            </DialogTitle>
            <DialogDescription>
              This permanently removes their login and all of their content. This
              cannot be undone. Type{" "}
              <span className="font-semibold">{deleteUser?.username}</span> to
              confirm.
            </DialogDescription>
          </DialogHeader>
          <Input
            value={deleteConfirm}
            onChange={(e) => setDeleteConfirm(e.target.value)}
            placeholder={deleteUser?.username}
            autoComplete="off"
          />
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setDeleteUser(null);
                setDeleteConfirm("");
              }}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={submitDelete}
              disabled={
                deleteConfirm.trim() !== deleteUser?.username || deleteSubmitting
              }
              className="gap-1"
            >
              {deleteSubmitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4" />
              )}
              Permanently delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Suspension chat dialog */}
      <SuspensionChatDialog
        userId={chatUser?.id ?? null}
        userName={chatUser?.display_name ?? ""}
        isSuspended={chatUser?.is_suspended ?? false}
        open={chatOpen}
        onOpenChange={setChatOpen}
        onChanged={fetchUsers}
      />
    </div>
  );
}
