"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle, Loader2, ArrowRight, Sparkles } from "lucide-react";
import Link from "next/link";
import confetti from "canvas-confetti";

export function PaymentSuccess() {
  const searchParams = useSearchParams();
  const sessionId = searchParams.get("session_id");
  const [isLoading, setIsLoading] = useState(true);
  const [celebrationDone, setCelebrationDone] = useState(false);

  useEffect(() => {
    // Simulate verification delay
    const timer = setTimeout(() => {
      setIsLoading(false);
    }, 1500);

    return () => clearTimeout(timer);
  }, [sessionId]);

  useEffect(() => {
    if (!isLoading && !celebrationDone) {
      // Trigger confetti celebration
      const duration = 3 * 1000;
      const animationEnd = Date.now() + duration;

      const randomInRange = (min: number, max: number) => {
        return Math.random() * (max - min) + min;
      };

      const interval = setInterval(() => {
        const timeLeft = animationEnd - Date.now();

        if (timeLeft <= 0) {
          clearInterval(interval);
          setCelebrationDone(true);
          return;
        }

        const particleCount = 50 * (timeLeft / duration);

        confetti({
          particleCount,
          startVelocity: 30,
          spread: 360,
          origin: {
            x: randomInRange(0.1, 0.9),
            y: Math.random() - 0.2,
          },
          colors: ["#3B82F6", "#60A5FA", "#93C5FD", "#BFDBFE"],
        });
      }, 250);

      return () => clearInterval(interval);
    }
  }, [isLoading, celebrationDone]);

  if (isLoading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <Card className="max-w-md w-full">
          <CardContent className="py-12">
            <div className="flex flex-col items-center text-center">
              <Loader2 className="h-12 w-12 animate-spin text-blue-400 mb-4" />
              <h2 className="text-xl font-semibold text-white">Processing your payment...</h2>
              <p className="text-white/60 mt-2">Please wait while we confirm your purchase.</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <Card className="max-w-md w-full">
        <CardContent className="py-12">
          <div className="flex flex-col items-center text-center">
            <div className="relative mb-6">
              <div className="absolute inset-0 animate-ping bg-green-500/20 rounded-full" />
              <div className="relative bg-green-500/20 p-4 rounded-full">
                <CheckCircle className="h-12 w-12 text-green-400" />
              </div>
            </div>

            <h2 className="text-2xl font-bold text-white mb-2">Payment Successful!</h2>
            <p className="text-white/60 mb-8">
              Thank you for your purchase. Your access has been activated.
            </p>

            <div className="flex flex-col sm:flex-row gap-3 w-full">
              <Button asChild className="flex-1 bg-blue-500 hover:bg-blue-600">
                <Link href="/challenges">
                  <Sparkles className="h-4 w-4 mr-2" />
                  Go to Courses
                </Link>
              </Button>
              <Button asChild variant="outline" className="flex-1">
                <Link href="/settings">
                  View Receipt
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Link>
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export function PaymentCanceled() {
  return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <Card className="max-w-md w-full">
        <CardContent className="py-12">
          <div className="flex flex-col items-center text-center">
            <div className="bg-yellow-500/20 p-4 rounded-full mb-6">
              <Sparkles className="h-12 w-12 text-yellow-400" />
            </div>

            <h2 className="text-2xl font-bold text-white mb-2">Payment Canceled</h2>
            <p className="text-white/60 mb-8">
              Your payment was canceled. No charges were made to your account.
            </p>

            <div className="flex flex-col sm:flex-row gap-3 w-full">
              <Button asChild className="flex-1">
                <Link href="/pricing">
                  <ArrowRight className="h-4 w-4 mr-2" />
                  View Plans
                </Link>
              </Button>
              <Button asChild variant="outline" className="flex-1">
                <Link href="/challenges">Back to Courses</Link>
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
