/**
 * T062: InstructionDocumentRepository
 * Repository for managing instruction documents with versioning and crew assignment
 */
import { SupabaseClient } from '@supabase/supabase-js';

export interface InstructionDocument {
  id: string;
  tenant_id: string;
  title: string;
  description?: string;
  content: string; // Markdown or rich text
  document_type: 'procedure' | 'safety_guideline' | 'equipment_manual' | 'best_practice' | 'troubleshooting';
  category?: string;
  tags?: string[];
  version: number;
  previous_version_id?: string;
  file_attachments?: Array<{
    file_id: string;
    file_name: string;
    file_url: string;
    file_size_bytes: number;
    mime_type: string;
  }>;
  assigned_to_crews?: string[]; // Array of crew IDs
  required_for_job_types?: string[];
  active: boolean;
  view_count: number;
  last_viewed_at?: string;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export class InstructionDocumentRepository {
  constructor(private supabase: SupabaseClient) {}

  async findById(id: string): Promise<InstructionDocument | null> {
    const { data, error } = await this.supabase
      .from('instruction_documents')
      .select('*')
      .eq('id', id)
      .single();

    if (error) throw error;
    return data;
  }

  async findAll(options?: {
    active?: boolean;
    documentType?: InstructionDocument['document_type'];
    category?: string;
    tag?: string;
    limit?: number;
    orderBy?: 'title' | 'view_count' | 'created_at' | 'updated_at';
  }): Promise<InstructionDocument[]> {
    let query = this.supabase.from('instruction_documents').select('*');

    if (options?.active !== undefined) {
      query = query.eq('active', options.active);
    }

    if (options?.documentType) {
      query = query.eq('document_type', options.documentType);
    }

    if (options?.category) {
      query = query.eq('category', options.category);
    }

    if (options?.tag) {
      query = query.contains('tags', [options.tag]);
    }

    const orderBy = options?.orderBy || 'title';
    const ascending = orderBy === 'title';
    query = query.order(orderBy, { ascending });

    if (options?.limit) {
      query = query.limit(options.limit);
    }

    const { data, error } = await query;

    if (error) throw error;
    return data || [];
  }

  async findByType(documentType: InstructionDocument['document_type']): Promise<InstructionDocument[]> {
    const { data, error } = await this.supabase
      .from('instruction_documents')
      .select('*')
      .eq('document_type', documentType)
      .eq('active', true)
      .order('title', { ascending: true });

    if (error) throw error;
    return data || [];
  }

  async findByCategory(category: string): Promise<InstructionDocument[]> {
    const { data, error } = await this.supabase
      .from('instruction_documents')
      .select('*')
      .eq('category', category)
      .eq('active', true)
      .order('title', { ascending: true });

    if (error) throw error;
    return data || [];
  }

  async findByJobType(jobType: string): Promise<InstructionDocument[]> {
    const { data, error } = await this.supabase
      .from('instruction_documents')
      .select('*')
      .contains('required_for_job_types', [jobType])
      .eq('active', true)
      .order('title', { ascending: true });

    if (error) throw error;
    return data || [];
  }

  async findByCrewId(crewId: string): Promise<InstructionDocument[]> {
    const { data, error } = await this.supabase
      .from('instruction_documents')
      .select('*')
      .contains('assigned_to_crews', [crewId])
      .eq('active', true)
      .order('title', { ascending: true });

    if (error) throw error;
    return data || [];
  }

  async findByTag(tag: string): Promise<InstructionDocument[]> {
    const { data, error } = await this.supabase
      .from('instruction_documents')
      .select('*')
      .contains('tags', [tag])
      .eq('active', true)
      .order('title', { ascending: true });

    if (error) throw error;
    return data || [];
  }

  async findVersionHistory(documentId: string): Promise<InstructionDocument[]> {
    const versions: InstructionDocument[] = [];
    let currentDoc = await this.findById(documentId);

    while (currentDoc) {
      versions.push(currentDoc);
      if (!currentDoc.previous_version_id) break;
      currentDoc = await this.findById(currentDoc.previous_version_id);
    }

    return versions;
  }

  async findMostViewed(limit: number = 10): Promise<InstructionDocument[]> {
    const { data, error } = await this.supabase
      .from('instruction_documents')
      .select('*')
      .eq('active', true)
      .order('view_count', { ascending: false })
      .limit(limit);

    if (error) throw error;
    return data || [];
  }

  async search(searchTerm: string, options?: {
    documentType?: InstructionDocument['document_type'];
    category?: string;
  }): Promise<InstructionDocument[]> {
    let query = this.supabase
      .from('instruction_documents')
      .select('*')
      .eq('active', true);

    if (options?.documentType) {
      query = query.eq('document_type', options.documentType);
    }

    if (options?.category) {
      query = query.eq('category', options.category);
    }

    const { data, error } = await query;

    if (error) throw error;

    // Filter by search term (case-insensitive, checks title, description, content)
    const searchLower = searchTerm.toLowerCase();
    return (data || []).filter((doc) => {
      return (
        doc.title?.toLowerCase().includes(searchLower) ||
        doc.description?.toLowerCase().includes(searchLower) ||
        doc.content?.toLowerCase().includes(searchLower) ||
        doc.tags?.some((tag: any) => tag.toLowerCase().includes(searchLower))
      );
    });
  }

  async create(document: Omit<InstructionDocument, 'id' | 'created_at' | 'updated_at' | 'view_count' | 'version'>): Promise<InstructionDocument> {
    const { data, error } = await this.supabase
      .from('instruction_documents')
      .insert({ ...document, view_count: 0, version: 1 })
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async update(id: string, updates: Partial<InstructionDocument>): Promise<InstructionDocument> {
    const { data, error } = await this.supabase
      .from('instruction_documents')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async createNewVersion(
    originalId: string,
    updates: Partial<Omit<InstructionDocument, 'id' | 'version' | 'previous_version_id'>>
  ): Promise<InstructionDocument> {
    const original = await this.findById(originalId);
    if (!original) throw new Error('Original document not found');

    // Create new version
    const newVersion: Omit<InstructionDocument, 'id' | 'created_at' | 'updated_at'> = {
      ...original,
      ...updates,
      version: original.version + 1,
      previous_version_id: originalId,
      view_count: 0,
    };

    const { data, error } = await this.supabase
      .from('instruction_documents')
      .insert(newVersion)
      .select()
      .single();

    if (error) throw error;

    // Optionally deactivate old version
    await this.update(originalId, { active: false });

    return data;
  }

  async incrementViewCount(id: string): Promise<InstructionDocument> {
    const doc = await this.findById(id);
    if (!doc) throw new Error('Document not found');

    return this.update(id, {
      view_count: doc.view_count + 1,
      last_viewed_at: new Date().toISOString(),
    });
  }

  async addTag(id: string, tag: string): Promise<InstructionDocument> {
    const doc = await this.findById(id);
    if (!doc) throw new Error('Document not found');

    const currentTags = doc.tags || [];
    if (currentTags.includes(tag)) {
      return doc; // Already exists
    }

    const updatedTags = [...currentTags, tag];
    return this.update(id, { tags: updatedTags });
  }

  async removeTag(id: string, tag: string): Promise<InstructionDocument> {
    const doc = await this.findById(id);
    if (!doc) throw new Error('Document not found');

    const updatedTags = (doc.tags || []).filter((t) => t !== tag);
    return this.update(id, { tags: updatedTags });
  }

  async assignToCrew(id: string, crewId: string): Promise<InstructionDocument> {
    const doc = await this.findById(id);
    if (!doc) throw new Error('Document not found');

    const currentCrews = doc.assigned_to_crews || [];
    if (currentCrews.includes(crewId)) {
      return doc; // Already assigned
    }

    const updatedCrews = [...currentCrews, crewId];
    return this.update(id, { assigned_to_crews: updatedCrews });
  }

  async unassignFromCrew(id: string, crewId: string): Promise<InstructionDocument> {
    const doc = await this.findById(id);
    if (!doc) throw new Error('Document not found');

    const updatedCrews = (doc.assigned_to_crews || []).filter((cId) => cId !== crewId);
    return this.update(id, { assigned_to_crews: updatedCrews });
  }

  async setActive(id: string, active: boolean): Promise<InstructionDocument> {
    return this.update(id, { active });
  }

  async delete(id: string): Promise<void> {
    const { error } = await this.supabase
      .from('instruction_documents')
      .delete()
      .eq('id', id);

    if (error) throw error;
  }

  async getAllTags(): Promise<string[]> {
    const { data, error } = await this.supabase
      .from('instruction_documents')
      .select('tags')
      .eq('active', true);

    if (error) throw error;

    // Flatten and deduplicate
    const allTags = new Set<string>();
    (data || []).forEach((doc) => {
      (doc.tags || []).forEach((tag: any) => allTags.add(tag));
    });

    return Array.from(allTags).sort();
  }

  async getAllCategories(): Promise<string[]> {
    const { data, error } = await this.supabase
      .from('instruction_documents')
      .select('category')
      .eq('active', true);

    if (error) throw error;

    const categories = new Set<string>();
    (data || []).forEach((doc) => {
      if (doc.category) categories.add(doc.category);
    });

    return Array.from(categories).sort();
  }
}