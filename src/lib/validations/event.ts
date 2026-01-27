import { z } from "zod";

export const eventTypeEnum = z.enum([
  "clinic",
  "show",
  "run_club",
  "workout_group",
  "movie_night",
  "networking",
]);

export const rsvpStatusEnum = z.enum(["going", "interested", "not_going"]);

export const createEventSchema = z.object({
  title: z
    .string()
    .min(3, "Title must be at least 3 characters")
    .max(100, "Title must be less than 100 characters"),
  description: z.string().max(5000, "Description must be less than 5000 characters").optional(),
  event_type: eventTypeEnum,
  location_city: z.string().max(100, "City must be less than 100 characters").optional(),
  location_state: z.string().max(100, "State must be less than 100 characters").optional(),
  location_address: z.string().max(200, "Address must be less than 200 characters").optional(),
  start_time: z.string().datetime("Invalid start time"),
  end_time: z.string().datetime("Invalid end time"),
  capacity: z.number().int().positive("Capacity must be a positive number").optional(),
  price_display: z.string().max(50, "Price display must be less than 50 characters").optional(),
  banner_image_url: z.string().url("Invalid banner image URL").optional(),
  is_published: z.boolean().optional(),
});

export const updateEventSchema = createEventSchema.partial();

export const rsvpSchema = z.object({
  status: rsvpStatusEnum,
});

export type CreateEventInput = z.infer<typeof createEventSchema>;
export type UpdateEventInput = z.infer<typeof updateEventSchema>;
export type RsvpInput = z.infer<typeof rsvpSchema>;
