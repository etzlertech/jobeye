/**
 * @file src/domains/field-intelligence/components/InstructionSearcher.tsx
 * @phase 3
 * @domain field-intelligence
 * @purpose Semantic search UI for standard instructions
 * @spec_ref docs/feature-005-field-intelligence.md
 * @complexity_budget 250 LoC
 */

'use client';

import { useState, useEffect } from 'react';
import { logger } from '@/core/logger/voice-logger';

interface Instruction {
  id: string;
  title: string;
  content: string;
  category: string;
  relevanceScore?: number;
  lastUsed?: string;
}

interface InstructionSearcherProps {
  userId: string;
  jobType?: string;
  onSelectInstruction?: (instruction: Instruction) => void;
  className?: string;
}

/**
 * InstructionSearcher - Semantic search for instructions
 *
 * Features:
 * - Semantic search with embeddings
 * - Keyword fallback
 * - Category filtering
 * - Relevance scoring
 * - Usage tracking
 * - 60-min cache
 *
 * @example
 * ```tsx
 * <InstructionSearcher
 *   userId={user.id}
 *   jobType="lawn_mowing"
 *   onSelectInstruction={(instruction) => console.log('Selected:', instruction)}
 * />
 * ```
 */
export function InstructionSearcher({
  userId,
  jobType,
  onSelectInstruction,
  className = '',
}: InstructionSearcherProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Instruction[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [categories, setCategories] = useState<string[]>([]);

  useEffect(() => {
    fetchCategories();
  }, []);

  useEffect(() => {
    if (query.trim().length > 0) {
      const timer = setTimeout(() => {
        searchInstructions();
      }, 500); // Debounce 500ms

      return () => clearTimeout(timer);
    } else {
      setResults([]);
    }
  }, [query, selectedCategory]);

  const fetchCategories = async () => {
    try {
      // In production, this would fetch from API
      // For now, use static categories
      setCategories([
        'Safety',
        'Equipment',
        'Lawn Care',
        'Irrigation',
        'Tree Service',
        'Customer Service',
      ]);
    } catch (err: any) {
      logger.error('Failed to fetch categories', { error: err });
    }
  };

  const searchInstructions = async () => {
    if (!query.trim()) {
      setResults([]);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        query: query.trim(),
        userId,
      });

      if (selectedCategory) {
        params.append('category', selectedCategory);
      }

      if (jobType) {
        params.append('jobType', jobType);
      }

      const response = await fetch(
        `/api/field-intelligence/workflows/search-instructions?${params.toString()}`
      );

      if (!response.ok) {
        throw new Error('Search failed');
      }

      const data = await response.json();

      if (data.data && data.data.results) {
        setResults(data.data.results);
        logger.info('Instructions searched', {
          query,
          resultCount: data.data.results.length,
          userId,
        });
      } else {
        setResults([]);
      }
    } catch (err: any) {
      logger.error('Search failed', { error: err });
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectInstruction = (instruction: Instruction) => {
    logger.info('Instruction selected', {
      instructionId: instruction.id,
      userId,
    });

    if (onSelectInstruction) {
      onSelectInstruction(instruction);
    }
  };

  const highlightQuery = (text: string) => {
    if (!query.trim()) return text;

    const regex = new RegExp(`(${query.trim()})`, 'gi');
    const parts = text.split(regex);

    return parts.map((part, index) =>
      regex.test(part) ? (
        <mark key={index} className="bg-yellow-200 font-medium">
          {part}
        </mark>
      ) : (
        part
      )
    );
  };

  const getRelevanceColor = (score?: number) => {
    if (!score) return 'bg-gray-100 text-gray-600';
    if (score >= 0.8) return 'bg-green-100 text-green-800';
    if (score >= 0.6) return 'bg-yellow-100 text-yellow-800';
    return 'bg-orange-100 text-orange-800';
  };

  return (
    <div className={`instruction-searcher ${className}`}>
      <div className="bg-white border border-gray-200 rounded-lg p-4">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Search Instructions</h3>

        {/* Search Input */}
        <div className="mb-3">
          <div className="relative">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search for instructions... (e.g., 'how to edge a lawn')"
              className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
            <div className="absolute left-3 top-2.5 text-gray-400">
              🔍
            </div>
            {loading && (
              <div className="absolute right-3 top-2.5">
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
              </div>
            )}
          </div>
        </div>

        {/* Category Filter */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Filter by Category
          </label>
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
          >
            <option value="">All Categories</option>
            {categories.map((category) => (
              <option key={category} value={category}>
                {category}
              </option>
            ))}
          </select>
        </div>

        {/* Error */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4 text-sm text-red-600">
            {error}
          </div>
        )}

        {/* Results */}
        {results.length > 0 ? (
          <div className="space-y-2">
            <p className="text-sm text-gray-600 mb-2">
              Found {results.length} {results.length === 1 ? 'instruction' : 'instructions'}
            </p>
            {results.map((instruction) => (
              <button
                key={instruction.id}
                onClick={() => handleSelectInstruction(instruction)}
                className="w-full text-left bg-gray-50 border border-gray-200 rounded-lg p-3 hover:bg-blue-50 hover:border-blue-300 transition-colors"
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1">
                    <h4 className="font-medium text-gray-900">
                      {highlightQuery(instruction.title)}
                    </h4>
                    <p className="text-xs text-gray-500 mt-0.5">{instruction.category}</p>
                  </div>
                  {instruction.relevanceScore && (
                    <span
                      className={`px-2 py-1 rounded text-xs font-medium ${getRelevanceColor(
                        instruction.relevanceScore
                      )}`}
                    >
                      {Math.round(instruction.relevanceScore * 100)}% match
                    </span>
                  )}
                </div>
                <p className="text-sm text-gray-700 line-clamp-2">
                  {highlightQuery(instruction.content)}
                </p>
                {instruction.lastUsed && (
                  <p className="text-xs text-gray-500 mt-2">
                    Last used:{' '}
                    {new Date(instruction.lastUsed).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                    })}
                  </p>
                )}
              </button>
            ))}
          </div>
        ) : query.trim() && !loading ? (
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-6 text-center">
            <p className="text-gray-600 text-sm">
              No instructions found for &ldquo;{query}&rdquo;
            </p>
            <p className="text-xs text-gray-500 mt-1">
              Try a different search term or category
            </p>
          </div>
        ) : !query.trim() ? (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-700">
            <p className="font-medium">💡 Search Tips:</p>
            <ul className="mt-2 space-y-1 text-xs">
              <li>• Use natural language (e.g., &ldquo;how to handle tall grass&rdquo;)</li>
              <li>• Semantic search finds related instructions automatically</li>
              <li>• Filter by category for more specific results</li>
              <li>• Results are cached for 60 minutes for faster access</li>
            </ul>
          </div>
        ) : null}
      </div>
    </div>
  );
}