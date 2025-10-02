import { Project, SourceFile, Node, SyntaxKind } from 'ts-morph';
import { parse as babelParse } from '@babel/parser';
import type { CodeModule, ModuleType } from '../models/code-module.model';
import { CodeModuleModel } from '../models/code-module.model';
import { ErrorHandler, AnalysisError, ErrorCode } from '../lib/error-handler';
import * as fs from 'fs/promises';
import * as path from 'path';

export interface ParseOptions {
  includeTests?: boolean;
  includeDocs?: boolean;
  minModuleSize?: number;
}

export class AstParserService {
  private project: Project;
  private moduleCache: Map<string, CodeModule[]>;
  private errorHandler: ErrorHandler;

  constructor() {
    this.project = new Project({
      tsConfigFilePath: undefined, // We'll add files manually
      skipAddingFilesFromTsConfig: true,
    });
    this.moduleCache = new Map();
    this.errorHandler = ErrorHandler.getInstance();
  }

  async parseFile(filePath: string, options: ParseOptions = {}): Promise<CodeModule[]> {
    // Check cache first
    if (this.moduleCache.has(filePath)) {
      return this.moduleCache.get(filePath)!;
    }

    try {
      return await this.errorHandler.withRetry(
        async () => {
          const fileContent = await fs.readFile(filePath, 'utf-8');
          const extension = path.extname(filePath).toLowerCase();
          const modules: CodeModule[] = [];

          if (extension === '.ts' || extension === '.tsx') {
            modules.push(...await this.parseTypeScriptFile(filePath, fileContent, options));
          } else if (extension === '.js' || extension === '.jsx') {
            modules.push(...await this.parseJavaScriptFile(filePath, fileContent, options));
          }

          // Cache the results
          this.moduleCache.set(filePath, modules);
          return modules;
        },
        {
          maxRetries: 1, // File parsing usually doesn't benefit from retries
          operationId: `parse-${filePath}`,
          onRetry: (attempt, error) => {
            this.errorHandler.logWarning(`Retrying parse of ${filePath} (attempt ${attempt})`);
          }
        }
      );
    } catch (error) {
      if (error instanceof AnalysisError) {
        // Re-throw analysis errors
        throw error;
      }
      
      // Convert other errors to analysis errors
      const analysisError = this.errorHandler.handleParseError(error, filePath);
      this.errorHandler.logError(analysisError);
      
      // Return empty array for non-critical parse failures
      return [];
    }
  }

  private async parseTypeScriptFile(
    filePath: string,
    content: string,
    options: ParseOptions
  ): Promise<CodeModule[]> {
    const sourceFile = this.project.createSourceFile(filePath, content, { overwrite: true });
    const modules: CodeModule[] = [];

    // Parse classes
    sourceFile.getClasses().forEach((classDecl) => {
      const module = this.createModuleFromNode(
        classDecl,
        filePath,
        'class',
        classDecl.getName() || 'AnonymousClass'
      );
      if (this.shouldIncludeModule(module, options)) {
        modules.push(module);
      }
    });

    // Parse functions
    sourceFile.getFunctions().forEach((funcDecl) => {
      const module = this.createModuleFromNode(
        funcDecl,
        filePath,
        'function',
        funcDecl.getName() || 'AnonymousFunction'
      );
      if (this.shouldIncludeModule(module, options)) {
        modules.push(module);
      }
    });

    // Parse arrow functions assigned to variables
    sourceFile.getVariableDeclarations().forEach((varDecl) => {
      const initializer = varDecl.getInitializer();
      if (initializer && Node.isArrowFunction(initializer)) {
        const module = this.createModuleFromNode(
          initializer,
          filePath,
          'function',
          varDecl.getName()
        );
        if (this.shouldIncludeModule(module, options)) {
          modules.push(module);
        }
      }
    });

    // Detect module type based on patterns
    modules.forEach((module) => {
      module.type = this.detectModuleType(module, sourceFile);
    });

    // Extract dependencies
    this.extractDependencies(modules, sourceFile);

    return modules;
  }

  private async parseJavaScriptFile(
    filePath: string,
    content: string,
    options: ParseOptions
  ): Promise<CodeModule[]> {
    const modules: CodeModule[] = [];

    try {
      const ast = babelParse(content, {
        sourceType: 'module',
        plugins: ['jsx', 'typescript'],
      });

      // Simple JavaScript parsing - extract functions and classes
      // This is a simplified version - in production, we'd traverse the AST more thoroughly
      const lines = content.split('\n');
      
      // Look for function declarations and class declarations
      lines.forEach((line, index) => {
        const functionMatch = line.match(/(?:export\s+)?(?:async\s+)?function\s+(\w+)/);
        const classMatch = line.match(/(?:export\s+)?class\s+(\w+)/);
        
        if (functionMatch || classMatch) {
          const name = functionMatch?.[1] || classMatch?.[1];
          const type: ModuleType = functionMatch ? 'function' : 'class';
          
          if (name) {
            const startLine = index + 1;
            const endLine = this.findEndLine(lines, index);
            
            const module = new CodeModuleModel({
              filePath,
              moduleName: name,
              type,
              startLine,
              endLine,
              ast: {}, // Simplified AST
              metrics: {
                linesOfCode: endLine - startLine + 1,
                cyclomaticComplexity: 1,
                dependencyCount: 0,
                lastModified: new Date(),
              },
            });
            
            if (this.shouldIncludeModule(module, options)) {
              modules.push(module);
            }
          }
        }
      });
    } catch (error) {
      console.error(`Error parsing JavaScript file ${filePath}:`, error);
    }

    return modules;
  }

  private createModuleFromNode(
    node: Node,
    filePath: string,
    type: ModuleType,
    name: string
  ): CodeModule {
    const startLine = node.getStartLineNumber();
    const endLine = node.getEndLineNumber();
    
    return new CodeModuleModel({
      filePath,
      moduleName: name,
      type,
      startLine,
      endLine,
      ast: this.simplifyAst(node),
      metrics: {
        linesOfCode: endLine - startLine + 1,
        cyclomaticComplexity: this.calculateComplexity(node),
        dependencyCount: 0, // Will be updated later
        lastModified: new Date(), // Would get from git in production
      },
    });
  }

  private simplifyAst(node: Node): object {
    // Create a simplified AST representation for comparison
    return {
      kind: node.getKindName(),
      text: node.getText().substring(0, 100), // First 100 chars
      childCount: node.getChildren().length,
    };
  }

  private calculateComplexity(node: Node): number {
    let complexity = 1;

    node.forEachDescendant((descendant) => {
      if (
        Node.isIfStatement(descendant) ||
        Node.isWhileStatement(descendant) ||
        Node.isForStatement(descendant) ||
        Node.isDoStatement(descendant) ||
        Node.isCaseClause(descendant) ||
        Node.isCatchClause(descendant)
      ) {
        complexity++;
      }
    });

    return complexity;
  }

  private detectModuleType(module: CodeModule, sourceFile: SourceFile): ModuleType {
    const text = sourceFile.getFullText();
    const moduleText = text.substring(
      sourceFile.getPositionOfLineAndCharacter(module.startLine - 1, 0),
      sourceFile.getPositionOfLineAndCharacter(module.endLine, 0)
    );

    // Detect React components
    if (moduleText.includes('React.Component') || moduleText.includes('JSX.Element')) {
      return 'component';
    }

    // Detect services
    if (module.moduleName.toLowerCase().includes('service') || 
        moduleText.includes('@Injectable')) {
      return 'service';
    }

    // Detect repositories
    if (module.moduleName.toLowerCase().includes('repository') || 
        moduleText.includes('extends BaseRepository')) {
      return 'repository';
    }

    return module.type;
  }

  private extractDependencies(modules: CodeModule[], sourceFile: SourceFile): void {
    // Extract import statements
    const imports = sourceFile.getImportDeclarations();
    
    imports.forEach((importDecl) => {
      const moduleSpecifier = importDecl.getModuleSpecifierValue();
      
      // For each module, check if it uses this import
      modules.forEach((module) => {
        const moduleText = sourceFile.getFullText().substring(
          sourceFile.getPositionOfLineAndCharacter(module.startLine - 1, 0),
          sourceFile.getPositionOfLineAndCharacter(module.endLine, 0)
        );
        
        // Simple check - in production, we'd do proper scope analysis
        importDecl.getNamedImports().forEach((namedImport) => {
          const importName = namedImport.getName();
          if (moduleText.includes(importName)) {
            module.dependencies.push(moduleSpecifier);
          }
        });
      });
    });
  }

  private shouldIncludeModule(module: CodeModule, options: ParseOptions): boolean {
    // Check minimum size
    const minSize = options.minModuleSize || 10;
    if (module.metrics.linesOfCode < minSize) {
      return false;
    }

    // Check if tests should be included
    if (!options.includeTests && module.isTestFile()) {
      return false;
    }

    // Check if docs should be included
    if (!options.includeDocs && this.isDocFile(module.filePath)) {
      return false;
    }

    return true;
  }

  private isDocFile(filePath: string): boolean {
    return filePath.includes('/docs/') || 
           filePath.includes('/documentation/') ||
           filePath.endsWith('.md');
  }

  private findEndLine(lines: string[], startIndex: number): number {
    let braceCount = 0;
    let inFunction = false;

    for (let i = startIndex; i < lines.length; i++) {
      const line = lines[i];
      
      for (const char of line) {
        if (char === '{') {
          braceCount++;
          inFunction = true;
        } else if (char === '}') {
          braceCount--;
          if (braceCount === 0 && inFunction) {
            return i + 1;
          }
        }
      }
    }

    return startIndex + 1; // Default to single line if no end found
  }

  clearCache(): void {
    this.moduleCache.clear();
  }

  getCacheSize(): number {
    return this.moduleCache.size;
  }
}