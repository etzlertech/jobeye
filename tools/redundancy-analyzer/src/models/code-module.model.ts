export type ModuleType = 'class' | 'function' | 'component' | 'service' | 'repository';

export interface CodeMetrics {
  linesOfCode: number;
  cyclomaticComplexity: number;
  dependencyCount: number;
  lastModified: Date;
}

export interface CodeModule {
  id: string; // UUID
  filePath: string;
  moduleName: string;
  type: ModuleType;
  startLine: number;
  endLine: number;
  dependencies: string[]; // module IDs
  ast: object; // simplified AST representation
  metrics: CodeMetrics;
}

export class CodeModuleModel implements CodeModule {
  id: string;
  filePath: string;
  moduleName: string;
  type: ModuleType;
  startLine: number;
  endLine: number;
  dependencies: string[];
  ast: object;
  metrics: CodeMetrics;

  constructor(data: Partial<CodeModule>) {
    this.id = data.id || this.generateId();
    this.filePath = data.filePath || '';
    this.moduleName = data.moduleName || '';
    this.type = data.type || 'function';
    this.startLine = data.startLine || 1;
    this.endLine = data.endLine || 1;
    this.dependencies = data.dependencies || [];
    this.ast = data.ast || {};
    this.metrics = data.metrics || this.createDefaultMetrics();

    this.validate();
  }

  private generateId(): string {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }

  private createDefaultMetrics(): CodeMetrics {
    return {
      linesOfCode: 0,
      cyclomaticComplexity: 1,
      dependencyCount: 0,
      lastModified: new Date(),
    };
  }

  private validate(): void {
    // File path must exist
    if (!this.filePath) {
      throw new Error('File path is required');
    }

    // Start line < end line
    if (this.startLine > this.endLine) {
      throw new Error(`Start line ${this.startLine} must be less than or equal to end line ${this.endLine}`);
    }

    // AST must be valid TypeScript/JavaScript
    if (!this.ast || typeof this.ast !== 'object') {
      throw new Error('AST must be a valid object');
    }

    // Module name required
    if (!this.moduleName) {
      throw new Error('Module name is required');
    }
  }

  getLinesOfCode(): number {
    return this.endLine - this.startLine + 1;
  }

  hasDirectDependency(moduleId: string): boolean {
    return this.dependencies.includes(moduleId);
  }

  addDependency(moduleId: string): void {
    if (!this.dependencies.includes(moduleId)) {
      this.dependencies.push(moduleId);
      this.metrics.dependencyCount = this.dependencies.length;
    }
  }

  removeDependency(moduleId: string): void {
    const index = this.dependencies.indexOf(moduleId);
    if (index > -1) {
      this.dependencies.splice(index, 1);
      this.metrics.dependencyCount = this.dependencies.length;
    }
  }

  updateMetrics(metrics: Partial<CodeMetrics>): void {
    this.metrics = {
      ...this.metrics,
      ...metrics,
    };
  }

  isTestFile(): boolean {
    return (
      this.filePath.includes('.test.') ||
      this.filePath.includes('.spec.') ||
      this.filePath.includes('__tests__') ||
      this.filePath.includes('/tests/')
    );
  }

  getModuleSignature(): string {
    // Create a signature for comparison
    return `${this.type}:${this.moduleName}:${this.getLinesOfCode()}`;
  }

  toJSON(): CodeModule {
    return {
      id: this.id,
      filePath: this.filePath,
      moduleName: this.moduleName,
      type: this.type,
      startLine: this.startLine,
      endLine: this.endLine,
      dependencies: this.dependencies,
      ast: this.ast,
      metrics: this.metrics,
    };
  }
}