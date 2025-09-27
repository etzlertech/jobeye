# Migration Order for Voice-Vision System

Run these SQL files in your Supabase SQL Editor in this exact order:

## 1. First - Check what exists

```sql
-- Run this to see what tables you already have
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_type = 'BASE TABLE'
ORDER BY table_name;
```

## 2. Choose your base tables approach

### Option A: If you have NO existing tables
Run: `000_create_base_tables.sql`
- Creates fresh companies, customers, properties tables

### Option B: If you already have a 'tenants' table
Run: `000_create_base_tables_using_tenants.sql`
- Uses existing tenants table
- Creates companies as a view

### Option C: If you already have companies/tenants/customers
Skip to step 3

## 3. Create profiles table
Run: `000_setup_profiles_table.sql`
- Links auth.users to your app
- Required for RLS policies

## 4. Finally - Voice-Vision tables
Run: `2025-10-voice-vision-p0-supabase-compliant.sql`
- Creates all voice/vision tables
- Sets up proper RLS

## Quick Check Script

After each migration, run this to verify:

```sql
-- Check if migration succeeded
SELECT COUNT(*) as table_count, 
       STRING_AGG(table_name, ', ') as tables
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_type = 'BASE TABLE';
```

## If you get errors:

1. "relation companies does not exist" - Run step 2 first
2. "relation profiles does not exist" - Run step 3 first
3. "permission denied for schema auth" - Use the supabase-compliant version
4. Any other error - Check which tables exist and adjust accordingly