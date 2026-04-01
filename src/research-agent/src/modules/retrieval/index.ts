/**
 * Literature Retrieval Module
 * 
 * Handles automatic paper retrieval, analysis, and summarization
 */

import { StateManager, Paper, ResearchIntent } from '../../core/state';
import { ArxivClient, toInternalPaper as fromArxiv, ArxivPaper } from '../../tools/arxiv';
import { 
  SemanticScholarClient, 
  toInternalPaper as fromS2, 
  SemanticScholarPaper 
} from '../../tools/semantic-scholar';

// ============================================================================
// Types
// ============================================================================

export interface RetrievalConfig {
  maxPapers: number;
  sources: ('arxiv' | 'semantic_scholar')[];
  yearRange?: { start?: number; end?: number };
  minCitations?: number;
  openAccessOnly?: boolean;
}

export interface RetrievalResult {
  papers: Paper[];
  queries: string[];
  summary: string;
  statistics: {
    totalFound: number;
    retrieved: number;
    bySource: Record<string, number>;
    byYear: Record<number, number>;
  };
}

// ============================================================================
// Query Generation
// ============================================================================

/**
 * Generate search queries from research intent
 */
export function generateSearchQueries(intent: ResearchIntent): string[] {
  const queries: string[] = [];
  
  // Main topic query
  queries.push(intent.topic);
  
  // Problem statement keywords
  if (intent.problemStatement) {
    const keywords = extractKeywords(intent.problemStatement);
    queries.push(...keywords.slice(0, 3).map(k => `${intent.topic} ${k}`));
  }
  
  // Domain-specific expansions
  const domainTerms = getDomainTerms(intent.domain);
  for (const term of domainTerms.slice(0, 2)) {
    queries.push(`${intent.topic} ${term}`);
  }
  
  // Success criteria queries
  for (const criterion of intent.successCriteria.slice(0, 2)) {
    const criterionKeywords = extractKeywords(criterion);
    if (criterionKeywords.length > 0) {
      queries.push(`${intent.topic} ${criterionKeywords[0]}`);
    }
  }
  
  // Remove duplicates and limit
  return [...new Set(queries)].slice(0, 10);
}

function extractKeywords(text: string): string[] {
  // Simple keyword extraction
  const stopWords = new Set([
    'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
    'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
    'should', 'may', 'might', 'must', 'shall', 'can', 'need', 'to', 'of',
    'in', 'for', 'on', 'with', 'at', 'by', 'from', 'as', 'into', 'through',
    'during', 'before', 'after', 'above', 'below', 'between', 'under',
    'and', 'or', 'but', 'if', 'then', 'else', 'when', 'where', 'which',
    'that', 'this', 'these', 'those', 'it', 'its', 'they', 'their', 'we',
    'our', 'you', 'your', 'he', 'she', 'him', 'her', 'his', 'hers',
  ]);
  
  const words = text.toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 2 && !stopWords.has(w));
  
  // Count word frequency
  const freq: Record<string, number> = {};
  for (const word of words) {
    freq[word] = (freq[word] || 0) + 1;
  }
  
  // Return top keywords
  return Object.entries(freq)
    .sort((a, b) => b[1] - a[1])
    .map(([word]) => word)
    .slice(0, 5);
}

function getDomainTerms(domain: string): string[] {
  const domainTerms: Record<string, string[]> = {
    ml: ['machine learning', 'deep learning', 'neural network', 'training', 'optimization'],
    dl: ['deep learning', 'neural network', 'architecture', 'representation learning'],
    nlp: ['natural language processing', 'language model', 'text', 'transformer', 'attention'],
    cv: ['computer vision', 'image', 'convolutional', 'detection', 'segmentation'],
    rl: ['reinforcement learning', 'policy', 'reward', 'agent', 'environment'],
    cfd: ['computational fluid dynamics', 'numerical simulation', 'turbulence', 'Navier-Stokes'],
    optimization: ['optimization', 'gradient descent', 'loss function', 'convergence'],
    general: [],
  };
  
  return domainTerms[domain] || [];
}

// ============================================================================
// Literature Retriever
// ============================================================================

export class LiteratureRetriever {
  private arxivClient: ArxivClient;
  private s2Client: SemanticScholarClient;
  private stateManager: StateManager;
  private config: RetrievalConfig;

  constructor(
    stateManager: StateManager,
    config: Partial<RetrievalConfig> = {}
  ) {
    this.stateManager = stateManager;
    this.arxivClient = new ArxivClient();
    this.s2Client = new SemanticScholarClient(process.env.SEMANTIC_SCHOLAR_API_KEY);
    this.config = {
      maxPapers: 50,
      sources: ['arxiv', 'semantic_scholar'],
      ...config,
    };
  }

  /**
   * Main retrieval method
   */
  async retrieve(
    progressCallback?: (progress: number, message: string) => void
  ): Promise<RetrievalResult> {
    const intent = this.stateManager.getState().intent;
    const queries = generateSearchQueries(intent);
    
    const allPapers: Paper[] = [];
    const seenIds = new Set<string>();
    const statistics = {
      totalFound: 0,
      retrieved: 0,
      bySource: { arxiv: 0, semantic_scholar: 0 },
      byYear: {} as Record<number, number>,
    };

    // Execute searches
    for (let i = 0; i < queries.length; i++) {
      const query = queries[i];
      progressCallback?.(
        ((i + 1) / queries.length) * 80,
        `Searching: "${query.substring(0, 50)}..."`
      );

      try {
        // Search arXiv
        if (this.config.sources.includes('arxiv')) {
          const arxivPapers = await this.searchArxiv(query);
          for (const paper of arxivPapers) {
            if (!seenIds.has(paper.id) && allPapers.length < this.config.maxPapers) {
              seenIds.add(paper.id);
              allPapers.push(paper);
              statistics.bySource.arxiv++;
              const year = paper.year;
              statistics.byYear[year] = (statistics.byYear[year] || 0) + 1;
            }
          }
        }

        // Search Semantic Scholar
        if (this.config.sources.includes('semantic_scholar')) {
          const s2Papers = await this.searchS2(query);
          for (const paper of s2Papers) {
            if (!seenIds.has(paper.id) && allPapers.length < this.config.maxPapers) {
              seenIds.add(paper.id);
              allPapers.push(paper);
              statistics.bySource.semantic_scholar++;
              const year = paper.year;
              statistics.byYear[year] = (statistics.byYear[year] || 0) + 1;
            }
          }
        }
      } catch (error) {
        console.error(`Search failed for query "${query}":`, error);
      }

      if (allPapers.length >= this.config.maxPapers) {
        break;
      }
    }

    statistics.totalFound = seenIds.size;
    statistics.retrieved = allPapers.length;

    progressCallback?.(90, 'Analyzing and ranking papers...');

    // Rank papers by relevance
    const rankedPapers = this.rankPapers(allPapers, intent);

    progressCallback?.(95, 'Generating literature summary...');

    // Generate summary
    const summary = this.generateSummary(rankedPapers, intent);

    // Store results
    this.stateManager.addPapers(rankedPapers);
    this.stateManager.setLiteratureSummary(summary);

    progressCallback?.(100, 'Literature retrieval complete');

    return {
      papers: rankedPapers,
      queries,
      summary,
      statistics,
    };
  }

  /**
   * Search arXiv
   */
  private async searchArxiv(query: string): Promise<Paper[]> {
    const yearRange = this.config.yearRange;
    let yearFilter = '';
    if (yearRange?.start && yearRange?.end) {
      yearFilter = ` AND submittedDate:[${yearRange.start}0101 TO ${yearRange.end}1231]`;
    } else if (yearRange?.start) {
      yearFilter = ` AND submittedDate:[${yearRange.start}0101 TO 20991231]`;
    }

    const searchQuery = query + yearFilter;
    
    try {
      const result = await this.arxivClient.search({
        query: searchQuery,
        maxResults: Math.ceil(this.config.maxPapers / this.config.sources.length),
        sortBy: 'relevance',
      });

      return result.papers.map(p => this.convertArxivPaper(p));
    } catch (error) {
      console.error('arXiv search error:', error);
      return [];
    }
  }

  /**
   * Search Semantic Scholar
   */
  private async searchS2(query: string): Promise<Paper[]> {
    const yearRange = this.config.yearRange;
    let yearFilter = '';
    if (yearRange?.start && yearRange?.end) {
      yearFilter = `${yearRange.start}-${yearRange.end}`;
    } else if (yearRange?.start) {
      yearFilter = `${yearRange.start}-`;
    }

    try {
      const result = await this.s2Client.search({
        query,
        limit: Math.ceil(this.config.maxPapers / this.config.sources.length),
        year: yearFilter || undefined,
        isOpenAccess: this.config.openAccessOnly,
      });

      return result.data.map(p => this.convertS2Paper(p));
    } catch (error) {
      console.error('Semantic Scholar search error:', error);
      return [];
    }
  }

  /**
   * Convert arXiv paper to internal format
   */
  private convertArxivPaper(arxivPaper: ArxivPaper): Paper {
    return {
      id: `arxiv_${arxivPaper.arxivId}`,
      title: arxivPaper.title,
      authors: arxivPaper.authors,
      abstract: arxivPaper.abstract,
      year: new Date(arxivPaper.publishedDate).getFullYear(),
      url: arxivPaper.absUrl,
      arxivId: arxivPaper.arxivId,
      doi: arxivPaper.doi,
      keywords: arxivPaper.categories,
      keyFindings: [],
      methodology: '',
      relevanceScore: 0,
      source: 'arxiv',
    };
  }

  /**
   * Convert Semantic Scholar paper to internal format
   */
  private convertS2Paper(s2Paper: SemanticScholarPaper): Paper {
    return {
      id: `s2_${s2Paper.paperId}`,
      title: s2Paper.title,
      authors: s2Paper.authors.map(a => a.name),
      abstract: s2Paper.abstract || '',
      year: s2Paper.year || 0,
      url: s2Paper.url,
      arxivId: s2Paper.arxivId,
      doi: s2Paper.doi,
      citationCount: s2Paper.citationCount,
      keywords: s2Paper.fieldsOfStudy || [],
      keyFindings: [],
      methodology: '',
      relevanceScore: 0,
      source: 'semantic_scholar',
    };
  }

  /**
   * Rank papers by relevance
   */
  private rankPapers(papers: Paper[], intent: ResearchIntent): Paper[] {
    const topicKeywords = extractKeywords(intent.topic);
    const problemKeywords = extractKeywords(intent.problemStatement);
    const allKeywords = [...topicKeywords, ...problemKeywords];

    for (const paper of papers) {
      // Calculate relevance score
      const titleScore = this.calculateTextRelevance(paper.title, allKeywords);
      const abstractScore = this.calculateTextRelevance(paper.abstract, allKeywords);
      const recencyScore = paper.year >= 2022 ? 1 : paper.year >= 2020 ? 0.8 : 0.5;
      const citationScore = Math.min((paper.citationCount || 0) / 100, 1);

      paper.relevanceScore = (
        titleScore * 0.4 +
        abstractScore * 0.3 +
        recencyScore * 0.2 +
        citationScore * 0.1
      );
    }

    return papers.sort((a, b) => b.relevanceScore - a.relevanceScore);
  }

  /**
   * Calculate text relevance score
   */
  private calculateTextRelevance(text: string, keywords: string[]): number {
    const textLower = text.toLowerCase();
    let matches = 0;
    for (const keyword of keywords) {
      if (textLower.includes(keyword.toLowerCase())) {
        matches++;
      }
    }
    return keywords.length > 0 ? matches / keywords.length : 0;
  }

  /**
   * Generate literature summary
   */
  private generateSummary(papers: Paper[], intent: ResearchIntent): string {
    const topPapers = papers.slice(0, 10);
    const yearCounts: Record<number, number> = {};
    
    for (const paper of papers) {
      yearCounts[paper.year] = (yearCounts[paper.year] || 0) + 1;
    }

    const recentYears = Object.entries(yearCounts)
      .filter(([year]) => parseInt(year) >= 2022)
      .sort((a, b) => parseInt(b[0]) - parseInt(a[0]))
      .map(([year, count]) => `${year}: ${count}`)
      .join(', ');

    const summary = `
## Literature Review Summary

**Topic**: ${intent.topic}

**Total Papers Retrieved**: ${papers.length}

**Publication Trends**: ${recentYears}

**Top Relevant Papers**:
${topPapers.map((p, i) => `
${i + 1}. **${p.title}**
   - Authors: ${p.authors.slice(0, 3).join(', ')}${p.authors.length > 3 ? ' et al.' : ''}
   - Year: ${p.year}
   - Citations: ${p.citationCount || 'N/A'}
   - Source: ${p.source}
   - Relevance: ${(p.relevanceScore * 100).toFixed(0)}%
`).join('\n')}

**Research Landscape**:
Based on the retrieved literature, the field of "${intent.topic}" shows active research interest
with ${papers.filter(p => p.year >= 2023).length} papers published in 2023-2024.

**Key Research Directions Identified**:
${this.identifyKeyDirections(papers)}

**Potential Research Gaps**:
${this.identifyGaps(papers, intent)}
`.trim();

    return summary;
  }

  /**
   * Identify key research directions
   */
  private identifyKeyDirections(papers: Paper[]): string {
    // Extract common themes from titles
    const themes: Record<string, number> = {};
    const themePatterns = [
      { pattern: /attention|transformer/i, name: 'Attention Mechanisms' },
      { pattern: /efficient|optimization|fast/i, name: 'Efficiency & Optimization' },
      { pattern: /learning|training/i, name: 'Learning Methods' },
      { pattern: /architecture|network|model/i, name: 'Architecture Design' },
      { pattern: /application|deploy|real/i, name: 'Applications' },
      { pattern: /theory|analysis|understand/i, name: 'Theoretical Analysis' },
    ];

    for (const paper of papers) {
      for (const { pattern, name } of themePatterns) {
        if (pattern.test(paper.title)) {
          themes[name] = (themes[name] || 0) + 1;
        }
      }
    }

    const sortedThemes = Object.entries(themes)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);

    return sortedThemes
      .map(([name, count]) => `- ${name} (${count} papers)`)
      .join('\n');
  }

  /**
   * Identify potential research gaps
   */
  private identifyGaps(papers: Paper[], intent: ResearchIntent): string {
    const gaps: string[] = [];
    
    // Check for recent publications
    const recentPapers = papers.filter(p => p.year >= 2023);
    if (recentPapers.length < papers.length * 0.3) {
      gaps.push('Limited recent publications - potential opportunity for new contributions');
    }

    // Check for specific constraints
    for (const constraint of intent.constraints.compatibilityRequirements) {
      const constraintPapers = papers.filter(p => 
        p.title.toLowerCase().includes(constraint.toLowerCase()) ||
        p.abstract.toLowerCase().includes(constraint.toLowerCase())
      );
      if (constraintPapers.length < 5) {
        gaps.push(`Limited work addressing: ${constraint}`);
      }
    }

    if (gaps.length === 0) {
      gaps.push('Opportunities exist in combining multiple approaches or applying to new domains');
    }

    return gaps.map(g => `- ${g}`).join('\n');
  }
}