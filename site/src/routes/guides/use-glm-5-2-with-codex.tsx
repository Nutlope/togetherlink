import { createFileRoute } from "@tanstack/react-router";
import type { ReactNode } from "react";
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
  NumberedStep,
  SITE_URL,
  TerminalFigure,
} from "../../components/guides";
import { guideOgPath } from "../../lib/guide-og";

const path = "/guides/use-glm-5-2-with-codex";
const ogImage = guideOgPath("glm-codex");
const title = "How to use GLM 5.2 in Codex CLI";
const description =
  "Run GLM 5.2 in OpenAI Codex CLI through Together AI. Install TogetherLink, add a Together API key, verify the provider, and try a real coding task.";

const faqs: Faq[] = [
  {
    question: "Can Codex CLI use GLM 5.2?",
    answer:
      "Yes. TogetherLink starts a local OpenAI Responses-compatible proxy, points Codex at it for that run, and forwards the request to GLM 5.2 on Together AI.",
  },
  {
    question: "Do I need a Together AI API key?",
    answer:
      "Yes. The model request runs on Together AI, so you need a Together API key with available credit. Your ChatGPT or OpenAI subscription does not pay for Together inference.",
  },
  {
    question: "Does TogetherLink replace my normal Codex configuration?",
    answer:
      "No. TogetherLink passes a temporary provider and model catalog to the Codex process it launches. Your regular Codex settings and OpenAI login remain in place for normal Codex runs.",
  },
  {
    question: "How do I know Codex is really using GLM 5.2?",
    answer:
      "Check the startup output. It should say that Codex is routing to Together AI and show model zai-org/GLM-5.2 with provider togetherlink.",
  },
  {
    question: "Can I run GLM 5.2 with codex exec?",
    answer:
      "Yes. Put the Together model flag before the codex harness, then use Codex normally: togetherlink --model zai-org/GLM-5.2 codex exec followed by your prompt.",
  },
  {
    question: "Does GLM 5.2 support images in this setup?",
    answer:
      "GLM 5.2 is text-only in TogetherLink's current model catalog. Choose a vision-capable Together model such as Kimi K2.6 when your task needs image input.",
  },
];

export const Route = createFileRoute("/guides/use-glm-5-2-with-codex")({
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
        content: "Codex CLI routed through TogetherLink and Together AI to GLM 5.2",
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
  component: GlmCodexGuide,
});

function GlmCodexGuide() {
  return (
    <GuideShell>
      <main>
        <article>
          <header className="mx-auto max-w-[960px] px-6 pt-16 max-[520px]:px-[18px] max-[520px]:pt-12">
            <Breadcrumbs current="GLM 5.2 with Codex" />
            <div className="grid items-end gap-8 md:grid-cols-[1fr_auto]">
              <div>
                <div className="text-[12px] font-semibold tracking-[.09em] text-muted uppercase">
                  GLM 5.2 quickstart · 8 min
                </div>
                <h1 className="m-0 mt-4 text-balance text-[clamp(40px,7vw,68px)] font-semibold leading-[1.02] tracking-[-.05em]">
                  How to use GLM 5.2 in Codex CLI
                </h1>
                <p className="m-0 mt-6 max-w-[720px] text-[18px] leading-relaxed text-muted">
                  Keep the Codex interface and tools, but run the coding model on Together AI. This
                  guide takes you from API key to a verified GLM 5.2 coding run.
                </p>
              </div>
              <dl className="m-0 grid grid-cols-2 gap-x-7 gap-y-3 border-l border-line-strong pl-6 text-sm max-[767px]:border-l-0 max-[767px]:border-t max-[767px]:pt-5 max-[767px]:pl-0">
                <div>
                  <dt className="text-faint">Model</dt>
                  <dd className="m-0 mt-1 font-semibold">GLM 5.2</dd>
                </div>
                <div>
                  <dt className="text-faint">Context</dt>
                  <dd className="m-0 mt-1 font-semibold">262K</dd>
                </div>
                <div>
                  <dt className="text-faint">Protocol</dt>
                  <dd className="m-0 mt-1 font-semibold">Responses</dd>
                </div>
                <div>
                  <dt className="text-faint">Input</dt>
                  <dd className="m-0 mt-1 font-semibold">Text</dd>
                </div>
              </dl>
            </div>
            <GuideCover variant="glm-codex" className="mt-12" />
          </header>

          <div className="mx-auto mt-14 grid max-w-[960px] gap-14 px-6 md:grid-cols-[minmax(0,640px)_220px] max-[520px]:px-[18px]">
            <div>
              <ApiKeyCallout />

              <section className="mt-14" aria-labelledby="quickstart-heading">
                <div className="mb-8">
                  <div className="text-[12px] font-semibold tracking-[.08em] text-muted uppercase">
                    The shortest path
                  </div>
                  <h2
                    id="quickstart-heading"
                    className="m-0 mt-2 text-[30px] font-semibold tracking-[-.03em]"
                  >
                    Install, authenticate, launch
                  </h2>
                </div>
                <NumberedStep number="1" title="Install TogetherLink">
                  <p className="m-0 mb-4">
                    This installs the self-updating <code>togetherlink</code> binary on macOS or
                    Linux, plus the <code>tcodex</code>, <code>tclaude</code>, <code>tgrok</code>,{" "}
                    <code>tpi</code>, and <code>topencode</code> shortcuts. Codex CLI must also be
                    installed on the machine.
                  </p>
                  <CommandBlock command={INSTALL_COMMAND} />
                </NumberedStep>
                <NumberedStep number="2" title="Save your Together API key">
                  <p className="m-0 mb-4">
                    Create the key in Together's dashboard first. The configuration command stores
                    it locally so you do not paste a secret into every run.
                  </p>
                  <CommandBlock command="togetherlink configure" />
                </NumberedStep>
                <NumberedStep number="3" title="Start Codex on GLM 5.2">
                  <p className="m-0 mb-4">
                    Use the full model ID when you want the command to be explicit. GLM 5.2 is also
                    the current default, so <code>togetherlink codex</code> is the short form.
                  </p>
                  <CommandBlock command="tcodex" />
                </NumberedStep>
              </section>

              <section className="mt-16" aria-labelledby="proof-heading">
                <div className="mb-7">
                  <div className="text-[12px] font-semibold tracking-[.08em] text-muted uppercase">
                    Real sample-repo run
                  </div>
                  <h2
                    id="proof-heading"
                    className="m-0 mt-2 text-[30px] font-semibold tracking-[-.03em]"
                  >
                    What success looks like
                  </h2>
                  <p className="m-0 mt-3 text-[15px] leading-relaxed text-muted">
                    We asked Codex to read one TypeScript file in a small Git repository and
                    describe it without making changes. The startup block shows GLM 5.2 as the model
                    and TogetherLink as the provider.
                  </p>
                </div>
                <TerminalFigure
                  kind="codex"
                  caption="A real Warp window captured after a headless TogetherLink v0.6.4 Codex run on July 20, 2026. No terminal output was recreated or edited."
                />
              </section>

              <section className="mt-16" aria-labelledby="headless-heading">
                <h2
                  id="headless-heading"
                  className="m-0 text-[30px] font-semibold tracking-[-.03em]"
                >
                  Use it for a one-shot coding task
                </h2>
                <p className="mt-4 text-[15px] leading-relaxed text-muted">
                  Codex's <code>exec</code> mode works through the same route. Run it from the
                  repository you want Codex to inspect. The model flag belongs before{" "}
                  <code>codex</code>; everything after <code>codex</code> is passed to the Codex
                  CLI.
                </p>
                <div className="mt-5">
                  <CommandBlock
                    command={
                      'togetherlink --model zai-org/GLM-5.2 codex exec "Find and fix the failing test"'
                    }
                  />
                </div>
              </section>

              <section
                className="mt-16 border-y border-line-strong py-8"
                aria-labelledby="inside-heading"
              >
                <h2 id="inside-heading" className="m-0 text-[24px] font-semibold tracking-[-.02em]">
                  What TogetherLink changes—and what it does not
                </h2>
                <div className="mt-6 grid gap-7 sm:grid-cols-2">
                  <div>
                    <h3 className="m-0 text-[14px] font-semibold text-ink">For this run</h3>
                    <ul className="mt-3 space-y-2 pl-5 text-[14px] leading-relaxed text-muted">
                      <li>Starts a local Responses-compatible proxy.</li>
                      <li>Injects a temporary Together model catalog.</li>
                      <li>Reports Together token cost when the session ends.</li>
                    </ul>
                  </div>
                  <div>
                    <h3 className="m-0 text-[14px] font-semibold">Your normal Codex</h3>
                    <ul className="mt-3 space-y-2 pl-5 text-[14px] leading-relaxed text-muted">
                      <li>Keeps its existing OpenAI login.</li>
                      <li>Keeps its saved configuration.</li>
                      <li>Uses OpenAI again when launched normally.</li>
                    </ul>
                  </div>
                </div>
              </section>

              <section className="mt-16" aria-labelledby="troubleshooting-heading">
                <h2
                  id="troubleshooting-heading"
                  className="m-0 text-[30px] font-semibold tracking-[-.03em]"
                >
                  If it does not connect
                </h2>
                <div className="mt-6 space-y-6">
                  <TroubleshootingItem title="The key is missing or rejected">
                    Run <code>togetherlink configure</code> again and paste a current Together API
                    key. You can also provide <code>TOGETHER_API_KEY</code> in the environment.
                  </TroubleshootingItem>
                  <TroubleshootingItem title="The output says provider: openai">
                    Stop the process and launch through <code>togetherlink ... codex</code>. A plain{" "}
                    <code>codex</code> command intentionally uses your normal provider.
                  </TroubleshootingItem>
                  <TroubleshootingItem title="Codex does not recognize an option">
                    Keep TogetherLink options—such as <code>--model</code>—before <code>codex</code>
                    . Put Codex options—such as <code>exec</code> or <code>-s</code>—after it.
                  </TroubleshootingItem>
                </div>
              </section>

              <div className="mt-16">
                <FaqSection faqs={faqs} />
              </div>
            </div>

            <aside className="self-start md:sticky md:top-8">
              <div className="border-l border-line-strong pl-5 text-[13px] leading-relaxed">
                <div className="font-semibold">In this guide</div>
                <ol className="mt-3 space-y-2 pl-4 text-muted">
                  <li>Get an API key</li>
                  <li>Install and configure</li>
                  <li>Verify GLM 5.2</li>
                  <li>Run codex exec</li>
                  <li>Troubleshoot</li>
                </ol>
                <div className="mt-6 border-t border-line pt-5">
                  <span className="text-faint">Last checked</span>
                  <div className="mt-1 font-medium">July 20, 2026</div>
                </div>
              </div>
            </aside>
          </div>

          <section className="mx-auto mt-20 max-w-[960px] px-6 max-[520px]:px-[18px]">
            <h2 className="m-0 text-[24px] font-semibold">Go deeper</h2>
            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <ArticleLink
                href="/guides/use-together-ai-models-with-codex"
                eyebrow="Multiple models"
                title="How to use open source models in Codex"
                body="Switch among GLM, Kimi, Qwen, MiniMax, and DeepSeek without editing Codex config."
              />
              <ArticleLink
                href="/guides/use-together-ai-models-with-claude-code"
                eyebrow="Different harness"
                title="How to use open source models in Claude Code"
                body="Keep Claude Code's interface while running the model through Together AI."
              />
            </div>
          </section>
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

function TroubleshootingItem({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="grid gap-2 sm:grid-cols-[190px_1fr] sm:gap-6">
      <h3 className="m-0 text-[14px] font-semibold">{title}</h3>
      <p className="m-0 text-[14px] leading-relaxed text-muted [&_code]:text-ink">{children}</p>
    </div>
  );
}
