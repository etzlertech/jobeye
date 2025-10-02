export interface CrudOperations {
  create: boolean;
  read: boolean;
  update: boolean;
  delete: boolean;
}

export interface DatabaseTableMapping {
  tableName: string;
  hasRepository: boolean;
  repositoryPath: string | null;
  hasCrudOperations: CrudOperations;
  usageCount: number;
  lastModified: Date | null;
  isAbandoned: boolean;
}

export class DatabaseTableMappingModel implements DatabaseTableMapping {
  tableName: string;
  hasRepository: boolean;
  repositoryPath: string | null;
  hasCrudOperations: CrudOperations;
  usageCount: number;
  lastModified: Date | null;
  isAbandoned: boolean;

  constructor(data: Partial<DatabaseTableMapping>) {
    this.tableName = data.tableName || '';
    this.hasRepository = data.hasRepository || false;
    this.repositoryPath = data.repositoryPath || null;
    this.hasCrudOperations = data.hasCrudOperations || this.createEmptyCrud();
    this.usageCount = data.usageCount || 0;
    this.lastModified = data.lastModified || null;
    this.isAbandoned = data.isAbandoned !== undefined ? data.isAbandoned : this.calculateAbandoned();

    this.validate();
  }

  private createEmptyCrud(): CrudOperations {
    return {
      create: false,
      read: false,
      update: false,
      delete: false,
    };
  }

  private validate(): void {
    // Table name must match database schema
    if (!this.tableName) {
      throw new Error('Table name is required');
    }

    // If hasRepository true, repositoryPath required
    if (this.hasRepository && !this.repositoryPath) {
      throw new Error('Repository path is required when hasRepository is true');
    }

    // Usage count >= 0
    if (this.usageCount < 0) {
      throw new Error('Usage count must be non-negative');
    }
  }

  private calculateAbandoned(): boolean {
    // A table is considered abandoned if:
    // 1. It has no repository
    // 2. It has no CRUD operations
    // 3. It has zero usage count
    return (
      !this.hasRepository &&
      !this.hasAnyCrudOperation() &&
      this.usageCount === 0
    );
  }

  hasAnyCrudOperation(): boolean {
    return (
      this.hasCrudOperations.create ||
      this.hasCrudOperations.read ||
      this.hasCrudOperations.update ||
      this.hasCrudOperations.delete
    );
  }

  hasFullCrud(): boolean {
    return (
      this.hasCrudOperations.create &&
      this.hasCrudOperations.read &&
      this.hasCrudOperations.update &&
      this.hasCrudOperations.delete
    );
  }

  getCrudCount(): number {
    let count = 0;
    if (this.hasCrudOperations.create) count++;
    if (this.hasCrudOperations.read) count++;
    if (this.hasCrudOperations.update) count++;
    if (this.hasCrudOperations.delete) count++;
    return count;
  }

  updateCrudOperation(operation: keyof CrudOperations, value: boolean): void {
    this.hasCrudOperations[operation] = value;
    this.isAbandoned = this.calculateAbandoned();
  }

  incrementUsage(): void {
    this.usageCount++;
    this.isAbandoned = this.calculateAbandoned();
  }

  setRepository(path: string): void {
    this.hasRepository = true;
    this.repositoryPath = path;
    this.isAbandoned = this.calculateAbandoned();
  }

  getAbandonmentRisk(): 'high' | 'medium' | 'low' | 'none' {
    if (!this.isAbandoned) return 'none';

    // High risk if table was recently modified but has no code
    if (this.lastModified && this.daysSinceModified() < 30) {
      return 'high';
    }

    // Medium risk if table has some usage but no repository
    if (this.usageCount > 0 && !this.hasRepository) {
      return 'medium';
    }

    // Low risk for completely unused old tables
    return 'low';
  }

  private daysSinceModified(): number {
    if (!this.lastModified) return Infinity;
    const diff = Date.now() - this.lastModified.getTime();
    return Math.floor(diff / (1000 * 60 * 60 * 24));
  }

  toJSON(): DatabaseTableMapping {
    return {
      tableName: this.tableName,
      hasRepository: this.hasRepository,
      repositoryPath: this.repositoryPath,
      hasCrudOperations: this.hasCrudOperations,
      usageCount: this.usageCount,
      lastModified: this.lastModified,
      isAbandoned: this.isAbandoned,
    };
  }
}