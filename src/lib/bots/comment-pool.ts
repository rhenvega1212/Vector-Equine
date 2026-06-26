export interface CommentTemplate {
  content: string;
  category: "supportive" | "question" | "specific" | "reaction";
  /**
   * Topics/disciplines this comment fits. Empty/undefined = universal (works on
   * any post). Matched against the post's tags so comments read as a genuine
   * response to the content rather than a random one-liner.
   */
  tags?: string[];
  /**
   * True for comments that only make sense when there's something to look at
   * (a photo or video). These are filtered out on text-only posts so we never
   * say "Your position looks great!" on a written reflection.
   */
  requiresMedia?: boolean;
}

export const COMMENT_POOL: CommentTemplate[] = [
  // ---------------------------------------------------------------------------
  // SUPPORTIVE / GENERAL (mostly universal)
  // ---------------------------------------------------------------------------
  { content: "Love this!", category: "supportive" },
  { content: "This is so relatable", category: "supportive" },
  { content: "Beautiful shot!", category: "supportive", requiresMedia: true },
  { content: "Needed to hear this today", category: "supportive", tags: ["mindset"] },
  { content: "This made my day", category: "supportive" },
  { content: "Absolutely gorgeous", category: "supportive", requiresMedia: true },
  { content: "So true!", category: "supportive", tags: ["mindset"] },
  { content: "Goals right here", category: "supportive" },
  { content: "Amazing progress!", category: "supportive", tags: ["training"] },
  { content: "Keep it up!", category: "supportive" },
  { content: "You two look like a great team", category: "supportive", requiresMedia: true },
  { content: "Love seeing this kind of content", category: "supportive" },
  { content: "So inspiring", category: "supportive" },
  { content: "This is wonderful", category: "supportive" },
  { content: "Yes!! This is everything", category: "supportive" },

  // ---------------------------------------------------------------------------
  // QUESTION-BASED
  // ---------------------------------------------------------------------------
  { content: "What bit are you using?", category: "question", tags: ["training", "dressage"] },
  { content: "How long have you been riding?", category: "question" },
  { content: "Where is this?? It looks amazing", category: "question", tags: ["trail-riding"], requiresMedia: true },
  { content: "What saddle is that?", category: "question", requiresMedia: true },
  { content: "How did you teach that?", category: "question", tags: ["training"] },
  { content: "What's your warm-up routine like?", category: "question", tags: ["training"] },
  { content: "Any tips for a beginner working on the same thing?", category: "question", tags: ["training"] },
  { content: "What supplement do you use?", category: "question", tags: ["horse-care"] },
  { content: "How often do you ride per week?", category: "question", tags: ["training"] },
  { content: "What breed is your horse?", category: "question", tags: ["horse-care"], requiresMedia: true },
  { content: "Did you work with a trainer on this?", category: "question", tags: ["training"] },
  { content: "How long did it take to get to this point?", category: "question", tags: ["training"] },

  // ---------------------------------------------------------------------------
  // DISCIPLINE-SPECIFIC / TECHNICAL (need something to look at)
  // ---------------------------------------------------------------------------
  { content: "Your position looks great!", category: "specific", tags: ["training"], requiresMedia: true },
  { content: "That's a lovely frame", category: "specific", tags: ["dressage"], requiresMedia: true },
  { content: "Clean round! Well done", category: "specific", tags: ["jumping", "competition"], requiresMedia: true },
  { content: "Your horse looks so happy and relaxed", category: "specific", tags: ["horse-care"], requiresMedia: true },
  { content: "The connection looks amazing here", category: "specific", tags: ["dressage", "training"], requiresMedia: true },
  { content: "That stop was impressive!", category: "specific", tags: ["western"], requiresMedia: true },
  { content: "Such a nice rhythm", category: "specific", tags: ["dressage", "training"], requiresMedia: true },
  { content: "Your horse's topline is looking great", category: "specific", tags: ["horse-care", "dressage"], requiresMedia: true },
  { content: "Those transitions are so smooth", category: "specific", tags: ["dressage", "training"], requiresMedia: true },
  { content: "The impulsion is really coming through", category: "specific", tags: ["dressage"], requiresMedia: true },
  { content: "I need to try this exercise!", category: "specific", tags: ["training"] },
  { content: "That's a brave horse!", category: "specific", tags: ["jumping", "eventing"], requiresMedia: true },
  { content: "Your hands are so steady over fences", category: "specific", tags: ["jumping"], requiresMedia: true },

  // ---------------------------------------------------------------------------
  // REACTION-BASED (relatable, text-friendly)
  // ---------------------------------------------------------------------------
  { content: "I feel this so much", category: "reaction", tags: ["mindset"] },
  { content: "Same thing happened to me last week!", category: "reaction" },
  { content: "My horse does the exact same thing haha", category: "reaction" },
  { content: "I needed this reminder", category: "reaction", tags: ["mindset"] },
  { content: "Adding this to my training plan", category: "reaction", tags: ["training"] },
  { content: "Taking notes!", category: "reaction", tags: ["training"] },
  { content: "Going to try this tomorrow", category: "reaction", tags: ["training"] },
  { content: "This just motivated me to get to the barn", category: "reaction", tags: ["mindset"] },
  { content: "Can relate to this so much", category: "reaction" },
  { content: "My trainer says the same thing!", category: "reaction", tags: ["training"] },
  { content: "Sharing this with my barn friends", category: "reaction" },
  { content: "This is exactly what I've been working on too", category: "reaction", tags: ["training"] },
  { content: "You and your horse are an inspiration", category: "reaction" },
  { content: "Bookmarking this for later", category: "reaction", tags: ["training"] },
  { content: "Needed this today. Thank you for sharing!", category: "reaction", tags: ["mindset"] },
];
