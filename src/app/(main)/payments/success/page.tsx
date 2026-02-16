import { Suspense } from "react";
import { PaymentSuccess } from "@/components/payments";
import { Loader2 } from "lucide-react";

export default function PaymentSuccessPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-[#0a1628] to-[#0f2847] py-16 px-4">
      <Suspense
        fallback={
          <div className="flex items-center justify-center min-h-[60vh]">
            <Loader2 className="h-8 w-8 animate-spin text-blue-400" />
          </div>
        }
      >
        <PaymentSuccess />
      </Suspense>
    </div>
  );
}
