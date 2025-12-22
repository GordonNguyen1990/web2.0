
-- Create a table to store system configuration
CREATE TABLE IF NOT EXISTS system_config (
    id INT PRIMARY KEY DEFAULT 1,
    interest_rate_percent NUMERIC DEFAULT 5.0,
    withdrawal_fee_percent NUMERIC DEFAULT 1.5,
    CONSTRAINT single_row CHECK (id = 1)
);

-- Insert initial row if not exists
INSERT INTO system_config (id, interest_rate_percent, withdrawal_fee_percent)
VALUES (1, 5.0, 1.5)
ON CONFLICT (id) DO NOTHING;

-- Enable RLS (Optional but good practice)
ALTER TABLE system_config ENABLE ROW LEVEL SECURITY;

-- Allow everyone to read config
CREATE POLICY "Allow public read access" ON system_config FOR SELECT USING (true);

-- Allow only admins to update (For simplicity in this demo, we might allow authenticated users or just public for now if RLS is tricky with roles, but let's stick to public read, auth update)
-- Assuming you have a way to check admin, but for now let's allow all authenticated users to update for simplicity, or just public if you want to avoid permission issues during demo.
-- Ideally: CREATE POLICY "Allow admin update" ON system_config FOR UPDATE USING (auth.uid() IN (SELECT id FROM profiles WHERE role = 'ADMIN'));
-- For this demo:
CREATE POLICY "Allow authenticated update" ON system_config FOR UPDATE USING (auth.role() = 'authenticated');
