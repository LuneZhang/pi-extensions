---
name: research-agent
description: Autonomous full-stack research agent for ML/AI and CFD domains. Automatically performs literature retrieval, innovative ideation, multi-role evaluation, experiment execution, data analysis, visualization, and academic paper writing. Use when user wants to conduct autonomous scientific research.
license: MIT
compatibility: Node.js 18+, Python 3.9+ (for experiments)
---

# Research Agent - Autonomous Scientific Research Agent

A complete autonomous research system that conducts full-cycle scientific research: from idea generation to published paper.

## Supported Domains

- **Machine Learning / Deep Learning**: Neural architecture design, training, optimization, NLP, CV, RL
- **Computational Fluid Dynamics (CFD)**: Numerical simulation, turbulence modeling, flow analysis
- **Related Fields**: Optimization algorithms, data analysis, scientific computing

## Workflow Overview

```
User Intent → Literature Retrieval → Ideation → Multi-Role Evaluation → 
Experiment Execution → Data Analysis → Visualization → Paper Writing → Final Output
```

## Key Features

### 1. Intent Clarification (Interactive)
- 2-3 rounds of dialogue to understand research direction
- Confirms: domain, specific problem, constraints, success criteria

### 2. Literature Retrieval (Automatic)
- Searches arXiv and Semantic Scholar
- Extracts key papers, methods, and findings
- Identifies research gaps and opportunities

### 3. Innovative Ideation (Automatic)
- Generates 3-5 research proposals
- Each proposal includes: motivation, methodology, expected contributions
- Novelty analysis against existing work

### 4. Multi-Role Evaluation (Automatic)
- **Innovation Evaluator**: Assesses novelty and creativity
- **Feasibility Evaluator**: Checks technical feasibility and resource requirements
- **Superiority Evaluator**: Compares against existing methods
- Cross-evaluation identifies the best proposal

### 5. Experiment Execution (Automatic)
- Designs experiment protocols
- Generates and executes code
- Runs simulations/training
- Collects results automatically

### 6. Data Analysis (Automatic)
- Statistical analysis of results
- Comparison with baselines
- Ablation studies
- Error analysis

### 7. Visualization (Automatic)
- Generates publication-quality figures
- Charts, plots, diagrams
- LaTeX-formatted tables

### 8. Paper Writing (Automatic)
- Structured academic writing
- LaTeX output format
- Follows standard paper structure: Abstract, Introduction, Related Work, Method, Experiments, Conclusion

## Usage

### Start a Research Session

```
/research start
```

The agent will ask clarifying questions about your research direction.

### Check Research Progress

```
/research status
```

### Pause/Resume Research

```
/research pause
/research resume
```

### Export Results

```
/research export
```

Exports all artifacts: papers, code, data, figures.

## State Management

Research progress is persisted in `.research/state.json`:
- Current phase
- Collected literature
- Generated proposals
- Experiment results
- Generated figures
- Paper drafts

## Configuration

Create `.research/config.json` to customize:

```json
{
  "domain": "ml",
  "max_papers": 50,
  "max_proposals": 5,
  "experiment_timeout_hours": 24,
  "output_language": "en",
  "paper_template": "neurips"
}
```

## Dependencies

### Required
- Node.js 18+
- Python 3.9+ with scientific computing stack

### Python Packages (for experiments)
```
numpy, scipy, pandas, matplotlib, seaborn
torch/tensorflow (for ML)
```

## Directory Structure

```
.research/
├── state.json          # Research state
├── config.json         # Configuration
├── literature/         # Retrieved papers
├── proposals/          # Research proposals
├── experiments/        # Experiment code and results
├── figures/            # Generated visualizations
├── analysis/           # Data analysis outputs
└── paper/              # Final paper and drafts
```

## Example Session

```
User: I want to research efficient attention mechanisms for transformers

Agent: I understand you're interested in efficient attention mechanisms. Let me clarify:

1. What's your primary goal?
   - Reduce computational complexity?
   - Reduce memory footprint?
   - Maintain accuracy while improving speed?

2. Any specific constraints?
   - Must work with existing architectures?
   - Target hardware (GPU, CPU, edge)?

3. Preferred evaluation benchmarks?

User: Focus on reducing memory for long sequences, must be compatible with standard transformer architectures

Agent: Research direction confirmed:
- Focus: Memory-efficient attention for long sequences
- Constraint: Compatible with standard transformers
- Benchmarks: Long-range benchmarks (e.g., LongBench, PG-19)

Starting autonomous research workflow...

[Phase 1/8] Literature Retrieval...
  ✓ Found 47 relevant papers
  ✓ Extracted key methods: FlashAttention, Linformer, Performer...

[Phase 2/8] Ideation...
  ✓ Generated 4 research proposals
  
[Phase 3/8] Multi-Role Evaluation...
  ✓ Innovation score: 8.2/10
  ✓ Feasibility score: 7.8/10
  ✓ Superiority score: 8.0/10
  ✓ Selected: Proposal #2 - "Hierarchical Chunked Attention"

[Phase 4/8] Experiment Design...
  ...

[Continue until completion]

[Phase 8/8] Paper Writing...
  ✓ Generated LaTeX paper
  ✓ Saved to .research/paper/main.tex

Research complete! Paper ready for review.
```

## Notes

- The agent operates autonomously after intent confirmation
- Only pauses for critical user decisions (if configured)
- All progress is saved and can be resumed after interruption