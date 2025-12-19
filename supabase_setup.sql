-- Run this in your Supabase SQL Editor

-- 1. Add Telegram columns to profiles table
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS telegram_username TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS telegram_chat_id TEXT;

-- 2. (Optional) Create an index for faster lookup if you plan to search by chat_id
CREATE INDEX IF NOT EXISTS idx_profiles_telegram_chat_id ON profiles(telegram_chat_id);
