# Research Agent - Autonomous Scientific Research Agent

A complete autonomous research system that conducts full-cycle scientific research: from idea generation to published paper.

## Features

### 🎯 Full Research Workflow

1. **Intent Clarification** - Interactive dialogue to understand research direction
2. **Literature Retrieval** - Automatic paper search from arXiv and Semantic Scholar
3. **Ideation** - Generate innovative research proposals
4. **Multi-Role Evaluation** - Evaluate proposals for innovation, feasibility, and superiority
5. **Proposal Selection** - Select the best proposal based on evaluation
6. **Experiment Execution** - Design and run experiments automatically
7. **Data Analysis** - Analyze results and generate insights
8. **Visualization** - Create publication-quality figures
9. **Paper Writing** - Generate complete LaTeX papers

### 🔧 Supported Domains

- **Machine Learning (ML)**
- **Deep Learning (DL)**
- **Natural Language Processing (NLP)**
- **Computer Vision (CV)**
- **Reinforcement Learning (RL)**
- **Computational Fluid Dynamics (CFD)**
- **Optimization**

### 📚 Data Sources

- **arXiv** - Preprint server for CS/AI papers
- **Semantic Scholar** - Academic search with citations

## Installation

Copy the whole plugin directory into your global pi extensions folder, then install its npm dependencies:

```bash
mkdir -p ~/.pi/agent/extensions
cp -R extra-extensions/extensions/research-agent ~/.pi/agent/extensions/research-agent
cd ~/.pi/agent/extensions/research-agent
npm install
```

Restart `pi` or run `/reload` after copying the plugin folder.

## Usage

### In pi-agent

```bash
# Start a research project
/research start

# Check progress
/research status

# Pause/resume
/research pause
/research resume

# Export results
/research export
```

### Using the Research Tool

The agent can also use the `research` tool directly:

```json
{
  "action": "start",
  "topic": "efficient attention mechanisms for transformers",
  "domain": "nlp"
}
```

## Project Structure

```
research-agent/
├── SKILL.md                    # Skill definition reference
├── package.json                # Extension package manifest
├── src/
│   ├── index.ts                # Main entry point & pi extension
│   ├── core/
│   │   ├── state.ts            # State management
│   │   └── workflow.ts         # Workflow engine
│   ├── modules/
│   │   ├── intent/             # Intent clarification
│   │   ├── retrieval/          # Literature retrieval
│   │   ├── ideation/           # Proposal generation
│   │   ├── evaluation/         # Multi-role evaluation
│   │   ├── selection/          # Proposal selection
│   │   ├── experiment/         # Experiment execution
│   │   ├── analysis/           # Data analysis
│   │   ├── visualization/      # Figure generation
│   │   └── writing/            # Paper writing
│   └── tools/
│       ├── arxiv.ts            # arXiv API client
│       └── semantic-scholar.ts # Semantic Scholar API client
└── templates/
    └── paper.tex               # LaTeX paper template
```

## Research Workflow

```
┌─────────────────────────────────────────────────────────────────────┐
│                    Research Agent Workflow                           │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  User Input ──▶ Intent Clarification (2-3 rounds)                  │
│         │                                                           │
│         ▼                                                           │
│  Literature Retrieval ──▶ arXiv + Semantic Scholar                  │
│         │                                                           │
│         ▼                                                           │
│  Ideation ──▶ Generate 3-5 research proposals                       │
│         │                                                           │
│         ▼                                                           │
│  Multi-Role Evaluation                                              │
│    ├── Innovation Evaluator                                         │
│    ├── Feasibility Evaluator                                        │
│    ├── Superiority Evaluator                                        │
│    └── Cross-Reviewer                                               │
│         │                                                           │
│         ▼                                                           │
│  Proposal Selection ──▶ Best proposal chosen                        │
│         │                                                           │
│         ▼                                                           │
│  Experiment Execution ──▶ Automatic code generation & execution     │
│         │                                                           │
│         ▼                                                           │
│  Data Analysis ──▶ Statistical analysis & insights                  │
│         │                                                           │
│         ▼                                                           │
│  Visualization ──▶ Publication-quality figures                      │
│         │                                                           │
│         ▼                                                           │
│  Paper Writing ──▶ Complete LaTeX paper                             │
│         │                                                           │
│         ▼                                                           │
│  Output ──▶ Paper, Code, Figures, Data                             │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

## Output Artifacts

After completion, the research project produces:

```
.research/
├── state.json          # Complete research state
├── literature/         # Retrieved papers (metadata)
├── proposals/          # Generated research proposals
├── experiments/        # Experiment code and logs
├── analysis/           # Analysis results
├── figures/            # Generated visualizations
└── paper/
    ├── main.tex        # LaTeX source
    └── references.bib  # Bibliography
```

## Configuration

Create `.research/config.json` to customize:

```json
{
  "domain": "ml",
  "maxPapers": 50,
  "maxProposals": 5,
  "experimentTimeoutHours": 24,
  "outputLanguage": "en",
  "paperTemplate": "neurips"
}
```

## API Keys (Optional)

For enhanced Semantic Scholar access:

```bash
export SEMANTIC_SCHOLAR_API_KEY=your-api-key
```

## Requirements

- Node.js 18+
- Python 3.9+ (for experiments)
- PyTorch/TensorFlow (for ML experiments)

## License

MIT

## Acknowledgments

Built as a pi-agent extension for autonomous scientific research.
