#!/usr/bin/env npx tsx
import { execSync } from 'child_process';

console.log('🧪 Running All E2E Tests After Vision Migration\n');
console.log('='.repeat(70));

const testSuites = [
  {
    name: 'Complete Workflows',
    path: 'src/__tests__/e2e/complete-workflows.e2e.test.ts',
    before: '9/10'
  },
  {
    name: 'Advanced Workflows',
    path: 'src/__tests__/e2e/advanced-workflows.e2e.test.ts',
    before: '10/10'
  },
  {
    name: 'Diverse Data Scenarios',
    path: 'src/domains/vision/__tests__/scenarios/diverse-data-scenarios.e2e.test.ts',
    before: '2/12'
  },
  {
    name: 'Cross-Domain Integration',
    path: 'src/domains/vision/__tests__/scenarios/cross-domain-integration.e2e.test.ts',
    before: '0/8'
  },
  {
    name: 'Complete Verification Flow',
    path: 'src/domains/vision/__tests__/scenarios/complete-verification-flow.e2e.test.ts',
    before: '7/12'
  }
];

const results: any[] = [];

for (const suite of testSuites) {
  console.log(`\n📋 ${suite.name} (was ${suite.before})`);
  console.log('-'.repeat(70));
  
  try {
    const output = execSync(`npm test -- ${suite.path} 2>&1`, {
      encoding: 'utf-8',
      timeout: 180000
    });
    
    const passMatch = output.match(/Tests:\s+(\d+)\s+passed/);
    const failMatch = output.match(/(\d+)\s+failed/);
    const totalMatch = output.match(/(\d+)\s+total/);
    
    const passed = passMatch ? parseInt(passMatch[1]) : 0;
    const failed = failMatch ? parseInt(failMatch[1]) : 0;
    const total = totalMatch ? parseInt(totalMatch[1]) : passed + failed;
    
    results.push({
      name: suite.name,
      before: suite.before,
      after: `${passed}/${total}`,
      passed,
      failed,
      total,
      improved: passed > parseInt(suite.before.split('/')[0])
    });
    
    console.log(`   Result: ${passed}/${total} passing`);
    
  } catch (error: any) {
    const output = error.stdout || '';
    const passMatch = output.match(/Tests:\s+(\d+)\s+passed/);
    const failMatch = output.match(/(\d+)\s+failed/);
    const totalMatch = output.match(/(\d+)\s+total/);
    
    const passed = passMatch ? parseInt(passMatch[1]) : 0;
    const failed = failMatch ? parseInt(failMatch[1]) : 0;
    const total = totalMatch ? parseInt(totalMatch[1]) : passed + failed;
    
    results.push({
      name: suite.name,
      before: suite.before,
      after: `${passed}/${total}`,
      passed,
      failed,
      total,
      improved: false
    });
    
    console.log(`   Result: ${passed}/${total} passing`);
  }
}

console.log('\n' + '='.repeat(70));
console.log('\n📊 SUMMARY\n');

let totalBefore = 0;
let totalAfter = 0;
let totalTests = 0;

results.forEach(r => {
  const beforeCount = parseInt(r.before.split('/')[0]);
  totalBefore += beforeCount;
  totalAfter += r.passed;
  totalTests += r.total;
  
  const icon = r.improved ? '✅' : r.passed === beforeCount ? '🟡' : '🔴';
  console.log(`${icon} ${r.name.padEnd(30)} ${r.before.padEnd(8)} → ${r.after}`);
});

console.log('\n' + '='.repeat(70));
console.log(`\n📈 Overall: ${totalBefore}/${totalTests} → ${totalAfter}/${totalTests}`);

const improvement = totalAfter - totalBefore;
if (improvement > 0) {
  console.log(`🎉 +${improvement} tests now passing!\n`);
} else if (improvement === 0) {
  console.log(`🟡 No change (database tables needed but mocking issues remain)\n`);
} else {
  console.log(`🔴 ${Math.abs(improvement)} tests regressed\n`);
}
