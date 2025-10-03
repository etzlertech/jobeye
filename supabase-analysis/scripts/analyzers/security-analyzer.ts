import { SupabaseClient } from '@supabase/supabase-js';

export interface DatabaseRole {
  role_name: string;
  is_superuser: boolean;
  can_create_role: boolean;
  can_create_db: boolean;
  can_login: boolean;
  is_replication: boolean;
  connection_limit: number;
  member_of: string[];
  owns_objects: number;
  granted_to: string[];
  description?: string;
}

export interface RLSPolicyDetail {
  table_name: string;
  schema_name: string;
  policy_name: string;
  command: string;  // SELECT, INSERT, UPDATE, DELETE, ALL
  is_permissive: boolean;
  roles: string[];
  using_expression?: string;
  check_expression?: string;
  created_at?: string;
  description?: string;
}

export interface TablePermission {
  table_name: string;
  schema_name: string;
  grantee: string;
  privilege_type: string;
  is_grantable: boolean;
  grantor: string;
}

export interface ColumnPermission {
  table_name: string;
  column_name: string;
  schema_name: string;
  grantee: string;
  privilege_type: string;
  is_grantable: boolean;
}

export interface SecurityVulnerability {
  type: 'no_rls' | 'permissive_rls' | 'wide_permissions' | 'superuser_access' | 'no_policies' | 'public_access';
  severity: 'critical' | 'high' | 'medium' | 'low';
  table?: string;
  role?: string;
  description: string;
  risk: string;
  recommendation: string;
}

export interface DatabaseSchema {
  schema_name: string;
  owner: string;
  is_system: boolean;
  table_count: number;
  function_count: number;
  has_public_access: boolean;
  description?: string;
}

export interface SecurityAnalysis {
  roles: DatabaseRole[];
  schemas: DatabaseSchema[];
  rls_policies: RLSPolicyDetail[];
  table_permissions: TablePermission[];
  column_permissions: ColumnPermission[];
  vulnerabilities: SecurityVulnerability[];
  security_summary: {
    total_roles: number;
    superuser_roles: number;
    total_schemas: number;
    tables_with_rls: number;
    tables_without_rls: number;
    total_policies: number;
    permissive_policies: number;
    restrictive_policies: number;
    critical_vulnerabilities: number;
    high_vulnerabilities: number;
  };
  recommendations: string[];
}

export class SecurityAnalyzer {
  constructor(private client: SupabaseClient) {}

  async analyze(tables: any[]): Promise<SecurityAnalysis> {
    console.log('🔒 Analyzing database security...');

    const [
      roles,
      schemas,
      rlsPolicies,
      tablePermissions,
      columnPermissions
    ] = await Promise.all([
      this.analyzeRoles(),
      this.analyzeSchemas(),
      this.analyzeRLSPolicies(),
      this.analyzeTablePermissions(),
      this.analyzeColumnPermissions()
    ]);

    const vulnerabilities = this.identifyVulnerabilities(
      tables,
      roles,
      rlsPolicies,
      tablePermissions
    );

    const security_summary = this.generateSecuritySummary(
      tables,
      roles,
      schemas,
      rlsPolicies,
      vulnerabilities
    );

    const recommendations = this.generateRecommendations(
      vulnerabilities,
      security_summary
    );

    return {
      roles,
      schemas,
      rls_policies: rlsPolicies,
      table_permissions: tablePermissions,
      column_permissions: columnPermissions,
      vulnerabilities,
      security_summary,
      recommendations
    };
  }

  private async analyzeRoles(): Promise<DatabaseRole[]> {
    const rolesQuery = `
      SELECT 
        r.rolname as role_name,
        r.rolsuper as is_superuser,
        r.rolcreaterole as can_create_role,
        r.rolcreatedb as can_create_db,
        r.rolcanlogin as can_login,
        r.rolreplication as is_replication,
        r.rolconnlimit as connection_limit,
        ARRAY(
          SELECT b.rolname
          FROM pg_catalog.pg_auth_members m
          JOIN pg_catalog.pg_roles b ON (m.roleid = b.oid)
          WHERE m.member = r.oid
        ) as member_of,
        (
          SELECT COUNT(*)
          FROM pg_class c
          WHERE c.relowner = r.oid
        ) as owns_objects,
        ARRAY(
          SELECT b.rolname
          FROM pg_catalog.pg_auth_members m
          JOIN pg_catalog.pg_roles b ON (m.member = b.oid)
          WHERE m.roleid = r.oid
        ) as granted_to,
        shobj_description(r.oid, 'pg_authid') as description
      FROM pg_roles r
      WHERE r.rolname NOT LIKE 'pg_%'
      ORDER BY r.rolname;
    `;

    const { data, error } = await this.client.rpc('exec_sql', { sql: rolesQuery });
    
    if (error) {
      console.error('Error analyzing roles:', error);
      return [];
    }

    return (data || []).map((row: any) => ({
      role_name: row.role_name,
      is_superuser: row.is_superuser,
      can_create_role: row.can_create_role,
      can_create_db: row.can_create_db,
      can_login: row.can_login,
      is_replication: row.is_replication,
      connection_limit: row.connection_limit,
      member_of: row.member_of || [],
      owns_objects: parseInt(row.owns_objects) || 0,
      granted_to: row.granted_to || [],
      description: row.description
    }));
  }

  private async analyzeSchemas(): Promise<DatabaseSchema[]> {
    const query = `
      SELECT 
        n.nspname as schema_name,
        r.rolname as owner,
        n.nspname IN ('pg_catalog', 'information_schema', 'pg_toast') as is_system,
        (
          SELECT COUNT(*)
          FROM pg_class c
          WHERE c.relnamespace = n.oid
            AND c.relkind IN ('r', 'p')
        ) as table_count,
        (
          SELECT COUNT(*)
          FROM pg_proc p
          WHERE p.pronamespace = n.oid
        ) as function_count,
        EXISTS (
          SELECT 1
          FROM pg_namespace n2
          WHERE n2.oid = n.oid
            AND has_schema_privilege('public', n.nspname, 'USAGE')
        ) as has_public_access,
        obj_description(n.oid, 'pg_namespace') as description
      FROM pg_namespace n
      LEFT JOIN pg_roles r ON r.oid = n.nspowner
      ORDER BY n.nspname;
    `;

    const { data, error } = await this.client.rpc('exec_sql', { sql: query });
    
    if (error) {
      console.error('Error analyzing schemas:', error);
      return [];
    }

    return (data || []).map((row: any) => ({
      schema_name: row.schema_name,
      owner: row.owner,
      is_system: row.is_system,
      table_count: parseInt(row.table_count) || 0,
      function_count: parseInt(row.function_count) || 0,
      has_public_access: row.has_public_access,
      description: row.description
    }));
  }

  private async analyzeRLSPolicies(): Promise<RLSPolicyDetail[]> {
    const query = `
      SELECT 
        schemaname as schema_name,
        tablename as table_name,
        policyname as policy_name,
        cmd as command,
        permissive as is_permissive,
        roles,
        qual as using_expression,
        with_check as check_expression
      FROM pg_policies
      WHERE schemaname NOT IN ('pg_catalog', 'information_schema')
      ORDER BY schemaname, tablename, policyname;
    `;

    const { data, error } = await this.client.rpc('exec_sql', { sql: query });
    
    if (error) {
      console.error('Error analyzing RLS policies:', error);
      return [];
    }

    return (data || []).map((row: any) => ({
      table_name: row.table_name,
      schema_name: row.schema_name,
      policy_name: row.policy_name,
      command: row.command,
      is_permissive: row.is_permissive === 'PERMISSIVE',
      roles: row.roles || [],
      using_expression: row.using_expression,
      check_expression: row.check_expression
    }));
  }

  private async analyzeTablePermissions(): Promise<TablePermission[]> {
    const query = `
      SELECT 
        table_schema as schema_name,
        table_name,
        grantee,
        privilege_type,
        is_grantable,
        grantor
      FROM information_schema.table_privileges
      WHERE table_schema NOT IN ('pg_catalog', 'information_schema')
        AND grantee NOT IN ('postgres', 'supabase_admin')
      ORDER BY table_schema, table_name, grantee, privilege_type;
    `;

    const { data, error } = await this.client.rpc('exec_sql', { sql: query });
    
    if (error) {
      console.error('Error analyzing table permissions:', error);
      return [];
    }

    return (data || []).map((row: any) => ({
      table_name: row.table_name,
      schema_name: row.schema_name,
      grantee: row.grantee,
      privilege_type: row.privilege_type,
      is_grantable: row.is_grantable === 'YES',
      grantor: row.grantor
    }));
  }

  private async analyzeColumnPermissions(): Promise<ColumnPermission[]> {
    const query = `
      SELECT 
        table_schema as schema_name,
        table_name,
        column_name,
        grantee,
        privilege_type,
        is_grantable
      FROM information_schema.column_privileges
      WHERE table_schema NOT IN ('pg_catalog', 'information_schema')
        AND grantee NOT IN ('postgres', 'supabase_admin')
      ORDER BY table_schema, table_name, column_name, grantee;
    `;

    const { data, error } = await this.client.rpc('exec_sql', { sql: query });
    
    if (error) {
      console.error('Error analyzing column permissions:', error);
      return [];
    }

    return (data || []).map((row: any) => ({
      table_name: row.table_name,
      column_name: row.column_name,
      schema_name: row.schema_name,
      grantee: row.grantee,
      privilege_type: row.privilege_type,
      is_grantable: row.is_grantable === 'YES'
    }));
  }

  private identifyVulnerabilities(
    tables: any[],
    roles: DatabaseRole[],
    policies: RLSPolicyDetail[],
    permissions: TablePermission[]
  ): SecurityVulnerability[] {
    const vulnerabilities: SecurityVulnerability[] = [];

    // Check tables without RLS
    const tablesWithPolicies = new Set(policies.map(p => p.table_name));
    
    tables.forEach(table => {
      if (!table.rls_enabled && table.row_count > 0) {
        vulnerabilities.push({
          type: 'no_rls',
          severity: 'critical',
          table: table.name,
          description: `Table "${table.name}" has ${table.row_count} rows but RLS is disabled`,
          risk: 'All authenticated users can access all rows without restriction',
          recommendation: `Enable RLS: ALTER TABLE ${table.name} ENABLE ROW LEVEL SECURITY;`
        });
      } else if (table.rls_enabled && !tablesWithPolicies.has(table.name) && table.row_count > 0) {
        vulnerabilities.push({
          type: 'no_policies',
          severity: 'high',
          table: table.name,
          description: `Table "${table.name}" has RLS enabled but no policies defined`,
          risk: 'Table is inaccessible to all users except superusers',
          recommendation: 'Create appropriate RLS policies for this table'
        });
      }
    });

    // Check for overly permissive policies
    policies.forEach(policy => {
      if (policy.using_expression === 'true' || policy.using_expression === '(true)') {
        vulnerabilities.push({
          type: 'permissive_rls',
          severity: 'high',
          table: policy.table_name,
          description: `Policy "${policy.policy_name}" on "${policy.table_name}" allows unrestricted ${policy.command} access`,
          risk: 'Policy provides no actual security - all users can access all rows',
          recommendation: 'Review and tighten the USING clause to restrict access appropriately'
        });
      }
    });

    // Check for tables with public access
    const publicPermissions = permissions.filter(p => p.grantee === 'PUBLIC');
    const tablesWithPublicAccess = new Set(publicPermissions.map(p => p.table_name));
    
    tablesWithPublicAccess.forEach(tableName => {
      const tablePerms = publicPermissions.filter(p => p.table_name === tableName);
      const permTypes = tablePerms.map(p => p.privilege_type).join(', ');
      
      vulnerabilities.push({
        type: 'public_access',
        severity: 'medium',
        table: tableName,
        description: `Table "${tableName}" grants PUBLIC access for: ${permTypes}`,
        risk: 'Any database user can perform these operations',
        recommendation: 'Review if public access is necessary; consider restricting to specific roles'
      });
    });

    // Check for unnecessary superuser roles
    const superuserRoles = roles.filter(r => r.is_superuser && r.can_login);
    if (superuserRoles.length > 2) {  // postgres and one service account is normal
      vulnerabilities.push({
        type: 'superuser_access',
        severity: 'medium',
        description: `${superuserRoles.length} superuser roles can login to the database`,
        risk: 'Multiple superuser accounts increase attack surface',
        recommendation: 'Reduce number of superuser accounts; use role-based access control instead'
      });
    }

    return vulnerabilities.sort((a, b) => {
      const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
      return severityOrder[a.severity] - severityOrder[b.severity];
    });
  }

  private generateSecuritySummary(
    tables: any[],
    roles: DatabaseRole[],
    schemas: DatabaseSchema[],
    policies: RLSPolicyDetail[],
    vulnerabilities: SecurityVulnerability[]
  ): SecurityAnalysis['security_summary'] {
    const tablesWithRLS = tables.filter(t => t.rls_enabled).length;
    const tablesWithoutRLS = tables.filter(t => !t.rls_enabled && t.row_count > 0).length;
    const permissivePolicies = policies.filter(p => p.is_permissive).length;
    const restrictivePolicies = policies.filter(p => !p.is_permissive).length;

    return {
      total_roles: roles.length,
      superuser_roles: roles.filter(r => r.is_superuser).length,
      total_schemas: schemas.filter(s => !s.is_system).length,
      tables_with_rls: tablesWithRLS,
      tables_without_rls: tablesWithoutRLS,
      total_policies: policies.length,
      permissive_policies: permissivePolicies,
      restrictive_policies: restrictivePolicies,
      critical_vulnerabilities: vulnerabilities.filter(v => v.severity === 'critical').length,
      high_vulnerabilities: vulnerabilities.filter(v => v.severity === 'high').length
    };
  }

  private generateRecommendations(
    vulnerabilities: SecurityVulnerability[],
    summary: SecurityAnalysis['security_summary']
  ): string[] {
    const recommendations: string[] = [];

    if (summary.critical_vulnerabilities > 0) {
      recommendations.push(
        `🚨 Fix ${summary.critical_vulnerabilities} critical security vulnerabilities immediately`
      );
    }

    if (summary.tables_without_rls > 0) {
      recommendations.push(
        `🔒 Enable RLS on ${summary.tables_without_rls} tables containing data`
      );
    }

    if (summary.total_policies === 0 && summary.tables_with_rls > 0) {
      recommendations.push(
        '📋 Create RLS policies for tables with RLS enabled but no policies'
      );
    }

    const permissiveVulns = vulnerabilities.filter(v => v.type === 'permissive_rls');
    if (permissiveVulns.length > 0) {
      recommendations.push(
        `🔍 Review ${permissiveVulns.length} overly permissive RLS policies`
      );
    }

    if (summary.superuser_roles > 2) {
      recommendations.push(
        '👤 Reduce number of superuser accounts and implement role-based access control'
      );
    }

    const publicAccessVulns = vulnerabilities.filter(v => v.type === 'public_access');
    if (publicAccessVulns.length > 0) {
      recommendations.push(
        `🌐 Review PUBLIC access grants on ${publicAccessVulns.length} tables`
      );
    }

    // Best practices
    if (summary.restrictive_policies === 0 && summary.total_policies > 0) {
      recommendations.push(
        '✅ Consider adding restrictive policies for defense-in-depth security'
      );
    }

    return recommendations;
  }
}