// src/dashboard.ts
import path from "node:path";
import { DynamicBorder } from "@mariozechner/pi-coding-agent";
import { Container, Text, matchesKey } from "@mariozechner/pi-tui";
function formatRelativePath(cwd, filePath) {
  if (!path.isAbsolute(filePath)) return filePath;
  const relativePath = path.relative(cwd, filePath);
  if (!relativePath || relativePath.startsWith("..")) {
    return filePath;
  }
  return relativePath;
}
function collectFileEntries(ctx) {
  const branch = ctx.sessionManager.getBranch();
  const toolCalls = /* @__PURE__ */ new Map();
  for (const entry of branch) {
    if (entry.type !== "message") continue;
    const message = entry.message;
    if (message.role !== "assistant" || !Array.isArray(message.content)) continue;
    for (const block of message.content) {
      if (block.type !== "toolCall") continue;
      if (block.name !== "read" && block.name !== "write" && block.name !== "edit") continue;
      const filePath = block.arguments?.path;
      if (!filePath || typeof filePath !== "string") continue;
      toolCalls.set(block.id, { path: filePath, name: block.name, timestamp: message.timestamp });
    }
  }
  const files = /* @__PURE__ */ new Map();
  for (const entry of branch) {
    if (entry.type !== "message") continue;
    const message = entry.message;
    if (message.role !== "toolResult") continue;
    const toolCall = toolCalls.get(message.toolCallId);
    if (!toolCall) continue;
    const existing = files.get(toolCall.path);
    if (existing) {
      existing.operations.add(toolCall.name);
      existing.lastTimestamp = Math.max(existing.lastTimestamp, message.timestamp);
    } else {
      files.set(toolCall.path, {
        path: toolCall.path,
        operations: /* @__PURE__ */ new Set([toolCall.name]),
        lastTimestamp: message.timestamp
      });
    }
  }
  return Array.from(files.values()).sort((a, b) => b.lastTimestamp - a.lastTimestamp);
}
function buildSnapshot(pi, ctx, runtimeState) {
  let userMessages = 0;
  let assistantMessages = 0;
  let toolResults = 0;
  let customMessages = 0;
  for (const entry of ctx.sessionManager.getBranch()) {
    if (entry.type !== "message") continue;
    const role = entry.message.role;
    if (role === "user") userMessages += 1;
    else if (role === "assistant") assistantMessages += 1;
    else if (role === "toolResult") toolResults += 1;
    else if (role === "custom") customMessages += 1;
  }
  const fileEntries = collectFileEntries(ctx);
  const recentFiles = fileEntries.slice(0, 5).map((entry) => formatRelativePath(ctx.cwd, entry.path));
  const sessionName = ctx.sessionManager.getSessionName()?.trim();
  const sessionLabel = sessionName || path.basename(ctx.cwd) || ctx.cwd;
  const currentStatus = runtimeState.activeToolName ? `Running ${runtimeState.activeToolName}` : runtimeState.turnInProgress ? "Thinking" : runtimeState.lastToolName ? `${runtimeState.lastToolWasError ? "Last failed" : "Last ran"}: ${runtimeState.lastToolName}` : "Idle";
  return {
    sessionLabel,
    currentStatus,
    userMessages,
    assistantMessages,
    toolResults,
    customMessages,
    uniqueFiles: fileEntries.length,
    readFiles: fileEntries.filter((entry) => entry.operations.has("read")).length,
    writeFiles: fileEntries.filter((entry) => entry.operations.has("write")).length,
    editFiles: fileEntries.filter((entry) => entry.operations.has("edit")).length,
    recentFiles,
    activeTools: pi.getActiveTools(),
    updatedAt: (/* @__PURE__ */ new Date()).toLocaleTimeString()
  };
}
function createWidgetLines(theme, snapshot) {
  const activeTools = snapshot.activeTools.length > 0 ? snapshot.activeTools.join(", ") : "none";
  const recentFiles = snapshot.recentFiles.length > 0 ? snapshot.recentFiles.join(", ") : "none";
  return [
    `${theme.fg("accent", theme.bold("dashboard"))} ${theme.fg("dim", `(${snapshot.sessionLabel})`)}`,
    `${theme.fg("text", snapshot.currentStatus)}`,
    `${theme.fg("muted", `files: ${snapshot.uniqueFiles}`)} ${theme.fg("dim", `(R:${snapshot.readFiles} W:${snapshot.writeFiles} E:${snapshot.editFiles})`)}`,
    `${theme.fg("dim", `tools: ${activeTools} \u2022 msgs: U${snapshot.userMessages}/A${snapshot.assistantMessages}/T${snapshot.toolResults}`)}`,
    `${theme.fg("dim", `recent: ${recentFiles}`)}`
  ];
}
function applyDashboardUi(pi, ctx, runtimeState) {
  if (!ctx.hasUI) return;
  const snapshot = buildSnapshot(pi, ctx, runtimeState);
  ctx.ui.setWidget("dashboard", createWidgetLines(ctx.ui.theme, snapshot));
  ctx.ui.setStatus("dashboard", `${snapshot.currentStatus} \u2022 files ${snapshot.uniqueFiles} \u2022 updated ${snapshot.updatedAt}`);
}
function buildOverlayLines(snapshot) {
  const recentFiles = snapshot.recentFiles.length > 0 ? snapshot.recentFiles : ["none"];
  const activeTools = snapshot.activeTools.length > 0 ? snapshot.activeTools : ["none"];
  return [
    `Session: ${snapshot.sessionLabel}`,
    `Status: ${snapshot.currentStatus}`,
    `Updated: ${snapshot.updatedAt}`,
    "",
    "Messages",
    `  \u2022 User: ${snapshot.userMessages}`,
    `  \u2022 Assistant: ${snapshot.assistantMessages}`,
    `  \u2022 Tool Results: ${snapshot.toolResults}`,
    `  \u2022 Custom: ${snapshot.customMessages}`,
    "",
    "Files",
    `  \u2022 Touched: ${snapshot.uniqueFiles}`,
    `  \u2022 Read: ${snapshot.readFiles}`,
    `  \u2022 Write: ${snapshot.writeFiles}`,
    `  \u2022 Edit: ${snapshot.editFiles}`,
    "",
    "Recent Files",
    ...recentFiles.map((file) => `  \u2022 ${file}`),
    "",
    "Active Tools",
    ...activeTools.map((tool) => `  \u2022 ${tool}`),
    "",
    "Press Enter or Esc to close"
  ];
}
async function showDashboardOverlay(pi, ctx, runtimeState) {
  const snapshot = buildSnapshot(pi, ctx, runtimeState);
  const content = buildOverlayLines(snapshot).join("\n");
  await ctx.ui.custom(
    (_tui, theme, _kb, done) => {
      const container = new Container();
      container.addChild(new DynamicBorder((value) => theme.fg("accent", value)));
      container.addChild(new Text(theme.fg("accent", theme.bold(" Dashboard")), 0, 0));
      container.addChild(new Text("", 0, 0));
      container.addChild(new Text(content, 0, 0));
      container.addChild(new Text(theme.fg("dim", " Enter/Esc to close"), 0, 0));
      container.addChild(new DynamicBorder((value) => theme.fg("accent", value)));
      return {
        render: (width) => container.render(width),
        invalidate: () => container.invalidate(),
        handleInput: (data) => {
          if (matchesKey(data, "escape") || matchesKey(data, "return")) {
            done(void 0);
          }
        }
      };
    },
    { overlay: true, overlayOptions: { width: "72%", maxHeight: "82%", anchor: "center" } }
  );
}
function dashboardExtension(pi) {
  const runtimeState = {
    turnInProgress: false,
    lastToolWasError: false
  };
  pi.registerCommand("dashboard", {
    description: "Show coding session dashboard",
    handler: async (_args, ctx) => {
      if (!ctx.hasUI) {
        ctx.ui.notify("No UI available", "error");
        return;
      }
      await showDashboardOverlay(pi, ctx, runtimeState);
    }
  });
  pi.on("session_start", async (_event, ctx) => {
    applyDashboardUi(pi, ctx, runtimeState);
  });
  pi.on("session_switch", async (_event, ctx) => {
    applyDashboardUi(pi, ctx, runtimeState);
  });
  pi.on("turn_start", async (_event, ctx) => {
    runtimeState.turnInProgress = true;
    runtimeState.activeToolName = void 0;
    applyDashboardUi(pi, ctx, runtimeState);
  });
  pi.on("turn_end", async (_event, ctx) => {
    runtimeState.turnInProgress = false;
    runtimeState.activeToolName = void 0;
    applyDashboardUi(pi, ctx, runtimeState);
  });
  pi.on("tool_execution_start", async (event, ctx) => {
    runtimeState.activeToolName = event.toolName;
    applyDashboardUi(pi, ctx, runtimeState);
  });
  pi.on("tool_execution_end", async (event, ctx) => {
    runtimeState.activeToolName = void 0;
    runtimeState.lastToolName = event.toolName;
    runtimeState.lastToolWasError = event.isError;
    applyDashboardUi(pi, ctx, runtimeState);
  });
}
export {
  dashboardExtension as default
};
//# sourceMappingURL=dashboard.js.map
