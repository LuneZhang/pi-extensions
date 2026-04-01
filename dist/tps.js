// src/tps.ts
function isAssistantMessage(message) {
  if (!message || typeof message !== "object") return false;
  const role = message.role;
  return role === "assistant";
}
function tps_default(pi) {
  let agentStartMs = null;
  pi.on("agent_start", () => {
    agentStartMs = Date.now();
  });
  pi.on("agent_end", (event, ctx) => {
    if (!ctx.hasUI) return;
    if (agentStartMs === null) return;
    const elapsedMs = Date.now() - agentStartMs;
    agentStartMs = null;
    if (elapsedMs <= 0) return;
    let input = 0;
    let output = 0;
    let cacheRead = 0;
    let cacheWrite = 0;
    let totalTokens = 0;
    for (const message2 of event.messages) {
      if (!isAssistantMessage(message2)) continue;
      input += message2.usage.input || 0;
      output += message2.usage.output || 0;
      cacheRead += message2.usage.cacheRead || 0;
      cacheWrite += message2.usage.cacheWrite || 0;
      totalTokens += message2.usage.totalTokens || 0;
    }
    if (output <= 0) return;
    const elapsedSeconds = elapsedMs / 1e3;
    const tokensPerSecond = output / elapsedSeconds;
    const message = `TPS ${tokensPerSecond.toFixed(1)} tok/s. out ${output.toLocaleString()}, in ${input.toLocaleString()}, cache r/w ${cacheRead.toLocaleString()}/${cacheWrite.toLocaleString()}, total ${totalTokens.toLocaleString()}, ${elapsedSeconds.toFixed(1)}s`;
    ctx.ui.notify(message, "info");
  });
}
export {
  tps_default as default
};
//# sourceMappingURL=tps.js.map
