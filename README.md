# Equinti

A platform for equestrians to connect, learn, and participate in events.

## Features

- **Social Community**: Share posts, follow other riders, like and comment
- **Events Hub**: Discover and RSVP to clinics, shows, and meetups
- **Challenges**: Structured courses with gated progression and submissions
- **Role-Based Access**: Riders, Trainers, and Admins with different capabilities

## Tech Stack

- **Framework**: Next.js 14 with App Router
- **Language**: TypeScript
- **Styling**: Tailwind CSS + shadcn/ui
- **Database**: Supabase (PostgreSQL)
- **Auth**: Supabase Auth
- **Storage**: Supabase Storage
- **Data Fetching**: TanStack Query
- **Forms**: React Hook Form + Zod

## Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn
- Supabase account

### Setup

1. Clone the repository

2. Install dependencies:
   ```bash
   npm install
   ```

3. Create a Supabase project at [supabase.com](https://supabase.com)

4. Copy `.env.example` to `.env.local` and fill in your Supabase credentials:
   ```bash
   cp .env.example .env.local
   ```

5. Run database migrations:
   ```bash
   # Install Supabase CLI
   npm install -g supabase

   # Link to your project
   supabase link --project-ref YOUR_PROJECT_REF

   # Push migrations
   supabase db push

   # (Optional) Seed with test data
   supabase db seed
   ```

6. Start the development server:
   ```bash
   npm run dev
   ```

7. Open [http://localhost:3000](http://localhost:3000)

## Project Structure

```
src/
├── app/                    # Next.js App Router
│   ├── (auth)/             # Auth routes (login, signup, onboarding)
│   ├── (main)/             # Authenticated routes
│   │   ├── feed/           # Social feed
│   │   ├── events/         # Events hub
│   │   ├── challenges/     # Challenges system
│   │   ├── profile/        # User profiles
│   │   └── settings/       # User settings
│   ├── admin/              # Admin dashboard
│   ├── trainer/            # Trainer tools
│   └── api/                # API routes
├── components/
│   ├── ui/                 # shadcn/ui components
│   ├── feed/               # Feed components
│   ├── events/             # Event components
│   ├── challenges/         # Challenge components
│   └── shared/             # Shared components
├── lib/
│   ├── supabase/           # Supabase clients
│   ├── validations/        # Zod schemas
│   ├── permissions/        # Role checks
│   └── uploads/            # File upload utilities
├── hooks/                  # Custom React hooks
├── types/                  # TypeScript types
└── services/               # Future AI/sensor/AR stubs
```

## User Roles

- **Rider**: Default role. Can create posts, join events, enroll in challenges
- **Trainer**: Can create and host events (requires admin approval)
- **Admin**: Full access to manage users, moderate content, create challenges

## Test Accounts (Seed Data)

When using the seed data, these accounts are available:

| Email | Password | Role |
|-------|----------|------|
| admin@equinti.com | password123 | Admin |
| trainer@equinti.com | password123 | Trainer (approved) |
| rider1@equinti.com | password123 | Rider |
| rider2@equinti.com | password123 | Rider |
| rider3@equinti.com | password123 | Rider |

## Future Roadmap

The architecture is designed to support:

- **AI Coaching**: Personalized training recommendations
- **Sensor Integration**: Real-time riding metrics
- **AR Features**: Augmented reality training experiences

Service stubs are located in `src/services/` for future implementation.

## License

Private - All rights reserved
