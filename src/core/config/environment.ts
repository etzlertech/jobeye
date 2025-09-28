// --- AGENT DIRECTIVE BLOCK ---
// file: /src/core/config/environment.ts
// purpose: Environment variable validation and configuration management with voice settings
// spec_ref: core#environment
// version: 2025-08-1
// domain: core-infrastructure
// phase: 1
// complexity_budget: low
// offline_capability: REQUIRED

// dependencies:
//   - typescript: ^5.4.0

// exports:
//   - config: Config - Main configuration object with all environment settings
//   - validateEnvironment(): void - Environment validation function
//   - Config: interface - Configuration type definition
//   - isProduction(): boolean - Production environment checker
//   - isDevelopment(): boolean - Development environment checker

// voice_considerations: |
//   Voice API keys and endpoints must be configurable via environment variables.
//   Voice settings should include volume, speech rate, and voice selection options.
//   Support environment-based voice provider fallback configuration (Google → OpenAI → Web Speech).
//   Voice debugging modes should be configurable per environment.

// security_considerations: |
//   All sensitive configuration values must be loaded from environment variables only.
//   Never expose API keys, database credentials, or secrets in logs or error messages.
//   Implement configuration validation to ensure required security settings are present.
//   Use secure defaults for all security-related configuration options.

// performance_considerations: |
//   Configuration should be loaded once at startup and cached for performance.
//   Environment validation should fail fast with clear error messages.
//   Use type-safe configuration parsing to prevent runtime configuration errors.
//   Cache configuration validation results to avoid repeated processing.

// tasks:
//     1. Define Config interface with all required environment variables and types
//     2. Implement environment variable loading with type conversion and validation
//     3. Add required vs optional configuration field validation
//     4. Create environment-specific configuration profiles (dev, staging, production)
//     5. Implement secure default values for all configuration options
//     6. Add Supabase configuration validation (URL, service key, anon key)
//     7. Create voice provider configuration with fallback chain settings
//     8. Implement configuration schema validation with detailed error messages
//     9. Add configuration hot-reload support for development environments
//     10. Create configuration documentation generator for deployment guides
// --- END DIRECTIVE BLOCK ---

/**
 * Configuration interface with all environment settings
 */
export interface Config {
  // Environment
  env: 'development' | 'staging' | 'production';
  nodeEnv: string;
  
  // Supabase
  supabase: {
    url: string;
    anonKey: string;
    serviceKey?: string;
  };
  
  // Voice providers
  voice: {
    google?: {
      apiKey: string;
      projectId: string;
    };
    openai?: {
      apiKey: string;
    };
    webSpeech: {
      enabled: boolean;
    };
  };
  
  // Application
  app: {
    name: string;
    version: string;
    port: number;
  };

  storage: {
    inventoryBucket: string;
    inventoryThumbnailPrefix: string;
  };
}

/**
 * Load and validate environment configuration
 */
function loadConfig(): Config {
  const config: Config = {
    env: (process.env.NODE_ENV as any) || 'development',
    nodeEnv: process.env.NODE_ENV || 'development',
    
    supabase: {
      url: process.env.NEXT_PUBLIC_SUPABASE_URL || '',
      anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
      serviceKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
    },
    
    voice: {
      google: process.env.GOOGLE_CLOUD_API_KEY ? {
        apiKey: process.env.GOOGLE_CLOUD_API_KEY,
        projectId: process.env.GOOGLE_CLOUD_PROJECT_ID || '',
      } : undefined,
      
      openai: process.env.OPENAI_API_KEY ? {
        apiKey: process.env.OPENAI_API_KEY,
      } : undefined,
      
      webSpeech: {
        enabled: process.env.WEB_SPEECH_ENABLED !== 'false',
      },
    },
    
  app: {
    name: process.env.NEXT_PUBLIC_APP_NAME || 'JobEye Control Tower',
    version: process.env.NEXT_PUBLIC_APP_VERSION || '3.2.1',
    port: parseInt(process.env.PORT || '3000', 10),
  },

  storage: {
    inventoryBucket: process.env.NEXT_PUBLIC_SUPABASE_INVENTORY_BUCKET || 'inventory-images',
    inventoryThumbnailPrefix: process.env.NEXT_PUBLIC_SUPABASE_INVENTORY_THUMBNAIL_PREFIX || 'thumbnails',
  },
};
  
  return config;
}

// Main configuration object
export const config = loadConfig();

/**
 * Environment validation function
 */
export function validateEnvironment(): void {
  const errors: string[] = [];
  
  // Required Supabase configuration
  if (!config.supabase.url) {
    errors.push('NEXT_PUBLIC_SUPABASE_URL is required');
  }
  if (!config.supabase.anonKey) {
    errors.push('NEXT_PUBLIC_SUPABASE_ANON_KEY is required');
  }
  
  // Voice provider validation
  if (!config.voice.google && !config.voice.openai && !config.voice.webSpeech.enabled) {
    errors.push('At least one voice provider must be configured');
  }
  
  if (errors.length > 0) {
    throw new Error(`Environment validation failed:\n${errors.join('\n')}`);
  }
}

/**
 * Production environment checker
 */
export function isProduction(): boolean {
  return config.env === 'production';
}

/**
 * Development environment checker
 */
export function isDevelopment(): boolean {
  return config.env === 'development';
}

// Validate on module load
if (typeof window === 'undefined') {
  // Only validate on server-side to avoid client-side errors
  try {
    validateEnvironment();
  } catch (error) {
    console.warn('Environment validation warning:', error);
  }
}
