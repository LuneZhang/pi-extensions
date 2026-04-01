import path from "node:path";

import type { ExtensionAPI, ExtensionContext, Theme } from "@mariozechner/pi-coding-agent";
import { DynamicBorder } from "@mariozechner/pi-coding-agent";
import { Container, Text, matchesKey } from "@mariozechner/pi-tui";

type FileToolName = "read" | "write" | "edit";

interface FileEntry {
	path: string;
	operations: Set<FileToolName>;
	lastTimestamp: number;
}

interface DashboardSnapshot {
	sessionLabel: string;
	currentStatus: string;
	userMessages: number;
	assistantMessages: number;
	toolResults: number;
	customMessages: number;
	uniqueFiles: number;
	readFiles: number;
	writeFiles: number;
	editFiles: number;
	recentFiles: string[];
	activeTools: string[];
	updatedAt: string;
}

interface RuntimeState {
	turnInProgress: boolean;
	activeToolName?: string;
	lastToolName?: string;
	lastToolWasError: boolean;
}

function formatRelativePath(cwd: string, filePath: string): string {
	if (!path.isAbsolute(filePath)) return filePath;
	const relativePath = path.relative(cwd, filePath);
	if (!relativePath || relativePath.startsWith("..")) {
		return filePath;
	}
	return relativePath;
}

function collectFileEntries(ctx: ExtensionContext): FileEntry[] {
	const branch = ctx.sessionManager.getBranch();
	const toolCalls = new Map<string, { path: string; name: FileToolName; timestamp: number }>();

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

	const files = new Map<string, FileEntry>();

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
				operations: new Set([toolCall.name]),
				lastTimestamp: message.timestamp,
			});
		}
	}

	return Array.from(files.values()).sort((a, b) => b.lastTimestamp - a.lastTimestamp);
}

function buildSnapshot(pi: ExtensionAPI, ctx: ExtensionContext, runtimeState: RuntimeState): DashboardSnapshot {
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
	const currentStatus = runtimeState.activeToolName
		? `Running ${runtimeState.activeToolName}`
		: runtimeState.turnInProgress
			? "Thinking"
			: runtimeState.lastToolName
				? `${runtimeState.lastToolWasError ? "Last failed" : "Last ran"}: ${runtimeState.lastToolName}`
				: "Idle";

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
		updatedAt: new Date().toLocaleTimeString(),
	};
}

function createWidgetLines(theme: Theme, snapshot: DashboardSnapshot): string[] {
  const activeTools = snapshot.activeTools.length > 0 ? snapshot.activeTools.join(", ") : "none";
  const recentFiles = snapshot.recentFiles.length > 0 ? snapshot.recentFiles.join(", ") : "none";

  return [
    `${theme.fg("accent", theme.bold("dashboard"))} ${theme.fg("dim", `(${snapshot.sessionLabel})`)}`,
    `${theme.fg("text", snapshot.currentStatus)}`,
    `${theme.fg("muted", `files: ${snapshot.uniqueFiles}`)} ${theme.fg("dim", `(R:${snapshot.readFiles} W:${snapshot.writeFiles} E:${snapshot.editFiles})`)}`,
    `${theme.fg("dim", `tools: ${activeTools} • msgs: U${snapshot.userMessages}/A${snapshot.assistantMessages}/T${snapshot.toolResults}`)}`,
    `${theme.fg("dim", `recent: ${recentFiles}`)}`,
  ];
}

function applyDashboardUi(pi: ExtensionAPI, ctx: ExtensionContext, runtimeState: RuntimeState): void {
	if (!ctx.hasUI) return;
	const snapshot = buildSnapshot(pi, ctx, runtimeState);
	ctx.ui.setWidget("dashboard", createWidgetLines(ctx.ui.theme, snapshot));
	ctx.ui.setStatus("dashboard", `${snapshot.currentStatus} • files ${snapshot.uniqueFiles} • updated ${snapshot.updatedAt}`);
}

function buildOverlayLines(snapshot: DashboardSnapshot): string[] {
  const recentFiles = snapshot.recentFiles.length > 0 ? snapshot.recentFiles : ["none"];
  const activeTools = snapshot.activeTools.length > 0 ? snapshot.activeTools : ["none"];

  return [
    `Session: ${snapshot.sessionLabel}`,
    `Status: ${snapshot.currentStatus}`,
    `Updated: ${snapshot.updatedAt}`,
    "",
    "Messages",
    `  • User: ${snapshot.userMessages}`,
    `  • Assistant: ${snapshot.assistantMessages}`,
    `  • Tool Results: ${snapshot.toolResults}`,
    `  • Custom: ${snapshot.customMessages}`,
    "",
    "Files",
    `  • Touched: ${snapshot.uniqueFiles}`,
    `  • Read: ${snapshot.readFiles}`,
    `  • Write: ${snapshot.writeFiles}`,
    `  • Edit: ${snapshot.editFiles}`,
    "",
    "Recent Files",
    ...recentFiles.map((file) => `  • ${file}`),
    "",
    "Active Tools",
    ...activeTools.map((tool) => `  • ${tool}`),
    "",
    "Press Enter or Esc to close",
  ];
}

async function showDashboardOverlay(pi: ExtensionAPI, ctx: ExtensionContext, runtimeState: RuntimeState): Promise<void> {
	const snapshot = buildSnapshot(pi, ctx, runtimeState);
	const content = buildOverlayLines(snapshot).join("\n");

  await ctx.ui.custom<void>(
    (_tui, theme, _kb, done) => {
      const container = new Container();
      container.addChild(new DynamicBorder((value: string) => theme.fg("accent", value)));
      container.addChild(new Text(theme.fg("accent", theme.bold(" Dashboard")), 0, 0));
      container.addChild(new Text("", 0, 0));
      container.addChild(new Text(content, 0, 0));
      container.addChild(new Text(theme.fg("dim", " Enter/Esc to close"), 0, 0));
      container.addChild(new DynamicBorder((value: string) => theme.fg("accent", value)));

      return {
        render: (width: number) => container.render(width),
        invalidate: () => container.invalidate(),
        handleInput: (data: string) => {
          if (matchesKey(data, "escape") || matchesKey(data, "return")) {
            done(undefined);
          }
        },
      };
    },
    { overlay: true, overlayOptions: { width: "72%", maxHeight: "82%", anchor: "center" } },
  );
}

export default function dashboardExtension(pi: ExtensionAPI) {
	const runtimeState: RuntimeState = {
		turnInProgress: false,
		lastToolWasError: false,
	};

	pi.registerCommand("dashboard", {
		description: "Show coding session dashboard",
		handler: async (_args, ctx) => {
			if (!ctx.hasUI) {
				ctx.ui.notify("No UI available", "error");
				return;
			}
			await showDashboardOverlay(pi, ctx, runtimeState);
		},
	});

	pi.on("session_start", async (_event, ctx) => {
		applyDashboardUi(pi, ctx, runtimeState);
	});

	pi.on("session_switch", async (_event, ctx) => {
		applyDashboardUi(pi, ctx, runtimeState);
	});

	pi.on("turn_start", async (_event, ctx) => {
		runtimeState.turnInProgress = true;
		runtimeState.activeToolName = undefined;
		applyDashboardUi(pi, ctx, runtimeState);
	});

	pi.on("turn_end", async (_event, ctx) => {
		runtimeState.turnInProgress = false;
		runtimeState.activeToolName = undefined;
		applyDashboardUi(pi, ctx, runtimeState);
	});

	pi.on("tool_execution_start", async (event, ctx) => {
		runtimeState.activeToolName = event.toolName;
		applyDashboardUi(pi, ctx, runtimeState);
	});

	pi.on("tool_execution_end", async (event, ctx) => {
		runtimeState.activeToolName = undefined;
		runtimeState.lastToolName = event.toolName;
		runtimeState.lastToolWasError = event.isError;
		applyDashboardUi(pi, ctx, runtimeState);
	});
}
