# Deployment & Data Setup Guide

This guide covers deploying **Ledgelog** to Vercel and managing data in Supabase.

## Table of Contents

1. [Deploy to Vercel](#deploy-to-vercel)
2. [Add Data to Supabase](#add-data-to-supabase)
3. [Environment Variables](#environment-variables)
4. [Post-Deployment Checklist](#post-deployment-checklist)

---

## Deploy to Vercel

### Prerequisites

- A [Vercel](https://vercel.com) account
- The GitHub repository connected to Vercel (or deploy manually)
- Supabase project already set up with SQL scripts run (see [`supabase/README.md`](./supabase/README.md))

### Option 1: Deploy via GitHub (Recommended)

1. **Connect your repository to Vercel**
   - Go to [https://vercel.com/new](https://vercel.com/new)
   - Select "Import Git Repository"
   - Authorize Vercel to access your GitHub account
   - Select the `Expense-Tracker` repository

2. **Configure environment variables**
   - In the Vercel import screen, under "Environment Variables", add:
     ```
     VITE_SUPABASE_URL=https://your-project-ref.supabase.co
     VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
     ```
   - Get these values from: **Supabase Dashboard → Project Settings → API Keys**
   - Use the **publishable key** (public), never the secret key

3. **Deploy**
   - Click "Deploy"
   - Vercel will build and deploy automatically
   - Your app will be live at `https://your-project-name.vercel.app`

### Option 2: Deploy via Vercel CLI

1. **Install Vercel CLI**
   ```bash
   npm install -g vercel
   ```

2. **Deploy from project directory**
   ```bash
   vercel
   ```

3. **Follow the prompts**
   - Confirm the project name
   - Confirm the build settings (should auto-detect Vite)
   - Add environment variables when prompted

### Option 3: Manual Deployment

1. **Build the app**
   ```bash
   npm install
   npm run build
   ```

2. **Deploy the `dist/` folder**
   - Upload the contents of `dist/` to Vercel as a static site
   - Or use the Vercel dashboard to upload directly

---

## Add Data to Supabase

### Option 1: Use the Seed Script (Fastest)

The included `03_seed_data.sql` contains sample data for immediate testing:

1. **Find your user UUID**
   - In Supabase Dashboard → **Authentication → Users**
   - Click on your email and copy the **User UID**

2. **Update the seed file**
   - Open [`supabase/03_seed_data.sql`](./supabase/03_seed_data.sql)
   - Find line ~20: `uid UUID := 'REPLACE_WITH_YOUR_USER_UUID';`
   - Replace `REPLACE_WITH_YOUR_USER_UUID` with your UUID

3. **Run the seed script**
   - Go to **Supabase Dashboard → SQL Editor → New Query**
   - Paste the contents of `03_seed_data.sql`
   - Click "Run"

4. **What gets created**
   - 5 bank accounts (Checking, Savings, Credit Card, etc.)
   - 14 spending categories (Groceries, Transport, Rent, etc.)
   - 8 monthly budgets
   - 52 sample transactions
   - 3 IOUs (money lent/borrowed)
   - 6 recurring transactions (weekly, monthly, yearly)
   - 3 saved filter views

### Option 2: Add Data Through the App UI

Once the app is deployed, you can add data directly in the browser:

#### Add an Account
1. Open the app → **Accounts** tab
2. Click "+ New Account"
3. Fill in:
   - **Name** (e.g., "My Checking")
   - **Type** (Checking, Savings, Credit Card, Investment, Loan)
   - **Opening Balance** (starting amount)
   - **Currency** (USD, EUR, GBP, etc.)
   - **Color** (optional, for UI)
4. Click "Create" — the balance is calculated automatically

#### Add a Spending Category (Tag)
1. Open the app → **Tags** tab
2. Click "+ New Tag"
3. Fill in:
   - **Name** (e.g., "Groceries", "Transport")
   - **Color** (for charts and organization)
4. Click "Create"

#### Add a Transaction
1. Open the app → **Transactions** tab
2. Click "+ New Transaction"
3. Fill in:
   - **Date** (when the transaction occurred)
   - **Type** (Expense, Income, Transfer)
   - **From/To** (account or counterparty)
   - **Amount** (in transaction currency)
   - **Tags** (optional, for categorization)
   - **Notes** (optional memo)
4. Click "Save" — the account balance updates automatically

#### Set a Budget
1. Open the app → **Budgets** tab
2. Click "+ New Budget"
3. Fill in:
   - **Category** (select a tag, e.g., "Groceries")
   - **Limit** (e.g., $500/month)
   - **Month** (starts next month)
4. Click "Create" — spending is tracked in real-time

### Option 3: Bulk Import via CSV

1. **Prepare a CSV file** with columns:
   ```
   date,type,from_account,to_account,amount,currency,tags,notes
   2025-01-15,Expense,Checking,Groceries,45.50,USD,Groceries,Weekly shop
   2025-01-16,Income,Employer,Checking,2500.00,USD,Salary,Monthly salary
   ```

2. **Import in the app**
   - Open the app → **Settings → Import Transactions**
   - Upload your CSV file
   - Review the preview
   - Click "Import" — transactions are added with account balances updated

3. **CSV Format**
   - Must include: `date`, `type`, `from_account`, `to_account`, `amount`, `currency`
   - Optional: `tags`, `notes`, `tx_type`
   - Dates must be `YYYY-MM-DD` format

---

## Environment Variables

### For Development

Copy `.env.example` to `.env`:

```bash
cp .env.example .env
```

Fill in your Supabase credentials:

```env
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
```

### For Vercel

Set environment variables in Vercel Dashboard:

1. **Go to your project** → **Settings → Environment Variables**
2. **Add two variables:**
   - `VITE_SUPABASE_URL` = `https://your-project-ref.supabase.co`
   - `VITE_SUPABASE_PUBLISHABLE_KEY` = your publishable key
3. **Redeploy** (Vercel will rebuild with new env vars)

### Security Notes

- ✅ Use the **publishable key** (public, safe to expose)
- ❌ Never use the **secret key** (private, for backend only)
- ❌ Never commit `.env` to git (it's in `.gitignore`)
- ✅ Environment variables in Vercel are encrypted at rest

---

## Post-Deployment Checklist

After deploying to Vercel and adding data to Supabase:

- [ ] **Test sign-up**: Create a new account in the deployed app
- [ ] **Verify data appears**: Seed data or manually added data shows in the app
- [ ] **Test transactions**: Add a transaction and confirm the account balance updates
- [ ] **Check RLS policies**: Sign in as a different user and verify they cannot see other users' data
- [ ] **Test recurring transactions**: Check that recurring transactions are created on next app load
- [ ] **Test currency conversion**: If using multi-currency, verify FX rates are fetched
- [ ] **Monitor Vercel**: Check **Vercel Dashboard → Analytics** for errors
- [ ] **Monitor Supabase**: Check **Supabase → Statistics** for database usage

---

## Troubleshooting

### App shows no data after deploying
- **Check environment variables** in Vercel are set correctly
- **Verify Supabase project is running** (check Supabase Dashboard → Status)
- **Confirm the publishable key is correct** (not the secret key)
- **Clear browser cache** and reload

### "Database connection refused" error
- **Check the Supabase URL** is correct (should include `.supabase.co`)
- **Verify the publishable key** matches your project
- **Check RLS policies** haven't been too restrictive (see `02_rls_policies.sql`)

### Seed data won't import
- **Confirm you replaced the UUID** in `03_seed_data.sql` (line ~20)
- **Check the UUID is valid** (format should be `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`)
- **Run the SQL files in order** (01 → 05) before running seed data

### Transactions not updating account balance
- **Verify the balance trigger** was installed (run `05_hardening.sql`)
- **Check for errors** in Supabase → SQL Editor query results
- **Manually recalculate** balances using the `v_net_worth` view

---

## More Info

- **Supabase setup**: See [`supabase/README.md`](./supabase/README.md)
- **Environment variables**: See [`.env.example`](./.env.example)
- **Vercel docs**: [https://vercel.com/docs](https://vercel.com/docs)
- **Supabase docs**: [https://supabase.com/docs](https://supabase.com/docs)
