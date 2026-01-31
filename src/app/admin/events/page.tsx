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
import { formatDateTime } from "@/lib/utils";
import { 
  Loader2, 
  Plus,
  Pencil, 
  Eye, 
  EyeOff, 
  Trash2, 
  MoreHorizontal,
  Calendar,
  CheckCircle,
  Clock
} from "lucide-react";

interface Event {
  id: string;
  title: string;
  event_type: string;
  start_time: string;
  end_time: string;
  is_published: boolean;
  status: string | null;
  host: {
    username: string;
    display_name: string;
  };
  rsvp_count: number;
}

export default function AdminEventsPage() {
  const { toast } = useToast();
  const [events, setEvents] = useState<Event[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("all");

  useEffect(() => {
    fetchEvents();
  }, []);

  async function fetchEvents() {
    setIsLoading(true);
    try {
      const response = await fetch("/api/admin/events");
      const data = await response.json();
      
      if (response.ok) {
        setEvents(data.events || []);
      } else {
        console.error("Failed to fetch events:", data.error);
        toast({
          title: "Error loading events",
          description: data.error || "Failed to load events",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Failed to fetch events:", error);
      toast({
        title: "Error",
        description: "Failed to connect to server",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }

  async function handleToggleStatus(eventId: string, publish: boolean) {
    setActionLoading(eventId);
    try {
      const response = await fetch(`/api/events/${eventId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          is_published: publish,
          status: publish ? "published" : "draft"
        }),
      });

      if (response.ok) {
        toast({
          title: publish ? "Event published" : "Event unpublished",
          description: publish
            ? "The event is now visible to users."
            : "The event has been moved to drafts.",
        });
        fetchEvents();
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update event status.",
        variant: "destructive",
      });
    } finally {
      setActionLoading(null);
    }
  }

  async function handleDelete(eventId: string, title: string) {
    if (!confirm(`Are you sure you want to delete "${title}"? This action cannot be undone.`)) {
      return;
    }

    setActionLoading(eventId);
    try {
      const response = await fetch(`/api/events/${eventId}`, {
        method: "DELETE",
      });

      if (response.ok) {
        toast({
          title: "Event deleted",
          description: "The event has been permanently removed.",
        });
        fetchEvents();
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to delete event.",
        variant: "destructive",
      });
    } finally {
      setActionLoading(null);
    }
  }

  // Check if event is published (handle both old and new status fields)
  const isPublished = (event: Event) => {
    return event.is_published || event.status === "published";
  };

  const filteredEvents = events.filter((event) => {
    if (activeTab === "all") return true;
    if (activeTab === "drafts") return !isPublished(event);
    if (activeTab === "published") return isPublished(event);
    return true;
  });

  const draftCount = events.filter((e) => !isPublished(e)).length;
  const publishedCount = events.filter((e) => isPublished(e)).length;

  function renderEventTable(items: Event[]) {
    if (items.length === 0) {
      return (
        <div className="text-center py-10 text-muted-foreground">
          {activeTab === "drafts" 
            ? "No draft events."
            : activeTab === "published"
            ? "No published events yet."
            : "No events found."}
        </div>
      );
    }

    return (
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Event</TableHead>
            <TableHead>Type</TableHead>
            <TableHead>Host</TableHead>
            <TableHead>Date</TableHead>
            <TableHead>RSVPs</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((event) => {
            const published = isPublished(event);
            const isPast = new Date(event.end_time) < new Date();
            
            return (
              <TableRow key={event.id}>
                <TableCell className="font-medium">
                  <div>
                    {event.title}
                    {isPast && (
                      <Badge variant="outline" className="ml-2 text-xs">
                        Past
                      </Badge>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant="outline">
                    {event.event_type.replace("_", " ")}
                  </Badge>
                </TableCell>
                <TableCell>
                  <Link
                    href={`/profile/${event.host.username}`}
                    className="hover:underline"
                  >
                    @{event.host.username}
                  </Link>
                </TableCell>
                <TableCell>{formatDateTime(event.start_time)}</TableCell>
                <TableCell>{event.rsvp_count}</TableCell>
                <TableCell>
                  <Badge
                    variant={published ? "default" : "secondary"}
                    className={!published ? "bg-yellow-500/20 text-yellow-500 border-yellow-500/40" : ""}
                  >
                    {!published && <Clock className="h-3 w-3 mr-1" />}
                    {published && <CheckCircle className="h-3 w-3 mr-1" />}
                    {published ? "Published" : "Draft"}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button 
                        size="sm" 
                        variant="ghost"
                        disabled={actionLoading === event.id}
                      >
                        {actionLoading === event.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <MoreHorizontal className="h-4 w-4" />
                        )}
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem asChild>
                        <Link href={`/admin/events/${event.id}/edit`}>
                          <Pencil className="h-4 w-4 mr-2" />
                          Edit Event
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem asChild>
                        <Link href={`/events/${event.id}`}>
                          <Eye className="h-4 w-4 mr-2" />
                          Preview
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      {!published ? (
                        <DropdownMenuItem
                          onClick={() => handleToggleStatus(event.id, true)}
                          className="text-green-500"
                        >
                          <CheckCircle className="h-4 w-4 mr-2" />
                          Publish Event
                        </DropdownMenuItem>
                      ) : (
                        <DropdownMenuItem
                          onClick={() => handleToggleStatus(event.id, false)}
                        >
                          <EyeOff className="h-4 w-4 mr-2" />
                          Unpublish (Move to Drafts)
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onClick={() => handleDelete(event.id, event.title)}
                        className="text-destructive"
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Delete Event
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Event Management</h2>
          <p className="text-muted-foreground">
            Create, edit, and manage events
          </p>
        </div>
        <Link href="/events/create">
          <Button className="bg-cyan-500 hover:bg-cyan-400 text-black">
            <Plus className="h-4 w-4 mr-2" />
            Create Event
          </Button>
        </Link>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="all" className="gap-2">
            <Calendar className="h-4 w-4" />
            All ({events.length})
          </TabsTrigger>
          <TabsTrigger value="drafts" className="gap-2">
            <Clock className="h-4 w-4" />
            Drafts ({draftCount})
          </TabsTrigger>
          <TabsTrigger value="published" className="gap-2">
            <CheckCircle className="h-4 w-4" />
            Published ({publishedCount})
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
                  {renderEventTable(filteredEvents)}
                </TabsContent>
                <TabsContent value="drafts" className="m-0">
                  {renderEventTable(filteredEvents)}
                </TabsContent>
                <TabsContent value="published" className="m-0">
                  {renderEventTable(filteredEvents)}
                </TabsContent>
              </>
            )}
          </CardContent>
        </Card>
      </Tabs>
    </div>
  );
}
