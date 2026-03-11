import { z } from "zod";

export const createHorseProfileSchema = z.object({
  name: z.string().min(1, "Name is required").max(120),
  barn_name: z.string().max(120).optional().nullable(),
  breed: z.string().max(120).optional().nullable(),
  age: z.number().int().min(0).max(50).optional().nullable(),
  birthday: z.string().optional().nullable(),
  sex: z.string().max(20).optional().nullable(),
  height: z.string().max(20).optional().nullable(),
  color: z.string().max(60).optional().nullable(),
  discipline: z.string().max(80).optional().nullable(),
  training_level: z.string().max(80).optional().nullable(),
  owner: z.string().max(120).optional().nullable(),
  rider: z.string().max(120).optional().nullable(),
  trainer: z.string().max(120).optional().nullable(),
  purchase_lease_status: z.string().max(60).optional().nullable(),
  date_acquired: z.string().optional().nullable(),
  notes: z.string().max(3000).optional().nullable(),
  profile_photo_url: z.string().url().optional().nullable().or(z.literal("")),
  show_name: z.string().max(120).optional().nullable(),
  personality_quirks: z.string().max(1000).optional().nullable(),
  injuries_limitations: z.string().max(1000).optional().nullable(),
  goals: z.string().max(2000).optional().nullable(),
});

export const updateHorseProfileSchema = createHorseProfileSchema.partial();

export type CreateHorseProfileInput = z.infer<typeof createHorseProfileSchema>;
export type UpdateHorseProfileInput = z.infer<typeof updateHorseProfileSchema>;
