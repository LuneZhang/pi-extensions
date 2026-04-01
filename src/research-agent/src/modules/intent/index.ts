/**
 * Intent Clarification Module
 * 
 * Manages interactive dialogue to understand and confirm user's research direction
 */

import { 
  StateManager, 
  ResearchIntent, 
  ClarificationRound,
  ResearchDomain 
} from '../../core/state';
import { PhaseExecutor, PhaseExecutionContext } from '../../core/workflow';

// ============================================================================
// Types
// ============================================================================

export interface ClarificationQuestion {
  id: string;
  question: string;
  type: 'single_choice' | 'multiple_choice' | 'text' | 'scale';
  options?: string[];
  followUp?: (answer: string) => ClarificationQuestion | null;
}

export interface ClarificationResult {
  isComplete: boolean;
  nextQuestions?: ClarificationQuestion[];
  currentUnderstanding?: string;
}

// ============================================================================
// Question Templates
// ============================================================================

const DOMAIN_QUESTIONS: Record<ResearchDomain, ClarificationQuestion[]> = {
  ml: [
    {
      id: 'ml_task_type',
      question: 'What type of machine learning task are you focusing on?',
      type: 'single_choice',
      options: [
        'Classification',
        'Regression',
        'Clustering',
        'Generation/Synthesis',
        'Representation Learning',
        'Optimization',
      ],
    },
    {
      id: 'ml_data_type',
      question: 'What type of data will you be working with?',
      type: 'single_choice',
      options: [
        'Tabular data',
        'Images/Video',
        'Text/NLP',
        'Audio/Speech',
        'Time series',
        'Graph/Network data',
        'Multi-modal',
      ],
    },
  ],
  dl: [
    {
      id: 'dl_architecture',
      question: 'What type of deep learning architecture interests you?',
      type: 'single_choice',
      options: [
        'CNN-based',
        'Transformer-based',
        'RNN/LSTM-based',
        'GAN-based',
        'Diffusion models',
        'Hybrid architectures',
        'Novel architecture design',
      ],
    },
  ],
  nlp: [
    {
      id: 'nlp_task',
      question: 'What NLP task is your focus?',
      type: 'single_choice',
      options: [
        'Text generation',
        'Machine translation',
        'Question answering',
        'Text classification',
        'Named entity recognition',
        'Summarization',
        'Dialogue/Conversational AI',
        'Information retrieval',
      ],
    },
    {
      id: 'nlp_scale',
      question: 'What scale of language models are you considering?',
      type: 'single_choice',
      options: [
        'Large-scale (billions of parameters)',
        'Medium-scale (millions of parameters)',
        'Small/efficient models',
        'Model-agnostic methods',
      ],
    },
  ],
  cv: [
    {
      id: 'cv_task',
      question: 'What computer vision task?',
      type: 'single_choice',
      options: [
        'Image classification',
        'Object detection',
        'Semantic segmentation',
        'Instance segmentation',
        'Image generation',
        'Video analysis',
        '3D vision',
        'Medical imaging',
      ],
    },
  ],
  rl: [
    {
      id: 'rl_setting',
      question: 'What reinforcement learning setting?',
      type: 'single_choice',
      options: [
        'Single-agent',
        'Multi-agent',
        'Offline RL',
        'Online RL',
        'Model-based RL',
        'Model-free RL',
      ],
    },
  ],
  cfd: [
    {
      id: 'cfd_application',
      question: 'What CFD application area?',
      type: 'single_choice',
      options: [
        'Turbulence modeling',
        'Heat transfer',
        'Multiphase flow',
        'Aerodynamics',
        'Hydrodynamics',
        'Combustion',
        'ML-accelerated CFD',
      ],
    },
    {
      id: 'cfd_method',
      question: 'What numerical methods are you considering?',
      type: 'single_choice',
      options: [
        'Finite volume method',
        'Finite element method',
        'Spectral methods',
        'Lattice Boltzmann',
        'Mesh-free methods',
        'Physics-informed neural networks',
      ],
    },
  ],
  optimization: [
    {
      id: 'opt_type',
      question: 'What type of optimization?',
      type: 'single_choice',
      options: [
        'Gradient-based optimization',
        'Evolutionary algorithms',
        'Bayesian optimization',
        'Convex optimization',
        'Combinatorial optimization',
        'Hyperparameter optimization',
      ],
    },
  ],
  general: [],
};

const GENERAL_QUESTIONS: ClarificationQuestion[] = [
  {
    id: 'specific_problem',
    question: 'Can you describe the specific problem you want to solve? (e.g., "I want to improve the efficiency of attention mechanisms for long sequences")',
    type: 'text',
  },
  {
    id: 'constraints',
    question: 'What constraints or requirements does your solution need to satisfy?',
    type: 'multiple_choice',
    options: [
      'Must be compatible with existing architectures',
      'Must be computationally efficient',
      'Must work with limited data',
      'Must be interpretable',
      'Must scale to large datasets',
      'Real-time performance required',
      'Memory constraints',
    ],
  },
  {
    id: 'success_criteria',
    question: 'How will you measure success? What metrics matter most?',
    type: 'multiple_choice',
    options: [
      'Accuracy/F1 score improvement',
      'Speed/throughput improvement',
      'Memory reduction',
      'Training efficiency',
      'Generalization ability',
      'Robustness',
      'Novelty of approach',
    ],
  },
  {
    id: 'benchmarks',
    question: 'What benchmarks or datasets should be used for evaluation?',
    type: 'text',
  },
  {
    id: 'timeline',
    question: 'What is your expected timeline for this research?',
    type: 'single_choice',
    options: [
      '1-2 weeks (quick exploration)',
      '1-2 months (conference paper)',
      '3-6 months (full research project)',
      'Flexible/ongoing',
    ],
  },
];

// ============================================================================
// Intent Clarifier
// ============================================================================

export class IntentClarifier implements PhaseExecutor {
  private stateManager: StateManager;
  private currentRound: number = 0;
  private pendingQuestions: ClarificationQuestion[] = [];
  private answers: Map<string, string[]> = new Map();

  constructor(stateManager: StateManager) {
    this.stateManager = stateManager;
  }

  /**
   * Execute the clarification phase
   */
  async execute(context: PhaseExecutionContext): Promise<void> {
    const state = this.stateManager.getState();
    
    // Check if intent is already confirmed
    if (state.intent.isConfirmed) {
      context.reportProgress(100, 'Research direction already confirmed');
      return;
    }

    // Start clarification process
    context.reportProgress(0, 'Starting research direction clarification');

    // Round 1: Understand domain and topic
    if (this.currentRound === 0) {
      await this.conductRound1(context);
    }

    // Round 2: Specific problem and constraints
    if (this.currentRound === 1 && !context.signal.aborted) {
      await this.conductRound2(context);
    }

    // Round 3: Success criteria and benchmarks
    if (this.currentRound === 2 && !context.signal.aborted) {
      await this.conductRound3(context);
    }

    // Confirm final understanding
    if (this.currentRound >= 3 || this.isIntentComplete()) {
      await this.confirmIntent(context);
    }
  }

  /**
   * Round 1: Domain and topic identification
   */
  private async conductRound1(context: PhaseExecutionContext): Promise<void> {
    context.reportProgress(10, 'Understanding your research domain');

    // Ask about topic
    const topicAnswer = await context.requestUserInput(
      'What topic or research area would you like to explore?\n\n' +
      'Example: "efficient attention mechanisms for transformers", ' +
      '"physics-informed neural networks for CFD", "graph neural networks for molecular property prediction"'
    );

    this.recordAnswer('topic', topicAnswer);
    
    // Infer domain from topic
    const inferredDomain = this.inferDomain(topicAnswer);
    
    // Get domain-specific questions
    const domainQuestions = DOMAIN_QUESTIONS[inferredDomain] || [];
    
    if (domainQuestions.length > 0) {
      const domainAnswers: string[] = [];
      
      for (const question of domainQuestions.slice(0, 2)) {
        const answer = await this.requestChoice(
          context,
          question.question,
          question.options || []
        );
        domainAnswers.push(answer);
        this.recordAnswer(question.id, answer);
      }
    }

    this.currentRound = 1;
    context.reportProgress(33, 'Domain and topic understood');
  }

  /**
   * Round 2: Problem definition and constraints
   */
  private async conductRound2(context: PhaseExecutionContext): Promise<void> {
    context.reportProgress(40, 'Defining specific problem');

    // Ask about specific problem
    const problemQuestion = GENERAL_QUESTIONS.find(q => q.id === 'specific_problem')!;
    const problemAnswer = await context.requestUserInput(problemQuestion.question);
    this.recordAnswer('specific_problem', problemAnswer);

    // Ask about constraints
    const constraintQuestion = GENERAL_QUESTIONS.find(q => q.id === 'constraints')!;
    const constraintAnswer = await context.requestUserInput(
      constraintQuestion.question + '\n\n' +
      (constraintQuestion.options || []).map((o, i) => `${i + 1}. ${o}`).join('\n') +
      '\n\nEnter the numbers of applicable constraints (comma-separated) or describe your own:'
    );
    const constraints = this.parseMultiSelect(constraintAnswer, constraintQuestion.options || []);
    this.recordAnswer('constraints', constraints.join('; '));

    this.currentRound = 2;
    context.reportProgress(66, 'Problem and constraints defined');
  }

  /**
   * Round 3: Success criteria and benchmarks
   */
  private async conductRound3(context: PhaseExecutionContext): Promise<void> {
    context.reportProgress(70, 'Setting success criteria');

    // Ask about success criteria
    const successQuestion = GENERAL_QUESTIONS.find(q => q.id === 'success_criteria')!;
    const successAnswer = await context.requestUserInput(
      successQuestion.question + '\n\n' +
      (successQuestion.options || []).map((o, i) => `${i + 1}. ${o}`).join('\n') +
      '\n\nEnter the numbers of most important criteria (comma-separated):'
    );
    const criteria = this.parseMultiSelect(successAnswer, successQuestion.options || []);
    this.recordAnswer('success_criteria', criteria.join('; '));

    // Ask about benchmarks
    const benchmarkQuestion = GENERAL_QUESTIONS.find(q => q.id === 'benchmarks')!;
    const benchmarkAnswer = await context.requestUserInput(
      benchmarkQuestion.question + '\n\n' +
      'Example: "ImageNet for image classification, GLUE for NLP, LongBench for long-context tasks"'
    );
    this.recordAnswer('benchmarks', benchmarkAnswer);

    this.currentRound = 3;
    context.reportProgress(90, 'Success criteria established');
  }

  /**
   * Confirm the final intent with user
   */
  private async confirmIntent(context: PhaseExecutionContext): Promise<void> {
    const intent = this.buildIntent();
    
    // Build confirmation message
    const confirmationMessage = this.buildConfirmationMessage(intent);
    
    const confirmation = await context.requestUserInput(
      confirmationMessage + '\n\n' +
      'Does this accurately capture your research direction?\n\n' +
      '1. Yes, proceed with this direction\n' +
      '2. I want to modify something\n' +
      '3. Start over'
    );

    if (confirmation.includes('1') || confirmation.toLowerCase().includes('yes')) {
      // Save and confirm intent
      this.stateManager.updateIntent(intent);
      this.stateManager.confirmIntent();
      
      // Record clarification round
      const round: ClarificationRound = {
        round: this.currentRound,
        questions: Array.from(this.answers.keys()),
        answers: Array.from(this.answers.values()).flat(),
        timestamp: new Date().toISOString(),
      };
      this.stateManager.addClarificationRound(round);
      
      context.reportProgress(100, 'Research direction confirmed!');
    } else if (confirmation.includes('2') || confirmation.toLowerCase().includes('modify')) {
      // Ask what to modify
      const modifyWhat = await context.requestUserInput(
        'What would you like to modify?\n\n' +
        '1. Topic/domain\n' +
        '2. Specific problem\n' +
        '3. Constraints\n' +
        '4. Success criteria'
      );
      
      // Reset to appropriate round
      if (modifyWhat.includes('1')) this.currentRound = 0;
      else if (modifyWhat.includes('2')) this.currentRound = 1;
      else this.currentRound = 2;
      
      // Re-execute
      await this.execute(context);
    } else {
      // Start over
      this.currentRound = 0;
      this.answers.clear();
      await this.execute(context);
    }
  }

  /**
   * Build intent from collected answers
   */
  private buildIntent(): ResearchIntent {
    const topic = this.answers.get('topic')?.join(' ') || '';
    const problem = this.answers.get('specific_problem')?.join(' ') || '';
    const constraints = this.answers.get('constraints')?.join('; ').split('; ') || [];
    const criteria = this.answers.get('success_criteria')?.join('; ').split('; ') || [];
    const benchmarks = this.answers.get('benchmarks')?.join(' ').split(/[;,]/).map(s => s.trim()) || [];
    
    return {
      domain: this.inferDomain(topic),
      topic,
      problemStatement: problem,
      constraints: {
        compatibilityRequirements: constraints.filter(c => 
          c.toLowerCase().includes('compatible') || 
          c.toLowerCase().includes('existing')
        ),
        resourceConstraints: constraints.filter(c =>
          c.toLowerCase().includes('memory') ||
          c.toLowerCase().includes('computational') ||
          c.toLowerCase().includes('real-time')
        ),
      },
      successCriteria: criteria,
      evaluationBenchmarks: benchmarks.filter(b => b.length > 0),
      clarificationRounds: [],
      isConfirmed: false,
    };
  }

  /**
   * Build confirmation message
   */
  private buildConfirmationMessage(intent: ResearchIntent): string {
    return `
## Research Direction Summary

**Domain**: ${intent.domain.toUpperCase()}

**Topic**: ${intent.topic}

**Problem Statement**: ${intent.problemStatement}

**Constraints**:
${intent.constraints.compatibilityRequirements.length > 0 
  ? intent.constraints.compatibilityRequirements.map(c => `- ${c}`).join('\n')
  : '- None specified'}

**Success Criteria**:
${intent.successCriteria.map(c => `- ${c}`).join('\n')}

**Evaluation Benchmarks**:
${intent.evaluationBenchmarks.length > 0 
  ? intent.evaluationBenchmarks.map(b => `- ${b}`).join('\n')
  : '- To be determined'}
`.trim();
  }

  /**
   * Infer domain from topic text
   */
  private inferDomain(topic: string): ResearchDomain {
    const topicLower = topic.toLowerCase();
    
    if (/transformer|attention|language model|nlp|text|bert|gpt/i.test(topicLower)) {
      return 'nlp';
    }
    if (/image|vision|cnn|segmentation|detection|classification.*image/i.test(topicLower)) {
      return 'cv';
    }
    if (/reinforcement|reward|policy|agent|rl/i.test(topicLower)) {
      return 'rl';
    }
    if (/fluid|cfd|navier|turbulence|aerodynamic|flow/i.test(topicLower)) {
      return 'cfd';
    }
    if (/optim|gradient|loss|converg/i.test(topicLower)) {
      return 'optimization';
    }
    if (/neural|deep learning|architecture|layer|network/i.test(topicLower)) {
      return 'dl';
    }
    if (/machine learning|ml|training|model/i.test(topicLower)) {
      return 'ml';
    }
    
    return 'general';
  }

  /**
   * Check if intent is complete
   */
  private isIntentComplete(): boolean {
    return (
      this.answers.has('topic') &&
      this.answers.has('specific_problem') &&
      this.answers.has('success_criteria')
    );
  }

  /**
   * Record an answer
   */
  private recordAnswer(questionId: string, answer: string): void {
    const existing = this.answers.get(questionId) || [];
    this.answers.set(questionId, [...existing, answer]);
  }

  /**
   * Parse multi-select answer
   */
  private parseMultiSelect(answer: string, options: string[]): string[] {
    // Try to parse as numbers
    const numbers = answer.match(/\d+/g);
    if (numbers) {
      return numbers
        .map(n => parseInt(n) - 1)
        .filter(i => i >= 0 && i < options.length)
        .map(i => options[i]);
    }
    
    // Otherwise, return as-is
    return [answer];
  }

  /**
   * Request a choice selection
   */
  private async requestChoice(
    context: PhaseExecutionContext,
    question: string,
    options: string[]
  ): Promise<string> {
    const optionText = options.map((o, i) => `${i + 1}. ${o}`).join('\n');
    const answer = await context.requestUserInput(
      question + '\n\n' + optionText + '\n\nEnter the number of your choice:'
    );
    
    const num = parseInt(answer.match(/\d+/)?.[0] || '1');
    return options[Math.max(0, Math.min(num - 1, options.length - 1))];
  }
}