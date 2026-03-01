/**
 * Seed a sample "First Level Module 1" course with two modules,
 * five lessons, and assorted content blocks.
 *
 * Usage:
 *   import { seedSampleCourse } from "@/lib/seed/sample-course";
 *   const challengeId = await seedSampleCourse(supabaseAdmin);
 */
export async function seedSampleCourse(supabaseAdmin: any): Promise<string> {
  const challengeId = crypto.randomUUID();

  // ── Challenge ──────────────────────────────────────────────
  await supabaseAdmin.from("challenges").insert({
    id: challengeId,
    title: "First Level - Module 1: Foundations",
    description:
      "Master the fundamentals of equestrian training with structured lessons, video demos, and practical assignments.",
    difficulty: "beginner",
    status: "published",
    duration_days: 30,
  });

  // ── Module 1: Introduction ─────────────────────────────────
  const mod1Id = crypto.randomUUID();
  await supabaseAdmin.from("challenge_modules").insert({
    id: mod1Id,
    challenge_id: challengeId,
    title: "Introduction",
    sort_order: 0,
  });

  // Lesson 1.1 — Welcome & Course Overview
  const lesson1_1Id = crypto.randomUUID();
  await supabaseAdmin.from("challenge_lessons").insert({
    id: lesson1_1Id,
    module_id: mod1Id,
    title: "Welcome & Course Overview",
    sort_order: 0,
  });

  await supabaseAdmin.from("lesson_content_blocks").insert([
    {
      id: crypto.randomUUID(),
      lesson_id: lesson1_1Id,
      block_type: "rich_text",
      content:
        "<h1>Welcome to First Level</h1><p>This course will guide you through the foundational skills needed...</p>",
      sort_order: 0,
      is_required: true,
      settings: {},
    },
    {
      id: crypto.randomUUID(),
      lesson_id: lesson1_1Id,
      block_type: "video",
      content: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
      sort_order: 1,
      is_required: true,
      settings: { trackCompletion: true },
    },
    {
      id: crypto.randomUUID(),
      lesson_id: lesson1_1Id,
      block_type: "callout",
      content: "Complete each lesson before moving to the next.",
      sort_order: 2,
      is_required: false,
      settings: { calloutType: "tip" },
    },
  ]);

  // Lesson 1.2 — Setting Goals
  const lesson1_2Id = crypto.randomUUID();
  await supabaseAdmin.from("challenge_lessons").insert({
    id: lesson1_2Id,
    module_id: mod1Id,
    title: "Setting Goals",
    sort_order: 1,
  });

  await supabaseAdmin.from("lesson_content_blocks").insert([
    {
      id: crypto.randomUUID(),
      lesson_id: lesson1_2Id,
      block_type: "rich_text",
      content:
        "<h2>Setting Goals</h2><p>Before diving in, take a moment to define what you want to achieve.</p>",
      sort_order: 0,
      is_required: true,
      settings: {},
    },
    {
      id: crypto.randomUUID(),
      lesson_id: lesson1_2Id,
      block_type: "checklist",
      content: null,
      sort_order: 1,
      is_required: true,
      settings: {
        items: [
          { label: "Review course outline", required: true },
          { label: "Set personal goals", required: true },
          { label: "Join community discussion", required: false },
        ],
      },
    },
    {
      id: crypto.randomUUID(),
      lesson_id: lesson1_2Id,
      block_type: "discussion",
      content: null,
      sort_order: 2,
      is_required: false,
      settings: {
        prompt: "Share your goals for this course!",
        sortDefault: "newest",
        minParticipation: 1,
      },
    },
  ]);

  // ── Module 2: Fundamentals ─────────────────────────────────
  const mod2Id = crypto.randomUUID();
  await supabaseAdmin.from("challenge_modules").insert({
    id: mod2Id,
    challenge_id: challengeId,
    title: "Fundamentals",
    sort_order: 1,
  });

  // Lesson 2.1 — Basic Position
  const lesson2_1Id = crypto.randomUUID();
  await supabaseAdmin.from("challenge_lessons").insert({
    id: lesson2_1Id,
    module_id: mod2Id,
    title: "Basic Position",
    sort_order: 0,
  });

  await supabaseAdmin.from("lesson_content_blocks").insert([
    {
      id: crypto.randomUUID(),
      lesson_id: lesson2_1Id,
      block_type: "rich_text",
      content:
        "<h2>Basic Position</h2><p>A correct position is the foundation of effective riding.</p>",
      sort_order: 0,
      is_required: true,
      settings: {},
    },
    {
      id: crypto.randomUUID(),
      lesson_id: lesson2_1Id,
      block_type: "image",
      content: null,
      sort_order: 1,
      is_required: false,
      settings: { alignment: "full", allowEnlarge: true },
    },
    {
      id: crypto.randomUUID(),
      lesson_id: lesson2_1Id,
      block_type: "video",
      content: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
      sort_order: 2,
      is_required: true,
      settings: { trackCompletion: true },
    },
  ]);

  // Lesson 2.2 — Walk Work
  const lesson2_2Id = crypto.randomUUID();
  await supabaseAdmin.from("challenge_lessons").insert({
    id: lesson2_2Id,
    module_id: mod2Id,
    title: "Walk Work",
    sort_order: 1,
  });

  await supabaseAdmin.from("lesson_content_blocks").insert([
    {
      id: crypto.randomUUID(),
      lesson_id: lesson2_2Id,
      block_type: "rich_text",
      content:
        "<h2>Walk Work</h2><p>The walk is where you build the conversation with your horse.</p>",
      sort_order: 0,
      is_required: true,
      settings: {},
    },
    {
      id: crypto.randomUUID(),
      lesson_id: lesson2_2Id,
      block_type: "video",
      content: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
      sort_order: 1,
      is_required: true,
      settings: { trackCompletion: true },
    },
    {
      id: crypto.randomUUID(),
      lesson_id: lesson2_2Id,
      block_type: "quiz",
      content: null,
      sort_order: 2,
      is_required: true,
      settings: {
        questions: [
          {
            question: "What is the correct heel position?",
            options: [
              "Above the toe",
              "Below the toe",
              "Level with the toe",
              "Behind the toe",
            ],
            correctIndex: 1,
            explanation:
              "The heel should be below the toe to maintain proper leg position.",
          },
        ],
        passingPercent: 70,
      },
    },
  ]);

  // Lesson 2.3 — Your First Submission (hard-gated)
  const lesson2_3Id = crypto.randomUUID();
  await supabaseAdmin.from("challenge_lessons").insert({
    id: lesson2_3Id,
    module_id: mod2Id,
    title: "Your First Submission",
    sort_order: 2,
    gating_type: "hard",
    gating_rules: { requireAllBlocks: true, requireSubmission: true },
  });

  await supabaseAdmin.from("lesson_content_blocks").insert([
    {
      id: crypto.randomUUID(),
      lesson_id: lesson2_3Id,
      block_type: "rich_text",
      content:
        "<h2>Your First Submission</h2><p>Time to put what you've learned into practice. Follow the instructions below to submit your video.</p>",
      sort_order: 0,
      is_required: true,
      settings: {},
    },
    {
      id: crypto.randomUUID(),
      lesson_id: lesson2_3Id,
      block_type: "submission",
      content: null,
      sort_order: 1,
      is_required: true,
      settings: {
        submissionType: "video",
        instructions:
          "Record a 2-minute video demonstrating your walk work.",
        maxFiles: 1,
        allowResubmission: true,
        aiFeedbackEnabled: true,
      },
    },
  ]);

  return challengeId;
}
