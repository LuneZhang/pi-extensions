# Pi Extensions

[![pi-package](https://img.shields.io/badge/pi--package-compatible-blue)](https://shittycodingagent.ai/packages)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

A collection of custom extensions for [pi coding agent](https://github.com/mariozechner/pi-coding-agent) that enhance productivity and enable advanced workflows.

## Features

| Extension | Description |
|-----------|-------------|
| **artifacts** 📁 | Browse and preview files created/modified during the session with rich UI |
| **dashboard** 📊 | Real-time session statistics widget showing messages, tokens, and file operations |
| **diff** 🔀 | Git diff viewer — select changed files and open in VS Code diff view |
| **files** 🗂️ | Show all files read/written/edited in current session with operation history |
| **prompt-url-widget** 🔗 | Auto-detect GitHub PR/Issue URLs in prompts and show metadata preview |
| **question** ❓ | Interactive multi-question tool with options, multi-select, and custom answer support |
| **research-agent** 🔬 | Autonomous scientific research workflow — literature review → experiments → paper |
| **tps** ⚡ | Tokens-per-second monitor showing performance stats after each agent turn |
| **tui** 🖼️ | TUI diagnostics command for checking redraw statistics |

### Highlights

**Question Tool** — Ask structured questions with a beautiful interactive UI:

```
┌─────────────────────────────────────────────────────┐
│ Which approach do you prefer?                       │
│                                                     │
│ > (x) 1. Clean architecture                         │
│      Easy to test, clear separation of concerns     │
│                                                     │
│   ( ) 2. Quick prototype                            │
│      Fast iteration, minimal structure              │
│                                                     │
│   ( ) 3. Type your own answer                       │
│      Open an input box to type your own answer      │
│                                                     │
│ [space: select] [enter: submit] [esc: dismiss]     │
└─────────────────────────────────────────────────────┘
```

**Research Agent** — Full-cycle autonomous research:

```
User: Research efficient attention mechanisms for long sequences
      │
      ▼
┌─────────────────────────────────────────────────────────┐
│ 1. Clarify Intent    →  2-3 rounds of dialogue         │
│ 2. Literature Review →  arXiv + Semantic Scholar       │
│ 3. Ideation         →  Generate research proposals     │
│ 4. Evaluation       →  Multi-perspective scoring       │
│ 5. Selection        →  Choose best proposal            │
│ 6. Experiments      →  Design + Execute + Analyze      │
│ 7. Visualization    →  Generate figures                │
│ 8. Paper Writing    →  Complete academic paper         │
└─────────────────────────────────────────────────────────┘
```

## Installation

### Quick Install (Git)

```bash
pi install git:github.com/LuneZhang/pi-extensions
```

### Install with Version Pin

```bash
pi install git:github.com/LuneZhang/pi-extensions@v1.0.0
```

### Try Without Installing

```bash
pi -e git:github.com/LuneZhang/pi-extensions
```

### Requirements

- [pi coding agent](https://github.com/mariozechner/pi-coding-agent) v0.64.0+
- Node.js 20+

**No additional dependencies required** — all runtime dependencies are bundled.

## Usage

After installation, extensions are automatically loaded on pi startup.

### Commands

| Command | Description |
|---------|-------------|
| `/artifacts` | Open artifacts browser |
| `/dashboard` | Toggle session dashboard |
| `/diff` | Show git changes and open diff |
| `/files` | List session file operations |
| `/tui` | Show TUI statistics |
| `/research start` | Start autonomous research |
| `/research status` | Check research progress |

### Tools (LLM-callable)

The `question` and `research` tools are available to the LLM:

```typescript
// Question tool — ask structured questions
{
  "questions": [
    {
      "question": "Which framework should we use?",
      "header": "Framework",
      "options": [
        { "label": "React", "description": "Component-based, virtual DOM" },
        { "label": "Vue", "description": "Progressive, template-based" }
      ],
      "multiple": false
    }
  ]
}

// Research tool — start research workflow
{
  "action": "start",
  "topic": "efficient attention for long sequences",
  "domain": "nlp"
}
```

## Development

### Prerequisites

```bash
# Clone the repository
git clone https://github.com/LuneZhang/pi-extensions.git
cd pi-extensions

# Install dev dependencies
npm install
```

### Build

```bash
# Build all extensions
npm run build

# Watch mode for development
npm run watch
```

### Project Structure

```
pi-extensions/
├── src/                      # Source files
│   ├── artifacts.ts
│   ├── dashboard.ts
│   ├── diff.ts
│   ├── files.ts
│   ├── prompt-url-widget.ts
│   ├── question/
│   │   └── index.ts
│   ├── redraws.ts
│   ├── research-agent/
│   │   ├── src/
│   │   │   ├── index.ts      # Entry point
│   │   │   ├── core/         # State management
│   │   │   ├── modules/      # Functional modules
│   │   │   └── tools/        # arXiv, Semantic Scholar
│   │   └── ...
│   └── tps.ts
├── dist/                     # Bundled extensions (committed)
├── package.json              # Package manifest
├── build.js                  # Build script (esbuild)
├── README.md
└── AGENDA.md                 # Development roadmap
```

### Adding a New Extension

1. Create `src/my-extension.ts`:

```typescript
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";

export default function (pi: ExtensionAPI) {
  pi.registerCommand("my-cmd", {
    description: "My custom command",
    handler: async (args, ctx) => {
      ctx.ui.notify("Hello!", "info");
    },
  });
}
```

2. Add to `build.js`:

```javascript
const extensions = [
  // ...existing entries
  { entry: 'my-extension.ts', out: 'my-extension.js' },
];
```

3. Build and test:

```bash
npm run build
pi --version  # Should load new extension
```

### Adding Dependencies

```bash
npm install <package>
npm run build
```

Dependencies are automatically bundled into `dist/`.

## Contributing

Contributions are welcome! Please:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/my-extension`)
3. Commit changes (`git commit -am 'Add my-extension'`)
4. Push to branch (`git push origin feature/my-extension`)
5. Open a Pull Request

### Guidelines

- Follow existing code style
- Add TypeScript types for all functions
- Test extensions manually before submitting
- Update documentation for new features

## License

MIT License — see [LICENSE](LICENSE) for details.

## Acknowledgments

- [pi coding agent](https://github.com/mariozechner/pi-coding-agent) by [@mariozechner](https://github.com/mariozechner)
- [arXiv API](https://arxiv.org/help/api) for paper search
- [Semantic Scholar API](https://api.semanticscholar.org/) for literature retrieval

---

**Maintained by [@LuneZhang](https://github.com/LuneZhang)**