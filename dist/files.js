// src/files.ts
import { DynamicBorder } from "@mariozechner/pi-coding-agent";
import { Container, Key, matchesKey, SelectList, Text } from "@mariozechner/pi-tui";
function files_default(pi) {
  pi.registerCommand("files", {
    description: "Show files read/written/edited in this session",
    handler: async (_args, ctx) => {
      if (!ctx.hasUI) {
        ctx.ui.notify("No UI available", "error");
        return;
      }
      const branch = ctx.sessionManager.getBranch();
      const toolCalls = /* @__PURE__ */ new Map();
      for (const entry of branch) {
        if (entry.type !== "message") continue;
        const msg = entry.message;
        if (msg.role === "assistant" && Array.isArray(msg.content)) {
          for (const block of msg.content) {
            if (block.type === "toolCall") {
              const name = block.name;
              if (name === "read" || name === "write" || name === "edit") {
                const path = block.arguments?.path;
                if (path && typeof path === "string") {
                  toolCalls.set(block.id, { path, name, timestamp: msg.timestamp });
                }
              }
            }
          }
        }
      }
      const fileMap = /* @__PURE__ */ new Map();
      for (const entry of branch) {
        if (entry.type !== "message") continue;
        const msg = entry.message;
        if (msg.role === "toolResult") {
          const toolCall = toolCalls.get(msg.toolCallId);
          if (!toolCall) continue;
          const { path, name } = toolCall;
          const timestamp = msg.timestamp;
          const existing = fileMap.get(path);
          if (existing) {
            existing.operations.add(name);
            if (timestamp > existing.lastTimestamp) {
              existing.lastTimestamp = timestamp;
            }
          } else {
            fileMap.set(path, {
              path,
              operations: /* @__PURE__ */ new Set([name]),
              lastTimestamp: timestamp
            });
          }
        }
      }
      if (fileMap.size === 0) {
        ctx.ui.notify("No files read/written/edited in this session", "info");
        return;
      }
      const files = Array.from(fileMap.values()).sort((a, b) => b.lastTimestamp - a.lastTimestamp);
      const WINDOWS_UNSAFE_CMD_CHARS_RE = /[&|<>^%\r\n]/;
      const quoteCmdArg = (value) => `"${value.replace(/"/g, '""')}"`;
      const openWithCode = async (path) => {
        if (process.platform === "win32") {
          if (WINDOWS_UNSAFE_CMD_CHARS_RE.test(path)) {
            ctx.ui.notify(
              `Refusing to open ${path}: path contains Windows cmd metacharacters (& | < > ^ % or newline).`,
              "error"
            );
            return null;
          }
          const commandLine = `code -g ${quoteCmdArg(path)}`;
          return pi.exec("cmd", ["/d", "/s", "/c", commandLine], { cwd: ctx.cwd });
        }
        return pi.exec("code", ["-g", path], { cwd: ctx.cwd });
      };
      const openSelected = async (file) => {
        try {
          const openResult = await openWithCode(file.path);
          if (!openResult) return;
          if (openResult.code !== 0) {
            const openStderr = openResult.stderr.trim();
            ctx.ui.notify(
              `Failed to open ${file.path} (exit ${openResult.code})${openStderr ? `: ${openStderr}` : ""}`,
              "error"
            );
          }
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          ctx.ui.notify(`Failed to open ${file.path}: ${message}`, "error");
        }
      };
      await ctx.ui.custom((tui, theme, _kb, done) => {
        const container = new Container();
        container.addChild(new DynamicBorder((s) => theme.fg("accent", s)));
        container.addChild(new Text(theme.fg("accent", theme.bold(" Select file to open")), 0, 0));
        const items = files.map((f) => {
          const ops = [];
          if (f.operations.has("read")) ops.push(theme.fg("muted", "R"));
          if (f.operations.has("write")) ops.push(theme.fg("success", "W"));
          if (f.operations.has("edit")) ops.push(theme.fg("warning", "E"));
          const opsLabel = ops.join("");
          return {
            value: f,
            label: `${opsLabel} ${f.path}`
          };
        });
        const visibleRows = Math.min(files.length, 15);
        let currentIndex = 0;
        const selectList = new SelectList(items, visibleRows, {
          selectedPrefix: (t) => theme.fg("accent", t),
          selectedText: (t) => t,
          description: (t) => theme.fg("muted", t),
          scrollInfo: (t) => theme.fg("dim", t),
          noMatch: (t) => theme.fg("warning", t)
        });
        selectList.onSelect = (item) => {
          void openSelected(item.value);
        };
        selectList.onCancel = () => done();
        selectList.onSelectionChange = (item) => {
          currentIndex = items.indexOf(item);
        };
        container.addChild(selectList);
        container.addChild(
          new Text(theme.fg("dim", " \u2191\u2193 navigate \u2022 \u2190\u2192 page \u2022 enter open \u2022 esc close"), 0, 0)
        );
        container.addChild(new DynamicBorder((s) => theme.fg("accent", s)));
        return {
          render: (w) => container.render(w),
          invalidate: () => container.invalidate(),
          handleInput: (data) => {
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
          }
        };
      });
    }
  });
}
export {
  files_default as default
};
//# sourceMappingURL=files.js.map
