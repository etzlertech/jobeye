import * as fs from 'fs/promises';
import * as path from 'path';
import * as ts from 'typescript';

export interface TableReference {
  tableName: string;
  filePath: string;
  line: number;
  column: number;
  type: 'client_call' | 'repository' | 'service' | 'api_route' | 'component' | 'migration' | 'type_definition';
  operation?: string;
  context?: string;
}

export interface FileAnalysis {
  filePath: string;
  fileType: 'repository' | 'service' | 'api_route' | 'component' | 'migration' | 'other';
  tableReferences: TableReference[];
  imports: string[];
}

export class CodeScanner {
  private tableReferences: TableReference[] = [];
  private knownTables: Set<string>;

  constructor(knownTables: string[]) {
    this.knownTables = new Set(knownTables);
  }

  async scanDirectory(dirPath: string, exclude: string[] = []): Promise<TableReference[]> {
    this.tableReferences = [];
    await this.walkDirectory(dirPath, exclude);
    return this.tableReferences;
  }

  private async walkDirectory(dirPath: string, exclude: string[]) {
    try {
      const entries = await fs.readdir(dirPath, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name);
        
        // Skip excluded paths
        if (exclude.some(ex => fullPath.includes(ex))) continue;
        
        if (entry.isDirectory()) {
          // Skip common non-source directories
          if (['node_modules', '.git', 'dist', 'build', '.next', 'coverage'].includes(entry.name)) {
            continue;
          }
          await this.walkDirectory(fullPath, exclude);
        } else if (entry.isFile() && this.isSourceFile(entry.name)) {
          await this.analyzeFile(fullPath);
        }
      }
    } catch (error) {
      console.error(`Error scanning directory ${dirPath}:`, error);
    }
  }

  private isSourceFile(fileName: string): boolean {
    return /\.(ts|tsx|js|jsx)$/.test(fileName) && !fileName.endsWith('.d.ts');
  }

  private async analyzeFile(filePath: string) {
    try {
      const content = await fs.readFile(filePath, 'utf8');
      const sourceFile = ts.createSourceFile(
        filePath,
        content,
        ts.ScriptTarget.Latest,
        true
      );

      const fileType = this.determineFileType(filePath);
      
      // Walk the AST
      this.visitNode(sourceFile, sourceFile, filePath, fileType);
    } catch (error) {
      console.error(`Error analyzing file ${filePath}:`, error);
    }
  }

  private determineFileType(filePath: string): FileAnalysis['fileType'] {
    if (filePath.includes('/repositories/')) return 'repository';
    if (filePath.includes('/services/')) return 'service';
    if (filePath.includes('/api/') && filePath.endsWith('route.ts')) return 'api_route';
    if (filePath.includes('/components/')) return 'component';
    if (filePath.includes('/migrations/')) return 'migration';
    return 'other';
  }

  private visitNode(node: ts.Node, sourceFile: ts.SourceFile, filePath: string, fileType: FileAnalysis['fileType']) {
    // Look for Supabase client calls: .from('table_name')
    if (ts.isCallExpression(node)) {
      const expression = node.expression;
      
      // Check for .from() calls
      if (ts.isPropertyAccessExpression(expression) && expression.name.text === 'from') {
        if (node.arguments.length > 0 && ts.isStringLiteral(node.arguments[0])) {
          const tableName = node.arguments[0].text;
          
          if (this.knownTables.has(tableName)) {
            const { line, character } = sourceFile.getLineAndCharacterOfPosition(node.getStart());
            
            // Try to determine the operation
            const operation = this.findChainedOperation(node);
            
            this.tableReferences.push({
              tableName,
              filePath,
              line: line + 1,
              column: character + 1,
              type: this.getRefType(fileType),
              operation,
              context: this.getContext(node, sourceFile)
            });
          }
        }
      }
      
      // Check for RPC calls that might reference tables
      if (ts.isPropertyAccessExpression(expression) && expression.name.text === 'rpc') {
        this.checkRpcCall(node, sourceFile, filePath, fileType);
      }
    }
    
    // Look for SQL template literals
    if (ts.isTemplateExpression(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
      this.checkSqlQuery(node, sourceFile, filePath, fileType);
    }
    
    // Look for type definitions referencing tables
    if (ts.isTypeReferenceNode(node)) {
      this.checkTypeReference(node, sourceFile, filePath, fileType);
    }

    // Continue traversing
    ts.forEachChild(node, child => this.visitNode(child, sourceFile, filePath, fileType));
  }

  private findChainedOperation(fromCall: ts.CallExpression): string | undefined {
    let parent = fromCall.parent;
    const operations: string[] = [];
    
    while (parent && ts.isCallExpression(parent.parent)) {
      if (ts.isPropertyAccessExpression(parent) && parent.expression === fromCall) {
        operations.push(parent.name.text);
      }
      parent = parent.parent;
    }
    
    // Common Supabase operations
    const knownOps = ['select', 'insert', 'update', 'upsert', 'delete'];
    return operations.find(op => knownOps.includes(op));
  }

  private getRefType(fileType: FileAnalysis['fileType']): TableReference['type'] {
    switch (fileType) {
      case 'repository': return 'repository';
      case 'service': return 'service';
      case 'api_route': return 'api_route';
      case 'component': return 'component';
      case 'migration': return 'migration';
      default: return 'client_call';
    }
  }

  private getContext(node: ts.Node, sourceFile: ts.SourceFile): string {
    // Find the containing function or method
    let parent = node.parent;
    while (parent) {
      if (ts.isFunctionDeclaration(parent) || ts.isMethodDeclaration(parent)) {
        const name = parent.name?.getText() || 'anonymous';
        return `function: ${name}`;
      }
      if (ts.isArrowFunction(parent) && ts.isVariableDeclaration(parent.parent)) {
        return `const: ${parent.parent.name.getText()}`;
      }
      parent = parent.parent;
    }
    return 'global scope';
  }

  private checkRpcCall(node: ts.CallExpression, sourceFile: ts.SourceFile, filePath: string, fileType: FileAnalysis['fileType']) {
    if (node.arguments.length > 0 && ts.isStringLiteral(node.arguments[0])) {
      const rpcName = node.arguments[0].text;
      
      // Check if the RPC name contains table references
      for (const table of this.knownTables) {
        if (rpcName.includes(table) || (node.arguments.length > 1 && node.arguments[1].getText().includes(table))) {
          const { line, character } = sourceFile.getLineAndCharacterOfPosition(node.getStart());
          
          this.tableReferences.push({
            tableName: table,
            filePath,
            line: line + 1,
            column: character + 1,
            type: this.getRefType(fileType),
            operation: `rpc:${rpcName}`,
            context: this.getContext(node, sourceFile)
          });
        }
      }
    }
  }

  private checkSqlQuery(node: ts.TemplateExpression | ts.NoSubstitutionTemplateLiteral, sourceFile: ts.SourceFile, filePath: string, fileType: FileAnalysis['fileType']) {
    const text = node.getText().toLowerCase();
    
    // Look for SQL keywords followed by table names
    const sqlPatterns = [
      /from\s+["'`]?(\w+)["'`]?/g,
      /join\s+["'`]?(\w+)["'`]?/g,
      /into\s+["'`]?(\w+)["'`]?/g,
      /update\s+["'`]?(\w+)["'`]?/g,
      /delete\s+from\s+["'`]?(\w+)["'`]?/g,
      /create\s+table\s+["'`]?(\w+)["'`]?/g,
      /alter\s+table\s+["'`]?(\w+)["'`]?/g,
      /drop\s+table\s+["'`]?(\w+)["'`]?/g
    ];
    
    for (const pattern of sqlPatterns) {
      let match;
      while ((match = pattern.exec(text)) !== null) {
        const tableName = match[1];
        if (this.knownTables.has(tableName)) {
          const { line, character } = sourceFile.getLineAndCharacterOfPosition(node.getStart());
          
          this.tableReferences.push({
            tableName,
            filePath,
            line: line + 1,
            column: character + 1,
            type: 'migration',
            operation: 'sql',
            context: this.getContext(node, sourceFile)
          });
        }
      }
    }
  }

  private checkTypeReference(node: ts.TypeReferenceNode, sourceFile: ts.SourceFile, filePath: string, fileType: FileAnalysis['fileType']) {
    const typeName = node.typeName.getText();
    
    // Check for Database['public']['Tables']['tablename'] pattern
    if (typeName === 'Database' && node.typeArguments) {
      const typeText = node.getText();
      for (const table of this.knownTables) {
        if (typeText.includes(`['${table}']`)) {
          const { line, character } = sourceFile.getLineAndCharacterOfPosition(node.getStart());
          
          this.tableReferences.push({
            tableName: table,
            filePath,
            line: line + 1,
            column: character + 1,
            type: 'type_definition',
            operation: 'type',
            context: this.getContext(node, sourceFile)
          });
        }
      }
    }
    
    // Check for direct table type references (e.g., CustomersRow, JobsInsert)
    for (const table of this.knownTables) {
      const tableTypePatterns = [
        new RegExp(`^${table}Row$`, 'i'),
        new RegExp(`^${table}Insert$`, 'i'),
        new RegExp(`^${table}Update$`, 'i'),
        new RegExp(`^${table}Table$`, 'i')
      ];
      
      if (tableTypePatterns.some(pattern => pattern.test(typeName))) {
        const { line, character } = sourceFile.getLineAndCharacterOfPosition(node.getStart());
        
        this.tableReferences.push({
          tableName: table,
          filePath,
          line: line + 1,
          column: character + 1,
          type: 'type_definition',
          operation: 'type',
          context: this.getContext(node, sourceFile)
        });
      }
    }
  }
}