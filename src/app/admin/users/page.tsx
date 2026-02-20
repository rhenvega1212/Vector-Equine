"use client";

import { useState, useEffect } from "react";
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
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useToast } from "@/hooks/use-toast";
import { formatDate } from "@/lib/utils";
import { Loader2, Check, X, Shield, Users, UserCog, LogIn } from "lucide-react";

interface User {
  id: string;
  email: string;
  username: string;
  display_name: string;
  avatar_url: string | null;
  role: "rider" | "trainer" | "admin";
  trainer_approved: boolean;
  created_at: string;
}

export default function AdminUsersPage() {
  const { toast } = useToast();
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [roleFilter, setRoleFilter] = useState("all");
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  useEffect(() => {
    fetchUsers();
  }, [roleFilter]);

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
                        <Badge variant={getRoleBadgeVariant(user.role)} className="gap-1">
                          {getRoleIcon(user.role)}
                          {user.role.charAt(0).toUpperCase() + user.role.slice(1)}
                        </Badge>
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
                      <TableHead>Joined</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {users.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center py-10 text-muted-foreground">
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
                              {user.role === "trainer" && (
                                <Badge
                                  variant={
                                    user.trainer_approved ? "default" : "secondary"
                                  }
                                >
                                  {user.trainer_approved
                                    ? "Approved"
                                    : "Pending Approval"}
                                </Badge>
                              )}
                              {user.role === "admin" && (
                                <Badge variant="destructive">Full Access</Badge>
                              )}
                            </TableCell>
                            <TableCell>{formatDate(user.created_at)}</TableCell>
                            <TableCell>
                              <Button
                                type="button"
                                size="sm"
                                variant="ghost"
                                className="gap-1"
                                onClick={() => handleLoginAsUser(user.id)}
                                disabled={actionLoading === user.id}
                              >
                                {actionLoading === user.id ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <>
                                    <LogIn className="h-4 w-4" />
                                    Login as
                                  </>
                                )}
                              </Button>
                              {user.role === "trainer" && (
                                <div className="inline-flex gap-2 ml-2">
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
    </div>
  );
}
