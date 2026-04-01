/**
 * Ideation Module
 * 
 * Generates innovative research proposals based on literature review
 */

import {
  StateManager,
  ResearchProposal,
  Paper,
  ResearchIntent
} from '../../core/state';
import { PhaseExecutor, PhaseExecutionContext } from '../../core/workflow';
import { buildNoveltyAnalysisFromProposal } from '../shared/prior-art';

// ============================================================================
// Types
// ============================================================================

export interface IdeationContext {
  intent: ResearchIntent;
  papers: Paper[];
  existingApproaches: Map<string, string[]>;
  identifiedGaps: string[];
}

export interface ProposalTemplate {
  type: 'improvement' | 'novel_method' | 'combination' | 'application' | 'analysis';
  description: string;
  applicableDomains: string[];
}

type ProposalDraft = Omit<ResearchProposal, 'noveltyAnalysis'>;

// ============================================================================
// Proposal Templates
// ============================================================================

const PROPOSAL_TEMPLATES: ProposalTemplate[] = [
  {
    type: 'improvement',
    description: 'Improve an existing method by addressing its limitations',
    applicableDomains: ['ml', 'dl', 'nlp', 'cv', 'rl', 'cfd', 'optimization'],
  },
  {
    type: 'novel_method',
    description: 'Propose a completely new approach to the problem',
    applicableDomains: ['ml', 'dl', 'nlp', 'cv', 'rl', 'cfd', 'optimization'],
  },
  {
    type: 'combination',
    description: 'Combine multiple existing approaches synergistically',
    applicableDomains: ['ml', 'dl', 'nlp', 'cv', 'rl', 'cfd'],
  },
  {
    type: 'application',
    description: 'Apply methods from one domain to another',
    applicableDomains: ['ml', 'dl', 'nlp', 'cv', 'cfd'],
  },
  {
    type: 'analysis',
    description: 'Provide theoretical analysis or empirical study of existing methods',
    applicableDomains: ['ml', 'dl', 'nlp', 'cv', 'optimization'],
  },
];

// ============================================================================
// Ideation Engine
// ============================================================================

export class IdeationEngine implements PhaseExecutor {
  private stateManager: StateManager;

  constructor(stateManager: StateManager) {
    this.stateManager = stateManager;
  }

  /**
   * Execute ideation phase
   */
  async execute(context: PhaseExecutionContext): Promise<void> {
    const state = this.stateManager.getState();
    const { intent, literature } = state;

    context.reportProgress(0, 'Analyzing literature for research opportunities');

    // Build ideation context
    const ideationContext = this.buildContext(intent, literature.papers);
    context.reportProgress(20, 'Identifying research gaps and opportunities');

    // Identify gaps
    const gaps = this.identifyGaps(ideationContext);
    ideationContext.identifiedGaps = gaps;
    context.reportProgress(40, 'Generating research proposals');

    // Generate proposals
    const proposals = await this.generateProposals(ideationContext, context);
    context.reportProgress(80, 'Refining proposals');

    // Refine and score proposals
    const refinedProposals = this.refineProposals(proposals, ideationContext);
    context.reportProgress(100, 'Research proposals generated');

    // Store proposals
    for (const proposal of refinedProposals) {
      this.stateManager.addProposal(proposal);
    }
  }

  /**
   * Build ideation context from literature
   */
  private buildContext(intent: ResearchIntent, papers: Paper[]): IdeationContext {
    const existingApproaches = new Map<string, string[]>();
    
    // Categorize existing approaches
    for (const paper of papers) {
      const approach = this.extractApproach(paper);
      if (approach) {
        const key = approach.category;
        if (!existingApproaches.has(key)) {
          existingApproaches.set(key, []);
        }
        existingApproaches.get(key)!.push(approach.method);
      }
    }

    return {
      intent,
      papers,
      existingApproaches,
      identifiedGaps: [],
    };
  }

  /**
   * Extract approach from paper
   */
  private extractApproach(paper: Paper): { category: string; method: string } | null {
    // Extract key technical terms from title
    const title = paper.title.toLowerCase();
    
    // Common ML/DL patterns
    const patterns = [
      { pattern: /attention|transformer/i, category: 'Attention Mechanism' },
      { pattern: /convolution|cnn/i, category: 'Convolution' },
      { pattern: /recurrent|rnn|lstm/i, category: 'Recurrent Network' },
      { pattern: /diffusion/i, category: 'Diffusion Model' },
      { pattern: /gan|generative/i, category: 'Generative Model' },
      { pattern: /graph|gnn/i, category: 'Graph Neural Network' },
      { pattern: /reinforcement|rl|policy/i, category: 'Reinforcement Learning' },
      { pattern: /optimization|optimizer|gradient/i, category: 'Optimization' },
      { pattern: /regularization|dropout|batch.*norm/i, category: 'Regularization' },
      { pattern: /efficient|fast|lightweight/i, category: 'Efficiency' },
      { pattern: /pruning|quantization|distill/i, category: 'Model Compression' },
      { pattern: /transfer|meta.*learn|few.*shot/i, category: 'Transfer Learning' },
      { pattern: /physics.*inform|pinn|neural.*operator/i, category: 'Physics-Informed' },
      { pattern: /turbulence|les|rans|dns/i, category: 'Turbulence Modeling' },
    ];

    for (const { pattern, category } of patterns) {
      if (pattern.test(title)) {
        return { category, method: paper.title };
      }
    }

    return null;
  }

  /**
   * Identify research gaps
   */
  private identifyGaps(context: IdeationContext): string[] {
    const gaps: string[] = [];
    const { intent, papers, existingApproaches } = context;

    // Gap 1: Unexplored combinations
    const categories = Array.from(existingApproaches.keys());
    if (categories.length >= 2) {
      for (let i = 0; i < categories.length - 1; i++) {
        for (let j = i + 1; j < categories.length; j++) {
          gaps.push(`Combining ${categories[i]} with ${categories[j]}`);
        }
      }
    }

    // Gap 2: Efficiency improvements
    const efficiencyPapers = papers.filter(p => 
      /efficient|fast|lightweight|speed|memory/i.test(p.title)
    );
    if (efficiencyPapers.length < papers.length * 0.2) {
      gaps.push('Efficiency optimization for the proposed methods');
    }

    // Gap 3: Theoretical understanding
    const theoryPapers = papers.filter(p =>
      /theory|analysis|understand|explain|interpret/i.test(p.title)
    );
    if (theoryPapers.length < papers.length * 0.15) {
      gaps.push('Theoretical analysis of method properties');
    }

    // Gap 4: Application to constraints
    for (const constraint of intent.constraints.compatibilityRequirements) {
      const constraintPapers = papers.filter(p =>
        p.title.toLowerCase().includes(constraint.toLowerCase()) ||
        p.abstract.toLowerCase().includes(constraint.toLowerCase())
      );
      if (constraintPapers.length < 3) {
        gaps.push(`Addressing constraint: ${constraint}`);
      }
    }

    // Gap 5: Benchmark gaps
    for (const benchmark of intent.evaluationBenchmarks) {
      const benchmarkPapers = papers.filter(p =>
        p.title.toLowerCase().includes(benchmark.toLowerCase())
      );
      if (benchmarkPapers.length < 5) {
        gaps.push(`Evaluation on ${benchmark}`);
      }
    }

    return gaps.slice(0, 10);
  }

  /**
   * Generate research proposals
   */
  private async generateProposals(
    context: IdeationContext,
    executionContext: PhaseExecutionContext
  ): Promise<ResearchProposal[]> {
    const proposals: ResearchProposal[] = [];
    const { intent, papers, identifiedGaps } = context;

    // Get applicable proposal templates
    const templates = PROPOSAL_TEMPLATES.filter(t =>
      t.applicableDomains.includes(intent.domain)
    );

    // Generate proposals based on templates and gaps
    let proposalCount = 0;
    const maxProposals = this.stateManager.getState().config.maxProposals;

    for (const template of templates) {
      if (proposalCount >= maxProposals) break;

      const gap = identifiedGaps.length > 0
        ? identifiedGaps[proposalCount % identifiedGaps.length]
        : intent.problemStatement || intent.topic;

      const proposal = this.generateProposalFromTemplate(
        template,
        context,
        gap
      );

      if (proposal) {
        proposals.push(proposal);
        proposalCount++;
        executionContext.reportProgress(
          40 + (proposalCount / maxProposals) * 30,
          `Generated proposal ${proposalCount}: ${proposal.title.substring(0, 50)}...`
        );
      }
    }

    // Ensure we have enough proposals
    while (proposals.length < Math.min(maxProposals, 3)) {
      const proposal = this.generateFallbackProposal(context, proposals.length);
      proposals.push(proposal);
    }

    return proposals;
  }

  /**
   * Generate proposal from template
   */
  private generateProposalFromTemplate(
    template: ProposalTemplate,
    context: IdeationContext,
    gap?: string
  ): ResearchProposal | null {
    const { intent, papers, existingApproaches } = context;
    const id = `prop_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Get relevant papers for inspiration
    const relevantPapers = papers.slice(0, 10);

    let proposal: ProposalDraft | null = null;

    switch (template.type) {
      case 'improvement':
        proposal = this.generateImprovementProposal(id, intent, relevantPapers, gap);
        break;
      case 'novel_method':
        proposal = this.generateNovelMethodProposal(id, intent, relevantPapers, gap);
        break;
      case 'combination':
        proposal = this.generateCombinationProposal(id, intent, existingApproaches, gap);
        break;
      case 'application':
        proposal = this.generateApplicationProposal(id, intent, relevantPapers, gap);
        break;
      case 'analysis':
        proposal = this.generateAnalysisProposal(id, intent, relevantPapers, gap);
        break;
      default:
        return null;
    }

    if (!proposal) {
      return null;
    }

    return this.attachNoveltyAnalysis(proposal, context, gap);
  }

  private attachNoveltyAnalysis(
    proposal: ProposalDraft,
    context: IdeationContext,
    gap?: string
  ): ResearchProposal {
    return {
      ...proposal,
      noveltyAnalysis: buildNoveltyAnalysisFromProposal(proposal, context.intent, context.papers, gap),
    };
  }

  /**
   * Generate improvement proposal
   */
  private generateImprovementProposal(
    id: string,
    intent: ResearchIntent,
    papers: Paper[],
    gap?: string
  ): ProposalDraft {
    const targetMethod = papers[0]?.title || 'existing approach';
    const improvementType = gap || 'efficiency and effectiveness';

    return {
      id,
      title: `Improved ${intent.topic} with Enhanced ${improvementType}`,
      motivation: `Current approaches for ${intent.topic} face limitations in ${improvementType}. ` +
        `This work proposes improvements to address these limitations.`,
      problemDefinition: `How can we improve ${improvementType} in ${intent.topic} while ` +
        `${intent.constraints.compatibilityRequirements.join(' and ') || 'maintaining performance'}?`,
      methodology: {
        overview: `We propose an improved method building upon ${targetMethod}`,
        technicalApproach: `
1. Analyze limitations of current approaches
2. Design novel improvement mechanisms
3. Integrate improvements into existing framework
4. Validate on standard benchmarks
        `.trim(),
        implementationSteps: [
          'Literature review and limitation analysis',
          'Method design and theoretical formulation',
          'Implementation and debugging',
          'Experimental validation',
          'Ablation studies',
        ],
      },
      expectedContributions: [
        'Novel improvement to existing methods',
        'Comprehensive evaluation on benchmarks',
        'Open-source implementation',
      ],
      risks: [
        'May not generalize to all scenarios',
        'Computational overhead of new components',
      ],
      estimatedResources: {
        computeHours: 100,
        memoryGB: 32,
        datasetRequirements: intent.evaluationBenchmarks,
        softwareDependencies: ['PyTorch', 'Transformers', 'NumPy'],
      },
      evaluationMetrics: intent.successCriteria,
    };
  }

  /**
   * Generate novel method proposal
   */
  private generateNovelMethodProposal(
    id: string,
    intent: ResearchIntent,
    papers: Paper[],
    gap?: string
  ): ProposalDraft {
    const focus = gap || intent.problemStatement || intent.topic;

    return {
      id,
      title: `A Literature-Gap-Driven Approach to ${intent.topic}`,
      motivation: `Existing methods for ${intent.topic} have inherent limitations. ` +
        `We propose a targeted approach that is motivated by the uncovered gap around ${focus}.`,
      problemDefinition: `Can we develop a new paradigm for ${intent.topic} that ` +
        `overcomes the limitations of current methods?`,
      methodology: {
        overview: 'We propose a novel method with a fresh perspective on the problem',
        technicalApproach: `
1. Formulate problem from a new angle
2. Design novel architecture/algorithm
3. Develop theoretical foundations
4. Implement and validate
        `.trim(),
        implementationSteps: [
          'Problem reformulation',
          'Novel method design',
          'Theoretical analysis',
          'Implementation',
          'Comprehensive evaluation',
        ],
      },
      expectedContributions: [
        'A method targeted at a gap identified from retrieved literature',
        'Empirical evidence about whether the gap-driven design helps',
        'Analysis of where the method differs from nearby prior work',
      ],
      risks: [
        'Higher uncertainty in outcomes',
        'May require significant compute resources',
        'Potential implementation challenges',
      ],
      estimatedResources: {
        computeHours: 200,
        memoryGB: 64,
        datasetRequirements: intent.evaluationBenchmarks,
        softwareDependencies: ['PyTorch', 'Custom modules'],
      },
      evaluationMetrics: intent.successCriteria,
    };
  }

  /**
   * Generate combination proposal
   */
  private generateCombinationProposal(
    id: string,
    intent: ResearchIntent,
    existingApproaches: Map<string, string[]>,
    gap?: string
  ): ProposalDraft {
    const categories = Array.from(existingApproaches.keys()).slice(0, 2);
    const method1 = categories[0] || 'Approach A';
    const method2 = categories[1] || 'Approach B';

    return {
      id,
      title: `Synergistic Integration of ${method1} and ${method2} for ${intent.topic}`,
      motivation: `${method1} and ${method2} each have strengths. ` +
        `Combining them synergistically can achieve better results than either alone.`,
      problemDefinition: `How can we effectively combine ${method1} with ${method2} ` +
        `to improve ${intent.topic}?`,
      methodology: {
        overview: `We propose a novel integration of ${method1} and ${method2}`,
        technicalApproach: `
1. Analyze strengths of each approach
2. Design integration mechanism
3. Develop training strategy
4. Optimize for efficiency
        `.trim(),
        implementationSteps: [
          'Component analysis',
          'Integration design',
          'Joint training development',
          'Evaluation and tuning',
        ],
      },
      expectedContributions: [
        'Novel combined method',
        'Analysis of synergy effects',
        'Evidence about whether the combination closes the identified gap',
      ],
      risks: [
        'Integration may introduce complexity',
        'Training stability challenges',
      ],
      estimatedResources: {
        computeHours: 150,
        memoryGB: 48,
        datasetRequirements: intent.evaluationBenchmarks,
        softwareDependencies: ['PyTorch', 'Multiple framework integration'],
      },
      evaluationMetrics: intent.successCriteria,
    };
  }

  /**
   * Generate application proposal
   */
  private generateApplicationProposal(
    id: string,
    intent: ResearchIntent,
    papers: Paper[],
    gap?: string
  ): ProposalDraft {
    const anchorPaper = papers[0]?.title || 'retrieved prior work';
    const scopedGap = gap || intent.problemStatement || intent.topic;

    return {
      id,
      title: `Applying Cross-Domain Techniques to ${intent.topic}`,
      motivation: `The retrieved literature suggests room to adapt ideas beyond ${anchorPaper} toward ${scopedGap.toLowerCase()}.`,
      problemDefinition: `How can we adapt successful techniques from other domains ` +
        `to enhance ${intent.topic}?`,
      methodology: {
        overview: `We adapt cross-domain techniques with domain-specific modifications while keeping the design anchored to limitations visible in ${anchorPaper}`,
        technicalApproach: `
1. Survey cross-domain techniques
2. Identify applicable methods
3. Design adaptation strategy
4. Validate effectiveness
        `.trim(),
        implementationSteps: [
          'Cross-domain literature review',
          'Adaptation design',
          'Implementation',
          'Comparative evaluation',
        ],
      },
      expectedContributions: [
        `A cross-domain adaptation strategy grounded in the limitations of ${anchorPaper}`,
        'Domain-specific improvements',
        'Transfer learning insights',
      ],
      risks: [
        'Domain gap may limit transfer',
        'Adaptation may require significant modification',
      ],
      estimatedResources: {
        computeHours: 80,
        memoryGB: 32,
        datasetRequirements: intent.evaluationBenchmarks,
        softwareDependencies: ['PyTorch', 'Domain-specific libraries'],
      },
      evaluationMetrics: intent.successCriteria,
    };
  }

  /**
   * Generate analysis proposal
   */
  private generateAnalysisProposal(
    id: string,
    intent: ResearchIntent,
    papers: Paper[],
    gap?: string
  ): ProposalDraft {
    return {
      id,
      title: `Understanding and Analyzing ${intent.topic}: A Systematic Study`,
      motivation: `Despite progress, the underlying mechanisms of ${intent.topic} ` +
        `are not fully understood. This work provides systematic analysis.`,
      problemDefinition: `What are the key factors influencing the performance of ` +
        `${intent.topic}? How can we understand and improve them?`,
      methodology: {
        overview: 'We conduct systematic analysis through controlled experiments',
        technicalApproach: `
1. Define analysis framework
2. Design controlled experiments
3. Analyze factors systematically
4. Derive insights and recommendations
        `.trim(),
        implementationSteps: [
          'Framework design',
          'Experiment setup',
          'Data collection',
          'Statistical analysis',
          'Insight derivation',
        ],
      },
      expectedContributions: [
        'Analysis framework',
        'Key insights and findings',
        'Practical recommendations',
      ],
      risks: [
        'Findings may not generalize',
        'Complex factor interactions',
      ],
      estimatedResources: {
        computeHours: 60,
        memoryGB: 16,
        datasetRequirements: intent.evaluationBenchmarks,
        softwareDependencies: ['Python', 'Statistical analysis tools'],
      },
      evaluationMetrics: intent.successCriteria,
    };
  }

  /**
   * Generate fallback proposal
   */
  private generateFallbackProposal(
    context: IdeationContext,
    index: number
  ): ResearchProposal {
    const id = `prop_${Date.now()}_${index}_${Math.random().toString(36).substr(2, 9)}`;
    const { intent } = context;

    const proposal: ProposalDraft = {
      id,
      title: `Research Direction ${index + 1}: ${intent.topic}`,
      motivation: `This proposal explores ${intent.topic} with focus on ${intent.successCriteria[0] || 'improvement'}.`,
      problemDefinition: intent.problemStatement,
      methodology: {
        overview: 'A systematic approach to address the research question',
        technicalApproach: 'Details to be developed during execution',
        implementationSteps: [
          'Literature review',
          'Method design',
          'Implementation',
          'Evaluation',
        ],
      },
      expectedContributions: [
        'Method improvement',
        'Experimental validation',
      ],
      risks: ['Execution challenges'],
      estimatedResources: {
        computeHours: 100,
        memoryGB: 32,
        datasetRequirements: intent.evaluationBenchmarks,
        softwareDependencies: ['PyTorch'],
      },
      evaluationMetrics: intent.successCriteria,
    };

    const fallbackGap = context.identifiedGaps[index % Math.max(1, context.identifiedGaps.length)];
    return this.attachNoveltyAnalysis(proposal, context, fallbackGap);
  }

  /**
   * Refine proposals
   */
  private refineProposals(
    proposals: ResearchProposal[],
    context: IdeationContext
  ): ResearchProposal[] {
    return proposals.map(proposal => {
      // Ensure methodology is well-specified
      if (!proposal.methodology.implementationSteps?.length) {
        proposal.methodology.implementationSteps = [
          'Design and planning',
          'Implementation',
          'Testing and validation',
        ];
      }

      // Ensure evaluation metrics
      if (!proposal.evaluationMetrics?.length) {
        proposal.evaluationMetrics = context.intent.successCriteria;
      }

      return proposal;
    });
  }
}
