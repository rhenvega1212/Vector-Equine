"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Check, Star, X } from "lucide-react";

interface EventRsvpProps {
  eventId: string;
  currentStatus?: string;
}

type RsvpStatus = "going" | "interested" | "not_going";

export function EventRsvp({ eventId, currentStatus }: EventRsvpProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [status, setStatus] = useState<string | undefined>(currentStatus);
  const [isLoading, setIsLoading] = useState(false);

  async function handleRsvp(newStatus: RsvpStatus) {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/events/${eventId}/rsvp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });

      if (response.ok) {
        setStatus(newStatus);
        router.refresh();
        toast({
          title: "RSVP updated",
          description:
            newStatus === "going"
              ? "You're going to this event!"
              : newStatus === "interested"
              ? "You've marked this event as interested."
              : "You've declined this event.",
        });
      } else {
        throw new Error("Failed to update RSVP");
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update RSVP. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="space-y-2">
      <Button
        className="w-full"
        variant={status === "going" ? "default" : "outline"}
        onClick={() => handleRsvp("going")}
        disabled={isLoading}
      >
        {isLoading ? (
          <Loader2 className="h-4 w-4 animate-spin mr-2" />
        ) : (
          <Check className="h-4 w-4 mr-2" />
        )}
        Going
      </Button>

      <Button
        className="w-full"
        variant={status === "interested" ? "default" : "outline"}
        onClick={() => handleRsvp("interested")}
        disabled={isLoading}
      >
        {isLoading ? (
          <Loader2 className="h-4 w-4 animate-spin mr-2" />
        ) : (
          <Star className="h-4 w-4 mr-2" />
        )}
        Interested
      </Button>

      {status && status !== "not_going" && (
        <Button
          className="w-full"
          variant="ghost"
          onClick={() => handleRsvp("not_going")}
          disabled={isLoading}
        >
          {isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
          ) : (
            <X className="h-4 w-4 mr-2" />
          )}
          Can&apos;t Go
        </Button>
      )}
    </div>
  );
}
