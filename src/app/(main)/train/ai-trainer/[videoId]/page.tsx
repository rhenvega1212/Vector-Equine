import { redirect } from "next/navigation";

export default async function AiTrainerVideoRedirect({
  params,
}: {
  params: Promise<{ videoId: string }>;
}) {
  const { videoId } = await params;
  redirect(`/train/ride/plan/${videoId}`);
}
