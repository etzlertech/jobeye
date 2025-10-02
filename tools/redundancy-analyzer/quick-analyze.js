#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { glob } = require('glob');

console.log('🔍 JobEye Redundancy Quick Analyzer\n');

// Get project root (default to JobEye root)
const projectRoot = process.argv[2] || path.resolve(__dirname, '../..');
console.log(`📁 Analyzing project: ${projectRoot}\n`);

async function quickAnalysis() {
  try {
    // Phase 1: Scan for files
    console.log('📋 Phase 1: Scanning files...');
    
    const patterns = [
      '**/*.ts',
      '**/*.tsx', 
      '**/*.js',
      '**/*.jsx'
    ];
    
    const excludePatterns = [
      '**/node_modules/**',
      '**/.git/**',
      '**/dist/**',
      '**/build/**',
      '**/*.min.js',
      '**/*.test.*',
      '**/*.spec.*',
      '**/coverage/**',
      '**/.next/**',
      '**/lcov-report/**'
    ];
    
    const allFiles = [];
    for (const pattern of patterns) {
      const files = await glob(pattern, {
        cwd: projectRoot,
        ignore: excludePatterns,
        absolute: false
      });
      allFiles.push(...files);
    }
    
    console.log(`   Found ${allFiles.length} code files`);
    
    // Phase 2: Analyze by domain/directory
    console.log('\n📊 Phase 2: Analyzing by domain...');
    
    const domainFiles = {};
    const duplicateNames = {};
    const visionFiles = [];
    const offlineFiles = [];
    const apiFiles = [];
    
    allFiles.forEach(file => {
      const parts = file.split('/');
      const domain = parts[1] || 'root';
      
      if (!domainFiles[domain]) domainFiles[domain] = [];
      domainFiles[domain].push(file);
      
      const fileName = path.basename(file);
      if (!duplicateNames[fileName]) duplicateNames[fileName] = [];
      duplicateNames[fileName].push(file);
      
      // Look for specific redundancy patterns
      if (file.includes('vision') || file.includes('yolo') || file.includes('vlm')) {
        visionFiles.push(file);
      }
      if (file.includes('offline') || file.includes('sync') || file.includes('indexeddb')) {
        offlineFiles.push(file);
      }
      if (file.includes('api/') && file.includes('route')) {
        apiFiles.push(file);
      }
    });
    
    // Phase 3: Report findings
    console.log('\n🎯 REDUNDANCY ANALYSIS RESULTS\n');
    console.log('=' * 50);
    
    // Domain distribution
    console.log('\n📁 CODE DISTRIBUTION BY DOMAIN:');
    Object.entries(domainFiles)
      .sort(([,a], [,b]) => b.length - a.length)
      .forEach(([domain, files]) => {
        console.log(`   ${domain.padEnd(20)} ${files.length.toString().padStart(4)} files`);
      });
    
    // Duplicate file names
    console.log('\n🔄 POTENTIAL DUPLICATE IMPLEMENTATIONS:');
    const duplicates = Object.entries(duplicateNames)
      .filter(([name, files]) => files.length > 1)
      .sort(([,a], [,b]) => b.length - a.length);
    
    if (duplicates.length > 0) {
      duplicates.slice(0, 10).forEach(([name, files]) => {
        console.log(`   📄 ${name} (${files.length} copies):`);
        files.forEach(file => console.log(`      - ${file}`));
        console.log('');
      });
    } else {
      console.log('   ✅ No obvious duplicate file names found');
    }
    
    // Vision system analysis
    console.log('\n👁️  VISION SYSTEM REDUNDANCY:');
    if (visionFiles.length > 0) {
      console.log(`   Found ${visionFiles.length} vision-related files:`);
      visionFiles.forEach(file => console.log(`   - ${file}`));
      
      const visionDomains = [...new Set(visionFiles.map(f => f.split('/')[1]))];
      console.log(`   \n   ⚠️  Vision code spread across ${visionDomains.length} domains: ${visionDomains.join(', ')}`);
    } else {
      console.log('   ✅ No vision-related files found');
    }
    
    // Offline sync analysis
    console.log('\n💾 OFFLINE SYNC REDUNDANCY:');
    if (offlineFiles.length > 0) {
      console.log(`   Found ${offlineFiles.length} offline/sync files:`);
      offlineFiles.forEach(file => console.log(`   - ${file}`));
      
      const offlineDomains = [...new Set(offlineFiles.map(f => f.split('/')[1]))];
      console.log(`   \n   ⚠️  Offline code spread across ${offlineDomains.length} domains: ${offlineDomains.join(', ')}`);
    } else {
      console.log('   ✅ No offline sync files found');
    }
    
    // API endpoint analysis
    console.log('\n🔗 API ENDPOINT ANALYSIS:');
    if (apiFiles.length > 0) {
      console.log(`   Found ${apiFiles.length} API route files:`);
      
      const apiByDomain = {};
      apiFiles.forEach(file => {
        const domain = file.split('/api/')[1]?.split('/')[0] || 'unknown';
        if (!apiByDomain[domain]) apiByDomain[domain] = [];
        apiByDomain[domain].push(file);
      });
      
      Object.entries(apiByDomain).forEach(([domain, files]) => {
        console.log(`   📡 ${domain}: ${files.length} endpoints`);
      });
    } else {
      console.log('   ✅ No API route files found');
    }
    
    // Summary
    console.log('\n📋 SUMMARY:');
    console.log(`   📊 Total files analyzed: ${allFiles.length}`);
    console.log(`   📁 Domains found: ${Object.keys(domainFiles).length}`);
    console.log(`   🔄 Files with duplicate names: ${duplicates.length}`);
    console.log(`   👁️  Vision-related files: ${visionFiles.length}`);
    console.log(`   💾 Offline/sync files: ${offlineFiles.length}`);
    console.log(`   🔗 API endpoints: ${apiFiles.length}`);
    
    const redundancyScore = duplicates.length + (visionFiles.length > 5 ? 5 : 0) + (offlineFiles.length > 5 ? 5 : 0);
    console.log(`   ⚠️  Redundancy score: ${redundancyScore}/20 ${redundancyScore > 10 ? '(HIGH)' : redundancyScore > 5 ? '(MEDIUM)' : '(LOW)'}`);
    
    console.log('\n🎯 NEXT STEPS:');
    if (redundancyScore > 10) {
      console.log('   1. 🚨 High redundancy detected - immediate cleanup recommended');
      console.log('   2. 🔧 Focus on vision and offline sync consolidation');
      console.log('   3. 📝 Create refactoring plan for duplicate implementations');
    } else if (redundancyScore > 5) {
      console.log('   1. ⚠️  Moderate redundancy - plan cleanup in next sprint');
      console.log('   2. 🔍 Review duplicate file names for consolidation opportunities');
    } else {
      console.log('   1. ✅ Low redundancy - codebase is well organized');
      console.log('   2. 🎯 Continue monitoring as project grows');
    }
    
    console.log('\n💡 For detailed analysis, run the full TypeScript analyzer once compilation issues are fixed.');
    
  } catch (error) {
    console.error('❌ Analysis failed:', error.message);
  }
}

quickAnalysis();