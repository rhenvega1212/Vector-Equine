import { z } from "zod";

export const createPostSchema = z.object({
  content: z
    .string()
    .min(1, "Post content is required")
    .max(5000, "Post must be less than 5000 characters"),
  tags: z.array(z.string()).max(5, "Maximum 5 tags allowed").optional(),
  media: z
    .array(
      z.object({
        url: z.string().url(),
        media_type: z.enum(["image", "video"]),
        thumbnail_url: z.string().url().optional(),
      })
    )
    .max(10, "Maximum 10 media items allowed")
    .optional(),
});

export const updatePostSchema = z.object({
  content: z
    .string()
    .min(1, "Post content is required")
    .max(5000, "Post must be less than 5000 characters")
    .optional(),
  tags: z.array(z.string()).max(5, "Maximum 5 tags allowed").optional(),
});

export const createCommentSchema = z.object({
  content: z
    .string()
    .min(1, "Comment content is required")
    .max(1000, "Comment must be less than 1000 characters"),
  parent_id: z.string().uuid().nullish(),
});

export const reportSchema = z.object({
  reason: z
    .string()
    .min(10, "Please provide more details about the issue")
    .max(500, "Reason must be less than 500 characters"),
  post_id: z.string().uuid().optional(),
  comment_id: z.string().uuid().optional(),
});

export type CreatePostInput = z.infer<typeof createPostSchema>;
export type UpdatePostInput = z.infer<typeof updatePostSchema>;
export type CreateCommentInput = z.infer<typeof createCommentSchema>;
export type ReportInput = z.infer<typeof reportSchema>;
