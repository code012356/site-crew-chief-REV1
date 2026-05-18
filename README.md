# Site Crew Chief REV1

Site Crew Chief REV1 is a construction site crew management system built with React, Vite, TypeScript, Tailwind CSS, shadcn/ui, and Supabase. It focuses on daily labor logs, equipment usage, foreman team assignment, work code management, review workflows, and operations reporting.

The app is designed for three main operational roles:

- **Admin**: manage accounts, personnel, engineers, work codes, equipment, and approvals.
- **Foreman**: manage assigned workers/equipment and submit daily logs.
- **Engineer**: review daily logs and equipment requests.

## Features

- **Authentication and account management**
  - Role-based login for admin, foreman, and engineer accounts.
  - Account approval workflow linked to personnel records.
  - Phone number support for approved accounts.

- **Personnel and team management**
  - Personnel records for workers, foremen, and engineers.
  - Foreman team assignment for workers and equipment.
  - Deduped assignment logic to reduce duplicated team membership.

- **Daily logs**
  - Labor and equipment daily log submission.
  - Local-date handling for log dates.
  - Required field validation for worker and equipment entries.
  - Review statuses including pending, approved, conditional, rejected, withdraw requested, and withdrawn.

- **Equipment management**
  - Equipment registry and status tracking.
  - Equipment request workflow for existing and new equipment.
  - Approved new equipment is created, assigned, and linked back to the request.
  - Equipment assignment is normalized so one equipment item belongs to one foreman team at a time.

- **Review and analytics**
  - Review page for engineer/admin actions.
  - Withdrawal review keeps structured previous status data.
  - Analytics dashboard for labor, equipment, and work-code based reporting.

- **Supabase database**
  - SQL migrations are included under `supabase/migrations`.
  - Data integrity migration adds role/status checks and uniqueness constraints for important fields.

## Tech Stack

- React 18
- TypeScript
- Vite
- Tailwind CSS
- shadcn/ui and Radix UI
- Supabase JavaScript client
- React Router
- TanStack Query
- Vitest
- ESLint

## Project Structure

```text
src/
  contexts/
    AppContext.tsx       # Authentication, accounts, and app-level data
    DataContext.tsx      # Personnel, teams, equipment, logs, and work codes
  pages/
    AccountManagePage.tsx
    AnalyticsPage.tsx
    DailyLogPage.tsx
    Dashboard.tsx
    EngineerManagePage.tsx
    EquipmentPage.tsx
    ForemanTeamPage.tsx
    LoginPage.tsx
    PersonnelPage.tsx
    ReviewPage.tsx
    WorkCodesPage.tsx
  lib/
    supabase.ts          # Supabase client
    types.ts             # Shared domain types
supabase/
  migrations/            # Database schema and data integrity migrations
```

## Requirements

- Node.js 18 or newer
- npm
- Supabase project
- Supabase CLI for database migration work

Install dependencies:

```bash
npm install
```

## Environment Variables

Create a `.env` file from `.env.example`:

```bash
cp .env.example .env
```

Fill in the Supabase values:

```env
VITE_SUPABASE_PROJECT_ID="your-supabase-project-id"
VITE_SUPABASE_URL="https://your-supabase-project.supabase.co"
VITE_SUPABASE_PUBLISHABLE_KEY="your-supabase-publishable-key"
```

Only use the Supabase **publishable** key in the frontend environment file. Do not commit secret keys or personal access tokens.

## Local Development

Start the development server:

```bash
npm run dev
```

Build for production:

```bash
npm run build
```

Preview the production build:

```bash
npm run preview
```

Run tests:

```bash
npm test
```

Run lint:

```bash
npm run lint
```

## Supabase Setup

This repository includes Supabase migrations. After installing dependencies, link the local project to a Supabase project:

```bash
npx supabase link --project-ref your-project-ref
```

Push migrations:

```bash
npx supabase db push
```

The migration set creates and updates the application tables used by the frontend. The latest integrity migration adds database-level constraints for common data quality issues, including role/status checks and uniqueness rules.

## Data Notes

- `team_assignments` stores assigned worker and equipment IDs for each foreman.
- Frontend logic normalizes equipment assignment so a piece of equipment is removed from other teams before being assigned to a new foreman.
- Some relationship fields are stored as text or JSON arrays in the existing schema, so not every relationship can be enforced as a traditional foreign key without a larger schema refactor.
- Row Level Security policies currently need a production hardening pass before handling sensitive real-world data.
- Account passwords are currently stored and checked through the application tables. For production use, migrate authentication to Supabase Auth or another secure password hashing/authentication flow.

## Deployment

The app is a standard Vite frontend and can be deployed to Vercel or any static hosting provider that supports environment variables.

Required production environment variables:

- `VITE_SUPABASE_PROJECT_ID`
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`

Build command:

```bash
npm run build
```

Output directory:

```text
dist
```

## Current Quality Status

- Production build passes.
- Basic Vitest test suite passes.
- ESLint currently reports existing type/style debt, mostly around `any`, empty interfaces, and React refresh warnings.
- Business data fixes have been added for equipment assignment, daily log validation, local date handling, phone-based account approval, withdrawal status recovery, and Supabase data integrity constraints.
