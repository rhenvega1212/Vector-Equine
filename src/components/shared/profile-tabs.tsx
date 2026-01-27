"use client";

import Link from "next/link";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PostCard } from "@/components/feed/post-card";
import { formatDate } from "@/lib/utils";
import { Calendar, Trophy, FileText } from "lucide-react";

interface ProfileTabsProps {
  posts: any[];
  enrollments: any[];
  rsvps: any[];
  currentUserId?: string;
}

export function ProfileTabs({
  posts,
  enrollments,
  rsvps,
  currentUserId,
}: ProfileTabsProps) {
  return (
    <Tabs defaultValue="posts">
      <TabsList className="w-full justify-start">
        <TabsTrigger value="posts" className="gap-2">
          <FileText className="h-4 w-4" />
          Posts
        </TabsTrigger>
        <TabsTrigger value="challenges" className="gap-2">
          <Trophy className="h-4 w-4" />
          Challenges
        </TabsTrigger>
        <TabsTrigger value="events" className="gap-2">
          <Calendar className="h-4 w-4" />
          Events
        </TabsTrigger>
      </TabsList>

      <TabsContent value="posts" className="mt-6">
        {posts.length === 0 ? (
          <Card>
            <CardContent className="py-10 text-center text-muted-foreground">
              No posts yet
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {posts.map((post) => (
              <PostCard
                key={post.id}
                post={post}
                currentUserId={currentUserId}
              />
            ))}
          </div>
        )}
      </TabsContent>

      <TabsContent value="challenges" className="mt-6">
        {enrollments.length === 0 ? (
          <Card>
            <CardContent className="py-10 text-center text-muted-foreground">
              No challenges joined yet
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {enrollments.map((enrollment) => (
              <Link
                key={enrollment.id}
                href={`/challenges/${enrollment.challenges.id}`}
              >
                <Card className="hover:bg-muted/50 transition-colors">
                  <CardContent className="p-4">
                    <div className="flex gap-4">
                      {enrollment.challenges.cover_image_url ? (
                        <img
                          src={enrollment.challenges.cover_image_url}
                          alt=""
                          className="w-20 h-20 object-cover rounded"
                        />
                      ) : (
                        <div className="w-20 h-20 bg-muted rounded flex items-center justify-center">
                          <Trophy className="h-8 w-8 text-muted-foreground" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold truncate">
                          {enrollment.challenges.title}
                        </h3>
                        <div className="flex gap-2 mt-1">
                          {enrollment.challenges.difficulty && (
                            <Badge variant="outline" className="text-xs">
                              {enrollment.challenges.difficulty}
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground mt-2">
                          Enrolled {formatDate(enrollment.enrolled_at)}
                        </p>
                        {enrollment.completed_at && (
                          <Badge className="mt-2" variant="secondary">
                            Completed
                          </Badge>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </TabsContent>

      <TabsContent value="events" className="mt-6">
        {rsvps.length === 0 ? (
          <Card>
            <CardContent className="py-10 text-center text-muted-foreground">
              No events attended yet
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {rsvps.map((rsvp) => (
              <Link key={rsvp.event_id} href={`/events/${rsvp.events.id}`}>
                <Card className="hover:bg-muted/50 transition-colors">
                  <CardContent className="p-4">
                    <div className="flex items-start gap-4">
                      <div className="bg-primary/10 rounded p-3">
                        <Calendar className="h-6 w-6 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold truncate">
                          {rsvp.events.title}
                        </h3>
                        <Badge variant="outline" className="text-xs mt-1">
                          {rsvp.events.event_type.replace("_", " ")}
                        </Badge>
                        <p className="text-sm text-muted-foreground mt-2">
                          {formatDate(rsvp.events.start_time)}
                        </p>
                        {(rsvp.events.location_city || rsvp.events.location_state) && (
                          <p className="text-xs text-muted-foreground">
                            {[rsvp.events.location_city, rsvp.events.location_state]
                              .filter(Boolean)
                              .join(", ")}
                          </p>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </TabsContent>
    </Tabs>
  );
}
