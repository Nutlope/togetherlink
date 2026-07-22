import { createFileRoute } from "@tanstack/react-router";
import { GuideCover, type GuideCoverVariant, GuideShell, SITE_URL } from "../../components/guides";

const title = "TogetherLink guides for open models and coding tools";
const description =
  "Practical guides for using open models from Together AI in Codex CLI, Grok Build, ChatGPT Desktop, and Claude Code.";

const guides = [
  {
    href: "/guides/use-together-ai-models-with-codex",
    cover: "together-codex" as GuideCoverVariant,
    title: "Run open models in Codex CLI without replacing your config",
    description:
      "Connect Codex to Together AI, choose between six current open models, and keep provider and model settings scoped to each run.",
    meta: "Codex CLI · model picker · 10 min",
  },
  {
    href: "/guides/use-glm-5-2-with-grok-build",
    cover: "glm-grok" as GuideCoverVariant,
    title: "Launch Grok Build with GLM 5.2",
    description:
      "Run Grok Build on GLM 5.2 through Together AI while keeping native settings, built-ins, workflows, plugins, and local sessions.",
    meta: "Grok Build · GLM 5.2 · 8 min",
  },
  {
    href: "/guides/use-together-ai-models-with-chatgpt-desktop",
    cover: "together-chatgpt" as GuideCoverVariant,
    title: "Use open models in Codex for the ChatGPT Desktop app",
    description:
      "Configure the Codex coding experience for open models, inspect the exact file changed, and restore your previous app configuration safely.",
    meta: "Codex in ChatGPT Desktop · alpha · 8 min",
  },
  {
    href: "/guides/use-glm-5-2-with-codex",
    cover: "glm-codex" as GuideCoverVariant,
    title: "GLM 5.2 in Codex CLI: Install, launch, verify",
    description:
      "A focused quickstart with a real coding run, provider verification, headless Codex exec examples, and GLM-specific troubleshooting.",
    meta: "Codex CLI · GLM 5.2 · 8 min",
  },
  {
    href: "/guides/use-together-ai-models-with-claude-code",
    cover: "together-claude" as GuideCoverVariant,
    title: "Connect Claude Code to GLM 5.2, Kimi, and MiniMax",
    description:
      "Route Claude Code through Together, keep your Claude login and settings, and optionally add web search with Exa.",
    meta: "Claude Code · model picker · 10 min",
  },
];

export const Route = createFileRoute("/guides/")({
  head: () => ({
    meta: [
      { title },
      { name: "description", content: description },
      { name: "robots", content: "index, follow, max-image-preview:large" },
      { property: "og:type", content: "website" },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { property: "og:url", content: `${SITE_URL}/guides` },
      { property: "og:image", content: `${SITE_URL}/togetherlink-cover.png` },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "canonical", href: `${SITE_URL}/guides` }],
  }),
  component: GuidesIndex,
});

function GuidesIndex() {
  return (
    <GuideShell>
      <main className="mx-auto max-w-[1120px] px-6 pt-20 max-[520px]:px-[18px] max-[520px]:pt-14">
        <div className="max-w-[760px]">
          <span className="text-[12px] font-semibold tracking-[.09em] text-muted uppercase">
            TogetherLink guides
          </span>
          <h1 className="m-0 mt-4 text-balance text-[clamp(38px,6vw,62px)] font-semibold leading-[1.04] tracking-[-.045em]">
            Put open models inside the coding tools you already use.
          </h1>
          <p className="m-0 mt-6 max-w-[680px] text-pretty text-[18px] leading-relaxed text-muted">
            Start with the tool you want to keep. Each guide shows the exact TogetherLink command,
            where to get the required Together API key, what changes locally, and how to verify the
            active model.
          </p>
        </div>

        <div className="mt-16 max-w-[920px] border-t border-line-strong">
          {guides.map((guide) => (
            <article key={guide.href} className="border-b border-line-strong">
              <a
                href={guide.href}
                className="group grid gap-6 py-7 md:grid-cols-[300px_minmax(0,1fr)] md:items-center md:gap-9"
              >
                <GuideCover
                  variant={guide.cover}
                  compact
                  className="transition-[transform,box-shadow] duration-200 ease-out group-hover:-translate-y-0.5 group-hover:shadow-[0_12px_30px_-20px_rgba(10,10,10,.35)]"
                />
                <div className="min-w-0 py-1">
                  <div className="font-mono text-[11px] text-faint uppercase">{guide.meta}</div>
                  <h2 className="m-0 mt-3 text-balance text-[25px] font-semibold leading-tight tracking-[-.025em] group-hover:underline group-hover:underline-offset-4">
                    {guide.title}
                  </h2>
                  <p className="m-0 mt-3 max-w-[560px] text-pretty text-[14.5px] leading-relaxed text-muted">
                    {guide.description}
                  </p>
                  <span className="mt-5 inline-flex text-[13px] font-semibold text-ink">
                    Read guide&nbsp; →
                  </span>
                </div>
              </a>
            </article>
          ))}
        </div>
      </main>
    </GuideShell>
  );
}
