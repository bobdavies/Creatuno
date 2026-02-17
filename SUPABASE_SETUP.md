# Supabase Setup Guide for Creatuno

This guide will help you set up Supabase for the Creatuno application.

## Step 1: Create a Supabase Project

1. Go to [https://supabase.com](https://supabase.com)
2. Click **"Start your project"** (sign in with GitHub if needed)
3. Click **"New Project"**
4. Fill in the details:
   - **Organization**: Select or create one
   - **Project Name**: `creatuno` (or your preferred name)
   - **Database Password**: Generate a strong password (SAVE THIS!)
   - **Region**: Choose the closest to your users (e.g., `West US` or `Central EU`)
5. Click **"Create new project"**
6. Wait 1-2 minutes for the project to be created

## Step 2: Get Your API Keys

Once your project is ready:

1. Click **"Settings"** (gear icon) in the left sidebar
2. Click **"API"** under Project Settings
3. You'll see two important keys:
   - **Project URL**: `https://xxxxx.supabase.co`
   - **anon public key**: `eyJhbGciOiJIUzI1NiIs...`
   - **service_role key**: `eyJhbGciOiJIUzI1NiIs...` (click "Reveal" to see it)

## Step 3: Update Your Environment Variables

Open your `.env.local` file and update these values:

```env
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here
```

**Replace** the placeholder values with your actual keys from Step 2.

## Step 4: Create the Database Schema

1. In your Supabase dashboard, click **"SQL Editor"** in the left sidebar
2. Click **"New Query"**
3. Open the file `supabase/migrations/001_initial_schema.sql` from your project
4. Copy ALL the SQL code from that file
5. Paste it into the SQL Editor
6. Click **"Run"** (or press Ctrl+Enter)
7. You should see: `"Creatuno database schema created successfully!"`

## Step 5: Set Up Storage Buckets

1. Stay in the SQL Editor
2. Click **"New Query"**
3. Open the file `supabase/migrations/002_storage_setup.sql` from your project
4. Copy ALL the SQL code from that file
5. Paste it into the SQL Editor
6. Click **"Run"**
7. You should see: `"Storage buckets and policies created successfully!"`

## Step 6: Verify the Setup

### Check Tables
1. Click **"Table Editor"** in the left sidebar
2. You should see these tables:
   - `profiles`
   - `portfolios`
   - `projects`
   - `posts`
   - `comments`
   - `likes`
   - `mentorship_requests`
   - `mentorships`
   - `opportunities`
   - `applications`
   - `transactions`
   - `notifications`

### Check Storage
1. Click **"Storage"** in the left sidebar
2. You should see these buckets:
   - `portfolio-images`
   - `avatars`
   - `post-images`
   - `opportunity-attachments`

## Step 7: Test the Connection

1. Restart your development server:
   ```bash
   npm run dev
   ```

2. Open the app at `http://localhost:3000`
3. The sync indicator in the header should now work without errors
4. Try creating a portfolio - it should sync to Supabase

## Troubleshooting

### "Invalid API key" error
- Double-check that you copied the full API keys without extra spaces
- Make sure you're using the `anon` key for `NEXT_PUBLIC_SUPABASE_ANON_KEY`

### "Permission denied" error
- The RLS policies might not be set up correctly
- Re-run the SQL migration files in the SQL Editor

### "Table not found" error
- The schema migration might not have run completely
- Check the SQL Editor for any error messages
- Re-run the `001_initial_schema.sql` file

### Storage upload fails
- Check that the `002_storage_setup.sql` migration ran successfully
- Verify the storage buckets exist in the Storage section

## Database Schema Overview

### Tables Created

| Table | Purpose |
|-------|---------|
| `profiles` | User profiles linked to Clerk auth |
| `portfolios` | Creative portfolios |
| `projects` | Projects within portfolios |
| `posts` | Village Square community posts |
| `comments` | Comments on posts |
| `likes` | Likes on posts |
| `mentorship_requests` | Mentorship requests between users |
| `mentorships` | Active mentorship relationships |
| `opportunities` | Job, gig, and investment listings |
| `applications` | Applications to opportunities |
| `transactions` | Payment transactions |
| `notifications` | User notifications |

### Storage Buckets Created

| Bucket | Purpose | Max Size |
|--------|---------|----------|
| `portfolio-images` | Project images | 5MB |
| `avatars` | Profile pictures | 2MB |
| `post-images` | Village Square post images | 5MB |
| `opportunity-attachments` | Job posting attachments | 10MB |

## Next Steps

After setting up Supabase:

1. **Set up Stripe** (optional) - for payments
2. **Configure webhooks** - for real-time updates
3. **Set up email notifications** - using Supabase Edge Functions

## Need Help?

- [Supabase Documentation](https://supabase.com/docs)
- [Supabase Discord](https://discord.supabase.com)
- Check the project's README for more information
