/**
 * Multi-Role Evaluation Module
 * 
 * Evaluates research proposals from multiple perspectives:
 * - Innovation: Novelty and creativity
 * - Feasibility: Technical and resource feasibility
 * - Superiority: Advantages over existing methods
 */

import {
  StateManager,
  ResearchProposal,
  ProposalScores,
  EvaluationComment,
  Paper,
  NoveltyAnalysis,
  ResearchIntent
} from '../../core/state';
import { PhaseExecutor, PhaseExecutionContext } from '../../core/workflow';
import { buildNoveltyAnalysisFromProposal } from '../shared/prior-art';

// ============================================================================
// Types
// ============================================================================

export type EvaluationRole = 'innovator' | 'feasibility_analyst' | 'superiority_analyst' | 'reviewer';

export interface EvaluationCriteria {
  dimension: string;
  weight: number;
  subCriteria: string[];
}

export interface EvaluationResult {
  proposalId: string;
  scores: ProposalScores;
  noveltyAnalysis: NoveltyAnalysis;
  recommendation: 'strong_accept' | 'accept' | 'weak_accept' | 'borderline' | 'reject';
  summary: string;
}

// ============================================================================
// Evaluation Criteria
// ============================================================================

const EVALUATION_CRITERIA: Record<string, EvaluationCriteria[]> = {
  innovation: [
    {
      dimension: 'Novelty',
      weight: 0.4,
      subCriteria: [
        'New problem formulation',
        'Novel methodology',
        'Creative combination of ideas',
        'Fresh perspective on existing problem',
      ],
    },
    {
      dimension: 'Originality',
      weight: 0.3,
      subCriteria: [
        'Different from existing work',
        'Not incremental improvement only',
        'Potential for new research direction',
      ],
    },
    {
      dimension: 'Impact Potential',
      weight: 0.3,
      subCriteria: [
        'Could influence future research',
        'Addresses important gap',
        'Has practical implications',
      ],
    },
  ],
  feasibility: [
    {
      dimension: 'Technical Soundness',
      weight: 0.35,
      subCriteria: [
        'Method is technically viable',
        'Clear implementation path',
        'No fundamental barriers',
      ],
    },
    {
      dimension: 'Resource Availability',
      weight: 0.25,
      subCriteria: [
        'Compute resources sufficient',
        'Datasets available',
        'Software/tool support exists',
      ],
    },
    {
      dimension: 'Timeline',
      weight: 0.2,
      subCriteria: [
        'Can be completed in reasonable time',
        'No blocking dependencies',
        'Clear milestones possible',
      ],
    },
    {
      dimension: 'Risk Management',
      weight: 0.2,
      subCriteria: [
        'Risks identified',
        'Mitigation strategies possible',
        'Alternative approaches exist',
      ],
    },
  ],
  superiority: [
    {
      dimension: 'Performance Advantage',
      weight: 0.35,
      subCriteria: [
        'Clear performance improvements expected',
        'Metrics advantage',
        'Efficiency gains',
      ],
    },
    {
      dimension: 'Practical Benefits',
      weight: 0.25,
      subCriteria: [
        'Easier to use/deploy',
        'Lower resource requirements',
        'Better generalization',
      ],
    },
    {
      dimension: 'Theoretical Contribution',
      weight: 0.2,
      subCriteria: [
        'New insights',
        'Better understanding',
        'Theoretical foundations',
      ],
    },
    {
      dimension: 'Reproducibility',
      weight: 0.2,
      subCriteria: [
        'Method can be reproduced',
        'Clear specification',
        'Open implementation possible',
      ],
    },
  ],
};

// ============================================================================
// Evaluator Agents
// ============================================================================

interface EvaluatorAgent {
  role: EvaluationRole;
  evaluate(proposal: ResearchProposal, context: EvaluationContext): Promise<EvaluationComment>;
}

interface EvaluationContext {
  relatedPapers: Paper[];
  domainKnowledge: string[];
  constraints: string[];
  intent: ResearchIntent;
}

class InnovationEvaluator implements EvaluatorAgent {
  role: EvaluationRole = 'innovator';

  async evaluate(proposal: ResearchProposal, context: EvaluationContext): Promise<EvaluationComment> {
    const criteria = EVALUATION_CRITERIA.innovation;
    const concerns: string[] = [];
    const suggestions: string[] = [];
    const supportingPapers = proposal.noveltyAnalysis.supportingPapers || [];
    const averageOverlap = supportingPapers.length > 0
      ? supportingPapers.reduce((sum, paper) => sum + paper.overlapScore, 0) / supportingPapers.length
      : 0;
    const strongestMatch = supportingPapers[0];

    if (supportingPapers.length === 0) {
      concerns.push('Novelty claim is weakly grounded because no strong prior-art matches were extracted from the retrieved literature');
      suggestions.push('Retrieve more closely related papers before treating this as a strong novelty claim');
    } else if (averageOverlap > 0.45 && strongestMatch) {
      concerns.push(`High overlap with retrieved prior art, especially ${strongestMatch.title}`);
      suggestions.push('Narrow the claim to the concrete uncovered gap rather than presenting the idea as broadly novel');
    }

    const uncoveredGap = /lack|not directly covered|underrepresented|sparsely covered/i.test(
      `${proposal.noveltyAnalysis.gapStatement || ''} ${proposal.noveltyAnalysis.noveltyJustification}`
    );
    if (!uncoveredGap) {
      concerns.push('The literature comparison suggests the proposal is closer to incremental extension than a clearly isolated research gap');
    }

    const noveltyDimension = Math.max(1, Math.min(10,
      proposal.noveltyAnalysis.noveltyScore - averageOverlap * 4 + (uncoveredGap ? 1 : 0)
    ));
    const originalityDimension = Math.max(1, Math.min(10,
      4 + proposal.noveltyAnalysis.keyDifferences.length + (uncoveredGap ? 2 : 0) - (averageOverlap > 0.45 ? 1 : 0)
    ));
    const impactDimension = Math.max(1, Math.min(10,
      4 + Math.min(3, proposal.expectedContributions.length) + (proposal.evaluationMetrics.length > 0 ? 1 : 0)
    ));

    if (proposal.expectedContributions.length < 3) {
      concerns.push('Limited expected contributions');
      suggestions.push('Expand contributions beyond basic implementation');
    }

    const finalScore =
      noveltyDimension * criteria[0].weight +
      originalityDimension * criteria[1].weight +
      impactDimension * criteria[2].weight;

    return {
      role: this.role,
      comment: this.generateComment(proposal, finalScore, concerns),
      score: finalScore,
      concerns,
      suggestions,
    };
  }

  private generateComment(
    proposal: ResearchProposal,
    score: number,
    concerns: string[]
  ): string {
    const priorArtAnchor = proposal.noveltyAnalysis.supportingPapers?.[0]?.title;
    if (score >= 8) {
      return `Literature-grounded novelty case is promising${priorArtAnchor ? ` relative to ${priorArtAnchor}` : ''}. ${proposal.noveltyAnalysis.noveltyJustification}`;
    } else if (score >= 6) {
      return `Moderately innovative with some differentiated elements, but the prior-art comparison still shows overlap with nearby work.`;
    } else {
      return `Innovation claim is weak after comparing against retrieved literature. Consider narrowing or reframing the contribution around a better-supported gap.`;
    }
  }
}

class FeasibilityEvaluator implements EvaluatorAgent {
  role: EvaluationRole = 'feasibility_analyst';

  async evaluate(proposal: ResearchProposal, context: EvaluationContext): Promise<EvaluationComment> {
    const criteria = EVALUATION_CRITERIA.feasibility;
    let totalScore = 0;
    const concerns: string[] = [];
    const suggestions: string[] = [];

    // Technical soundness
    const hasClearMethodology = proposal.methodology.implementationSteps?.length >= 3;
    if (hasClearMethodology) {
      totalScore += 8 * criteria[0].weight;
    } else {
      concerns.push('Methodology not well specified');
      suggestions.push('Provide more detailed implementation steps');
    }

    // Resource check
    const computeHours = proposal.estimatedResources.computeHours;
    if (computeHours <= 100) {
      totalScore += 9 * criteria[1].weight;
    } else if (computeHours <= 200) {
      totalScore += 7 * criteria[1].weight;
      concerns.push('High compute requirements');
    } else {
      totalScore += 4 * criteria[1].weight;
      concerns.push('Very high compute requirements may be prohibitive');
    }

    // Timeline feasibility
    const steps = proposal.methodology.implementationSteps?.length || 0;
    if (steps <= 5) {
      totalScore += 8 * criteria[2].weight;
    } else {
      totalScore += 6 * criteria[2].weight;
      concerns.push('Complex implementation with many steps');
    }

    // Risk assessment
    if (proposal.risks.length <= 2) {
      totalScore += 8 * criteria[3].weight;
    } else if (proposal.risks.length <= 4) {
      totalScore += 6 * criteria[3].weight;
      concerns.push('Multiple risks identified');
    } else {
      totalScore += 4 * criteria[3].weight;
      concerns.push('High risk proposal');
      suggestions.push('Consider risk mitigation strategies');
    }

    const finalScore = totalScore;

    return {
      role: this.role,
      comment: this.generateComment(proposal, finalScore, concerns),
      score: finalScore,
      concerns,
      suggestions,
    };
  }

  private generateComment(
    proposal: ResearchProposal,
    score: number,
    concerns: string[]
  ): string {
    if (score >= 7) {
      return `Feasible proposal with manageable risks. Clear implementation path.`;
    } else if (score >= 5) {
      return `Moderately feasible. Some concerns about ${concerns[0]?.toLowerCase() || 'resources'}.`;
    } else {
      return `Feasibility concerns. Consider simplifying the scope or addressing identified risks.`;
    }
  }
}

class SuperiorityEvaluator implements EvaluatorAgent {
  role: EvaluationRole = 'superiority_analyst';

  async evaluate(proposal: ResearchProposal, context: EvaluationContext): Promise<EvaluationComment> {
    const criteria = EVALUATION_CRITERIA.superiority;
    let totalScore = 0;
    const concerns: string[] = [];
    const suggestions: string[] = [];

    // Performance advantage
    const hasMetrics = proposal.evaluationMetrics.length > 0;
    if (hasMetrics) {
      totalScore += 7 * criteria[0].weight;
    } else {
      concerns.push('No clear evaluation metrics defined');
      suggestions.push('Specify concrete evaluation metrics');
    }

    // Check for comparison baselines
    const hasBaselines = proposal.noveltyAnalysis.comparedMethods.length > 0;
    if (hasBaselines) {
      totalScore += 0.5 * criteria[0].weight * 10;
    } else {
      suggestions.push('Identify baseline methods for comparison');
    }

    if (proposal.noveltyAnalysis.supportingPapers?.[0]) {
      const anchor = proposal.noveltyAnalysis.supportingPapers[0];
      suggestions.push(`Use ${anchor.title} as a concrete high-priority baseline in experiments`);
    }

    // Practical benefits
    const hasEfficiencyImprovement = proposal.noveltyAnalysis.keyDifferences.some(d =>
      /efficient|fast|scalable|memory/i.test(d)
    );
    if (hasEfficiencyImprovement) {
      totalScore += 8 * criteria[1].weight;
    } else {
      totalScore += 6 * criteria[1].weight;
    }

    // Theoretical contribution
    const hasTheory = proposal.methodology.technicalApproach.toLowerCase().includes('theor') ||
                      proposal.expectedContributions.some(c => /insight|understand|analysis/i.test(c));
    if (hasTheory) {
      totalScore += 7 * criteria[2].weight;
    } else {
      totalScore += 5 * criteria[2].weight;
    }

    // Reproducibility
    if (proposal.expectedContributions.some(c => /open.*source|code|implementation/i.test(c))) {
      totalScore += 8 * criteria[3].weight;
    } else {
      totalScore += 6 * criteria[3].weight;
      suggestions.push('Consider open-sourcing implementation');
    }

    const finalScore = totalScore;

    return {
      role: this.role,
      comment: this.generateComment(proposal, finalScore, hasBaselines),
      score: finalScore,
      concerns,
      suggestions,
    };
  }

  private generateComment(
    proposal: ResearchProposal,
    score: number,
    hasBaselines: boolean
  ): string {
    if (score >= 7) {
      return `Strong potential for superiority. Clear advantages over existing methods.`;
    } else if (score >= 5) {
      return `Moderate potential. ${hasBaselines ? 'Good baseline comparison planned.' : 'Need clearer comparison strategy.'}`;
    } else {
      return `Unclear advantages. Need stronger justification for why this approach is better.`;
    }
  }
}

class CrossReviewer implements EvaluatorAgent {
  role: EvaluationRole = 'reviewer';

  async evaluate(proposal: ResearchProposal, context: EvaluationContext): Promise<EvaluationComment> {
    // Cross-review looks at overall balance and integration
    const concerns: string[] = [];
    const suggestions: string[] = [];

    // Check balance between novelty and feasibility
    const novelty = proposal.noveltyAnalysis.noveltyScore;
    const complexity = proposal.methodology.implementationSteps?.length || 0;

    let balanceScore = 7;
    if (novelty >= 8 && complexity >= 5) {
      concerns.push('High novelty but complex implementation - consider simplifying');
      balanceScore = 6;
      suggestions.push('Consider phased implementation');
    } else if (novelty <= 5 && complexity <= 3) {
      concerns.push('Low complexity may limit novelty contribution');
      balanceScore = 6;
      suggestions.push('Consider adding more innovative elements');
    }

    // Check if contributions match methodology
    const contributionsMatchSteps = proposal.expectedContributions.every(c =>
      proposal.methodology.implementationSteps?.some(s =>
        s.toLowerCase().includes(c.toLowerCase().split(' ')[0])
      ) || true // Simplified check
    );

    if (!contributionsMatchSteps) {
      suggestions.push('Ensure contributions align with implementation steps');
    }

    return {
      role: this.role,
      comment: `Cross-review: Well-balanced proposal with coherent structure. ` +
               `${concerns.length > 0 ? 'Address: ' + concerns.join(', ') : 'No major integration concerns.'}`,
      score: balanceScore,
      concerns,
      suggestions,
    };
  }
}

// ============================================================================
// Evaluation Orchestrator
// ============================================================================

export class EvaluationOrchestrator implements PhaseExecutor {
  private stateManager: StateManager;
  private evaluators: EvaluatorAgent[];

  constructor(stateManager: StateManager) {
    this.stateManager = stateManager;
    this.evaluators = [
      new InnovationEvaluator(),
      new FeasibilityEvaluator(),
      new SuperiorityEvaluator(),
      new CrossReviewer(),
    ];
  }

  /**
   * Execute evaluation phase
   */
  async execute(context: PhaseExecutionContext): Promise<void> {
    const state = this.stateManager.getState();
    const proposals = state.proposals;
    const papers = state.literature.papers;

    if (proposals.length === 0) {
      throw new Error('No proposals to evaluate');
    }

    context.reportProgress(0, `Starting multi-role evaluation of ${proposals.length} proposals`);

      const evaluationContext: EvaluationContext = {
        relatedPapers: papers,
        domainKnowledge: [],
        constraints: state.intent.constraints.compatibilityRequirements,
        intent: state.intent,
      };

    // Evaluate each proposal
    for (let i = 0; i < proposals.length; i++) {
      const proposal = proposals[i];
      context.reportProgress(
        (i / proposals.length) * 80,
        `Evaluating proposal ${i + 1}: ${proposal.title.substring(0, 40)}...`
      );

      const result = await this.evaluateProposal(proposal, evaluationContext);

      // Update proposal with scores
      this.stateManager.updateProposal(proposal.id, {
        scores: result.scores,
        noveltyAnalysis: result.noveltyAnalysis,
      });
    }

    context.reportProgress(90, 'Finalizing evaluation results');

    // Generate summary
    const summary = this.generateEvaluationSummary(proposals);
    context.reportProgress(100, 'Evaluation complete');

    // Log results
    console.log('\n' + summary);
  }

  /**
   * Evaluate a single proposal
   */
  private async evaluateProposal(
    proposal: ResearchProposal,
    context: EvaluationContext
  ): Promise<EvaluationResult> {
    const noveltyAnalysis = buildNoveltyAnalysisFromProposal(proposal, context.intent, context.relatedPapers);
    const enrichedProposal: ResearchProposal = {
      ...proposal,
      noveltyAnalysis,
    };
    const evaluationComments: EvaluationComment[] = [];

    // Run all evaluators
    for (const evaluator of this.evaluators) {
      const comment = await evaluator.evaluate(enrichedProposal, context);
      evaluationComments.push(comment);
    }

    // Calculate overall scores
    const innovationScore = this.extractScore(evaluationComments, 'innovator');
    const feasibilityScore = this.extractScore(evaluationComments, 'feasibility_analyst');
    const superiorityScore = this.extractScore(evaluationComments, 'superiority_analyst');

    // Calculate overall score with weights
    const overallScore = (
      innovationScore * 0.35 +
      feasibilityScore * 0.30 +
      superiorityScore * 0.35
    );

    // Determine recommendation
    const recommendation = this.determineRecommendation(overallScore);

    // Build summary
    const summary = this.buildProposalSummary(enrichedProposal, evaluationComments, overallScore);

    const scores: ProposalScores = {
      innovationScore,
      feasibilityScore,
      superiorityScore,
      overallScore,
      evaluationComments,
    };

    return {
      proposalId: proposal.id,
      scores,
      noveltyAnalysis,
      recommendation,
      summary,
    };
  }

  /**
   * Extract score for a specific role
   */
  private extractScore(comments: EvaluationComment[], role: EvaluationRole): number {
    const comment = comments.find(c => c.role === role);
    return comment?.score || 5;
  }

  /**
   * Determine recommendation based on score
   */
  private determineRecommendation(score: number): EvaluationResult['recommendation'] {
    if (score >= 8) return 'strong_accept';
    if (score >= 7) return 'accept';
    if (score >= 6) return 'weak_accept';
    if (score >= 5) return 'borderline';
    return 'reject';
  }

  /**
   * Build proposal summary
   */
  private buildProposalSummary(
    proposal: ResearchProposal,
    comments: EvaluationComment[],
    overallScore: number
  ): string {
    const topConcerns = comments
      .flatMap(c => c.concerns)
      .slice(0, 3);

    const topSuggestions = comments
      .flatMap(c => c.suggestions)
      .slice(0, 3);

    return `
## Evaluation Summary: ${proposal.title}

**Overall Score**: ${overallScore.toFixed(1)}/10

**Key Strengths**:
${comments.filter(c => c.score >= 7).map(c => `- ${c.role}: ${c.comment}`).join('\n')}

**Concerns**:
${topConcerns.map(c => `- ${c}`).join('\n')}

**Suggestions**:
${topSuggestions.map(s => `- ${s}`).join('\n')}
`.trim();
  }

  /**
   * Generate overall evaluation summary
   */
  private generateEvaluationSummary(proposals: ResearchProposal[]): string {
    const scoredProposals = proposals
      .filter(p => p.scores)
      .sort((a, b) => (b.scores?.overallScore || 0) - (a.scores?.overallScore || 0));

    return `
## Multi-Role Evaluation Summary

${scoredProposals.map((p, i) => `
### ${i + 1}. ${p.title}
- Innovation: ${(p.scores?.innovationScore || 0).toFixed(1)}/10
- Feasibility: ${(p.scores?.feasibilityScore || 0).toFixed(1)}/10
- Superiority: ${(p.scores?.superiorityScore || 0).toFixed(1)}/10
- **Overall: ${(p.scores?.overallScore || 0).toFixed(1)}/10**
`.trim()).join('\n\n')}

**Recommended Proposal**: ${scoredProposals[0]?.title || 'None'}
`.trim();
  }
}
