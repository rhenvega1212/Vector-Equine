"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import { formatDate } from "@/lib/utils";
import { 
  Loader2, 
  Plus, 
  Pencil, 
  Eye, 
  EyeOff, 
  Trash2, 
  MoreHorizontal,
  FileText,
  CheckCircle,
  Clock,
  Archive
} from "lucide-react";

const NICHE_LABELS: Record<string, string> = {
  dressage: "Dressage",
  rider: "Rider",
  reining: "Reining",
  young_horse: "Young Horse",
};

interface Challenge {
  id: string;
  title: string;
  description: string | null;
  difficulty: string | null;
  duration_days: number | null;
  niche: string | null;
  status: "draft" | "published" | "active" | "archived";
  is_private: boolean;
  created_at: string;
  enrollment_count: number;
}

export default function AdminChallengesPage() {
  const { toast } = useToast();
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("all");

  useEffect(() => {
    fetchChallenges();
  }, []);

  async function fetchChallenges() {
    setIsLoading(true);
    try {
      const response = await fetch("/api/admin/challenges");
      if (response.ok) {
        const data = await response.json();
        setChallenges(data.challenges);
      }
    } catch (error) {
      console.error("Failed to fetch challenges:", error);
    } finally {
      setIsLoading(false);
    }
  }

  async function handleToggleStatus(challengeId: string, publish: boolean) {
    setActionLoading(challengeId);
    try {
      const response = await fetch(`/api/admin/challenges/${challengeId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: publish ? "active" : "draft" }),
      });

      if (response.ok) {
        toast({
          title: publish ? "Challenge published" : "Challenge unpublished",
          description: publish
            ? "The challenge is now visible to users."
            : "The challenge is now hidden.",
        });
        fetchChallenges();
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update challenge status.",
        variant: "destructive",
      });
    } finally {
      setActionLoading(null);
    }
  }

  async function handleDelete(challengeId: string, title: string) {
    if (!confirm(`Are you sure you want to delete "${title}"? This action cannot be undone.`)) {
      return;
    }

    setActionLoading(challengeId);
    try {
      const response = await fetch(`/api/admin/challenges/${challengeId}`, {
        method: "DELETE",
      });

      if (response.ok) {
        toast({
          title: "Challenge deleted",
          description: "The challenge has been permanently removed.",
        });
        fetchChallenges();
      } else {
        throw new Error("Failed to delete");
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to delete challenge.",
        variant: "destructive",
      });
    } finally {
      setActionLoading(null);
    }
  }

  const filteredChallenges = challenges.filter((challenge) => {
    if (activeTab === "all") return true;
    if (activeTab === "drafts") return challenge.status === "draft";
    if (activeTab === "published") return challenge.status === "published" || challenge.status === "active";
    if (activeTab === "archived") return challenge.status === "archived";
    return true;
  });

  const draftCount = challenges.filter((c) => c.status === "draft").length;
  const publishedCount = challenges.filter((c) => c.status === "published" || c.status === "active").length;
  const archivedCount = challenges.filter((c) => c.status === "archived").length;

  function renderChallengeTable(items: Challenge[]) {
    if (items.length === 0) {
      return (
        <div className="text-center py-10 text-muted-foreground">
          {activeTab === "drafts" 
            ? "No draft challenges. Create a new challenge to get started!"
            : activeTab === "published"
            ? "No published challenges yet."
            : activeTab === "archived"
            ? "No archived challenges."
            : "No challenges yet. Create your first challenge!"}
        </div>
      );
    }

    return (
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Title</TableHead>
            <TableHead>Niche</TableHead>
            <TableHead>Difficulty</TableHead>
            <TableHead>Duration</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Enrollments</TableHead>
            <TableHead>Created</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((challenge) => (
            <TableRow key={challenge.id}>
              <TableCell>
                <div>
                  <p className="font-medium">{challenge.title}</p>
                  {challenge.is_private && (
                    <Badge variant="outline" className="mt-1 text-xs">
                      Private
                    </Badge>
                  )}
                </div>
              </TableCell>
              <TableCell>
                {challenge.niche ? (
                  <Badge variant="outline">{NICHE_LABELS[challenge.niche] ?? challenge.niche}</Badge>
                ) : (
                  "-"
                )}
              </TableCell>
              <TableCell>
                {challenge.difficulty ? (
                  <Badge variant="secondary">{challenge.difficulty}</Badge>
                ) : (
                  "-"
                )}
              </TableCell>
              <TableCell>
                {challenge.duration_days
                  ? `${challenge.duration_days} days`
                  : "-"}
              </TableCell>
              <TableCell>
                <Badge
                  variant={challenge.status === "published" || challenge.status === "active" ? "default" : "secondary"}
                  className={challenge.status === "draft" ? "bg-yellow-500/20 text-yellow-500 border-yellow-500/40" : challenge.status === "archived" ? "bg-muted text-muted-foreground" : ""}
                >
                  {challenge.status === "draft" && <Clock className="h-3 w-3 mr-1" />}
                  {(challenge.status === "published" || challenge.status === "active") && <CheckCircle className="h-3 w-3 mr-1" />}
                  {challenge.status === "archived" && <Archive className="h-3 w-3 mr-1" />}
                  {challenge.status === "active" ? "Live" : challenge.status}
                </Badge>
              </TableCell>
              <TableCell>{challenge.enrollment_count}</TableCell>
              <TableCell>{formatDate(challenge.created_at)}</TableCell>
              <TableCell className="text-right">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button 
                      size="sm" 
                      variant="ghost"
                      disabled={actionLoading === challenge.id}
                    >
                      {actionLoading === challenge.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <MoreHorizontal className="h-4 w-4" />
                      )}
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem asChild>
                      <Link href={`/admin/challenges/${challenge.id}/edit`}>
                        <Pencil className="h-4 w-4 mr-2" />
                        Edit Challenge
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link href={challenge.status === "archived" ? `/challenges/${challenge.id}/archive` : `/challenges/${challenge.id}`}>
                        <Eye className="h-4 w-4 mr-2" />
                        {challenge.status === "archived" ? "View archive" : "Preview"}
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    {challenge.status === "archived" ? (
                      <DropdownMenuItem disabled className="text-muted-foreground">
                        <Archive className="h-4 w-4 mr-2" />
                        Archived (locked)
                      </DropdownMenuItem>
                    ) : challenge.status === "draft" ? (
                      <DropdownMenuItem
                        onClick={() => handleToggleStatus(challenge.id, true)}
                        className="text-green-500"
                      >
                        <CheckCircle className="h-4 w-4 mr-2" />
                        Publish Challenge
                      </DropdownMenuItem>
                    ) : (
                      <DropdownMenuItem
                        onClick={() => handleToggleStatus(challenge.id, false)}
                      >
                        <EyeOff className="h-4 w-4 mr-2" />
                        Unpublish (Move to Drafts)
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={() => handleDelete(challenge.id, challenge.title)}
                      className="text-destructive"
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Delete Challenge
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Challenge Management</h2>
          <p className="text-muted-foreground">
            Create, edit, and manage challenges
          </p>
        </div>
        <Link href="/admin/challenges/create">
          <Button className="bg-cyan-500 hover:bg-cyan-400 text-black">
            <Plus className="h-4 w-4 mr-2" />
            Create Challenge
          </Button>
        </Link>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="all" className="gap-2">
            <FileText className="h-4 w-4" />
            All ({challenges.length})
          </TabsTrigger>
          <TabsTrigger value="drafts" className="gap-2">
            <Clock className="h-4 w-4" />
            Drafts ({draftCount})
          </TabsTrigger>
          <TabsTrigger value="published" className="gap-2">
            <CheckCircle className="h-4 w-4" />
            Live ({publishedCount})
          </TabsTrigger>
          <TabsTrigger value="archived" className="gap-2">
            <Archive className="h-4 w-4" />
            Archived ({archivedCount})
          </TabsTrigger>
        </TabsList>

        <Card className="mt-4">
          <CardContent className="p-0">
            {isLoading ? (
              <div className="flex justify-center py-10">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <>
                <TabsContent value="all" className="m-0">
                  {renderChallengeTable(filteredChallenges)}
                </TabsContent>
                <TabsContent value="drafts" className="m-0">
                  {renderChallengeTable(filteredChallenges)}
                </TabsContent>
                <TabsContent value="published" className="m-0">
                  {renderChallengeTable(filteredChallenges)}
                </TabsContent>
                <TabsContent value="archived" className="m-0">
                  {renderChallengeTable(filteredChallenges)}
                </TabsContent>
              </>
            )}
          </CardContent>
        </Card>
      </Tabs>
    </div>
  );
}
