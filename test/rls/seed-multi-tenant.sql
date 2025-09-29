-- RLS Multi-Tenant Test Seed Data
-- Seeds two organizations and verifies row level security isolation

-- Clean up existing test data
DELETE FROM customers WHERE customer_number LIKE 'TEST-%';
DELETE FROM companies WHERE name LIKE 'Test Company %';

-- Create test companies/organizations
INSERT INTO companies (id, name, domain, is_active, created_at, updated_at) VALUES
  ('test-org-a', 'Test Company A', 'company-a.test', true, NOW(), NOW()),
  ('test-org-b', 'Test Company B', 'company-b.test', true, NOW(), NOW())
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  domain = EXCLUDED.domain,
  updated_at = NOW();

-- Create test customers for Org A
INSERT INTO customers (id, company_id, customer_number, name, phone, email, is_active, version, created_at, updated_at) VALUES
  ('test-cust-a1', 'test-org-a', 'TEST-A001', 'Customer A1', '+1-555-0101', 'customer.a1@test.com', true, 1, NOW(), NOW()),
  ('test-cust-a2', 'test-org-a', 'TEST-A002', 'Customer A2', '+1-555-0102', 'customer.a2@test.com', true, 1, NOW(), NOW()),
  ('test-cust-a3', 'test-org-a', 'TEST-A003', 'Customer A3', '+1-555-0103', 'customer.a3@test.com', true, 1, NOW(), NOW())
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  phone = EXCLUDED.phone,
  email = EXCLUDED.email,
  updated_at = NOW();

-- Create test customers for Org B  
INSERT INTO customers (id, company_id, customer_number, name, phone, email, is_active, version, created_at, updated_at) VALUES
  ('test-cust-b1', 'test-org-b', 'TEST-B001', 'Customer B1', '+1-555-0201', 'customer.b1@test.com', true, 1, NOW(), NOW()),
  ('test-cust-b2', 'test-org-b', 'TEST-B002', 'Customer B2', '+1-555-0202', 'customer.b2@test.com', true, 1, NOW(), NOW()),
  ('test-cust-b3', 'test-org-b', 'TEST-B003', 'Customer B3', '+1-555-0203', 'customer.b3@test.com', true, 1, NOW(), NOW())
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  phone = EXCLUDED.phone,
  email = EXCLUDED.email,
  updated_at = NOW();

-- Create test voice sessions for isolation testing
INSERT INTO voice_sessions (id, company_id, user_id, session_type, start_time, end_time, is_active, created_at, updated_at) VALUES
  ('test-session-a1', 'test-org-a', 'user-a1', 'customer_search', NOW() - INTERVAL '1 hour', NOW() - INTERVAL '30 minutes', false, NOW(), NOW()),
  ('test-session-b1', 'test-org-b', 'user-b1', 'customer_search', NOW() - INTERVAL '1 hour', NOW() - INTERVAL '30 minutes', false, NOW(), NOW())
ON CONFLICT (id) DO UPDATE SET
  end_time = EXCLUDED.end_time,
  updated_at = NOW();

-- Create test media assets for isolation testing
INSERT INTO media_assets (id, company_id, customer_id, asset_type, file_path, file_size, mime_type, is_active, storage_path, created_at, updated_at) VALUES
  (to_uuid('test-media-a1'), 'test-org-a', 'test-cust-a1', 'voice_recording', '/test/media/org-a-recording1.wav', 1024000, 'audio/wav', true, '/test/media/org-a-recording1.wav', NOW(), NOW()),
  (to_uuid('test-media-b1'), 'test-org-b', 'test-cust-b1', 'voice_recording', '/test/media/org-b-recording1.wav', 1024000, 'audio/wav', true, '/test/media/org-b-recording1.wav', NOW(), NOW())
ON CONFLICT (id) DO UPDATE SET
  file_path = EXCLUDED.file_path,
  updated_at = NOW();

-- Verification queries (to be run with different org contexts)
-- These should be run by the RLS test script with different auth contexts

SELECT 'Seed complete - created test data for org isolation testing' as status;
