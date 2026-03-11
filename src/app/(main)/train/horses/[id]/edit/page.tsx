import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { HorseForm } from "@/components/train/horse-form";

interface EditHorsePageProps {
  params: Promise<{ id: string }>;
}

export default async function EditHorsePage({ params }: EditHorsePageProps) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: horse, error } = await supabase
    .from("horse_profiles")
    .select("*")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (error || !horse) notFound();

  const defaultValues = {
    name: horse.name,
    barn_name: horse.barn_name ?? undefined,
    breed: horse.breed ?? undefined,
    age: horse.age ?? undefined,
    birthday: horse.birthday ?? undefined,
    sex: horse.sex ?? undefined,
    height: horse.height ?? undefined,
    color: horse.color ?? undefined,
    discipline: horse.discipline ?? undefined,
    training_level: horse.training_level ?? undefined,
    owner: horse.owner ?? undefined,
    rider: horse.rider ?? undefined,
    trainer: horse.trainer ?? undefined,
    purchase_lease_status: horse.purchase_lease_status ?? undefined,
    date_acquired: horse.date_acquired ?? undefined,
    notes: horse.notes ?? undefined,
    profile_photo_url: horse.profile_photo_url ?? undefined,
    show_name: horse.show_name ?? undefined,
    personality_quirks: horse.personality_quirks ?? undefined,
    injuries_limitations: horse.injuries_limitations ?? undefined,
    goals: horse.goals ?? undefined,
  };

  return (
    <div>
      <HorseForm mode="edit" horseId={id} defaultValues={defaultValues} />
    </div>
  );
}
