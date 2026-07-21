import { createFileRoute } from "@tanstack/react-router";
import { ImageResponse } from "@vercel/og";
import { Buffer } from "node:buffer";
import { ClaudeMark, CodexMark, GrokMark } from "../../components/harness-marks";
import { guideOgContent, isGuideOgKey } from "../../lib/guide-og";

export const Route = createFileRoute("/api/og")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const requestUrl = new URL(request.url);
        const guide = requestUrl.searchParams.get("guide");

        if (!isGuideOgKey(guide)) {
          return new Response("Unknown guide", { status: 404 });
        }

        const content = guideOgContent[guide];
        const togetherLogo = await loadImageDataUrl(new URL("/together-ai.png", requestUrl));
        const chatGptIcon =
          content.harness === "chatgpt"
            ? await loadImageDataUrl(new URL("/chatgpt-icon.png", requestUrl))
            : "";
        return new ImageResponse(
          <div
            style={{
              alignItems: "stretch",
              background: "#f8f8f7",
              color: "#0a0a0a",
              display: "flex",
              fontFamily: "Arial, Helvetica, sans-serif",
              height: "100%",
              padding: 34,
              width: "100%",
            }}
          >
            <div
              style={{
                background: "#fff",
                border: "1px solid #e5e7eb",
                borderRadius: 28,
                display: "flex",
                flex: 1,
                overflow: "hidden",
                padding: 18,
              }}
            >
              <div
                style={{
                  display: "flex",
                  flex: 1,
                  flexDirection: "column",
                  padding: "20px 24px",
                }}
              >
                <div style={{ alignItems: "center", display: "flex" }}>
                  <span
                    style={{
                      display: "flex",
                      fontSize: 25,
                      fontWeight: 800,
                      letterSpacing: "-2px",
                    }}
                  >
                    TL
                  </span>
                  <span
                    style={{
                      display: "flex",
                      fontSize: 23,
                      fontWeight: 700,
                      letterSpacing: "-.5px",
                      marginLeft: 18,
                    }}
                  >
                    togetherlink
                  </span>
                </div>
                <div
                  style={{
                    color: content.accent,
                    display: "flex",
                    fontSize: 17,
                    fontWeight: 700,
                    letterSpacing: "1.3px",
                    marginTop: 66,
                    textTransform: "uppercase",
                  }}
                >
                  {content.eyebrow}
                </div>
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    fontSize: content.titleSize,
                    fontWeight: 700,
                    letterSpacing: "-3.2px",
                    lineHeight: 0.98,
                    marginTop: 15,
                  }}
                >
                  <span style={{ display: "flex" }}>{content.titleLines[0]}</span>
                  <span style={{ display: "flex" }}>{content.titleLines[1]}</span>
                </div>
                <div style={{ alignItems: "center", display: "flex", marginTop: "auto" }}>
                  <div
                    style={{
                      alignItems: "center",
                      background: "#111113",
                      borderRadius: 13,
                      color: "#fff",
                      display: "flex",
                      fontFamily: "monospace",
                      fontSize: 18,
                      height: 52,
                      padding: "0 18px",
                    }}
                  >
                    <span style={{ color: "#77777f", display: "flex", marginRight: 10 }}>$</span>
                    {content.command}
                  </div>
                  <span
                    style={{
                      color: "#737373",
                      display: "flex",
                      fontSize: 16,
                      fontWeight: 600,
                      marginLeft: 18,
                    }}
                  >
                    {content.model}&nbsp;&nbsp;·&nbsp;&nbsp;{content.protocol}
                  </span>
                </div>
              </div>
              <div
                style={{
                  alignItems: "center",
                  background: content.tint,
                  border: `1px solid ${content.panelBorder}`,
                  borderRadius: 22,
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "center",
                  position: "relative",
                  width: 392,
                }}
              >
                <div
                  style={{
                    alignItems: "center",
                    background: "rgba(255,255,255,.78)",
                    borderRadius: 999,
                    display: "flex",
                    height: 224,
                    justifyContent: "center",
                    width: 224,
                  }}
                >
                  {content.harness === "claude" ? (
                    <ClaudeMark style={{ height: 122, width: 122 }} />
                  ) : content.harness === "grok" ? (
                    <GrokMark style={{ height: 122, width: 122 }} />
                  ) : content.harness === "chatgpt" ? (
                    <img src={chatGptIcon} style={{ borderRadius: 27, height: 122, width: 122 }} />
                  ) : (
                    <CodexMark style={{ height: 144, width: 144 }} />
                  )}
                </div>
                <span
                  style={{
                    display: "flex",
                    fontSize: 26,
                    fontWeight: 700,
                    letterSpacing: "-.8px",
                    marginTop: 23,
                  }}
                >
                  {content.harnessLabel}
                </span>
                <div
                  style={{
                    alignItems: "center",
                    bottom: 24,
                    display: "flex",
                    left: 28,
                    position: "absolute",
                    right: 28,
                  }}
                >
                  <span
                    style={{
                      color: "#777",
                      display: "flex",
                      fontSize: 13,
                      fontWeight: 700,
                      letterSpacing: "1.2px",
                    }}
                  >
                    POWERED BY
                  </span>
                  <img src={togetherLogo} style={{ height: 36, marginLeft: "auto", width: 172 }} />
                </div>
              </div>
            </div>
          </div>,
          {
            width: 1200,
            height: 630,
            headers: {
              "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=604800",
            },
          },
        );
      },
    },
  },
});

async function loadImageDataUrl(url: URL): Promise<string> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Could not load OG image asset: ${url.pathname}`);
  }
  const contentType = response.headers.get("content-type") || "image/png";
  const bytes = Buffer.from(await response.arrayBuffer());
  return `data:${contentType};base64,${bytes.toString("base64")}`;
}
