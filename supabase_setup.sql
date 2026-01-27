
-- 1. Create the Projects Table
CREATE TABLE IF NOT EXISTS public.projects (
    id TEXT PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    dataset_id TEXT NOT NULL,
    cells JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- 2. Enable Row Level Security
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;

-- 3. Comprehensive RLS Policy for Projects
-- This allows authenticated users to perform all actions on their own rows.
DROP POLICY IF EXISTS "Users can manage their own projects" ON public.projects;
CREATE POLICY "Users can manage their own projects" 
ON public.projects FOR ALL 
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- 4. Storage Setup
-- REQUIRED: You must manually go to Supabase Dashboard -> Storage and create a bucket named 'datasets'.
-- Set the bucket to 'Private'.

-- Allow authenticated users to manage their folder within 'datasets' bucket.
-- Folder structure is assumed to be {auth.uid()}/...
DROP POLICY IF EXISTS "Users can manage their datasets" ON storage.objects;
CREATE POLICY "Users can manage their datasets"
ON storage.objects FOR ALL
TO authenticated
USING (
  bucket_id = 'datasets' AND 
  (storage.foldername(name))[1] = auth.uid()::text
)
WITH CHECK (
  bucket_id = 'datasets' AND 
  (storage.foldername(name))[1] = auth.uid()::text
);
