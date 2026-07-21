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
} from "../../components/guides";
import { guideOgPath } from "../../lib/guide-og";

const path = "/guides/use-together-ai-models-with-codex";
const ogImage = guideOgPath("together-codex");
const title = "How to use open source coding models in Codex CLI";
const description =
  "Connect OpenAI Codex CLI to Together AI models with TogetherLink. Learn the local proxy architecture, switch models safely, and run Codex interactively or headlessly.";

const models = [
  {
    name: "GLM 5.2",
    id: "zai-org/GLM-5.2",
    note: "Default text coding model with a 262K context window.",
  },
  {
    name: "Kimi K2.6",
    id: "moonshotai/Kimi-K2.6",
    note: "Reasoning model with vision input and a 262K context window.",
  },
  {
    name: "MiniMax M3",
    id: "MiniMaxAI/MiniMax-M3",
    note: "Vision-capable model with a 512K context window.",
  },
  {
    name: "Qwen 3.7 Max",
    id: "Qwen/Qwen3.7-Max",
    note: "Vision-capable model with a 1M context window.",
  },
  {
    name: "DeepSeek V4 Pro",
    id: "deepseek-ai/DeepSeek-V4-Pro",
    note: "Text reasoning model with a 512K context window.",
  },
];

const faqs: Faq[] = [
  {
    question: "Can I connect Codex CLI to Together AI?",
    answer:
      "Yes. TogetherLink launches Codex with a temporary provider that points to a local Responses-compatible proxy. The proxy translates Codex requests into Together AI model calls.",
  },
  {
    question: "Which Together AI model does Codex use by default?",
    answer:
      "TogetherLink currently defaults to zai-org/GLM-5.2 for Codex. You can select another curated model with --model before the codex command.",
  },
  {
    question: "Where does the --model flag go?",
    answer:
      "Put TogetherLink flags before the harness name: togetherlink --model moonshotai/Kimi-K2.6 codex. Arguments after codex are passed to the Codex CLI.",
  },
  {
    question: "Will this overwrite ~/.codex/config.toml?",
    answer:
      "No. TogetherLink supplies the provider and model catalog to the launched process. It does not rewrite your normal Codex configuration.",
  },
  {
    question: "Does my OpenAI API key get sent to Together AI?",
    answer:
      "No. Together AI requests use the Together API key you configure. Your regular Codex login remains available for runs you launch without TogetherLink.",
  },
  {
    question: "Can I use Together AI with codex exec in CI?",
    answer:
      "Yes. Codex exec uses the same per-run route. Provide TOGETHER_API_KEY through your CI secret store and launch togetherlink with the model flag before codex exec.",
  },
];

export const Route = createFileRoute("/guides/use-together-ai-models-with-codex")({
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
        content: "Together AI models in Codex CLI with TogetherLink",
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
  component: TogetherCodexGuide,
});

function TogetherCodexGuide() {
  return (
    <GuideShell>
      <main>
        <article>
          <header className="mx-auto max-w-[1120px] px-6 pt-16 max-[520px]:px-[18px] max-[520px]:pt-12">
            <Breadcrumbs current="Open source coding models in Codex" />
            <div className="max-w-[800px]">
              <div className="text-[12px] font-semibold tracking-[.09em] text-muted uppercase">
                Open model guide · 10 min
              </div>
              <h1 className="m-0 mt-4 text-balance text-[clamp(40px,6vw,64px)] font-semibold leading-[1.03] tracking-[-.05em]">
                How to use open source coding models in Codex CLI
              </h1>
              <p className="m-0 mt-6 max-w-[650px] text-[18px] leading-relaxed text-muted">
                Switch the model behind Codex for one run at a time. TogetherLink handles the
                Responses protocol bridge and leaves your normal Codex setup alone.
              </p>
              <div className="mt-8 max-w-[600px]">
                <CommandBlock command="togetherlink codex" label="Default: GLM 5.2" />
              </div>
            </div>
            <GuideCover variant="together-codex" className="mt-12" />
          </header>

          <div className="mx-auto mt-16 max-w-[900px] px-6 max-[520px]:px-[18px]">
            <ApiKeyCallout compact />

            <section className="mt-16" aria-labelledby="routing-heading">
              <div className="grid gap-8 md:grid-cols-[280px_1fr]">
                <div>
                  <div className="text-[12px] font-semibold tracking-[.08em] text-muted uppercase">
                    The important boundary
                  </div>
                  <h2
                    id="routing-heading"
                    className="m-0 mt-2 text-[30px] font-semibold tracking-[-.03em]"
                  >
                    Codex still speaks Responses
                  </h2>
                </div>
                <div className="text-[15px] leading-relaxed text-muted">
                  <p className="m-0">
                    Codex expects an OpenAI Responses-style endpoint. TogetherLink starts a local
                    daemon that accepts that protocol, preserves the tool loop Codex expects, and
                    sends the model work to Together AI.
                  </p>
                  <p className="mt-4 mb-0">
                    That provider exists only inside the Codex process TogetherLink launches. A
                    later plain <code className="text-ink">codex</code> command follows your normal
                    OpenAI configuration as before.
                  </p>
                </div>
              </div>

              <div className="mt-9 grid gap-4 md:grid-cols-4">
                {[
                  ["1", "Codex CLI", "Creates a Responses request and runs tools."],
                  ["2", "Local proxy", "Adapts the protocol on localhost."],
                  ["3", "Together API", "Runs the selected serverless model."],
                  ["4", "Back to Codex", "Streams model events into the normal UI."],
                ].map(([number, label, body]) => (
                  <div key={number} className="border-t border-line-strong pt-4">
                    <span className="font-mono text-[11px] font-semibold text-faint">
                      0{number}
                    </span>
                    <h3 className="m-0 mt-3 text-[15px] font-semibold">{label}</h3>
                    <p className="m-0 mt-2 text-[13px] leading-relaxed text-muted">{body}</p>
                  </div>
                ))}
              </div>
            </section>

            <section className="mt-20" aria-labelledby="setup-heading">
              <div className="flex flex-wrap items-end justify-between gap-4">
                <div>
                  <div className="text-[12px] font-semibold tracking-[.08em] text-muted uppercase">
                    One-time setup
                  </div>
                  <h2
                    id="setup-heading"
                    className="m-0 mt-2 text-[30px] font-semibold tracking-[-.03em]"
                  >
                    Install and add your key
                  </h2>
                </div>
                <span className="text-[13px] text-faint">macOS or Linux · Node 18+</span>
              </div>
              <div className="mt-7 grid gap-4">
                <CommandBlock command={INSTALL_COMMAND} label="1. Install" />
                <CommandBlock command="togetherlink configure" label="2. Save Together API key" />
              </div>
              <p className="mt-4 text-[13.5px] leading-relaxed text-muted">
                You can skip local storage in automation and set{" "}
                <code className="text-ink">TOGETHER_API_KEY</code> through your secret manager
                instead.
              </p>
            </section>

            <section className="mt-20" aria-labelledby="models-heading">
              <div className="max-w-[680px]">
                <div className="text-[12px] font-semibold tracking-[.08em] text-muted uppercase">
                  Curated catalog
                </div>
                <h2
                  id="models-heading"
                  className="m-0 mt-2 text-[30px] font-semibold tracking-[-.03em]"
                >
                  Choose a Together model for the task
                </h2>
                <p className="mt-3 text-[15px] leading-relaxed text-muted">
                  TogetherLink ships a deliberately small model catalog. Use the exact Together
                  model ID and place it before <code className="text-ink">codex</code>.
                </p>
              </div>
              <div className="mt-7 border-t border-line-strong">
                {models.map((model, index) => (
                  <div
                    key={model.id}
                    className="grid gap-3 border-b border-line-strong py-5 md:grid-cols-[38px_160px_1fr]"
                  >
                    <span className="font-mono text-[11px] text-faint">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <div className="text-[14px] font-semibold">{model.name}</div>
                    <div>
                      <code className="text-[12px] text-ink">{model.id}</code>
                      <p className="m-0 mt-1.5 text-[13px] leading-relaxed text-muted">
                        {model.note}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-6">
                <CommandBlock
                  command="togetherlink --model moonshotai/Kimi-K2.6 codex"
                  label="Example: switch to Kimi K2.6"
                />
              </div>
            </section>

            <section
              className="mt-20 border-l-2 border-[#ff5200] py-1 pl-5 text-ink"
              aria-labelledby="headless-heading"
            >
              <div className="grid gap-7 md:grid-cols-[1fr_1.1fr] md:items-center">
                <div>
                  <span className="font-mono text-[11px] tracking-[.08em] text-muted uppercase">
                    Headless and CI
                  </span>
                  <h2
                    id="headless-heading"
                    className="m-0 mt-3 text-[27px] font-semibold tracking-[-.03em]"
                  >
                    Keep Codex exec in the loop
                  </h2>
                  <p className="m-0 mt-3 text-[14px] leading-relaxed text-muted">
                    The same provider route works for one-shot repository checks. The final session
                    line reports Together token cost, which is useful in automation logs.
                  </p>
                </div>
                <pre className="m-0 overflow-x-auto rounded-[12px] bg-code p-4 font-mono text-[12px] leading-relaxed text-ink shadow-[inset_0_0_0_1px_rgba(229,231,235,.95)]">
                  <code>
                    TOGETHER_API_KEY=••••••••
                    <br />
                    togetherlink --model Qwen/Qwen3.7-Max \<br />
                    {"  "}codex exec "Review the current diff"
                  </code>
                </pre>
              </div>
            </section>

            <section className="mt-20" aria-labelledby="decision-heading">
              <h2 id="decision-heading" className="m-0 text-[30px] font-semibold tracking-[-.03em]">
                When this route is useful
              </h2>
              <div className="mt-7 grid gap-4 sm:grid-cols-3">
                {[
                  [
                    "Compare models",
                    "Run the same Codex workflow against two Together models without maintaining separate Codex configs.",
                  ],
                  [
                    "Long repositories",
                    "Select a model with a larger advertised context window when the task needs broader repository context.",
                  ],
                  [
                    "Keep the harness",
                    "Retain Codex tools, approvals, and exec workflow while changing only the model provider for that run.",
                  ],
                ].map(([heading, body]) => (
                  <div key={heading} className="border-t border-line-strong pt-4">
                    <h3 className="m-0 text-[15px] font-semibold">{heading}</h3>
                    <p className="m-0 mt-2 text-[13.5px] leading-relaxed text-muted">{body}</p>
                  </div>
                ))}
              </div>
            </section>

            <section className="mt-20" aria-labelledby="gotchas-heading">
              <h2 id="gotchas-heading" className="m-0 text-[26px] font-semibold tracking-[-.02em]">
                Three details that prevent most mistakes
              </h2>
              <ol className="mt-6 grid gap-4 md:grid-cols-3">
                <li className="border-l-2 border-[#ff5200] py-1 pl-4 text-[14px] leading-relaxed text-muted">
                  <strong className="mb-2 block text-ink">Use a Together key.</strong>
                  An OpenAI key or ChatGPT subscription cannot authorize Together model calls.
                </li>
                <li className="border-l-2 border-[#ff5200] py-1 pl-4 text-[14px] leading-relaxed text-muted">
                  <strong className="mb-2 block text-ink">Put the model first.</strong>
                  Write <code>--model … codex</code>, not <code>codex --model …</code>.
                </li>
                <li className="border-l-2 border-[#ff5200] py-1 pl-4 text-[14px] leading-relaxed text-muted">
                  <strong className="mb-2 block text-ink">Read the banner.</strong>
                  It should say Together AI, followed by the selected model and provider.
                </li>
              </ol>
            </section>

            <div className="mt-20">
              <FaqSection faqs={faqs} />
            </div>

            <section className="mt-20" aria-labelledby="related-heading">
              <h2 id="related-heading" className="m-0 text-[24px] font-semibold">
                Related guides
              </h2>
              <div className="mt-5 grid gap-4 md:grid-cols-2">
                <ArticleLink
                  href="/guides/use-glm-5-2-with-codex"
                  eyebrow="Focused quickstart"
                  title="Use GLM 5.2 with Codex"
                  body="Follow one model from install to a verified edit in a real sample repository."
                />
                <ArticleLink
                  href="/guides/use-together-ai-models-with-claude-code"
                  eyebrow="Claude workflow"
                  title="How to use open source models in Claude Code"
                  body="See how the same Together models fit Claude Code's Anthropic Messages workflow."
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
