#!/usr/bin/env npx tsx
/**
 * Comprehensive Codebase Audit
 * Analyzes repositories, services, and types for issues
 */

import * as fs from 'fs';
import * as path from 'path';
import { glob } from 'glob';

interface AuditResults {
  repositories: {
    total: number;
    patterns: {
      classBase: string[];
      functional: string[];
      mixed: string[];
    };
    tenancyUsage: {
      useTenantId: string[];
      useCompanyId: string[];
      useBoth: string[];
      useNeither: string[];
    };
    clientCreation: {
      createPerCall: string[];
      useDI: string[];
    };
  };
  services: {
    total: number;
    voiceSupport: string[];
    offlineSupport: string[];
    largeFunctions: Array<{ file: string; lines: number }>;
  };
  types: {
    duplicateDefinitions: Record<string, string[]>;
    inconsistentNaming: string[];
  };
  imports: {
    circularDependencies: string[];
    externalUsage: Record<string, number>;
  };
}

async function auditCodebase(): Promise<AuditResults> {
  console.log('🔍 Starting Comprehensive Codebase Audit...\n');

  const results: AuditResults = {
    repositories: {
      total: 0,
      patterns: { classBase: [], functional: [], mixed: [] },
      tenancyUsage: { useTenantId: [], useCompanyId: [], useBoth: [], useNeither: [] },
      clientCreation: { createPerCall: [], useDI: [] }
    },
    services: {
      total: 0,
      voiceSupport: [],
      offlineSupport: [],
      largeFunctions: []
    },
    types: {
      duplicateDefinitions: {},
      inconsistentNaming: []
    },
    imports: {
      circularDependencies: [],
      externalUsage: {}
    }
  };

  // Audit repositories
  console.log('📦 Auditing repositories...');
  const repoFiles = glob.sync('src/domains/**/repositories/*.ts', {
    ignore: ['**/__tests__/**', '**/node_modules/**']
  });

  results.repositories.total = repoFiles.length;

  for (const file of repoFiles) {
    const content = fs.readFileSync(file, 'utf-8');
    const fileName = path.basename(file);

    // Pattern detection
    if (content.includes('extends BaseRepository')) {
      results.repositories.patterns.classBase.push(file);
    } else if (content.includes('export async function')) {
      results.repositories.patterns.functional.push(file);
    } else {
      results.repositories.patterns.mixed.push(file);
    }

    // Tenancy usage
    const hasTenantId = /\.eq\(['"]tenant_id['"]/g.test(content);
    const hasCompanyId = /\.eq\(['"]company_id['"]/g.test(content);

    if (hasTenantId && hasCompanyId) {
      results.repositories.tenancyUsage.useBoth.push(file);
    } else if (hasTenantId) {
      results.repositories.tenancyUsage.useTenantId.push(file);
    } else if (hasCompanyId) {
      results.repositories.tenancyUsage.useCompanyId.push(file);
    } else {
      results.repositories.tenancyUsage.useNeither.push(file);
    }

    // Client creation pattern
    if (content.includes('createClient()') && !content.includes('constructor(')) {
      results.repositories.clientCreation.createPerCall.push(file);
    } else if (content.includes('supabaseClient') || content.includes('supabase: SupabaseClient')) {
      results.repositories.clientCreation.useDI.push(file);
    }
  }

  // Audit services
  console.log('⚙️  Auditing services...');
  const serviceFiles = glob.sync('src/domains/**/services/*.ts', {
    ignore: ['**/__tests__/**', '**/node_modules/**']
  });

  results.services.total = serviceFiles.length;

  for (const file of serviceFiles) {
    const content = fs.readFileSync(file, 'utf-8');
    const lines = content.split('\n').length;

    // Voice support
    if (content.includes('voice') || content.includes('Voice')) {
      results.services.voiceSupport.push(file);
    }

    // Offline support
    if (content.includes('offline') || content.includes('queue')) {
      results.services.offlineSupport.push(file);
    }

    // Large files
    if (lines > 500) {
      results.services.largeFunctions.push({ file, lines });
    }
  }

  // Audit types
  console.log('📝 Auditing type definitions...');
  const typeFiles = glob.sync('src/domains/**/types/*.ts', {
    ignore: ['**/__tests__/**', '**/node_modules/**']
  });

  const typeDefinitions: Record<string, string[]> = {};

  for (const file of typeFiles) {
    const content = fs.readFileSync(file, 'utf-8');

    // Find interface/type definitions
    const interfaceMatches = content.matchAll(/(?:export )?(?:interface|type) (\w+)/g);

    for (const match of interfaceMatches) {
      const typeName = match[1];
      if (!typeDefinitions[typeName]) {
        typeDefinitions[typeName] = [];
      }
      typeDefinitions[typeName].push(file);
    }

    // Check for inconsistent naming (company_id vs tenantId)
    if (content.includes('company_id') && content.includes('tenantId')) {
      results.types.inconsistentNaming.push(file);
    }
  }

  // Find duplicates
  for (const [typeName, files] of Object.entries(typeDefinitions)) {
    if (files.length > 1) {
      results.types.duplicateDefinitions[typeName] = files;
    }
  }

  return results;
}

async function main() {
  const results = await auditCodebase();

  console.log('\n\n📊 AUDIT RESULTS\n');
  console.log('═'.repeat(60));

  console.log('\n📦 REPOSITORIES:');
  console.log(`  Total: ${results.repositories.total}`);
  console.log(`  Patterns:`);
  console.log(`    Class-based: ${results.repositories.patterns.classBase.length}`);
  console.log(`    Functional: ${results.repositories.patterns.functional.length}`);
  console.log(`    Mixed: ${results.repositories.patterns.mixed.length}`);
  console.log(`  Tenancy:`);
  console.log(`    Use tenant_id: ${results.repositories.tenancyUsage.useTenantId.length}`);
  console.log(`    Use company_id: ${results.repositories.tenancyUsage.useCompanyId.length}`);
  console.log(`    Use BOTH: ${results.repositories.tenancyUsage.useBoth.length}`);
  console.log(`    Use neither: ${results.repositories.tenancyUsage.useNeither.length}`);
  console.log(`  Client Pattern:`);
  console.log(`    Create per call: ${results.repositories.clientCreation.createPerCall.length}`);
  console.log(`    Dependency injection: ${results.repositories.clientCreation.useDI.length}`);

  console.log('\n⚙️  SERVICES:');
  console.log(`  Total: ${results.services.total}`);
  console.log(`  With voice support: ${results.services.voiceSupport.length}`);
  console.log(`  With offline support: ${results.services.offlineSupport.length}`);
  console.log(`  Large files (>500 lines): ${results.services.largeFunctions.length}`);

  console.log('\n📝 TYPES:');
  console.log(`  Duplicate definitions: ${Object.keys(results.types.duplicateDefinitions).length}`);
  console.log(`  Inconsistent naming: ${results.types.inconsistentNaming.length}`);

  // Write detailed results
  fs.writeFileSync(
    'codebase-audit-results.json',
    JSON.stringify(results, null, 2)
  );

  console.log('\n✅ Detailed results saved to codebase-audit-results.json\n');

  // Print critical issues
  if (results.repositories.tenancyUsage.useCompanyId.length > 0) {
    console.log('\n⚠️  CRITICAL: Files still using company_id:');
    results.repositories.tenancyUsage.useCompanyId.forEach(f => {
      console.log(`    - ${f}`);
    });
  }

  if (results.repositories.tenancyUsage.useBoth.length > 0) {
    console.log('\n⚠️  WARNING: Files using BOTH tenant_id and company_id:');
    results.repositories.tenancyUsage.useBoth.forEach(f => {
      console.log(`    - ${f}`);
    });
  }

  if (Object.keys(results.types.duplicateDefinitions).length > 0) {
    console.log('\n⚠️  WARNING: Duplicate type definitions:');
    for (const [typeName, files] of Object.entries(results.types.duplicateDefinitions)) {
      console.log(`    ${typeName} defined in:`);
      files.forEach(f => console.log(`      - ${f}`));
    }
  }
}

main().catch(console.error);