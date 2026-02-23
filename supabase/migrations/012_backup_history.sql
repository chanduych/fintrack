-- Create backup_history table to track automatic backups
CREATE TABLE IF NOT EXISTS backup_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  backup_path TEXT NOT NULL,
  backup_type TEXT NOT NULL DEFAULT 'auto', -- 'auto' or 'manual'
  file_count INTEGER DEFAULT 0,
  borrowers_count INTEGER DEFAULT 0,
  loans_count INTEGER DEFAULT 0,
  payments_count INTEGER DEFAULT 0,
  status TEXT DEFAULT 'success', -- 'success', 'partial', 'failed'
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_backup_history_user_id ON backup_history(user_id);
CREATE INDEX IF NOT EXISTS idx_backup_history_created_at ON backup_history(created_at DESC);

-- Enable RLS
ALTER TABLE backup_history ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view their own backup history"
  ON backup_history
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own backup records"
  ON backup_history
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own backup history"
  ON backup_history
  FOR DELETE
  USING (auth.uid() = user_id);

-- Create storage bucket for backups
INSERT INTO storage.buckets (id, name, public)
VALUES ('fintrack-backups', 'fintrack-backups', false)
ON CONFLICT (id) DO NOTHING;

-- Create storage policies
CREATE POLICY "Users can upload their own backups"
  ON storage.objects
  FOR INSERT
  WITH CHECK (
    bucket_id = 'fintrack-backups' AND
    auth.uid()::text = (string_to_array(name, '/'))[2]
  );

CREATE POLICY "Users can view their own backups"
  ON storage.objects
  FOR SELECT
  USING (
    bucket_id = 'fintrack-backups' AND
    auth.uid()::text = (string_to_array(name, '/'))[2]
  );

CREATE POLICY "Users can delete their own backups"
  ON storage.objects
  FOR DELETE
  USING (
    bucket_id = 'fintrack-backups' AND
    auth.uid()::text = (string_to_array(name, '/'))[2]
  );

-- Comment on table
COMMENT ON TABLE backup_history IS 'Tracks automatic and manual backups stored in Supabase Storage';
