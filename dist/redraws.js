// src/redraws.ts
import { Text } from "@mariozechner/pi-tui";
function redraws_default(pi) {
  pi.registerCommand("tui", {
    description: "Show TUI stats",
    handler: async (_args, ctx) => {
      if (!ctx.hasUI) return;
      let redraws = 0;
      await ctx.ui.custom((tui, _theme, _keybindings, done) => {
        redraws = tui.fullRedraws;
        done(void 0);
        return new Text("", 0, 0);
      });
      ctx.ui.notify(`TUI full redraws: ${redraws}`, "info");
    }
  });
}
export {
  redraws_default as default
};
//# sourceMappingURL=redraws.js.map
