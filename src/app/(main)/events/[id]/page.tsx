import { redirect } from "next/navigation";

interface EventPageProps {
  params: Promise<{ id: string }>;
}

export default async function EventPage({ params }: EventPageProps) {
  await params;
  redirect("/train");
}
