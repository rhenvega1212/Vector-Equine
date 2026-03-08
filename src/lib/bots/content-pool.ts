export interface ContentTemplate {
  content: string;
  tags: string[];
  /** Which disciplines this post suits. Empty = universal. */
  disciplines: string[];
  category: string;
}

export const CONTENT_POOL: ContentTemplate[] = [
  // ---------------------------------------------------------------------------
  // TRAINING (universal)
  // ---------------------------------------------------------------------------
  {
    content:
      "Had one of those rides today where everything just clicked. The half-halts were working, the bend was there, and my horse was so soft in the contact. Days like this make all the hard ones worth it.",
    tags: ["training", "mindset"],
    disciplines: [],
    category: "training",
  },
  {
    content:
      "Reminder to myself and everyone else: it's okay to take a step back in your training if your horse needs it. Progress isn't always linear.",
    tags: ["training", "mindset"],
    disciplines: [],
    category: "training",
  },
  {
    content:
      "Worked on transitions for a solid 30 minutes today. My trainer says they're the key to everything and I'm starting to believe her.",
    tags: ["training"],
    disciplines: [],
    category: "training",
  },
  {
    content:
      "Just started incorporating more groundwork into our routine and the difference under saddle is incredible. The connection is so much clearer.",
    tags: ["training"],
    disciplines: [],
    category: "training",
  },
  {
    content:
      "Had a really productive lesson today. Sometimes the simplest exercises teach you the most.",
    tags: ["training"],
    disciplines: [],
    category: "training",
  },
  {
    content:
      "Spent the morning working on relaxation exercises. A tense horse can't learn, and honestly, neither can a tense rider.",
    tags: ["training", "mindset"],
    disciplines: [],
    category: "training",
  },
  {
    content:
      "My trainer introduced pole work today and it was a game changer for rhythm and straightness. Highly recommend trying it if you haven't.",
    tags: ["training"],
    disciplines: [],
    category: "training",
  },
  {
    content:
      "Been doing a lot of walk work lately. People laugh, but the walk is where you build the foundation for everything.",
    tags: ["training"],
    disciplines: [],
    category: "training",
  },
  {
    content:
      "Training in the rain today. My horse was not impressed but we got some great work done once he settled.",
    tags: ["training"],
    disciplines: [],
    category: "training",
  },
  {
    content:
      "Two steps forward, one step back. That's the training journey and I'm learning to be okay with it.",
    tags: ["training", "mindset"],
    disciplines: [],
    category: "training",
  },
  {
    content:
      "Lunging with side reins today to work on balance before getting on. Such a useful tool when used correctly.",
    tags: ["training"],
    disciplines: [],
    category: "training",
  },
  {
    content:
      "Finally getting consistent leg yields. It's been months of work but the feeling when they step under is so rewarding.",
    tags: ["training", "dressage"],
    disciplines: ["dressage", "eventing"],
    category: "training",
  },
  {
    content:
      "Tried a new warm-up routine today — 10 minutes of free walk on a long rein before picking up contact. What a difference it made.",
    tags: ["training"],
    disciplines: [],
    category: "training",
  },
  {
    content:
      "Video review session with my trainer tonight. Watching yourself ride is humbling but SO educational.",
    tags: ["training"],
    disciplines: [],
    category: "training",
  },
  {
    content:
      "Anyone else feel like they ride better when they stop overthinking? My best rides happen when I just feel.",
    tags: ["training", "mindset"],
    disciplines: [],
    category: "training",
  },

  // ---------------------------------------------------------------------------
  // HORSE CARE (universal)
  // ---------------------------------------------------------------------------
  {
    content:
      "Farrier day! My horse always looks so proud of his new shoes. Fresh feet, fresh attitude.",
    tags: ["horse-care"],
    disciplines: [],
    category: "horse-care",
  },
  {
    content:
      "Spring shedding season is upon us. I'm basically wearing a fur coat at this point. Curry comb is my best friend.",
    tags: ["horse-care"],
    disciplines: [],
    category: "horse-care",
  },
  {
    content:
      "Switched to a slow feeder hay net last month and the difference in digestion has been amazing. Less waste too.",
    tags: ["horse-care"],
    disciplines: [],
    category: "horse-care",
  },
  {
    content:
      "Vet check day went great. All four legs sound and teeth look good. Peace of mind is everything.",
    tags: ["horse-care"],
    disciplines: [],
    category: "horse-care",
  },
  {
    content:
      "Just booked a custom bit fitting session. So many horses go in the wrong bit and we don't even realize.",
    tags: ["horse-care"],
    disciplines: [],
    category: "horse-care",
  },
  {
    content:
      "Ice boots after every hard ride. My horse's legs stay tight and he seems so much more comfortable the next day.",
    tags: ["horse-care"],
    disciplines: [],
    category: "horse-care",
  },
  {
    content:
      "Tried a new joint supplement and my mare is moving so much better after just a couple weeks. Worth every penny.",
    tags: ["horse-care"],
    disciplines: [],
    category: "horse-care",
  },
  {
    content:
      "Grooming time is bonding time. I spend at least 30 minutes just brushing and checking him over before every ride.",
    tags: ["horse-care"],
    disciplines: [],
    category: "horse-care",
  },
  {
    content:
      "Finally found a fly spray that actually works this season. Game changer.",
    tags: ["horse-care"],
    disciplines: [],
    category: "horse-care",
  },
  {
    content:
      "Turnout time is so important. My horse is a completely different animal when he gets his pasture hours.",
    tags: ["horse-care"],
    disciplines: [],
    category: "horse-care",
  },
  {
    content:
      "Dealing with a mild case of thrush. Keeping things clean and dry. Anyone have product recommendations that worked for them?",
    tags: ["horse-care"],
    disciplines: [],
    category: "horse-care",
  },
  {
    content:
      "Weight management with an easy keeper is a full-time job. Anyone else constantly adjusting feed?",
    tags: ["horse-care"],
    disciplines: [],
    category: "horse-care",
  },
  {
    content:
      "Massage therapist came out today and found so much tension in his poll and neck. No wonder our right bend has been tough.",
    tags: ["horse-care", "training"],
    disciplines: [],
    category: "horse-care",
  },
  {
    content:
      "First aid kit restocked and ready for the season. Hoping I don't need it, but always better to be prepared.",
    tags: ["horse-care"],
    disciplines: [],
    category: "horse-care",
  },
  {
    content:
      "The look on my horse's face when I bring out the treats after a bath. Pure betrayal turned to forgiveness.",
    tags: ["horse-care"],
    disciplines: [],
    category: "horse-care",
  },

  // ---------------------------------------------------------------------------
  // MINDSET (universal)
  // ---------------------------------------------------------------------------
  {
    content:
      "Bad rides happen. What matters is showing up tomorrow. Your horse doesn't hold grudges and neither should you.",
    tags: ["mindset"],
    disciplines: [],
    category: "mindset",
  },
  {
    content:
      "Comparison is the thief of joy, especially in this sport. Everyone's journey is different.",
    tags: ["mindset"],
    disciplines: [],
    category: "mindset",
  },
  {
    content:
      "I used to beat myself up after every mistake in the saddle. Now I treat them as data. What can I learn?",
    tags: ["mindset"],
    disciplines: [],
    category: "mindset",
  },
  {
    content:
      "The best investment I've made in my riding? Working on the mental game. It changed everything.",
    tags: ["mindset"],
    disciplines: [],
    category: "mindset",
  },
  {
    content:
      "Feeling frustrated today. Nothing went right in the arena. But I untacked, gave him a cookie, and reminded myself why I do this.",
    tags: ["mindset"],
    disciplines: [],
    category: "mindset",
  },
  {
    content:
      "Goal setting has changed my riding. Small, measurable goals instead of vague dreams. This month: consistent 20m circles.",
    tags: ["mindset", "training"],
    disciplines: [],
    category: "mindset",
  },
  {
    content:
      "Nervous about our show this weekend. Trying to focus on the process, not the ribbon.",
    tags: ["mindset", "competition"],
    disciplines: [],
    category: "mindset",
  },
  {
    content:
      "Just journaling my rides has helped so much. I can look back and see how far we've come when it feels like we're stuck.",
    tags: ["mindset"],
    disciplines: [],
    category: "mindset",
  },
  {
    content:
      "Riding through fear is the hardest part of this sport. But every time you do, you grow a little.",
    tags: ["mindset"],
    disciplines: [],
    category: "mindset",
  },
  {
    content:
      "Celebrating a small win today. My horse stood still at the mounting block without being asked. Months of patience paying off.",
    tags: ["mindset", "training"],
    disciplines: [],
    category: "mindset",
  },
  {
    content:
      "Some days the best thing you can do is a short, sweet ride and call it a win.",
    tags: ["mindset"],
    disciplines: [],
    category: "mindset",
  },
  {
    content:
      "Perfectionism has no place in horsemanship. Good enough IS good enough some days.",
    tags: ["mindset"],
    disciplines: [],
    category: "mindset",
  },

  // ---------------------------------------------------------------------------
  // COMPETITION (universal)
  // ---------------------------------------------------------------------------
  {
    content:
      "Show day! Braids are in, boots are polished, and nerves are high. Let's do this.",
    tags: ["competition"],
    disciplines: [],
    category: "competition",
  },
  {
    content:
      "First show of the season is in the books. Didn't place but completed all our goals. That's a win in my book.",
    tags: ["competition"],
    disciplines: [],
    category: "competition",
  },
  {
    content:
      "Packing the trailer the night before a show is my version of Christmas Eve. The excitement is real.",
    tags: ["competition"],
    disciplines: [],
    category: "competition",
  },
  {
    content:
      "Had an amazing warm-up and then it fell apart in the ring. That's showing for you. On to the next one.",
    tags: ["competition", "mindset"],
    disciplines: [],
    category: "competition",
  },
  {
    content:
      "Volunteering at a show today. If you've never done it, I highly recommend it. You learn so much just watching.",
    tags: ["competition"],
    disciplines: [],
    category: "competition",
  },
  {
    content:
      "Post-show analysis: three things that went well, one thing to improve. Keeping it constructive.",
    tags: ["competition", "mindset"],
    disciplines: [],
    category: "competition",
  },
  {
    content:
      "My horse was a total pro at the show today. Sometimes they rise to the occasion and surprise you.",
    tags: ["competition"],
    disciplines: [],
    category: "competition",
  },
  {
    content:
      "Show nerves are real but I've learned they mean I care. Channeling that energy into focus.",
    tags: ["competition", "mindset"],
    disciplines: [],
    category: "competition",
  },
  {
    content:
      "Just entered our first recognized show. Terrified and thrilled in equal measure.",
    tags: ["competition"],
    disciplines: [],
    category: "competition",
  },
  {
    content:
      "Ribbon or not, every show teaches you something. Today I learned that my warm-up routine needs work.",
    tags: ["competition", "training"],
    disciplines: [],
    category: "competition",
  },

  // ---------------------------------------------------------------------------
  // DRESSAGE-SPECIFIC
  // ---------------------------------------------------------------------------
  {
    content:
      "Half-halt epiphany today. It's not about pulling back — it's about momentarily engaging your core and closing your fingers. Mind blown.",
    tags: ["dressage", "training"],
    disciplines: ["dressage"],
    category: "dressage",
  },
  {
    content:
      "Working on shoulder-in and my horse finally offered it without resistance. The feeling of that lateral engagement is addictive.",
    tags: ["dressage", "training"],
    disciplines: ["dressage"],
    category: "dressage",
  },
  {
    content:
      "Watched some Grand Prix freestyle videos for inspiration tonight. The level of partnership is just breathtaking.",
    tags: ["dressage", "competition"],
    disciplines: ["dressage"],
    category: "dressage",
  },
  {
    content:
      "Struggling with our medium trot. He wants to rush instead of lengthen. Any tips for developing push over speed?",
    tags: ["dressage", "training"],
    disciplines: ["dressage"],
    category: "dressage",
  },
  {
    content:
      "Had a visiting clinician today who completely changed how I think about contact. It should feel like holding hands, not arm wrestling.",
    tags: ["dressage", "training"],
    disciplines: ["dressage"],
    category: "dressage",
  },
  {
    content:
      "My horse's canter pirouettes are getting smaller! We started at 15m circles and now we're down to about 8m. Long road ahead but progress is progress.",
    tags: ["dressage", "training"],
    disciplines: ["dressage"],
    category: "dressage",
  },
  {
    content:
      "Collection day. Less is more. The power should come from behind, not from my hands. Easier said than done.",
    tags: ["dressage", "training"],
    disciplines: ["dressage"],
    category: "dressage",
  },
  {
    content:
      "Test riding our freestyle music for the first time. My horse's ears were pricked the whole time. I think he loved it.",
    tags: ["dressage", "competition"],
    disciplines: ["dressage"],
    category: "dressage",
  },
  {
    content:
      "Working on straightness today. My trainer says my horse is like a banana going right. She's not wrong.",
    tags: ["dressage", "training"],
    disciplines: ["dressage"],
    category: "dressage",
  },
  {
    content:
      "Finally understanding the difference between a leg-yield and a half-pass. It's all about the bend and the direction of travel.",
    tags: ["dressage", "training"],
    disciplines: ["dressage"],
    category: "dressage",
  },
  {
    content:
      "Spent an hour on the 20m circle today. Sounds boring but the quality of our bend improved dramatically by the end.",
    tags: ["dressage", "training"],
    disciplines: ["dressage"],
    category: "dressage",
  },
  {
    content:
      "Finally broke 60% in our dressage test! I know that might not sound like much, but for us it's a huge milestone.",
    tags: ["dressage", "competition"],
    disciplines: ["dressage"],
    category: "dressage",
  },

  // ---------------------------------------------------------------------------
  // JUMPING-SPECIFIC
  // ---------------------------------------------------------------------------
  {
    content:
      "Grid work today! Nothing improves a horse's technique like a well-set gymnastic line.",
    tags: ["jumping", "training"],
    disciplines: ["jumping"],
    category: "jumping",
  },
  {
    content:
      "My horse jumped a clean round at 1.10m for the first time! We've been building up slowly and it paid off.",
    tags: ["jumping", "competition"],
    disciplines: ["jumping"],
    category: "jumping",
  },
  {
    content:
      "Working on my position over fences. Two-point at the trot until my legs burn. It'll be worth it.",
    tags: ["jumping", "training"],
    disciplines: ["jumping"],
    category: "jumping",
  },
  {
    content:
      "Course walking is an art form. Learning to see the distances and plan the turns makes such a difference in the ring.",
    tags: ["jumping", "competition"],
    disciplines: ["jumping"],
    category: "jumping",
  },
  {
    content:
      "Tried a bounce line today and my horse was not impressed initially. Got better by the third attempt though.",
    tags: ["jumping", "training"],
    disciplines: ["jumping"],
    category: "jumping",
  },
  {
    content:
      "Flat work for jumpers is so underrated. A balanced canter makes everything over fences easier.",
    tags: ["jumping", "training"],
    disciplines: ["jumping"],
    category: "jumping",
  },
  {
    content:
      "Stadium nerves are real. Cross country I'm weirdly fine but something about those colorful rails gets me every time.",
    tags: ["jumping", "competition", "mindset"],
    disciplines: ["jumping", "eventing"],
    category: "jumping",
  },
  {
    content:
      "New jumping saddle arrived and the difference in my position is immediate. Should have done this sooner.",
    tags: ["jumping"],
    disciplines: ["jumping"],
    category: "jumping",
  },
  {
    content:
      "Oxer practice today. Width is definitely scarier than height for both of us right now.",
    tags: ["jumping", "training"],
    disciplines: ["jumping"],
    category: "jumping",
  },
  {
    content:
      "My trainer set up a bending line today and it really tested our adjustability. We need more of this.",
    tags: ["jumping", "training"],
    disciplines: ["jumping"],
    category: "jumping",
  },
  {
    content:
      "Landing on the correct lead after a fence is something I never thought about before. Now it's all I think about.",
    tags: ["jumping", "training"],
    disciplines: ["jumping"],
    category: "jumping",
  },
  {
    content:
      "Pole work day — no jumping, just poles on the ground. Rhythm, rhythm, rhythm.",
    tags: ["jumping", "training"],
    disciplines: ["jumping"],
    category: "jumping",
  },

  // ---------------------------------------------------------------------------
  // EVENTING-SPECIFIC
  // ---------------------------------------------------------------------------
  {
    content:
      "Cross country schooling day! My OTTB was bold as brass through the water complex. So proud of this horse.",
    tags: ["eventing", "training"],
    disciplines: ["eventing"],
    category: "eventing",
  },
  {
    content:
      "Dressage phase is always our weakest link. Spending this week on nothing but flatwork to bring up our test scores.",
    tags: ["eventing", "dressage", "training"],
    disciplines: ["eventing"],
    category: "eventing",
  },
  {
    content:
      "Walked the cross country course for our upcoming event. The terrain is challenging but the jumps are fair. Feeling cautiously optimistic.",
    tags: ["eventing", "competition"],
    disciplines: ["eventing"],
    category: "eventing",
  },
  {
    content:
      "Fitness day — long trot sets and canter intervals. Eventing horses need to be proper athletes.",
    tags: ["eventing", "training"],
    disciplines: ["eventing"],
    category: "eventing",
  },
  {
    content:
      "My horse saw a ditch for the first time today. There was a moment of 'absolutely not' followed by a brave leap. Heart is full.",
    tags: ["eventing", "training"],
    disciplines: ["eventing"],
    category: "eventing",
  },
  {
    content:
      "Show jumping after cross country is all about recovery and ridability. Working on our adjustability at home so it's second nature by show day.",
    tags: ["eventing", "jumping", "training"],
    disciplines: ["eventing"],
    category: "eventing",
  },
  {
    content:
      "Working on our gallop position. Lighter seat, longer stirrups, steady hands. Harder than it looks.",
    tags: ["eventing", "training"],
    disciplines: ["eventing"],
    category: "eventing",
  },
  {
    content:
      "Eventing is three sports in one and I love every exhausting minute of it.",
    tags: ["eventing"],
    disciplines: ["eventing"],
    category: "eventing",
  },
  {
    content:
      "Schooling banks and drops today. Confidence building for both horse and rider.",
    tags: ["eventing", "training"],
    disciplines: ["eventing"],
    category: "eventing",
  },
  {
    content:
      "Dressage in the morning, jumping in the afternoon. Just another day as an eventer.",
    tags: ["eventing", "training"],
    disciplines: ["eventing"],
    category: "eventing",
  },
  {
    content:
      "The trust an event horse puts in their rider at the top of a drop fence is incredible. Don't take it for granted.",
    tags: ["eventing", "mindset"],
    disciplines: ["eventing"],
    category: "eventing",
  },
  {
    content:
      "XC schooling video from today is equal parts screaming and laughing. Wouldn't trade this sport for anything.",
    tags: ["eventing"],
    disciplines: ["eventing"],
    category: "eventing",
  },

  // ---------------------------------------------------------------------------
  // WESTERN-SPECIFIC
  // ---------------------------------------------------------------------------
  {
    content:
      "Barrel practice today. Shaved half a second off our time by fixing my approach to the second barrel.",
    tags: ["western", "competition"],
    disciplines: ["western"],
    category: "western",
  },
  {
    content:
      "Reining pattern work this morning. Sliding stops are getting longer and I'm here for it.",
    tags: ["western", "training"],
    disciplines: ["western"],
    category: "western",
  },
  {
    content:
      "Nothing beats a good trail ride on a quiet morning. Just me, my horse, and the sunrise.",
    tags: ["western", "trail-riding"],
    disciplines: ["western"],
    category: "western",
  },
  {
    content:
      "Western pleasure class went well yesterday. My mare was relaxed and the lope departures were smooth.",
    tags: ["western", "competition"],
    disciplines: ["western"],
    category: "western",
  },
  {
    content:
      "Working cattle today. My cow horse lit up the second he saw them. This is what he was born to do.",
    tags: ["western", "training"],
    disciplines: ["western"],
    category: "western",
  },
  {
    content:
      "Spent the afternoon on ranch work. Checking fences and moving cattle. Best office in the world.",
    tags: ["western"],
    disciplines: ["western"],
    category: "western",
  },
  {
    content:
      "Turnarounds are getting faster and more balanced. The key was slowing down to speed up.",
    tags: ["western", "training"],
    disciplines: ["western"],
    category: "western",
  },
  {
    content:
      "Long trot on the trail today. Building up endurance for the competitive trail season.",
    tags: ["western", "trail-riding"],
    disciplines: ["western"],
    category: "western",
  },
  {
    content:
      "My horse's stop is getting so much better. Planted and smooth instead of braced and choppy.",
    tags: ["western", "training"],
    disciplines: ["western"],
    category: "western",
  },
  {
    content:
      "Neck reining practice. My horse is so light now I barely have to think about the direction and he's already there.",
    tags: ["western", "training"],
    disciplines: ["western"],
    category: "western",
  },

  // ---------------------------------------------------------------------------
  // TRAIL RIDING
  // ---------------------------------------------------------------------------
  {
    content:
      "Found a new trail today that goes through a creek crossing and up a ridge. The views at the top were unreal.",
    tags: ["trail-riding"],
    disciplines: ["western"],
    category: "trail-riding",
  },
  {
    content:
      "Group trail ride with the barn this weekend. Eight horses, perfect weather, and lots of laughs.",
    tags: ["trail-riding"],
    disciplines: ["western"],
    category: "trail-riding",
  },
  {
    content:
      "My horse spotted a deer on the trail and handled it like a champ. He would have spooked at that a year ago. Progress.",
    tags: ["trail-riding", "training"],
    disciplines: ["western"],
    category: "trail-riding",
  },
  {
    content:
      "Packed a lunch and rode out for four hours today. Sometimes you just need to disconnect.",
    tags: ["trail-riding"],
    disciplines: ["western"],
    category: "trail-riding",
  },
  {
    content:
      "Night ride under the full moon last weekend. Magical doesn't even begin to describe it.",
    tags: ["trail-riding"],
    disciplines: ["western"],
    category: "trail-riding",
  },
  {
    content:
      "Bridge training on the trail paid off today. Crossed a wooden bridge without a single hesitation.",
    tags: ["trail-riding", "training"],
    disciplines: ["western"],
    category: "trail-riding",
  },
  {
    content:
      "Mountain trail ride this weekend. The elevation changes are great exercise for both horse and rider.",
    tags: ["trail-riding"],
    disciplines: ["western"],
    category: "trail-riding",
  },
  {
    content:
      "Trail riding in fall is peak equestrian experience. The colors, the crisp air, the sound of hooves on leaves.",
    tags: ["trail-riding"],
    disciplines: ["western"],
    category: "trail-riding",
  },
  {
    content:
      "Exploring new trails keeps things fresh for both me and my horse. Routine is the enemy of engagement.",
    tags: ["trail-riding", "mindset"],
    disciplines: ["western"],
    category: "trail-riding",
  },
  {
    content:
      "Packed a saddle bag for the first time for a long ride. Game changer for water and snacks on the go.",
    tags: ["trail-riding"],
    disciplines: ["western"],
    category: "trail-riding",
  },

  // ---------------------------------------------------------------------------
  // COMMUNITY / SOCIAL (universal)
  // ---------------------------------------------------------------------------
  {
    content:
      "Shoutout to everyone at the barn who helps each other. This sport is better together.",
    tags: [],
    disciplines: [],
    category: "community",
  },
  {
    content:
      "Just watched my friend's kid ride for the first time. The pure joy on her face reminded me why we all started.",
    tags: [],
    disciplines: [],
    category: "community",
  },
  {
    content:
      "Barn potluck this weekend was exactly what we all needed. Good food, good people, good horses.",
    tags: [],
    disciplines: [],
    category: "community",
  },
  {
    content:
      "To whoever left cookies in the tack room with a 'happy riding' note — you made my whole week.",
    tags: [],
    disciplines: [],
    category: "community",
  },
  {
    content:
      "Took a lesson kid on a trail ride today as a reward for her hard work. Seeing the world through beginner eyes again is special.",
    tags: ["trail-riding"],
    disciplines: [],
    category: "community",
  },
  {
    content:
      "This community is so supportive. Posted about a rough ride last week and got so many kind messages. Thank you all.",
    tags: [],
    disciplines: [],
    category: "community",
  },
  {
    content:
      "Helped a new boarder settle in their horse today. The equestrian community at its best.",
    tags: ["horse-care"],
    disciplines: [],
    category: "community",
  },

  // ---------------------------------------------------------------------------
  // GENERAL / LIFESTYLE (universal)
  // ---------------------------------------------------------------------------
  {
    content:
      "Early morning rides before the world wakes up hit different. Just the barn sounds and fresh air.",
    tags: [],
    disciplines: [],
    category: "lifestyle",
  },
  {
    content:
      "Rainy day means tack cleaning day. There's something meditative about conditioning leather.",
    tags: ["horse-care"],
    disciplines: [],
    category: "lifestyle",
  },
  {
    content:
      "My horse yawned in my face today and I've never felt more loved. Gross, but loved.",
    tags: [],
    disciplines: [],
    category: "lifestyle",
  },
  {
    content:
      "Watching my horse roll in the arena right after a bath. Every single time. EVERY time.",
    tags: [],
    disciplines: [],
    category: "lifestyle",
  },
  {
    content:
      "The bond between a horse and rider is built in all the quiet moments. Not just the big ones.",
    tags: ["mindset"],
    disciplines: [],
    category: "lifestyle",
  },
  {
    content:
      "Sunset ride tonight was exactly what I needed after a long week. Horses are the best therapy.",
    tags: [],
    disciplines: [],
    category: "lifestyle",
  },
  {
    content:
      "Three years ago I couldn't even tack up by myself. Today I'm entering my first show. Crazy how things change.",
    tags: ["competition", "mindset"],
    disciplines: [],
    category: "lifestyle",
  },
  {
    content:
      "My non-horsey friends don't understand why I wake up at 5am on weekends. I wouldn't trade it for anything.",
    tags: [],
    disciplines: [],
    category: "lifestyle",
  },
  {
    content:
      "New boots arrived today. That new leather smell is dangerous for the wallet.",
    tags: [],
    disciplines: [],
    category: "lifestyle",
  },
  {
    content:
      "Horses teach you patience, humility, and resilience. Also how to do laundry, because everything smells like horse.",
    tags: ["mindset"],
    disciplines: [],
    category: "lifestyle",
  },
];
