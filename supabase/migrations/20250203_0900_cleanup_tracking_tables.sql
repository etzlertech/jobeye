-- Migration: Create cleanup tracking tables
-- Feature: 009-codebase-cleanup-and
-- Purpose: Track progress of codebase cleanup and refactoring

-- 1. Migration Tracking Table
CREATE TABLE IF NOT EXISTS migration_tracking (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    table_name VARCHAR(255) NOT NULL UNIQUE,
    has_company_id BOOLEAN NOT NULL DEFAULT false,
    has_tenant_id BOOLEAN NOT NULL DEFAULT false,
    row_count INTEGER NOT NULL DEFAULT 0 CHECK (row_count >= 0),
    migration_status VARCHAR(50) NOT NULL DEFAULT 'pending' 
        CHECK (migration_status IN ('pending', 'in_progress', 'completed', 'failed', 'skipped')),
    migrated_at TIMESTAMPTZ,
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- 2. Table Inventory Table
CREATE TABLE IF NOT EXISTS table_inventory (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    schema_name VARCHAR(255) NOT NULL DEFAULT 'public',
    table_name VARCHAR(255) NOT NULL,
    category VARCHAR(50) NOT NULL 
        CHECK (category IN ('active', 'empty_with_code', 'orphaned', 'staging')),
    row_count INTEGER NOT NULL DEFAULT 0 CHECK (row_count >= 0),
    has_code_references BOOLEAN NOT NULL DEFAULT false,
    has_relationships BOOLEAN NOT NULL DEFAULT false,
    last_modified TIMESTAMPTZ,
    decision VARCHAR(50) NOT NULL DEFAULT 'keep'
        CHECK (decision IN ('keep', 'seed', 'remove', 'document')),
    decision_reason TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    UNIQUE(schema_name, table_name)
);

-- 3. Code Pattern Violations Table
CREATE TABLE IF NOT EXISTS code_pattern_violations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    file_path VARCHAR(500) NOT NULL,
    line_number INTEGER NOT NULL CHECK (line_number > 0),
    column_number INTEGER NOT NULL CHECK (column_number > 0),
    pattern_type VARCHAR(50) NOT NULL
        CHECK (pattern_type IN ('company_id_usage', 'functional_repository', 'missing_rls', 'direct_db_access', 'wrong_rls_path')),
    violation_text TEXT NOT NULL,
    suggested_fix TEXT NOT NULL,
    is_fixed BOOLEAN NOT NULL DEFAULT false,
    fixed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- 4. Repository Inventory Table
CREATE TABLE IF NOT EXISTS repository_inventory (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    domain VARCHAR(255) NOT NULL,
    repository_name VARCHAR(255) NOT NULL,
    file_path VARCHAR(500) NOT NULL,
    pattern_type VARCHAR(50) NOT NULL
        CHECK (pattern_type IN ('class_based', 'functional', 'singleton', 'mixed')),
    target_pattern VARCHAR(50) NOT NULL DEFAULT 'class_based'
        CHECK (target_pattern IN ('class_based', 'functional', 'singleton', 'mixed')),
    migration_status VARCHAR(50) NOT NULL DEFAULT 'pending'
        CHECK (migration_status IN ('pending', 'in_progress', 'completed', 'failed')),
    dependencies_count INTEGER NOT NULL DEFAULT 0 CHECK (dependencies_count >= 0),
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    migrated_at TIMESTAMPTZ
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_migration_status ON migration_tracking(migration_status);
CREATE INDEX IF NOT EXISTS idx_migration_table ON migration_tracking(table_name);

CREATE INDEX IF NOT EXISTS idx_table_category ON table_inventory(category);
CREATE INDEX IF NOT EXISTS idx_table_decision ON table_inventory(decision);

CREATE INDEX IF NOT EXISTS idx_violation_type ON code_pattern_violations(pattern_type);
CREATE INDEX IF NOT EXISTS idx_violation_fixed ON code_pattern_violations(is_fixed);
CREATE INDEX IF NOT EXISTS idx_violation_file ON code_pattern_violations(file_path);

CREATE INDEX IF NOT EXISTS idx_repo_status ON repository_inventory(migration_status);
CREATE INDEX IF NOT EXISTS idx_repo_pattern ON repository_inventory(pattern_type);

-- Add update timestamp triggers
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_migration_tracking_updated_at BEFORE UPDATE ON migration_tracking 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Add validation triggers
CREATE OR REPLACE FUNCTION validate_migration_tracking()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.migration_status = 'completed' AND NEW.migrated_at IS NULL THEN
        NEW.migrated_at = NOW();
    END IF;
    
    IF NEW.migration_status = 'failed' AND NEW.error_message IS NULL THEN
        RAISE EXCEPTION 'error_message required when status is failed';
    END IF;
    
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER validate_migration_tracking_trigger BEFORE INSERT OR UPDATE ON migration_tracking
    FOR EACH ROW EXECUTE FUNCTION validate_migration_tracking();

-- Add validation for code pattern violations
CREATE OR REPLACE FUNCTION validate_code_violations()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.is_fixed = true AND OLD.is_fixed = false AND NEW.fixed_at IS NULL THEN
        NEW.fixed_at = NOW();
    END IF;
    
    IF NEW.suggested_fix = NEW.violation_text THEN
        RAISE EXCEPTION 'suggested_fix must differ from violation_text';
    END IF;
    
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER validate_code_violations_trigger BEFORE INSERT OR UPDATE ON code_pattern_violations
    FOR EACH ROW EXECUTE FUNCTION validate_code_violations();