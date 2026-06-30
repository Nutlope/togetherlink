import { mutation } from "./_generated/server";
import { v } from "convex/values";

export const recordEvent = mutation({
  args: {
    installId: v.string(),
    sessionId: v.optional(v.string()),
    eventType: v.string(),
    cliVersion: v.optional(v.string()),
    agent: v.optional(v.string()),
    initialModel: v.optional(v.string()),
    finalModel: v.optional(v.string()),
    model: v.optional(v.string()),
    countryCode: v.string(),
    os: v.string(),
    arch: v.optional(v.string()),
    startedAt: v.optional(v.number()),
    endedAt: v.optional(v.number()),
    durationMs: v.optional(v.number()),
    promptTokens: v.optional(v.number()),
    cachedTokens: v.optional(v.number()),
    completionTokens: v.optional(v.number()),
    costUsd: v.optional(v.number()),
    usageByModel: v.optional(
      v.array(
        v.object({
          model: v.string(),
          promptTokens: v.optional(v.number()),
          cachedTokens: v.optional(v.number()),
          completionTokens: v.optional(v.number()),
          costUsd: v.optional(v.number()),
        }),
      ),
    ),
    metadata: v.optional(v.any()),
    exitCode: v.optional(v.number()),
    signal: v.optional(v.string()),
    errorKind: v.optional(v.string()),
    receivedAt: v.number(),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("telemetryEvents", {
      ...args,
      createdAt: Date.now(),
    });
  },
});
