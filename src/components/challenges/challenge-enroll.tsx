"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";

interface ChallengeEnrollProps {
  challengeId: string;
}

export function ChallengeEnroll({ challengeId }: ChallengeEnrollProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);

  async function handleEnroll() {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/challenges/${challengeId}/enroll`, {
        method: "POST",
      });

      if (response.ok) {
        toast({
          title: "Successfully enrolled!",
          description: "You can now start the challenge.",
        });
        router.refresh();
      } else {
        const error = await response.json();
        throw new Error(error.error || "Failed to enroll");
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to enroll. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <Button className="w-full" onClick={handleEnroll} disabled={isLoading}>
      {isLoading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
      Join Challenge
    </Button>
  );
}
