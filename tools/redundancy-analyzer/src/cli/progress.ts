import chalk from 'chalk';

export interface ProgressUpdate {
  phase: string;
  progress: number;
  filesScanned?: number;
  totalFiles?: number;
  findingsCount?: number;
  currentFile?: string;
  message?: string;
}

export class ProgressTracker {
  private currentPhase: string = 'initializing';
  private progress: number = 0;
  private startTime: number = Date.now();
  private verbose: boolean;
  private analysisId?: string;
  private lastProgressBar?: string;

  constructor(verbose: boolean = false) {
    this.verbose = verbose;
  }

  setAnalysisId(id: string): void {
    this.analysisId = id;
    if (this.verbose) {
      console.log(chalk.gray(`Analysis ID: ${id}`));
    }
  }

  setPhase(phase: string): void {
    this.currentPhase = phase;
    console.log(chalk.cyan(`\n📍 Phase: ${this.formatPhase(phase)}`));
  }

  update(update: ProgressUpdate): void {
    this.progress = update.progress || this.progress;

    if (update.phase && update.phase !== this.currentPhase) {
      this.setPhase(update.phase);
    }

    // Update progress bar
    this.showProgressBar();

    // Show detailed info if verbose
    if (this.verbose) {
      if (update.filesScanned !== undefined && update.totalFiles !== undefined) {
        console.log(
          chalk.gray(`Files: ${update.filesScanned}/${update.totalFiles}`)
        );
      }

      if (update.currentFile) {
        console.log(chalk.gray(`Processing: ${this.truncatePath(update.currentFile)}`));
      }

      if (update.findingsCount !== undefined) {
        console.log(chalk.yellow(`Findings: ${update.findingsCount}`));
      }

      if (update.message) {
        console.log(chalk.gray(update.message));
      }
    }
  }

  showProgressBar(): void {
    const width = 30;
    const filled = Math.floor((this.progress / 100) * width);
    const empty = width - filled;

    const bar = chalk.green('█'.repeat(filled)) + chalk.gray('░'.repeat(empty));
    const percentage = `${this.progress}%`.padStart(4);
    const elapsed = this.formatElapsed();

    const progressLine = `Progress: [${bar}] ${percentage} | ${elapsed}`;

    if (this.lastProgressBar) {
      // Clear previous line
      process.stdout.write('\r\x1b[K');
    }

    process.stdout.write(progressLine);
    this.lastProgressBar = progressLine;

    if (this.progress === 100) {
      console.log(); // New line after completion
      this.lastProgressBar = undefined;
    }
  }

  showError(message: string): void {
    if (this.lastProgressBar) {
      console.log(); // New line after progress bar
      this.lastProgressBar = undefined;
    }
    console.error(chalk.red(`\n❌ Error: ${message}`));
  }

  private formatPhase(phase: string): string {
    const phaseMap: Record<string, string> = {
      initializing: '🚀 Initializing',
      scanning: '🔍 Scanning files',
      analyzing: '🧠 Analyzing code',
      generating_report: '📝 Generating report',
      complete: '✅ Complete',
      failed: '❌ Failed',
    };

    return phaseMap[phase] || phase;
  }

  private formatElapsed(): string {
    const elapsed = Date.now() - this.startTime;
    const seconds = Math.floor(elapsed / 1000);
    const minutes = Math.floor(seconds / 60);

    if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    }
    return `${seconds}s`;
  }

  private truncatePath(filePath: string, maxLength: number = 60): string {
    if (filePath.length <= maxLength) return filePath;

    const parts = filePath.split('/');
    if (parts.length <= 2) return filePath;

    let truncated = `.../${parts[parts.length - 2]}/${parts[parts.length - 1]}`;
    
    if (truncated.length > maxLength) {
      truncated = `.../${parts[parts.length - 1]}`;
    }

    return truncated;
  }

  reset(): void {
    this.currentPhase = 'initializing';
    this.progress = 0;
    this.startTime = Date.now();
    this.analysisId = undefined;
    this.lastProgressBar = undefined;
  }
}