import { SupabaseClient } from '@supabase/supabase-js';

export interface BucketAnalysis {
  name: string;
  id: string;
  is_public: boolean;
  created_at: string;
  updated_at: string;
  allowed_mime_types: string[] | null;
  file_size_limit: number | null;
  folders: FolderAnalysis[];
  total_files: number;
  total_size: number;
  rls_policies: StoragePolicy[];
}

export interface FolderAnalysis {
  path: string;
  file_count: number;
  total_size: number;
  files: FileInfo[];
  subfolders: string[];
}

export interface FileInfo {
  name: string;
  path: string;
  size: number;
  mime_type: string | null;
  created_at: string;
  updated_at: string;
  last_accessed_at: string | null;
  metadata: Record<string, any>;
  cache_control: string | null;
  content_length: number;
  etag: string | null;
}

export interface StoragePolicy {
  policy_name: string;
  bucket_name: string;
  command: string;
  definition: string;
}

export interface StorageAnalysis {
  analyzed_at: string;
  buckets: BucketAnalysis[];
  total_buckets: number;
  total_files: number;
  total_size: number;
  public_buckets: string[];
  empty_buckets: string[];
  large_files: FileInfo[];
  file_type_distribution: Record<string, number>;
  recommendations: string[];
}

export class StorageAnalyzer {
  constructor(private client: SupabaseClient) {}

  async analyze(): Promise<StorageAnalysis> {
    const analyzedAt = new Date().toISOString();
    
    try {
      // Get all buckets
      const buckets = await this.getBuckets();
      const bucketAnalyses: BucketAnalysis[] = [];
      
      console.log(`Found ${buckets.length} storage buckets`);
      
      for (const bucket of buckets) {
        console.log(`  Analyzing bucket: ${bucket.name}...`);
        const analysis = await this.analyzeBucket(bucket);
        bucketAnalyses.push(analysis);
      }
      
      // Calculate statistics
      const totalFiles = bucketAnalyses.reduce((sum, b) => sum + b.total_files, 0);
      const totalSize = bucketAnalyses.reduce((sum, b) => sum + b.total_size, 0);
      const publicBuckets = bucketAnalyses.filter(b => b.is_public).map(b => b.name);
      const emptyBuckets = bucketAnalyses.filter(b => b.total_files === 0).map(b => b.name);
      
      // Find large files (>10MB)
      const largeFiles = this.findLargeFiles(bucketAnalyses, 10 * 1024 * 1024);
      
      // Calculate file type distribution
      const fileTypeDistribution = this.calculateFileTypeDistribution(bucketAnalyses);
      
      // Generate recommendations
      const recommendations = this.generateStorageRecommendations(
        bucketAnalyses,
        largeFiles,
        fileTypeDistribution
      );
      
      return {
        analyzed_at: analyzedAt,
        buckets: bucketAnalyses,
        total_buckets: bucketAnalyses.length,
        total_files: totalFiles,
        total_size: totalSize,
        public_buckets: publicBuckets,
        empty_buckets: emptyBuckets,
        large_files: largeFiles,
        file_type_distribution: fileTypeDistribution,
        recommendations
      };
    } catch (error) {
      console.error('Storage analysis error:', error);
      // Return minimal analysis if storage access fails
      return {
        analyzed_at: analyzedAt,
        buckets: [],
        total_buckets: 0,
        total_files: 0,
        total_size: 0,
        public_buckets: [],
        empty_buckets: [],
        large_files: [],
        file_type_distribution: {},
        recommendations: ['Unable to access storage buckets - check permissions']
      };
    }
  }

  private async getBuckets(): Promise<any[]> {
    try {
      const { data: buckets, error } = await this.client.storage.listBuckets();
      
      if (error) {
        console.error('Error listing buckets:', error);
        return [];
      }
      
      return buckets || [];
    } catch (error) {
      console.error('Failed to list buckets:', error);
      return [];
    }
  }

  private async analyzeBucket(bucket: any): Promise<BucketAnalysis> {
    const folders = await this.analyzeFolders(bucket.name, '');
    
    // Get RLS policies for storage
    const policies = await this.getStoragePolicies(bucket.name);
    
    // Calculate totals
    const totalFiles = this.countFiles(folders);
    const totalSize = this.calculateTotalSize(folders);
    
    return {
      name: bucket.name,
      id: bucket.id,
      is_public: bucket.public || false,
      created_at: bucket.created_at,
      updated_at: bucket.updated_at,
      allowed_mime_types: bucket.allowed_mime_types,
      file_size_limit: bucket.file_size_limit,
      folders,
      total_files: totalFiles,
      total_size: totalSize,
      rls_policies: policies
    };
  }

  private async analyzeFolders(
    bucketName: string, 
    path: string, 
    maxDepth: number = 5,
    currentDepth: number = 0
  ): Promise<FolderAnalysis[]> {
    if (currentDepth >= maxDepth) {
      return [];
    }

    const folderAnalyses: FolderAnalysis[] = [];
    
    try {
      // List files in current path
      const { data: files, error } = await this.client.storage
        .from(bucketName)
        .list(path, {
          limit: 1000,
          offset: 0
        });
      
      if (error) {
        console.error(`Error listing files in ${bucketName}/${path}:`, error);
        return [];
      }
      
      if (!files || files.length === 0) {
        return [];
      }
      
      // Separate files and folders
      const fileInfos: FileInfo[] = [];
      const subfolders: string[] = [];
      let totalSize = 0;
      
      for (const item of files) {
        const fullPath = path ? `${path}/${item.name}` : item.name;
        
        if (item.metadata && !item.id) {
          // This is a folder
          subfolders.push(item.name);
          
          // Recursively analyze subfolder
          if (currentDepth < maxDepth - 1) {
            const subfolderAnalyses = await this.analyzeFolders(
              bucketName, 
              fullPath, 
              maxDepth,
              currentDepth + 1
            );
            folderAnalyses.push(...subfolderAnalyses);
          }
        } else {
          // This is a file
          const fileInfo: FileInfo = {
            name: item.name,
            path: fullPath,
            size: item.metadata?.size || 0,
            mime_type: item.metadata?.mimetype || null,
            created_at: item.created_at || '',
            updated_at: item.updated_at || item.created_at || '',
            last_accessed_at: item.last_accessed_at || null,
            metadata: item.metadata || {},
            cache_control: item.metadata?.cacheControl || null,
            content_length: item.metadata?.size || 0,
            etag: item.metadata?.eTag || null
          };
          
          fileInfos.push(fileInfo);
          totalSize += fileInfo.size;
        }
      }
      
      // Add current folder analysis
      if (fileInfos.length > 0 || subfolders.length > 0) {
        folderAnalyses.unshift({
          path: path || '/',
          file_count: fileInfos.length,
          total_size: totalSize,
          files: fileInfos,
          subfolders
        });
      }
      
      return folderAnalyses;
    } catch (error) {
      console.error(`Failed to analyze folders in ${bucketName}/${path}:`, error);
      return [];
    }
  }

  private async getStoragePolicies(bucketName: string): Promise<StoragePolicy[]> {
    try {
      const { data, error } = await this.client.rpc('exec_sql', {
        sql: `
          SELECT 
            name as policy_name,
            bucket_id as bucket_name,
            CASE 
              WHEN operation = 'INSERT' THEN 'INSERT'
              WHEN operation = 'SELECT' THEN 'SELECT'
              WHEN operation = 'UPDATE' THEN 'UPDATE'
              WHEN operation = 'DELETE' THEN 'DELETE'
              ELSE operation
            END as command,
            definition
          FROM storage.policies
          WHERE bucket_id = '${bucketName}';
        `
      });
      
      if (error) {
        console.error('Error fetching storage policies:', error);
        return [];
      }
      
      return data || [];
    } catch (error) {
      // Storage schema might not be accessible
      return [];
    }
  }

  private countFiles(folders: FolderAnalysis[]): number {
    return folders.reduce((sum, folder) => sum + folder.file_count, 0);
  }

  private calculateTotalSize(folders: FolderAnalysis[]): number {
    return folders.reduce((sum, folder) => sum + folder.total_size, 0);
  }

  private findLargeFiles(buckets: BucketAnalysis[], sizeThreshold: number): FileInfo[] {
    const largeFiles: FileInfo[] = [];
    
    for (const bucket of buckets) {
      for (const folder of bucket.folders) {
        for (const file of folder.files) {
          if (file.size >= sizeThreshold) {
            largeFiles.push(file);
          }
        }
      }
    }
    
    // Sort by size descending and take top 20
    return largeFiles
      .sort((a, b) => b.size - a.size)
      .slice(0, 20);
  }

  private calculateFileTypeDistribution(buckets: BucketAnalysis[]): Record<string, number> {
    const distribution: Record<string, number> = {};
    
    for (const bucket of buckets) {
      for (const folder of bucket.folders) {
        for (const file of folder.files) {
          const ext = this.getFileExtension(file.name);
          distribution[ext] = (distribution[ext] || 0) + 1;
        }
      }
    }
    
    return distribution;
  }

  private getFileExtension(filename: string): string {
    const parts = filename.split('.');
    if (parts.length > 1) {
      return parts[parts.length - 1].toLowerCase();
    }
    return 'no_extension';
  }

  private generateStorageRecommendations(
    buckets: BucketAnalysis[],
    largeFiles: FileInfo[],
    fileTypeDistribution: Record<string, number>
  ): string[] {
    const recommendations: string[] = [];
    
    // Check for public buckets with sensitive data patterns
    const publicBuckets = buckets.filter(b => b.is_public);
    if (publicBuckets.length > 0) {
      const sensitivePatterns = ['backup', 'private', 'internal', 'config', 'env'];
      for (const bucket of publicBuckets) {
        if (sensitivePatterns.some(pattern => bucket.name.includes(pattern))) {
          recommendations.push(
            `Review public access on bucket '${bucket.name}' - name suggests sensitive content`
          );
        }
      }
    }
    
    // Check for empty buckets
    const emptyBuckets = buckets.filter(b => b.total_files === 0);
    if (emptyBuckets.length > 2) {
      recommendations.push(
        `Remove ${emptyBuckets.length} unused buckets: ${emptyBuckets.map(b => b.name).join(', ')}`
      );
    }
    
    // Check for large files
    if (largeFiles.length > 10) {
      const totalLargeSize = largeFiles.reduce((sum, f) => sum + f.size, 0);
      recommendations.push(
        `Optimize ${largeFiles.length} large files (${this.formatBytes(totalLargeSize)} total)`
      );
    }
    
    // Check for unorganized files
    const rootFiles = buckets.reduce((count, bucket) => {
      const rootFolder = bucket.folders.find(f => f.path === '/' || f.path === '');
      return count + (rootFolder?.file_count || 0);
    }, 0);
    
    if (rootFiles > 50) {
      recommendations.push(
        `Organize ${rootFiles} files in root directories into subfolders`
      );
    }
    
    // Check for missing RLS policies
    const bucketsWithoutPolicies = buckets.filter(b => b.rls_policies.length === 0);
    if (bucketsWithoutPolicies.length > 0) {
      recommendations.push(
        `Add RLS policies to ${bucketsWithoutPolicies.length} buckets without access control`
      );
    }
    
    // Check for potential duplicate files (same size in same bucket)
    for (const bucket of buckets) {
      const sizeMap = new Map<number, number>();
      for (const folder of bucket.folders) {
        for (const file of folder.files) {
          const count = sizeMap.get(file.size) || 0;
          sizeMap.set(file.size, count + 1);
        }
      }
      
      const duplicateSizes = Array.from(sizeMap.entries())
        .filter(([size, count]) => count > 3 && size > 1024) // More than 3 files with same size > 1KB
        .length;
      
      if (duplicateSizes > 5) {
        recommendations.push(
          `Check bucket '${bucket.name}' for potential duplicate files`
        );
      }
    }
    
    return recommendations;
  }

  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }
}