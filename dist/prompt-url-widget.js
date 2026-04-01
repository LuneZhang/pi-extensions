// src/prompt-url-widget.ts
import { DynamicBorder } from "@mariozechner/pi-coding-agent";
import { Container, Text } from "@mariozechner/pi-tui";
var PR_PROMPT_PATTERN = /^\s*You are given one or more GitHub PR URLs:\s*(\S+)/im;
var ISSUE_PROMPT_PATTERN = /^\s*Analyze GitHub issue\(s\):\s*(\S+)/im;
function extractPromptMatch(prompt) {
  const prMatch = prompt.match(PR_PROMPT_PATTERN);
  if (prMatch?.[1]) {
    return { kind: "pr", url: prMatch[1].trim() };
  }
  const issueMatch = prompt.match(ISSUE_PROMPT_PATTERN);
  if (issueMatch?.[1]) {
    return { kind: "issue", url: issueMatch[1].trim() };
  }
  return void 0;
}
async function fetchGhMetadata(pi, kind, url) {
  const args = kind === "pr" ? ["pr", "view", url, "--json", "title,author"] : ["issue", "view", url, "--json", "title,author"];
  try {
    const result = await pi.exec("gh", args);
    if (result.code !== 0 || !result.stdout) return void 0;
    return JSON.parse(result.stdout);
  } catch {
    return void 0;
  }
}
function formatAuthor(author) {
  if (!author) return void 0;
  const name = author.name?.trim();
  const login = author.login?.trim();
  if (name && login) return `${name} (@${login})`;
  if (login) return `@${login}`;
  if (name) return name;
  return void 0;
}
function promptUrlWidgetExtension(pi) {
  const setWidget = (ctx, match, title, authorText) => {
    ctx.ui.setWidget("prompt-url", (_tui, thm) => {
      const titleText = title ? thm.fg("accent", title) : thm.fg("accent", match.url);
      const authorLine = authorText ? thm.fg("muted", authorText) : void 0;
      const urlLine = thm.fg("dim", match.url);
      const lines = [titleText];
      if (authorLine) lines.push(authorLine);
      lines.push(urlLine);
      const container = new Container();
      container.addChild(new DynamicBorder((s) => thm.fg("muted", s)));
      container.addChild(new Text(lines.join("\n"), 1, 0));
      return container;
    });
  };
  const applySessionName = (ctx, match, title) => {
    const label = match.kind === "pr" ? "PR" : "Issue";
    const trimmedTitle = title?.trim();
    const fallbackName = `${label}: ${match.url}`;
    const desiredName = trimmedTitle ? `${label}: ${trimmedTitle} (${match.url})` : fallbackName;
    const currentName = pi.getSessionName()?.trim();
    if (!currentName) {
      pi.setSessionName(desiredName);
      return;
    }
    if (currentName === match.url || currentName === fallbackName) {
      pi.setSessionName(desiredName);
    }
  };
  pi.on("before_agent_start", async (event, ctx) => {
    if (!ctx.hasUI) return;
    const match = extractPromptMatch(event.prompt);
    if (!match) {
      return;
    }
    setWidget(ctx, match);
    applySessionName(ctx, match);
    void fetchGhMetadata(pi, match.kind, match.url).then((meta) => {
      const title = meta?.title?.trim();
      const authorText = formatAuthor(meta?.author);
      setWidget(ctx, match, title, authorText);
      applySessionName(ctx, match, title);
    });
  });
  pi.on("session_switch", async (_event, ctx) => {
    rebuildFromSession(ctx);
  });
  const getUserText = (content) => {
    if (!content) return "";
    if (typeof content === "string") return content;
    return content.filter((block) => block.type === "text").map((block) => block.text).join("\n") ?? "";
  };
  const rebuildFromSession = (ctx) => {
    if (!ctx.hasUI) return;
    const entries = ctx.sessionManager.getEntries();
    const lastMatch = [...entries].reverse().find((entry) => {
      if (entry.type !== "message" || entry.message.role !== "user") return false;
      const text2 = getUserText(entry.message.content);
      return !!extractPromptMatch(text2);
    });
    const content = lastMatch?.type === "message" && lastMatch.message.role === "user" ? lastMatch.message.content : void 0;
    const text = getUserText(content);
    const match = text ? extractPromptMatch(text) : void 0;
    if (!match) {
      ctx.ui.setWidget("prompt-url", void 0);
      return;
    }
    setWidget(ctx, match);
    applySessionName(ctx, match);
    void fetchGhMetadata(pi, match.kind, match.url).then((meta) => {
      const title = meta?.title?.trim();
      const authorText = formatAuthor(meta?.author);
      setWidget(ctx, match, title, authorText);
      applySessionName(ctx, match, title);
    });
  };
  pi.on("session_start", async (_event, ctx) => {
    rebuildFromSession(ctx);
  });
}
export {
  promptUrlWidgetExtension as default
};
//# sourceMappingURL=prompt-url-widget.js.map
