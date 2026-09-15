# Urban Company — QuickRebook Platform

A full-stack on-demand home service booking and scheduling platform inspired by Urban Company. Built with **Next.js 16 (App Router)**, **Prisma 8 (Prisma Next)**, and **PostgreSQL**.

---

## Tech Stack

- **Framework**: Next.js 16 (Turbopack, App Router, Server Components & Route Handlers)
- **Data Layer**: Prisma 8 (`@prisma/orm-postgres`, contract-first schema, PSL contract)
- **Database**: PostgreSQL with advisory transaction locks and partial unique indexing
- **Authentication**: Salted scrypt password hashing + HMAC-SHA256 JWT sessions (HTTP-only cookies)
- **Styling**: Vanilla CSS Design System with custom properties, responsive grid, DM Sans & Playfair Display
- **Testing**: Vitest with `@testing-library/react` and `happy-dom` (70+ automated tests)

---

## Prerequisites

- **Node.js**: v20.x or higher
- **PostgreSQL**: v14 or higher (or cloud provider like Neon, Supabase, Railway)
- **npm** or **pnpm**

---

## Local Development Setup

### 1. Clone & Install Dependencies

```bash
git clone https://github.com/aryatiwari124/SW2627-Nextjs-urbancompany.git
cd SW2627-Nextjs-urbancompany
npm install
```

### 2. Configure Environment Variables

Create a `.env` file in the root directory:

```env
DATABASE_URL="postgresql://postgres:password@localhost:5432/urban_company?schema=public"
AUTH_SECRET="urban-company-super-secret-session-key-2026"
```

### 3. Database Migration & Seeding

```bash
# 1. Emit the Prisma 8 contract
npm run contract:emit

# 2. Push contract schema changes to PostgreSQL
npx prisma db update

# 3. Seed demo accounts, completed bookings, and test data
npm run db:seed
```

### 4. Start the Application

```bash
# Run local development server
npm run dev

# Or build and run production server
npm run build
npm run start
```

Visit `http://localhost:3000` (or `http://localhost:3000/login`).

---

## Demo Test Accounts

All demo accounts use password: `password123`

| Role | Name | Email | Password |
| :--- | :--- | :--- | :--- |
| **Customer** | Ananya Sharma | `ananya@gmail.com` | `password123` |
| **Customer** | Arya Kumar | `arya@gmail.com` | `password123` |
| **Professional** | Priya S. | `priya@gmail.com` | `password123` |
| **Professional** | Rahul M. | `rahul@gmail.com` | `password123` |
| **Professional** | Amit K. | `amit@gmail.com` | `password123` |

---

## Automated Test Suite

Run the full automated test suite (unit, route integration, concurrency, and component tests):

```bash
npm test
```

For live watch mode:
```bash
npm run test:watch
```

---

## Deployment Checklist (Vercel / Cloud)

Set these environment variables in your hosting dashboard (e.g. Vercel Settings → Environment Variables):

| Variable | Description | Example |
| :--- | :--- | :--- |
| `DATABASE_URL` | Pooled/Direct PostgreSQL connection string | `postgresql://user:pass@ep-xyz.neon.tech/neondb?sslmode=require` |
| `AUTH_SECRET` | 32+ character random secret for JWT signing | `random-32-character-secret-key-here` |
| `NODE_ENV` | Environment mode | `production` |
