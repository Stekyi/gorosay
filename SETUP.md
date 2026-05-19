# Gorosay — Setup Guide

## What You Need to Create (Free Accounts)

1. **Neon (Database)** — https://neon.tech
   - Create account → New Project → Copy the connection string

2. **Cloudflare R2 (File Storage)** — https://cloudflare.com
   - Create account → R2 → Create bucket named `gorosay-documents`
   - Go to Manage R2 API Tokens → Create token with Read & Write on your bucket
   - Note your Account ID, Access Key ID, and Secret Access Key

3. **Gmail App Password (Email)** — your Gmail account
   - Go to https://myaccount.google.com/security
   - Enable 2-Step Verification if not already on
   - Search "App passwords" → Create one called "Gorosay"
   - Copy the 16-character password

4. **Arkesel (SMS)** — https://arkesel.com (Ghana SMS provider)
   - Create account → Get API key
   - Register sender ID "GOROSAY" (takes 1-3 days to approve)

5. **Vercel (Hosting)** — https://vercel.com
   - Create account → Import your GitHub repository

---

## First-Time Setup Steps

### Step 1: Copy environment file
```
cp .env.example .env.local
```
Fill in all values in `.env.local`

### Step 2: Set up database
```
npm run db:push
```
This creates all tables in your Neon database.

### Step 3: Seed initial data
```
npm run db:seed
```
This adds Ghana cities, document types (Motor Insurance, Road Worthy, etc.), and default settings.

### Step 4: Create your first admin user
Run this in the Neon SQL console or with `npm run db:studio`:
```sql
INSERT INTO staff_users (name, email, password_hash, role)
VALUES (
  'Your Name',
  'your-email@gmail.com',
  '$2b$10$YOUR_BCRYPT_HASH',  -- generate at: https://bcrypt-generator.com
  'ADMIN'
);
```

Or use the helper script:
```
npx tsx src/lib/db/create-admin.ts your-email@gmail.com "your-password" "Your Name"
```

### Step 5: Run locally
```
npm run dev
```
Open http://localhost:3000

### Step 6: Deploy to Vercel
1. Push code to GitHub
2. Connect repo in Vercel dashboard
3. Add all environment variables from `.env.local` in Vercel → Settings → Environment Variables
4. Deploy

---

## Pricing (all configurable in Admin Settings)

| Service | Default |
|---|---|
| New vehicle package | GHC 50 |
| New driver license management | GHC 15 |
| Renewal document upload | GHC 20 |

Change these anytime in the Admin panel without redeploying.

---

## SMS Setup in Admin Panel

Go to Admin → SMS Gateway and enter:
- **Provider**: arkesel (or mnotify)
- **API Key**: your Arkesel API key
- **Sender ID**: GOROSAY (must match your registered sender ID)

---

## Email Setup in Admin Panel

Go to Admin → Email and enter:
- **Gmail Address**: asamoahtekyi@gmail.com
- **App Password**: the 16-char password from Google
- **Sender Name**: Gorosay

---

## Notification Schedule

Default: alerts sent **5 days before** and **1 day before** each expiry/renewal date.
Change in Admin → Notification Schedule → "5,1"

Alerts run automatically every day at 8:00 AM Ghana time via Vercel Cron.

---

## Database Management

```bash
npm run db:studio    # Browse all data in a web UI
npm run db:push      # Apply schema changes to production
npm run db:generate  # Generate migration files
```
