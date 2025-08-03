// Placeholder Supabase types - replace with actual generated types from your database
export type Database = {
  public: {
    Tables: {
      dev_manifest_history: {
        Row: {
          id: string
          manifest_content: string
          file_count: number
          generated_by: string
          created_at: string
        }
        Insert: {
          id?: string
          manifest_content: string
          file_count: number
          generated_by: string
          created_at?: string
        }
        Update: {
          id?: string
          manifest_content?: string
          file_count?: number
          generated_by?: string
          created_at?: string
        }
      }
    }
  }
}