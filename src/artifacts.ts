import fs from "node:fs";
import path from "node:path";

import type { ExtensionAPI, ExtensionContext, Theme } from "@mariozechner/pi-coding-agent";
import { DynamicBorder } from "@mariozechner/pi-coding-agent";
import { Container, Key, matchesKey, type SelectItem, SelectList, Text } from "@mariozechner/pi-tui";

type FileToolName = "read" | "write" | "edit";

interface SessionFileEntry {
	path: string;
	operations: Set<FileToolName>;
	lastTimestamp: number;
}

interface ArtifactRecord {
	path: string;
	displayPath: string;
	kind: string;
	description: string;
	timestamp: number;
	size?: number;
	operations?: Set<FileToolName>;
	previewable: boolean;
}

const TEXT_EXTENSIONS = new Set([
	".txt",
	".md",
	".json",
	".yml",
	".yaml",
	".csv",
	".tsv",
	".log",
	".py",
	".ts",
	".tsx",
	".js",
	".jsx",
	".html",
	".tex",
	".xml",
	".ini",
	".cfg",
]);

const IMAGE_EXTENSIONS = new Set([".png", ".jpg", ".jpeg", ".webp", ".gif", ".svg"]);

function formatRelativePath(cwd: string, filePath: string): string {
	if (!path.isAbsolute(filePath)) return filePath;
	const relativePath = path.relative(cwd, filePath);
	if (!relativePath || relativePath.startsWith("..")) {
		return filePath;
	}
	return relativePath;
}

function formatBytes(size: number | undefined): string {
	if (size === undefined) return "unknown size";
	if (size < 1024) return `${size} B`;
	if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
	return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function getArtifactKind(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  if (IMAGE_EXTENSIONS.has(ext)) return "image";
  if (ext === ".pdf") return "document";
  if (ext === ".csv" || ext === ".tsv") return "data-table";
  if (ext === ".json" || ext === ".yml" || ext === ".yaml") return "config";
  if (ext === ".log") return "log-file";
  if (ext === ".tex" || ext === ".md") return "document";
  if (TEXT_EXTENSIONS.has(ext)) return "source";
  return "binary";
}

function isPreviewable(filePath: string): boolean {
	return TEXT_EXTENSIONS.has(path.extname(filePath).toLowerCase());
}

function buildSessionArtifacts(ctx: ExtensionContext): ArtifactRecord[] {
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

	const files = new Map<string, SessionFileEntry>();

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

	return Array.from(files.values())
		.sort((a, b) => b.lastTimestamp - a.lastTimestamp)
		.map((entry) => {
			let size: number | undefined;
			try {
				size = fs.statSync(entry.path).size;
			} catch {
				size = undefined;
			}

			return {
				path: entry.path,
				displayPath: formatRelativePath(ctx.cwd, entry.path),
				kind: getArtifactKind(entry.path),
				description: `session • ${Array.from(entry.operations).map(op => op.charAt(0).toUpperCase()).join("/")}`,
				timestamp: entry.lastTimestamp,
				size,
				operations: entry.operations,
				previewable: isPreviewable(entry.path),
			};
		});
}

function openWithCode(pi: ExtensionAPI, ctx: ExtensionContext, filePath: string) {
	const windowsUnsafeCmdChars = /[&|<>^%\r\n]/;
	const quoteCmdArg = (value: string) => `"${value.replace(/"/g, '""')}"`;

	if (process.platform === "win32") {
		if (windowsUnsafeCmdChars.test(filePath)) {
			ctx.ui.notify(
				`Refusing to open ${filePath}: path contains Windows cmd metacharacters (& | < > ^ % or newline).`,
				"error",
			);
			return null;
		}
		const commandLine = `code -g ${quoteCmdArg(filePath)}`;
		return pi.exec("cmd", ["/d", "/s", "/c", commandLine], { cwd: ctx.cwd });
	}

	return pi.exec("code", ["-g", filePath], { cwd: ctx.cwd });
}

function readPreviewLines(artifact: ArtifactRecord): string[] {
	if (!artifact.previewable) {
		return ["Preview unavailable in terminal."];
	}

	try {
		const text = fs.readFileSync(artifact.path, "utf8");
		const lines = text.split(/\r?\n/).slice(0, 24);
		return lines.length > 0 ? lines : ["(empty file)"];
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		return [`Failed to read preview: ${message}`];
	}
}

async function showArtifactPicker(ctx: ExtensionContext, artifacts: ArtifactRecord[]): Promise<ArtifactRecord | undefined> {
  const artifactMap = new Map<string, ArtifactRecord>();
  artifacts.forEach(artifact => {
    artifactMap.set(artifact.path, artifact);
  });

  return ctx.ui.custom<ArtifactRecord | undefined>(
    (tui, theme, _kb, done) => {
      const container = new Container();
      container.addChild(new DynamicBorder((value: string) => theme.fg("accent", value)));
      container.addChild(new Text(theme.fg("accent", theme.bold(" Artifacts")), 0, 0));

      const items: SelectItem[] = artifacts.map((artifact) => {
        const kindColor = artifact.kind === "image" ? "success" : 
                         artifact.kind === "document" ? "warning" : 
                         artifact.kind === "binary" ? "error" : 
                         artifact.kind === "config" ? "accent" :
                         artifact.kind === "data-table" ? "muted" :
                         artifact.kind === "log-file" ? "dim" :
                         "text";
        return {
          value: artifact.path,
          label: `${theme.fg(kindColor, artifact.kind.padEnd(10))} ${artifact.displayPath}`,
          description: theme.fg("muted", `${artifact.description} • ${formatBytes(artifact.size)}`),
        };
      });

      let currentIndex = 0;
      const visibleRows = Math.min(artifacts.length, 15);
      const selectList = new SelectList(items, visibleRows, {
        selectedPrefix: (value) => theme.fg("accent", value),
        selectedText: (value) => value,
        description: (value) => value,
        scrollInfo: (value) => theme.fg("dim", value),
        noMatch: (value) => theme.fg("warning", value),
      });

      selectList.onSelect = (item) => {
        const artifact = artifactMap.get(item.value);
        if (artifact) {
          done(artifact);
        } else {
          done(undefined);
        }
      };
      selectList.onCancel = () => done(undefined);
      selectList.onSelectionChange = (item) => {
        currentIndex = items.indexOf(item);
      };

      container.addChild(selectList);
      container.addChild(
        new Text(theme.fg("dim", " ↑↓ navigate • ←→ page • Enter preview • Esc close"), 0, 0),
      );
      container.addChild(new DynamicBorder((value: string) => theme.fg("accent", value)));

      return {
        render: (width: number) => container.render(width),
        invalidate: () => container.invalidate(),
        handleInput: (data: string) => {
          if (matchesKey(data, Key.left)) {
            currentIndex = Math.max(0, currentIndex - visibleRows);
            selectList.setSelectedIndex(currentIndex);
          } else if (matchesKey(data, Key.right)) {
            currentIndex = Math.min(items.length - 1, currentIndex + visibleRows);
            selectList.setSelectedIndex(currentIndex);
          } else {
            selectList.handleInput(data);
          }
          tui.requestRender();
        },
      };
    },
    { overlay: true, overlayOptions: { width: "78%", maxHeight: "85%", anchor: "center" } },
  );
}

async function showArtifactPreview(pi: ExtensionAPI, ctx: ExtensionContext, artifact: ArtifactRecord): Promise<void> {
	const previewLines = readPreviewLines(artifact);
	const metadataLines = [
		`Path:    ${artifact.displayPath}`,
		`Kind:    ${artifact.kind}`,
		`Size:    ${formatBytes(artifact.size)}`,
		`Updated: ${new Date(artifact.timestamp).toLocaleString()}`,
		...(artifact.operations ? [`Ops:     ${Array.from(artifact.operations).join(", ")}`] : []),
	];

	const content = [...metadataLines, "", "Preview", ...previewLines].join("\n");

  await ctx.ui.custom<void>(
    (_tui, theme, _kb, done) => {
      const container = new Container();
      container.addChild(new DynamicBorder((value: string) => theme.fg("accent", value)));
      container.addChild(new Text(theme.fg("accent", theme.bold(" Artifact Preview")), 0, 0));
      container.addChild(new Text("", 0, 0));
      container.addChild(new Text(content, 0, 0));
      container.addChild(new Text(theme.fg("dim", " Enter/Esc back • 'o' open in VS Code"), 0, 0));
      container.addChild(new DynamicBorder((value: string) => theme.fg("accent", value)));

      return {
        render: (width: number) => container.render(width),
        invalidate: () => container.invalidate(),
        handleInput: (data: string) => {
          if (matchesKey(data, "escape") || matchesKey(data, "return")) {
            done(undefined);
            return;
          }
          if (data === "o" || data === "O") {
            void openWithCode(pi, ctx, artifact.path)?.then((result) => {
              if (!result) return;
              if (result.code !== 0) {
                const stderr = result.stderr.trim();
                ctx.ui.notify(
                  `Failed to open ${artifact.displayPath} (exit ${result.code})${stderr ? `: ${stderr}` : ""}`,
                  "error",
                );
              }
            });
          }
        },
      };
    },
    { overlay: true, overlayOptions: { width: "80%", maxHeight: "90%", anchor: "center" } },
  );
}

export default function artifactsExtension(pi: ExtensionAPI) {
	pi.registerCommand("artifacts", {
		description: "Browse current-session artifacts",
		handler: async (_args, ctx) => {
			if (!ctx.hasUI) {
				ctx.ui.notify("No UI available", "error");
				return;
			}

			const artifacts = buildSessionArtifacts(ctx);

			if (artifacts.length === 0) {
				ctx.ui.notify("No artifacts found in the current session", "info");
				return;
			}

			while (true) {
				const selected = await showArtifactPicker(ctx, artifacts);
				if (!selected) {
					return;
				}
				await showArtifactPreview(pi, ctx, selected);
			}
		},
	});
}
