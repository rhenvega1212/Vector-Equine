import { redirect } from "next/navigation";

/** Insights folded into Today tiles + Horse Health/Predict (brief-08). */
export default function InsightsRedirectPage() {
  redirect("/train/horse");
}
