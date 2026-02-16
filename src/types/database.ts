export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          email: string;
          username: string;
          display_name: string;
          avatar_url: string | null;
          bio: string | null;
          location: string | null;
          discipline: string | null;
          rider_level: string | null;
          role: "rider" | "trainer" | "admin";
          trainer_approved: boolean;
          trainer_approved_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          email: string;
          username: string;
          display_name: string;
          avatar_url?: string | null;
          bio?: string | null;
          location?: string | null;
          discipline?: string | null;
          rider_level?: string | null;
          role?: "rider" | "trainer" | "admin";
          trainer_approved?: boolean;
          trainer_approved_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          email?: string;
          username?: string;
          display_name?: string;
          avatar_url?: string | null;
          bio?: string | null;
          location?: string | null;
          discipline?: string | null;
          rider_level?: string | null;
          role?: "rider" | "trainer" | "admin";
          trainer_approved?: boolean;
          trainer_approved_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      posts: {
        Row: {
          id: string;
          author_id: string;
          content: string;
          tags: string[];
          is_hidden: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          author_id: string;
          content: string;
          tags?: string[];
          is_hidden?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          author_id?: string;
          content?: string;
          tags?: string[];
          is_hidden?: boolean;
          created_at?: string;
          updated_at?: string;
        };
      };
      post_media: {
        Row: {
          id: string;
          post_id: string;
          media_type: "image" | "video";
          url: string;
          thumbnail_url: string | null;
          sort_order: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          post_id: string;
          media_type: "image" | "video";
          url: string;
          thumbnail_url?: string | null;
          sort_order?: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          post_id?: string;
          media_type?: "image" | "video";
          url?: string;
          thumbnail_url?: string | null;
          sort_order?: number;
          created_at?: string;
        };
      };
      follows: {
        Row: {
          follower_id: string;
          following_id: string;
          created_at: string;
        };
        Insert: {
          follower_id: string;
          following_id: string;
          created_at?: string;
        };
        Update: {
          follower_id?: string;
          following_id?: string;
          created_at?: string;
        };
      };
      post_likes: {
        Row: {
          user_id: string;
          post_id: string;
          created_at: string;
        };
        Insert: {
          user_id: string;
          post_id: string;
          created_at?: string;
        };
        Update: {
          user_id?: string;
          post_id?: string;
          created_at?: string;
        };
      };
      comments: {
        Row: {
          id: string;
          post_id: string;
          author_id: string;
          parent_id: string | null;
          content: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          post_id: string;
          author_id: string;
          parent_id?: string | null;
          content: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          post_id?: string;
          author_id?: string;
          parent_id?: string | null;
          content?: string;
          created_at?: string;
          updated_at?: string;
        };
      };
      reports: {
        Row: {
          id: string;
          reporter_id: string;
          post_id: string | null;
          comment_id: string | null;
          reason: string;
          status: "pending" | "reviewed" | "resolved";
          resolved_by: string | null;
          created_at: string;
          resolved_at: string | null;
        };
        Insert: {
          id?: string;
          reporter_id: string;
          post_id?: string | null;
          comment_id?: string | null;
          reason: string;
          status?: "pending" | "reviewed" | "resolved";
          resolved_by?: string | null;
          created_at?: string;
          resolved_at?: string | null;
        };
        Update: {
          id?: string;
          reporter_id?: string;
          post_id?: string | null;
          comment_id?: string | null;
          reason?: string;
          status?: "pending" | "reviewed" | "resolved";
          resolved_by?: string | null;
          created_at?: string;
          resolved_at?: string | null;
        };
      };
      events: {
        Row: {
          id: string;
          host_id: string;
          title: string;
          description: string | null;
          event_type: "clinic" | "show" | "run_club" | "workout_group" | "movie_night" | "networking";
          location_city: string | null;
          location_state: string | null;
          location_address: string | null;
          start_time: string;
          end_time: string;
          capacity: number | null;
          price_display: string | null;
          banner_image_url: string | null;
          is_published: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          host_id: string;
          title: string;
          description?: string | null;
          event_type: "clinic" | "show" | "run_club" | "workout_group" | "movie_night" | "networking";
          location_city?: string | null;
          location_state?: string | null;
          location_address?: string | null;
          start_time: string;
          end_time: string;
          capacity?: number | null;
          price_display?: string | null;
          banner_image_url?: string | null;
          is_published?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          host_id?: string;
          title?: string;
          description?: string | null;
          event_type?: "clinic" | "show" | "run_club" | "workout_group" | "movie_night" | "networking";
          location_city?: string | null;
          location_state?: string | null;
          location_address?: string | null;
          start_time?: string;
          end_time?: string;
          capacity?: number | null;
          price_display?: string | null;
          banner_image_url?: string | null;
          is_published?: boolean;
          created_at?: string;
          updated_at?: string;
        };
      };
      event_rsvps: {
        Row: {
          user_id: string;
          event_id: string;
          status: "going" | "interested" | "not_going";
          created_at: string;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          event_id: string;
          status: "going" | "interested" | "not_going";
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          user_id?: string;
          event_id?: string;
          status?: "going" | "interested" | "not_going";
          created_at?: string;
          updated_at?: string;
        };
      };
      challenges: {
        Row: {
          id: string;
          creator_id: string;
          title: string;
          description: string | null;
          difficulty: "beginner" | "intermediate" | "advanced" | null;
          duration_days: number | null;
          price_display: string | null;
          cover_image_url: string | null;
          status: "draft" | "published" | "active" | "archived";
          is_private: boolean;
          niche: "dressage" | "rider" | "reining" | "young_horse" | null;
          schedule_type: "scheduled" | "evergreen";
          open_at: string | null;
          close_at: string | null;
          start_at: string | null;
          end_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          creator_id: string;
          title: string;
          description?: string | null;
          difficulty?: "beginner" | "intermediate" | "advanced" | null;
          duration_days?: number | null;
          price_display?: string | null;
          cover_image_url?: string | null;
          status?: "draft" | "published" | "active" | "archived";
          is_private?: boolean;
          niche?: "dressage" | "rider" | "reining" | "young_horse" | null;
          schedule_type?: "scheduled" | "evergreen";
          open_at?: string | null;
          close_at?: string | null;
          start_at?: string | null;
          end_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          creator_id?: string;
          title?: string;
          description?: string | null;
          difficulty?: "beginner" | "intermediate" | "advanced" | null;
          duration_days?: number | null;
          price_display?: string | null;
          cover_image_url?: string | null;
          status?: "draft" | "published" | "active" | "archived";
          is_private?: boolean;
          niche?: "dressage" | "rider" | "reining" | "young_horse" | null;
          schedule_type?: "scheduled" | "evergreen";
          open_at?: string | null;
          close_at?: string | null;
          start_at?: string | null;
          end_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      challenge_modules: {
        Row: {
          id: string;
          challenge_id: string;
          title: string;
          description: string | null;
          sort_order: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          challenge_id: string;
          title: string;
          description?: string | null;
          sort_order?: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          challenge_id?: string;
          title?: string;
          description?: string | null;
          sort_order?: number;
          created_at?: string;
        };
      };
      challenge_lessons: {
        Row: {
          id: string;
          module_id: string;
          title: string;
          description: string | null;
          requires_submission: boolean;
          sort_order: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          module_id: string;
          title: string;
          description?: string | null;
          requires_submission?: boolean;
          sort_order?: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          module_id?: string;
          title?: string;
          description?: string | null;
          requires_submission?: boolean;
          sort_order?: number;
          created_at?: string;
        };
      };
      lesson_content_blocks: {
        Row: {
          id: string;
          lesson_id: string;
          block_type: "rich_text" | "image" | "video" | "file";
          content: string | null;
          file_name: string | null;
          sort_order: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          lesson_id: string;
          block_type: "rich_text" | "image" | "video" | "file";
          content?: string | null;
          file_name?: string | null;
          sort_order?: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          lesson_id?: string;
          block_type?: "rich_text" | "image" | "video" | "file";
          content?: string | null;
          file_name?: string | null;
          sort_order?: number;
          created_at?: string;
        };
      };
      challenge_enrollments: {
        Row: {
          id: string;
          user_id: string;
          challenge_id: string;
          enrolled_at: string;
          completed_at: string | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          challenge_id: string;
          enrolled_at?: string;
          completed_at?: string | null;
        };
        Update: {
          id?: string;
          user_id?: string;
          challenge_id?: string;
          enrolled_at?: string;
          completed_at?: string | null;
        };
      };
      lesson_completions: {
        Row: {
          user_id: string;
          lesson_id: string;
          completed_at: string;
        };
        Insert: {
          user_id: string;
          lesson_id: string;
          completed_at?: string;
        };
        Update: {
          user_id?: string;
          lesson_id?: string;
          completed_at?: string;
        };
      };
      assignments: {
        Row: {
          id: string;
          lesson_id: string;
          title: string;
          instructions: string | null;
          submission_type: "text" | "image" | "video" | "link";
          created_at: string;
        };
        Insert: {
          id?: string;
          lesson_id: string;
          title: string;
          instructions?: string | null;
          submission_type: "text" | "image" | "video" | "link";
          created_at?: string;
        };
        Update: {
          id?: string;
          lesson_id?: string;
          title?: string;
          instructions?: string | null;
          submission_type?: "text" | "image" | "video" | "link";
          created_at?: string;
        };
      };
      submissions: {
        Row: {
          id: string;
          assignment_id: string;
          user_id: string;
          content: string | null;
          media_url: string | null;
          admin_feedback: string | null;
          is_feedback_pinned: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          assignment_id: string;
          user_id: string;
          content?: string | null;
          media_url?: string | null;
          admin_feedback?: string | null;
          is_feedback_pinned?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          assignment_id?: string;
          user_id?: string;
          content?: string | null;
          media_url?: string | null;
          admin_feedback?: string | null;
          is_feedback_pinned?: boolean;
          created_at?: string;
          updated_at?: string;
        };
      };
      submission_likes: {
        Row: {
          user_id: string;
          submission_id: string;
          created_at: string;
        };
        Insert: {
          user_id: string;
          submission_id: string;
          created_at?: string;
        };
        Update: {
          user_id?: string;
          submission_id?: string;
          created_at?: string;
        };
      };
      submission_comments: {
        Row: {
          id: string;
          submission_id: string;
          author_id: string;
          content: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          submission_id: string;
          author_id: string;
          content: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          submission_id?: string;
          author_id?: string;
          content?: string;
          created_at?: string;
        };
      };
      training_sessions: {
        Row: {
          id: string;
          user_id: string;
          session_date: string;
          horse: string;
          session_type: string;
          overall_feel: number;
          discipline: string | null;
          exercises: string | null;
          notes: string | null;
          rhythm: number | null;
          relaxation: number | null;
          connection: number | null;
          impulsion: number | null;
          straightness: number | null;
          collection: number | null;
          competition_prep: boolean;
          focused_goal_session: boolean;
          video_link_url: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          session_date: string;
          horse: string;
          session_type: string;
          overall_feel: number;
          discipline?: string | null;
          exercises?: string | null;
          notes?: string | null;
          rhythm?: number | null;
          relaxation?: number | null;
          connection?: number | null;
          impulsion?: number | null;
          straightness?: number | null;
          collection?: number | null;
          competition_prep?: boolean;
          focused_goal_session?: boolean;
          video_link_url?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          session_date?: string;
          horse?: string;
          session_type?: string;
          overall_feel?: number;
          discipline?: string | null;
          exercises?: string | null;
          notes?: string | null;
          rhythm?: number | null;
          relaxation?: number | null;
          connection?: number | null;
          impulsion?: number | null;
          straightness?: number | null;
          collection?: number | null;
          competition_prep?: boolean;
          focused_goal_session?: boolean;
          video_link_url?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      ai_video_uploads: {
        Row: {
          id: string;
          user_id: string;
          file_url: string;
          horse: string | null;
          notes: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          file_url: string;
          horse?: string | null;
          notes?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          file_url?: string;
          horse?: string | null;
          notes?: string | null;
          created_at?: string;
        };
      };
      ai_analyses: {
        Row: {
          id: string;
          video_id: string;
          status: "pending" | "processing" | "complete" | "error";
          result_json: Json | null;
          error_message: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          video_id: string;
          status?: "pending" | "processing" | "complete" | "error";
          result_json?: Json | null;
          error_message?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          video_id?: string;
          status?: "pending" | "processing" | "complete" | "error";
          result_json?: Json | null;
          error_message?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      ai_chat_messages: {
        Row: {
          id: string;
          analysis_id: string;
          role: "user" | "assistant";
          content: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          analysis_id: string;
          role: "user" | "assistant";
          content: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          analysis_id?: string;
          role?: "user" | "assistant";
          content?: string;
          created_at?: string;
        };
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      [_ in never]: never;
    };
  };
};

// Helper types
export type Tables<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Row"];
export type TablesInsert<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Insert"];
export type TablesUpdate<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Update"];

// Convenience types
export type Profile = Tables<"profiles">;
export type Post = Tables<"posts">;
export type PostMedia = Tables<"post_media">;
export type Follow = Tables<"follows">;
export type PostLike = Tables<"post_likes">;
export type Comment = Tables<"comments">;
export type Report = Tables<"reports">;
export type Event = Tables<"events">;
export type EventRsvp = Tables<"event_rsvps">;
export type Challenge = Tables<"challenges">;
export type ChallengeModule = Tables<"challenge_modules">;
export type ChallengeLesson = Tables<"challenge_lessons">;
export type LessonContentBlock = Tables<"lesson_content_blocks">;
export type ChallengeEnrollment = Tables<"challenge_enrollments">;
export type LessonCompletion = Tables<"lesson_completions">;
export type Assignment = Tables<"assignments">;
export type Submission = Tables<"submissions">;
export type SubmissionLike = Tables<"submission_likes">;
export type SubmissionComment = Tables<"submission_comments">;
export type TrainingSession = Tables<"training_sessions">;
export type AiVideoUpload = Tables<"ai_video_uploads">;
export type AiAnalysis = Tables<"ai_analyses">;
export type AiChatMessage = Tables<"ai_chat_messages">;

export type UserRole = "rider" | "trainer" | "admin";
export type EventType = "clinic" | "show" | "run_club" | "workout_group" | "movie_night" | "networking";
export type RsvpStatus = "going" | "interested" | "not_going";
export type ChallengeDifficulty = "beginner" | "intermediate" | "advanced";
export type ChallengeStatus = "draft" | "published";
export type ContentBlockType = "rich_text" | "image" | "video" | "file";
export type SubmissionType = "text" | "image" | "video" | "link";
export type MediaType = "image" | "video";
export type ReportStatus = "pending" | "reviewed" | "resolved";
