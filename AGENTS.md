# Pi Extensions Development Agenda

> Development roadmap and task tracking for this extension collection.

## Vision

Build a comprehensive, high-quality extension collection for [pi coding agent](https://github.com/mariozechner/pi-coding-agent) that enhances productivity and enables advanced workflows like autonomous scientific research.

---

## Current Status

### Completed Extensions

| Extension | Status | Description |
|-----------|--------|-------------|
| `artifacts` | ✅ Stable | File artifacts browser with preview support |
| `dashboard` | ✅ Stable | Session statistics dashboard widget |
| `diff` | ✅ Stable | Git diff viewer with VS Code integration |
| `files` | ✅ Stable | Session file operations history |
| `prompt-url-widget` | ✅ Stable | GitHub PR/Issue URL preview widget |
| `question` | ✅ Stable | Interactive multi-question tool with custom answers |
| `redraws` | ✅ Stable | TUI redraw statistics command |
| `tps` | ✅ Stable | Tokens-per-second performance monitor |
| `research-agent` | 🔶 Beta | Autonomous research workflow (needs testing) |

### Infrastructure

| Item | Status |
|------|--------|
| Build system (esbuild) | ✅ Complete |
| Dependency bundling | ✅ Complete |
| Package manifest | ✅ Complete |
| Documentation | ✅ Complete |
| CI/CD | ❌ Not started |

---

## Milestones

### v1.0.0 — Initial Release

**Goal:** Stable release ready for public use.

**Tasks:**
- [x] Fix package imports (`forked package` → `@mariozechner/pi-coding-agent`)
- [x] Set up build system with dependency bundling
- [x] Create package manifest for pi
- [x] Write documentation (README, AGENDA)
- [ ] Add unit tests for core extensions
- [ ] Test research-agent end-to-end
- [ ] Set up GitHub Actions for automated builds
- [ ] Publish first release

**Target:** 2025-04-15

---

### v1.1.0 — Quality Improvements

**Goal:** Improve user experience and code quality.

**Tasks:**
- [ ] Add TypeScript strict mode
- [ ] Improve error handling across extensions
- [ ] Add configuration options per extension
- [ ] Create extension-specific documentation
- [ ] Add screenshots/demo videos to README

**Target:** TBD

---

### v1.2.0 — New Extensions

**Goal:** Expand extension collection.

**Planned Extensions:**
- [ ] `git-branch-manager` — Interactive branch selection/creation
- [ ] `todo-list` — Persistent task tracking tool
- [ ] `snippet-manager` — Code snippet library
- [ ] `context-summarizer` — Custom conversation summarization

**Target:** TBD

---

## Technical Debt

| Item | Priority | Notes |
|------|----------|-------|
| research-agent testing | High | Needs end-to-end validation |
| Type safety | Medium | Enable strict TypeScript |
| Error messages | Medium | Improve user-facing errors |
| Code duplication | Low | Some utility functions repeated |

---

## Contribution Ideas

Ideas welcome for:
- New extension proposals
- Bug reports and fixes
- Documentation improvements
- Performance optimizations
- Integration with other tools

---

## Notes

### Architecture Decisions

1. **Bundle dependencies** — Users don't need `npm install`, improves UX
2. **Peer dependencies for core** — Avoid version conflicts with pi core
3. **Single build script** — Simple, maintainable, no complex tooling
4. **Git-based distribution** — Easy versioning, no npm account needed

### Lessons Learned

- `@mariozechner/pi-coding-agent` is the official package name
- Extensions run with full system permissions — security matters
- `dist/` must be committed for git-based distribution
- esbuild handles cheerio/axios bundling well (outputs ~2.8MB)

---

## changelog

### 2025-04-01
- Fixed forked package reference issue
- Created bundled build system
- Moved from `~/.pi/agent/extensions/` to standalone repo
- Drafted initial documentation