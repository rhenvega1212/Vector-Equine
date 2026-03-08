export interface CommentTemplate {
  content: string;
  category: "supportive" | "question" | "specific" | "reaction";
}

export const COMMENT_POOL: CommentTemplate[] = [
  // ---------------------------------------------------------------------------
  // SUPPORTIVE / GENERAL
  // ---------------------------------------------------------------------------
  { content: "Love this!", category: "supportive" },
  { content: "This is so relatable", category: "supportive" },
  { content: "Beautiful!", category: "supportive" },
  { content: "Needed to hear this today", category: "supportive" },
  { content: "This made my day", category: "supportive" },
  { content: "Absolutely gorgeous", category: "supportive" },
  { content: "So true!", category: "supportive" },
  { content: "Goals right here", category: "supportive" },
  { content: "Amazing progress!", category: "supportive" },
  { content: "Keep it up!", category: "supportive" },
  { content: "You two are a great team", category: "supportive" },
  { content: "Love seeing this kind of content", category: "supportive" },
  { content: "So inspiring", category: "supportive" },
  { content: "This is wonderful", category: "supportive" },
  { content: "Yes!! This is everything", category: "supportive" },

  // ---------------------------------------------------------------------------
  // QUESTION-BASED
  // ---------------------------------------------------------------------------
  { content: "What bit are you using?", category: "question" },
  { content: "How long have you been riding?", category: "question" },
  { content: "Where is this?? It looks amazing", category: "question" },
  { content: "What saddle is that?", category: "question" },
  { content: "How did you teach that?", category: "question" },
  { content: "What's your warm-up routine like?", category: "question" },
  { content: "Any tips for a beginner working on the same thing?", category: "question" },
  { content: "What supplement do you use?", category: "question" },
  { content: "How often do you ride per week?", category: "question" },
  { content: "What breed is your horse?", category: "question" },
  { content: "Did you work with a trainer on this?", category: "question" },
  { content: "How long did it take to get to this point?", category: "question" },

  // ---------------------------------------------------------------------------
  // DISCIPLINE-SPECIFIC / TECHNICAL
  // ---------------------------------------------------------------------------
  { content: "Your position looks great!", category: "specific" },
  { content: "That's a lovely frame", category: "specific" },
  { content: "Clean round! Well done", category: "specific" },
  { content: "Your horse looks so happy and relaxed", category: "specific" },
  { content: "The connection looks amazing here", category: "specific" },
  { content: "That stop was impressive!", category: "specific" },
  { content: "Such a nice rhythm", category: "specific" },
  { content: "Your horse's topline is looking great", category: "specific" },
  { content: "Those transitions are so smooth", category: "specific" },
  { content: "The impulsion is really coming through", category: "specific" },
  { content: "I need to try this exercise!", category: "specific" },
  { content: "That's a brave horse!", category: "specific" },
  { content: "Your hands are so steady over fences", category: "specific" },

  // ---------------------------------------------------------------------------
  // REACTION-BASED
  // ---------------------------------------------------------------------------
  { content: "I feel this so much", category: "reaction" },
  { content: "Same thing happened to me last week!", category: "reaction" },
  { content: "My horse does the exact same thing haha", category: "reaction" },
  { content: "I needed this reminder", category: "reaction" },
  { content: "Adding this to my training plan", category: "reaction" },
  { content: "Taking notes!", category: "reaction" },
  { content: "Going to try this tomorrow", category: "reaction" },
  { content: "This just motivated me to get to the barn", category: "reaction" },
  { content: "Can relate to this so much", category: "reaction" },
  { content: "My trainer says the same thing!", category: "reaction" },
  { content: "Sharing this with my barn friends", category: "reaction" },
  { content: "This is exactly what I've been working on too", category: "reaction" },
  { content: "You and your horse are an inspiration", category: "reaction" },
  { content: "Bookmarking this for later", category: "reaction" },
  { content: "Needed this today. Thank you for sharing!", category: "reaction" },
];
