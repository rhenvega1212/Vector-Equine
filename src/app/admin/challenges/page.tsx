"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
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
import { useToast } from "@/hooks/use-toast";
import { formatDate } from "@/lib/utils";
import { Loader2, Plus, Pencil, Eye, EyeOff } from "lucide-react";

interface Challenge {
  id: string;
  title: string;
  description: string | null;
  difficulty: string | null;
  duration_days: number | null;
  status: "draft" | "published";
  is_private: boolean;
  created_at: string;
  enrollment_count: number;
}

export default function AdminChallengesPage() {
  const { toast } = useToast();
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

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
        body: JSON.stringify({ status: publish ? "published" : "draft" }),
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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Challenge Management</h2>
          <p className="text-muted-foreground">
            Create and manage challenges
          </p>
        </div>
        <Link href="/admin/challenges/create">
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            Create Challenge
          </Button>
        </Link>
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex justify-center py-10">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : challenges.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground">
              No challenges yet. Create your first challenge!
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead>Difficulty</TableHead>
                  <TableHead>Duration</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Enrollments</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {challenges.map((challenge) => (
                  <TableRow key={challenge.id}>
                    <TableCell>
                      <p className="font-medium">{challenge.title}</p>
                      {challenge.is_private && (
                        <Badge variant="outline" className="mt-1 text-xs">
                          Private
                        </Badge>
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
                        variant={
                          challenge.status === "published"
                            ? "default"
                            : "secondary"
                        }
                      >
                        {challenge.status}
                      </Badge>
                    </TableCell>
                    <TableCell>{challenge.enrollment_count}</TableCell>
                    <TableCell>{formatDate(challenge.created_at)}</TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Link href={`/admin/challenges/${challenge.id}/edit`}>
                          <Button size="sm" variant="outline">
                            <Pencil className="h-4 w-4" />
                          </Button>
                        </Link>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            handleToggleStatus(
                              challenge.id,
                              challenge.status !== "published"
                            )
                          }
                          disabled={actionLoading === challenge.id}
                        >
                          {actionLoading === challenge.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : challenge.status === "published" ? (
                            <EyeOff className="h-4 w-4" />
                          ) : (
                            <Eye className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
