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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { formatDate } from "@/lib/utils";
import { Loader2, Eye, EyeOff, Check } from "lucide-react";

interface Report {
  id: string;
  reason: string;
  status: "pending" | "reviewed" | "resolved";
  created_at: string;
  reporter: {
    id: string;
    username: string;
    display_name: string;
  };
  post?: {
    id: string;
    content: string;
    is_hidden: boolean;
    author: {
      username: string;
      display_name: string;
    };
  };
  comment?: {
    id: string;
    content: string;
  };
}

export default function AdminReportsPage() {
  const { toast } = useToast();
  const [reports, setReports] = useState<Report[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("pending");
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  useEffect(() => {
    fetchReports();
  }, [statusFilter]);

  async function fetchReports() {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter !== "all") {
        params.set("status", statusFilter);
      }
      const response = await fetch(`/api/admin/reports?${params}`);
      if (response.ok) {
        const data = await response.json();
        setReports(data.reports);
      }
    } catch (error) {
      console.error("Failed to fetch reports:", error);
    } finally {
      setIsLoading(false);
    }
  }

  async function handleResolve(reportId: string) {
    setActionLoading(reportId);
    try {
      const response = await fetch(`/api/admin/reports/${reportId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "resolved" }),
      });

      if (response.ok) {
        toast({
          title: "Report resolved",
          description: "The report has been marked as resolved.",
        });
        fetchReports();
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to resolve report.",
        variant: "destructive",
      });
    } finally {
      setActionLoading(null);
    }
  }

  async function handleToggleHide(postId: string, hide: boolean) {
    setActionLoading(postId);
    try {
      const response = await fetch(`/api/admin/posts/${postId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_hidden: hide }),
      });

      if (response.ok) {
        toast({
          title: hide ? "Post hidden" : "Post visible",
          description: hide
            ? "The post is now hidden from public view."
            : "The post is now visible again.",
        });
        fetchReports();
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update post visibility.",
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
          <h2 className="text-2xl font-bold">Content Moderation</h2>
          <p className="text-muted-foreground">
            Review and resolve reported content
          </p>
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Reports</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="reviewed">Reviewed</SelectItem>
            <SelectItem value="resolved">Resolved</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex justify-center py-10">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : reports.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground">
              No reports found
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Content</TableHead>
                  <TableHead>Reason</TableHead>
                  <TableHead>Reporter</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {reports.map((report) => (
                  <TableRow key={report.id}>
                    <TableCell className="max-w-xs">
                      {report.post ? (
                        <div>
                          <p className="text-sm truncate">
                            Post by @{report.post.author.username}
                          </p>
                          <p className="text-xs text-muted-foreground truncate">
                            {report.post.content}
                          </p>
                          {report.post.is_hidden && (
                            <Badge variant="secondary" className="mt-1">
                              Hidden
                            </Badge>
                          )}
                        </div>
                      ) : report.comment ? (
                        <div>
                          <p className="text-sm">Comment</p>
                          <p className="text-xs text-muted-foreground truncate">
                            {report.comment.content}
                          </p>
                        </div>
                      ) : (
                        "-"
                      )}
                    </TableCell>
                    <TableCell className="max-w-xs">
                      <p className="text-sm truncate">{report.reason}</p>
                    </TableCell>
                    <TableCell>
                      <Link
                        href={`/profile/${report.reporter.username}`}
                        className="text-sm hover:underline"
                      >
                        @{report.reporter.username}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          report.status === "pending"
                            ? "destructive"
                            : report.status === "reviewed"
                            ? "secondary"
                            : "outline"
                        }
                      >
                        {report.status}
                      </Badge>
                    </TableCell>
                    <TableCell>{formatDate(report.created_at)}</TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        {report.post && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() =>
                              handleToggleHide(
                                report.post!.id,
                                !report.post!.is_hidden
                              )
                            }
                            disabled={actionLoading === report.post.id}
                          >
                            {actionLoading === report.post.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : report.post.is_hidden ? (
                              <>
                                <Eye className="h-4 w-4 mr-1" />
                                Show
                              </>
                            ) : (
                              <>
                                <EyeOff className="h-4 w-4 mr-1" />
                                Hide
                              </>
                            )}
                          </Button>
                        )}
                        {report.status !== "resolved" && (
                          <Button
                            size="sm"
                            onClick={() => handleResolve(report.id)}
                            disabled={actionLoading === report.id}
                          >
                            {actionLoading === report.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <>
                                <Check className="h-4 w-4 mr-1" />
                                Resolve
                              </>
                            )}
                          </Button>
                        )}
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
