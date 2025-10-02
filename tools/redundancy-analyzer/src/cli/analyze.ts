#!/usr/bin/env node

import { Command } from 'commander';
import * as path from 'path';
import chalk from 'chalk';
import { RedundancyAnalyzer } from '../services/redundancy-analyzer';
import { ProgressTracker } from './progress';
import { OutputHandler } from './output';
import type { AnalysisOptions } from '../types/api';

const program = new Command();

program
  .name('redundancy-analyzer')
  .description('Analyze codebase for redundancy, duplicate code, and unused database tables')
  .version('1.0.0');

program
  .command('analyze', { isDefault: true })
  .description('Start redundancy analysis')
  .option('-p, --project-root <path>', 'Path to project root', process.cwd())
  .option('-e, --exclude <patterns...>', 'Patterns to exclude', ['node_modules', '.git', 'build', 'dist'])
  .option('-t, --threshold <number>', 'Similarity threshold (0-100)', '70')
  .option('-m, --min-size <number>', 'Minimum module size in lines', '10')
  .option('--include-tests', 'Include test files in analysis', false)
  .option('--include-docs', 'Include documentation files', false)
  .option('-f, --focus <type>', 'Focus on specific analysis type: all|code|database|api', 'all')
  .option('-o, --output <dir>', 'Output directory for report', './reports')
  .option('--format <format>', 'Report format: markdown|json', 'markdown')
  .option('-v, --verbose', 'Show detailed progress', false)
  .action(async (options) => {
    try {
      await runAnalysis(options);
    } catch (error) {
      console.error(chalk.red('Error:'), error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

program
  .command('status <analysisId>')
  .description('Check analysis status')
  .action(async (analysisId) => {
    try {
      await checkStatus(analysisId);
    } catch (error) {
      console.error(chalk.red('Error:'), error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

async function runAnalysis(options: any): Promise<void> {
  const projectRoot = path.resolve(options.projectRoot);
  const outputDir = path.resolve(options.output);
  
  console.log(chalk.blue('🔍 Redundancy Analyzer v1.0.0\n'));
  console.log(chalk.gray(`Project root: ${projectRoot}`));
  console.log(chalk.gray(`Output directory: ${outputDir}`));
  console.log(chalk.gray(`Analysis focus: ${options.focus}`));
  console.log(chalk.gray(`Similarity threshold: ${options.threshold}%\n`));

  // Validate project root
  const fs = await import('fs/promises');
  try {
    await fs.access(projectRoot);
  } catch {
    throw new Error(`Project path does not exist: ${projectRoot}`);
  }

  // Create analysis options
  const analysisOptions: AnalysisOptions = {
    excludePatterns: options.exclude,
    includeTests: options.includeTests,
    includeDocs: options.includeDocs,
    similarityThreshold: parseInt(options.threshold),
    minModuleSize: parseInt(options.minSize),
  };

  // Initialize services
  const analyzer = new RedundancyAnalyzer();
  const progress = new ProgressTracker(options.verbose);
  const output = new OutputHandler();

  // Set up progress tracking
  analyzer.on('progress', (update) => {
    progress.update(update);
  });

  analyzer.on('phase', (phase) => {
    progress.setPhase(phase);
  });

  // Start analysis
  console.log(chalk.cyan('Starting analysis...\n'));
  const startTime = Date.now();

  try {
    const analysisId = await analyzer.startAnalysis({
      projectPath: projectRoot,
      options: analysisOptions,
    });

    progress.setAnalysisId(analysisId);

    // Wait for completion
    await analyzer.waitForCompletion(analysisId);

    const duration = Date.now() - startTime;
    console.log(chalk.green(`\n✅ Analysis completed in ${formatDuration(duration)}\n`));

    // Generate report
    console.log(chalk.cyan('Generating report...'));
    const report = await analyzer.getReport(analysisId);

    // Save report
    const reportPath = await output.saveReport(report, outputDir, options.format);
    console.log(chalk.green(`\n📄 Report saved to: ${reportPath}`));

    // Show summary
    const summary = analyzer.getSummary();
    if (summary) {
      console.log(chalk.yellow('\n📊 Summary:'));
      console.log(`  - Total files analyzed: ${summary.totalFiles}`);
      console.log(`  - Redundant code found: ${summary.totalRedundancy.toLocaleString()} lines`);
      console.log(`  - Critical findings: ${summary.criticalFindings}`);
      console.log(`  - Tables without CRUD: ${summary.tablesWithoutCrud}`);
    }
  } catch (error) {
    progress.showError(error instanceof Error ? error.message : 'Unknown error');
    throw error;
  }
}

async function checkStatus(analysisId: string): Promise<void> {
  console.log(chalk.blue(`Checking status for analysis: ${analysisId}\n`));

  const analyzer = new RedundancyAnalyzer();
  
  try {
    const status = await analyzer.getStatus(analysisId);
    
    console.log(chalk.cyan('Status:'), status.status);
    console.log(chalk.cyan('Progress:'), `${status.progress}%`);
    
    if (status.currentPhase) {
      console.log(chalk.cyan('Current phase:'), status.currentPhase);
    }
    
    if (status.filesScanned !== undefined) {
      console.log(chalk.cyan('Files scanned:'), status.filesScanned);
    }
    
    if (status.findingsCount !== undefined) {
      console.log(chalk.cyan('Findings:'), status.findingsCount);
    }
    
    if (status.error) {
      console.log(chalk.red('Error:'), status.error);
    }
  } catch (error) {
    console.error(chalk.red('Failed to get status:'), error);
    process.exit(1);
  }
}

function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);

  if (hours > 0) {
    return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
  } else if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  } else {
    return `${seconds}s`;
  }
}

// Parse command line arguments
program.parse(process.argv);