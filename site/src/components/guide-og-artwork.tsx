import type { SVGProps } from "react";
import { guideOgContent, type GuideOgKey } from "../lib/guide-og";
import { ClaudeMark, CodexMark, GrokMark } from "./harness-marks";

export function GuideOgArtwork({
  guide,
  ...props
}: { guide: GuideOgKey } & SVGProps<SVGSVGElement>) {
  const content = guideOgContent[guide];
  const commandWidth = Math.max(117, content.command.length * 11 + 48);
  const metadataX = 77 + commandWidth + 18;

  return (
    <svg
      viewBox="0 0 1200 630"
      width="1200"
      height="630"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label={`${content.title}. ${content.harnessLabel} with ${content.model} through Together AI.`}
      {...props}
    >
      <rect width="1200" height="630" fill="#f8f8f7" />
      <rect x="34" y="34" width="1132" height="562" rx="28" fill="#fff" stroke="#e5e7eb" />

      <text x="86" y="103" fill="#0a0a0a" fontFamily="Arial, Helvetica, sans-serif">
        <tspan fontSize="25" fontWeight="800" letterSpacing="-2">
          TL
        </tspan>
        <tspan dx="18" fontSize="23" fontWeight="700" letterSpacing="-.5">
          togetherlink
        </tspan>
      </text>
      <text
        x="77"
        y="188"
        fill={content.accent}
        fontFamily="Arial, Helvetica, sans-serif"
        fontSize="17"
        fontWeight="700"
        letterSpacing="1.3"
      >
        {content.eyebrow.toUpperCase()}
      </text>
      <text
        x="77"
        y="267"
        fill="#0a0a0a"
        fontFamily="Arial, Helvetica, sans-serif"
        fontSize={content.titleSize}
        fontWeight="700"
        letterSpacing="-3.2"
      >
        <tspan x="77" dy="0">
          {content.titleLines[0]}
        </tspan>
        <tspan x="77" dy={content.titleSize * 0.98}>
          {content.titleLines[1]}
        </tspan>
      </text>

      <rect x="77" y="505" width={commandWidth} height="52" rx="13" fill="#111113" />
      <text x="95" y="538" fill="#77777f" fontFamily="monospace" fontSize="18">
        $
      </text>
      <text x="117" y="538" fill="#fff" fontFamily="monospace" fontSize="18">
        {content.command}
      </text>
      <text
        x={metadataX}
        y="538"
        fill="#737373"
        fontFamily="Arial, Helvetica, sans-serif"
        fontSize="16"
        fontWeight="600"
      >
        {content.model} · {content.protocol}
      </text>

      <rect
        x="755"
        y="53"
        width="392"
        height="524"
        rx="22"
        fill={content.tint}
        stroke={content.panelBorder}
      />
      <circle cx="951" cy="287" r="112" fill="#fff" fillOpacity=".78" />
      {content.harness === "claude" ? (
        <ClaudeMark x="890" y="226" width="122" height="122" />
      ) : content.harness === "grok" ? (
        <GrokMark x="890" y="226" width="122" height="122" />
      ) : content.harness === "chatgpt" ? (
        <image href="/chatgpt-icon.png" x="890" y="226" width="122" height="122" />
      ) : (
        <CodexMark x="879" y="215" width="144" height="144" />
      )}
      <text
        x="951"
        y="449"
        fill="#0a0a0a"
        fontFamily="Arial, Helvetica, sans-serif"
        fontSize="26"
        fontWeight="700"
        letterSpacing="-.8"
        textAnchor="middle"
      >
        {content.harnessLabel}
      </text>
      <text
        x="784"
        y="543"
        fill="#777"
        fontFamily="Arial, Helvetica, sans-serif"
        fontSize="13"
        fontWeight="700"
        letterSpacing="1.2"
      >
        POWERED BY
      </text>
      <image
        href="/together-ai.png"
        x="944"
        y="523"
        width="172"
        height="36"
        preserveAspectRatio="xMidYMid meet"
      />
    </svg>
  );
}
