import { createFileRoute } from "@tanstack/react-router";
import {
  ApiKeyCallout,
  ArticleLink,
  Breadcrumbs,
  CommandBlock,
  FaqSection,
  type Faq,
  GuideCover,
  GuideShell,
  GuideStructuredData,
  INSTALL_COMMAND,
  SITE_URL,
  TerminalFigure,
  TOGETHER_API_KEY_URL,
} from "../../components/guides";
import { guideOgPath } from "../../lib/guide-og";

const path = "/guides/use-together-ai-models-with-claude-code";
const ogImage = guideOgPath("together-claude");
const title = "How to use open source models in Claude Code";
const description =
  "Run Claude Code with GLM 5.2 and other Together AI models. Configure a Together API key, preserve your Claude login and settings, and understand optional Exa web search.";

const faqs: Faq[] = [
  {
    question: "Can Claude Code run Together AI models?",
    answer:
      "Yes. TogetherLink launches Claude Code against a local Anthropic Messages-compatible proxy, then sends model work to the selected Together AI model.",
  },
  {
    question: "Do I still need Claude Code installed?",
    answer:
      "Yes. TogetherLink is a routing layer, not a replacement interface. Install and sign in to Claude Code normally, then launch it through togetherlink or the tclaude shortcut.",
  },
  {
    question: "Will TogetherLink log me out of Claude Code?",
    answer:
      "No. The Together route is injected for the launched process. Your Claude Code login and normal settings remain available when you launch Claude Code normally.",
  },
  {
    question: "Why do I need a Together API key if I pay for Claude?",
    answer:
      "Your Claude subscription covers Anthropic usage. In this setup the model runs on Together AI, so Together requires its own API key and bills those model tokens separately.",
  },
  {
    question: "Do I need an Exa API key?",
    answer:
      "Only if you want TogetherLink's Claude web-search emulation. Coding, file tools, and normal model requests use the Together key and do not require Exa.",
  },
  {
    question: "How do I change the Together model used by Claude Code?",
    answer:
      "Place --model and the exact Together model ID before claude. For example: togetherlink --model moonshotai/Kimi-K2.6 claude.",
  },
  {
    question: "Can I use Claude Code's non-interactive -p mode?",
    answer:
      "Yes. Arguments after claude go to Claude Code, so togetherlink --model zai-org/GLM-5.2 claude -p followed by a prompt uses the same local route.",
  },
];

export const Route = createFileRoute("/guides/use-together-ai-models-with-claude-code")({
  head: () => ({
    meta: [
      { title },
      { name: "description", content: description },
      { name: "robots", content: "index, follow, max-image-preview:large" },
      { name: "googlebot", content: "index, follow, max-image-preview:large" },
      { property: "og:type", content: "article" },
      { property: "og:site_name", content: "TogetherLink" },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { property: "og:url", content: SITE_URL + path },
      { property: "og:image", content: SITE_URL + ogImage },
      { property: "og:image:width", content: "1200" },
      { property: "og:image:height", content: "630" },
      {
        property: "og:image:alt",
        content: "Claude Code routed through TogetherLink and Anthropic Messages to Together AI",
      },
      { property: "article:published_time", content: "2026-07-20" },
      { property: "article:modified_time", content: "2026-07-21" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: title },
      { name: "twitter:description", content: description },
      { name: "twitter:image", content: SITE_URL + ogImage },
    ],
    links: [{ rel: "canonical", href: SITE_URL + path }],
  }),
  component: TogetherClaudeGuide,
});

function TogetherClaudeGuide() {
  return (
    <GuideShell>
      <main>
        <article>
          <header className="mx-auto max-w-[1000px] px-6 pt-16 max-[520px]:px-[18px] max-[520px]:pt-12">
            <Breadcrumbs current="Claude Code and open source models" />
            <div className="mx-auto max-w-[780px] text-center">
              <div className="text-[12px] font-semibold tracking-[.09em] text-muted uppercase">
                Claude Code compatibility guide · 10 min
              </div>
              <h1 className="m-0 mt-4 text-balance text-[clamp(40px,7vw,68px)] font-semibold leading-[1.02] tracking-[-.05em]">
                How to use open source models in Claude Code
              </h1>
              <p className="mx-auto mt-6 mb-0 max-w-[700px] text-[18px] leading-relaxed text-muted">
                Keep the Claude Code terminal experience and route model calls to GLM 5.2, Kimi,
                MiniMax, or another curated Together model—without replacing your Claude settings.
              </p>
            </div>
            <GuideCover variant="together-claude" className="mt-11" />
          </header>

          <div className="mx-auto mt-14 max-w-[760px] px-6 max-[520px]:px-[18px]">
            <section aria-labelledby="answer-heading">
              <div className="border-l-2 border-[#ff5200] py-1 pl-5">
                <h2 id="answer-heading" className="m-0 text-[24px] font-semibold tracking-[-.02em]">
                  The short answer
                </h2>
                <p className="m-0 mt-3 text-[16px] leading-relaxed text-muted">
                  TogetherLink makes Claude Code believe it is talking to an Anthropic
                  Messages-compatible endpoint on your machine. That local endpoint translates the
                  conversation for Together AI and streams the answer back in the shape Claude Code
                  expects.
                </p>
              </div>
            </section>

            <div className="mt-10">
              <ApiKeyCallout />
            </div>

            <section className="mt-16" aria-labelledby="prerequisites-heading">
              <div className="text-[12px] font-semibold tracking-[.08em] text-muted uppercase">
                Before you start
              </div>
              <h2
                id="prerequisites-heading"
                className="m-0 mt-2 text-[30px] font-semibold tracking-[-.03em]"
              >
                Two tools and one required key
              </h2>
              <div className="mt-7 grid gap-5">
                {[
                  ["01", "Claude Code", "Install it and complete Claude's normal sign-in once."],
                  [
                    "02",
                    "TogetherLink",
                    "Install the local routing binary with the command below.",
                  ],
                  ["03", "Together key", "Create an API key with available Together credit."],
                ].map(([number, heading, body]) => (
                  <div key={number} className="border-t border-line-strong pt-4">
                    <span className="font-mono text-[11px] font-semibold text-faint">{number}</span>
                    <h3 className="m-0 mt-3 text-[15px] font-semibold">{heading}</h3>
                    <p className="m-0 mt-2 text-[13px] leading-relaxed text-muted">{body}</p>
                  </div>
                ))}
              </div>
              <div className="mt-6 space-y-4">
                <CommandBlock command={INSTALL_COMMAND} label="Install TogetherLink" />
                <CommandBlock command="togetherlink configure" label="Save the Together API key" />
                <CommandBlock command="togetherlink claude" label="Launch Claude Code on GLM 5.2" />
              </div>
              <p className="mt-4 text-[13px] leading-relaxed text-faint">
                The shortcut <code className="text-ink">tclaude</code> launches the same default
                route. Use the full command in scripts when you want the intent to be obvious.
              </p>
            </section>

            <section className="mt-18" aria-labelledby="preserved-heading">
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-left text-[14px]">
                  <caption
                    id="preserved-heading"
                    className="mb-5 text-left text-[30px] font-semibold tracking-[-.03em]"
                  >
                    What changes for the launched process
                  </caption>
                  <thead>
                    <tr className="border-y border-line-strong text-[12px] tracking-[.05em] text-faint uppercase">
                      <th className="py-3 pr-5 font-semibold">Area</th>
                      <th className="py-3 pr-5 font-semibold">TogetherLink run</th>
                      <th className="py-3 font-semibold">Normal Claude Code</th>
                    </tr>
                  </thead>
                  <tbody className="align-top">
                    {[
                      ["Model endpoint", "Local Anthropic-compatible proxy", "Anthropic"],
                      ["Model billing", "Together API account", "Your Anthropic plan"],
                      ["Claude login", "Preserved", "Preserved"],
                      ["Saved settings", "Not rewritten", "Used normally"],
                      ["File and shell tools", "Run by Claude Code", "Run by Claude Code"],
                    ].map((row) => (
                      <tr key={row[0]} className="border-b border-line">
                        <th className="py-4 pr-5 font-semibold">{row[0]}</th>
                        <td className="py-4 pr-5 leading-relaxed text-muted">{row[1]}</td>
                        <td className="py-4 leading-relaxed text-muted">{row[2]}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="mt-18" aria-labelledby="live-heading">
              <div className="mb-7">
                <div className="text-[12px] font-semibold tracking-[.08em] text-muted uppercase">
                  Live proof
                </div>
                <h2
                  id="live-heading"
                  className="m-0 mt-2 text-[30px] font-semibold tracking-[-.03em]"
                >
                  Claude Code reading a sample repository
                </h2>
                <p className="m-0 mt-3 text-[15px] leading-relaxed text-muted">
                  This non-interactive run asked Claude Code to inspect a TypeScript file without
                  editing it. The TogetherLink banner confirms that the response came from GLM 5.2
                  on Together AI, not Anthropic.
                </p>
              </div>
              <TerminalFigure
                kind="claude"
                caption="A real Warp window captured after a headless TogetherLink v0.6.4 Claude Code run on July 20, 2026. No terminal output was recreated or edited."
              />
            </section>

            <section
              className="mt-18 border-l-2 border-[#ff5200] py-1 pl-5"
              aria-labelledby="exa-heading"
            >
              <h2 id="exa-heading" className="m-0 text-[20px] font-semibold">
                Web search is a separate, optional key
              </h2>
              <p className="m-0 mt-2 text-[14px] leading-relaxed text-muted">
                Claude Code's model calls use Together. If a Claude workflow invokes web search,
                TogetherLink can emulate that tool with Exa. Add an Exa key during{" "}
                <code className="text-ink">togetherlink configure</code> only when you want that
                feature; it is not required for repository work, shell commands, or file edits.
              </p>
            </section>

            <section className="mt-18" aria-labelledby="models-heading">
              <h2 id="models-heading" className="m-0 text-[30px] font-semibold tracking-[-.03em]">
                Switch models before the Claude command
              </h2>
              <p className="mt-4 text-[15px] leading-relaxed text-muted">
                TogetherLink options are parsed before the harness name. Claude Code arguments come
                after <code className="text-ink">claude</code>. That split matters when combining a
                model choice with Claude's print mode.
              </p>
              <div className="mt-6 space-y-4">
                <CommandBlock
                  command="togetherlink --model moonshotai/Kimi-K2.6 claude"
                  label="Interactive session on Kimi K2.6"
                />
                <CommandBlock
                  command={
                    'togetherlink --model zai-org/GLM-5.2 claude -p "Summarize the current diff"'
                  }
                  label="One-shot GLM 5.2 prompt"
                />
              </div>
              <div className="mt-7 grid gap-4 sm:grid-cols-2">
                <div className="border-l-2 border-emerald-500 py-1 pl-4">
                  <span className="text-[12px] font-semibold text-ink uppercase">Correct</span>
                  <code className="mt-2 block text-[12px] leading-relaxed">
                    togetherlink --model MODEL claude -p "..."
                  </code>
                </div>
                <div className="border-l-2 border-rose-500 py-1 pl-4">
                  <span className="text-[12px] font-semibold text-ink uppercase">Wrong order</span>
                  <code className="mt-2 block text-[12px] leading-relaxed">
                    togetherlink claude --model MODEL
                  </code>
                </div>
              </div>
            </section>

            <section className="mt-18" aria-labelledby="verify-heading">
              <h2 id="verify-heading" className="m-0 text-[28px] font-semibold tracking-[-.03em]">
                Verify the route before trusting the result
              </h2>
              <p className="mt-4 text-[15px] leading-relaxed text-muted">
                At startup, read the sentence before Claude Code opens. For the default route it
                should say:
              </p>
              <blockquote className="m-0 mt-5 rounded-[12px] bg-code px-5 py-4 font-mono text-[13px] leading-relaxed shadow-[inset_0_0_0_1px_rgba(229,231,235,.95)]">
                togetherlink ▸ Routing Claude Code → Together AI (GLM 5.2 · default). Not Anthropic.
              </blockquote>
              <p className="mt-4 text-[14px] leading-relaxed text-muted">
                If you do not see that line, stop and check that you launched{" "}
                <code className="text-ink">togetherlink claude</code> or{" "}
                <code className="text-ink">tclaude</code>, not plain{" "}
                <code className="text-ink">claude</code>.
              </p>
            </section>

            <section
              className="mt-18 border-l-2 border-[#ff5200] py-1 pl-5 text-ink"
              aria-labelledby="ready-heading"
            >
              <div className="flex flex-wrap items-center justify-between gap-6">
                <div className="max-w-[470px]">
                  <h2 id="ready-heading" className="m-0 text-[25px] font-semibold">
                    Ready to try the Claude route?
                  </h2>
                  <p className="m-0 mt-2 text-[14px] leading-relaxed text-muted">
                    Create the required Together key first, then configure and launch from your
                    repository.
                  </p>
                </div>
                <a
                  className="inline-flex min-h-10 items-center rounded-[10px] bg-ink px-4 py-2.5 text-sm font-semibold text-white transition-transform active:scale-[0.96]"
                  href={TOGETHER_API_KEY_URL}
                  target="_blank"
                  rel="noreferrer"
                >
                  Get Together API key →
                </a>
              </div>
            </section>

            <div className="mt-20">
              <FaqSection faqs={faqs} />
            </div>

            <section className="mt-20" aria-labelledby="related-heading">
              <h2 id="related-heading" className="m-0 text-[24px] font-semibold">
                Compare the Codex route
              </h2>
              <div className="mt-5 grid gap-4 md:grid-cols-2">
                <ArticleLink
                  href="/guides/use-together-ai-models-with-codex"
                  eyebrow="Responses protocol"
                  title="How to use open source models in Codex"
                  body="See the Codex-specific proxy, model catalog, and headless exec workflow."
                />
                <ArticleLink
                  href="/guides/use-glm-5-2-with-codex"
                  eyebrow="GLM quickstart"
                  title="Use GLM 5.2 with Codex"
                  body="Follow the shortest route to a verified GLM 5.2 coding edit."
                />
              </div>
            </section>
          </div>
        </article>
        <GuideStructuredData
          title={title}
          description={description}
          path={path}
          image={ogImage}
          datePublished="2026-07-20"
          dateModified="2026-07-21"
          faqs={faqs}
        />
      </main>
    </GuideShell>
  );
}
