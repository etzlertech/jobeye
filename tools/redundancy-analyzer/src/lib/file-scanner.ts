import { glob } from 'glob';
import * as path from 'path';
import * as fs from 'fs/promises';

export interface FileScanOptions {
  includePatterns?: string[];
  excludePatterns?: string[];
  includeTests?: boolean;
  includeDocs?: boolean;
  maxFiles?: number;
}

export interface FileInfo {
  path: string;
  size: number;
  extension: string;
  isTest: boolean;
  isDoc: boolean;
  lastModified: Date;
}

export class FileScanner {
  private defaultExclude = [
    'node_modules/**',
    '.git/**',
    'dist/**',
    'build/**',
    'coverage/**',
    '*.min.js',
    '*.map',
  ];

  private codeExtensions = [
    '.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs',
    '.vue', '.svelte', '.py', '.rb', '.java', '.go',
    '.rs', '.php', '.cs', '.cpp', '.c', '.h',
  ];

  private docExtensions = ['.md', '.mdx', '.rst', '.txt', '.adoc'];

  async scanDirectory(
    rootPath: string,
    options: FileScanOptions = {}
  ): Promise<FileInfo[]> {
    const includePatterns = options.includePatterns || ['**/*'];
    const excludePatterns = [
      ...this.defaultExclude,
      ...(options.excludePatterns || []),
    ];

    // Add test exclusion if needed
    if (!options.includeTests) {
      excludePatterns.push(
        '**/*.test.*',
        '**/*.spec.*',
        '**/__tests__/**',
        '**/tests/**',
        '**/test/**'
      );
    }

    // Add doc exclusion if needed
    if (!options.includeDocs) {
      excludePatterns.push(
        '**/*.md',
        '**/docs/**',
        '**/documentation/**'
      );
    }

    const files: FileInfo[] = [];

    for (const pattern of includePatterns) {
      const matches = await glob(pattern, {
        cwd: rootPath,
        ignore: excludePatterns,
        absolute: false,
        nodir: true,
      });

      for (const match of matches) {
        const fullPath = path.join(rootPath, match);
        const fileInfo = await this.getFileInfo(fullPath, rootPath);
        
        if (fileInfo && this.shouldIncludeFile(fileInfo, options)) {
          files.push(fileInfo);
        }

        // Check max files limit
        if (options.maxFiles && files.length >= options.maxFiles) {
          return files;
        }
      }
    }

    return files;
  }

  private async getFileInfo(
    fullPath: string,
    rootPath: string
  ): Promise<FileInfo | null> {
    try {
      const stats = await fs.stat(fullPath);
      const relativePath = path.relative(rootPath, fullPath);
      const extension = path.extname(fullPath).toLowerCase();

      return {
        path: relativePath,
        size: stats.size,
        extension,
        isTest: this.isTestFile(relativePath),
        isDoc: this.isDocFile(relativePath, extension),
        lastModified: stats.mtime,
      };
    } catch (error) {
      console.error(`Error reading file ${fullPath}:`, error);
      return null;
    }
  }

  private shouldIncludeFile(file: FileInfo, options: FileScanOptions): boolean {
    // Filter by extension - only include code files
    if (!this.isCodeFile(file.extension) && !file.isDoc) {
      return false;
    }

    // Apply test filter
    if (!options.includeTests && file.isTest) {
      return false;
    }

    // Apply doc filter
    if (!options.includeDocs && file.isDoc) {
      return false;
    }

    // Skip very large files (> 1MB)
    if (file.size > 1024 * 1024) {
      return false;
    }

    return true;
  }

  private isCodeFile(extension: string): boolean {
    return this.codeExtensions.includes(extension);
  }

  private isTestFile(filePath: string): boolean {
    return (
      filePath.includes('.test.') ||
      filePath.includes('.spec.') ||
      filePath.includes('__tests__') ||
      filePath.includes('/tests/') ||
      filePath.includes('/test/')
    );
  }

  private isDocFile(filePath: string, extension: string): boolean {
    return (
      this.docExtensions.includes(extension) ||
      filePath.includes('/docs/') ||
      filePath.includes('/documentation/')
    );
  }

  async streamFiles(
    rootPath: string,
    options: FileScanOptions,
    callback: (file: FileInfo) => Promise<void>
  ): Promise<number> {
    const includePatterns = options.includePatterns || ['**/*'];
    const excludePatterns = [
      ...this.defaultExclude,
      ...(options.excludePatterns || []),
    ];

    let processedCount = 0;

    for (const pattern of includePatterns) {
      const stream = glob.stream(pattern, {
        cwd: rootPath,
        ignore: excludePatterns,
        absolute: false,
        nodir: true,
      });

      for await (const match of stream) {
        const fullPath = path.join(rootPath, String(match));
        const fileInfo = await this.getFileInfo(fullPath, rootPath);
        
        if (fileInfo && this.shouldIncludeFile(fileInfo, options)) {
          await callback(fileInfo);
          processedCount++;

          if (options.maxFiles && processedCount >= options.maxFiles) {
            return processedCount;
          }
        }
      }
    }

    return processedCount;
  }

  getCodeExtensions(): string[] {
    return [...this.codeExtensions];
  }

  addCodeExtension(extension: string): void {
    if (!extension.startsWith('.')) {
      extension = '.' + extension;
    }
    if (!this.codeExtensions.includes(extension)) {
      this.codeExtensions.push(extension);
    }
  }

  async countFiles(
    rootPath: string,
    options: FileScanOptions = {}
  ): Promise<{ total: number; byExtension: Map<string, number> }> {
    const files = await this.scanDirectory(rootPath, options);
    const byExtension = new Map<string, number>();

    files.forEach((file) => {
      const count = byExtension.get(file.extension) || 0;
      byExtension.set(file.extension, count + 1);
    });

    return {
      total: files.length,
      byExtension,
    };
  }
}