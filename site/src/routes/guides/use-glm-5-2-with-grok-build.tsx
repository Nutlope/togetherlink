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
  NumberedStep,
  SITE_URL,
} from "../../components/guides";
import { guideOgPath } from "../../lib/guide-og";

const path = "/guides/use-glm-5-2-with-grok-build";
const ogImage = guideOgPath("glm-grok");
const title = "How to use GLM 5.2 with Grok Build";
const description =
  "Run GLM 5.2 inside the Grok Build coding CLI through Together AI. Install TogetherLink, add your Together API key, launch Grok Build, and verify the model boundary.";

const faqs: Faq[] = [
  {
    question: "Does Grok Build support GLM 5.2?",
    answer:
      "Yes. TogetherLink gives Grok Build a temporary model catalog whose default points to zai-org/GLM-5.2 on Together AI.",
  },
  {
    question: "Is the model still Grok?",
    answer:
      "No. Grok Build is the terminal coding harness in this setup. GLM 5.2 is the model, and Together AI serves the inference request.",
  },
  {
    question: "Do I need an xAI API key?",
    answer:
      "No xAI key is used for this route. You need a Together API key because the selected model runs on Together AI.",
  },
  {
    question: "Does TogetherLink overwrite my Grok Build config?",
    answer:
      "No. It creates a temporary Grok home for the launch, writes the Together model catalog there, and leaves your normal Grok config.toml untouched. Sessions and other supported local state remain persistent.",
  },
  {
    question: "Can I run Grok Build headlessly with GLM 5.2?",
    answer:
      "Yes. Pass Grok Build's prompt and output flags after the grok subcommand. Keep TogetherLink's model flag before the subcommand.",
  },
];

export const Route = createFileRoute("/guides/use-glm-5-2-with-grok-build")({
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
      { property: "article:published_time", content: "2026-07-21" },
      { property: "article:modified_time", content: "2026-07-21" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: title },
      { name: "twitter:description", content: description },
      { name: "twitter:image", content: SITE_URL + ogImage },
    ],
    links: [{ rel: "canonical", href: SITE_URL + path }],
  }),
  component: GlmGrokGuide,
});

function GlmGrokGuide() {
  return (
    <GuideShell>
      <main>
        <article>
          <header className="mx-auto max-w-[960px] px-6 pt-16 max-[520px]:px-[18px] max-[520px]:pt-12">
            <Breadcrumbs current="GLM 5.2 with Grok Build" />
            <div className="max-w-[780px]">
              <div className="text-[12px] font-semibold tracking-[.09em] text-muted uppercase">
                Grok Build harness · GLM 5.2 model · 8 min
              </div>
              <h1 className="m-0 mt-4 text-balance text-[clamp(40px,7vw,68px)] font-semibold leading-[1.02] tracking-[-.05em]">
                How to use GLM 5.2 with Grok Build
              </h1>
              <p className="m-0 mt-6 max-w-[720px] text-pretty text-[18px] leading-relaxed text-muted">
                Keep Grok Build's terminal workflow, tools, and sessions while GLM 5.2 handles the
                model work on Together AI. The harness and the model are separate parts of the
                stack.
              </p>
            </div>
            <GuideCover variant="glm-grok" className="mt-12" />
          </header>

          <div className="mx-auto mt-14 max-w-[760px] px-6 max-[520px]:px-[18px]">
            <ApiKeyCallout />

            <section className="mt-14" aria-labelledby="boundary-heading">
              <div className="text-[12px] font-semibold tracking-[.08em] text-muted uppercase">
                The important distinction
              </div>
              <h2
                id="boundary-heading"
                className="m-0 mt-2 text-[30px] font-semibold tracking-[-.03em]"
              >
                Grok Build is the interface. GLM 5.2 is the model.
              </h2>
              <p className="mt-4 text-pretty text-[15px] leading-relaxed text-muted">
                TogetherLink starts the existing <code>grok</code> binary with an isolated model
                catalog. That catalog points directly at Together AI and names GLM 5.2 as the
                default. No xAI model endpoint is involved in this launch.
              </p>
              <dl className="mt-7 grid border-y border-line-strong sm:grid-cols-3">
                {[
                  ["Harness", "Grok Build"],
                  ["Model", "GLM 5.2"],
                  ["Inference", "Together AI"],
                ].map(([term, value]) => (
                  <div
                    key={term}
                    className="py-5 sm:border-r sm:border-line-strong sm:px-5 sm:first:pl-0 sm:last:border-r-0"
                  >
                    <dt className="text-[12px] text-faint">{term}</dt>
                    <dd className="m-0 mt-1 text-[15px] font-semibold">{value}</dd>
                  </div>
                ))}
              </dl>
            </section>

            <section className="mt-16" aria-labelledby="setup-heading">
              <div className="mb-8">
                <div className="text-[12px] font-semibold tracking-[.08em] text-muted uppercase">
                  Setup
                </div>
                <h2
                  id="setup-heading"
                  className="m-0 mt-2 text-[30px] font-semibold tracking-[-.03em]"
                >
                  Install both CLIs, then launch
                </h2>
              </div>
              <NumberedStep number="1" title="Install TogetherLink">
                <CommandBlock command={INSTALL_COMMAND} />
              </NumberedStep>
              <NumberedStep number="2" title="Install Grok Build if it is not already present">
                <CommandBlock command="curl -fsSL https://x.ai/cli/install.sh | bash" />
              </NumberedStep>
              <NumberedStep number="3" title="Save your Together API key">
                <CommandBlock command="togetherlink configure" />
              </NumberedStep>
              <NumberedStep number="4" title="Launch Grok Build on GLM 5.2">
                <CommandBlock command="togetherlink --model zai-org/GLM-5.2 grok" />
                <p className="m-0 mt-4">
                  Because GLM 5.2 is the current default, <code>tgrok</code> is the short form.
                </p>
              </NumberedStep>
            </section>

            <section
              className="mt-16 border-y border-line-strong py-9"
              aria-labelledby="config-heading"
            >
              <h2 id="config-heading" className="m-0 text-[27px] font-semibold tracking-[-.025em]">
                Your normal Grok configuration stays in place
              </h2>
              <p className="mt-4 text-[15px] leading-relaxed text-muted">
                For each launch, TogetherLink creates a temporary Grok home and writes the Together
                model catalog there. It copies supported non-model preferences at lower priority,
                links persistent sessions and state, then deletes the temporary home when the
                process exits. Your real <code>~/.grok/config.toml</code> is never rewritten.
              </p>
            </section>

            <section className="mt-16" aria-labelledby="headless-heading">
              <div className="text-[12px] font-semibold tracking-[.08em] text-muted uppercase">
                Automation
              </div>
              <h2
                id="headless-heading"
                className="m-0 mt-2 text-[30px] font-semibold tracking-[-.03em]"
              >
                Run one coding task and stream JSON
              </h2>
              <p className="mt-4 text-[15px] leading-relaxed text-muted">
                TogetherLink options come before <code>grok</code>. Grok Build options come after
                it. Closing stdin prevents a background job from waiting for more input.
              </p>
              <div className="mt-5">
                <CommandBlock
                  command={
                    'togetherlink --model zai-org/GLM-5.2 grok --output-format streaming-json --no-memory --no-subagents -p "Review the current diff" < /dev/null'
                  }
                />
              </div>
            </section>

            <div className="mt-16">
              <FaqSection faqs={faqs} />
            </div>

            <section className="mt-16" aria-labelledby="related-heading">
              <h2 id="related-heading" className="m-0 text-[24px] font-semibold">
                Related guides
              </h2>
              <div className="mt-5 grid gap-4 md:grid-cols-2">
                <ArticleLink
                  href="/guides/use-together-ai-models-with-codex"
                  eyebrow="Codex CLI"
                  title="How to use open source models in Codex"
                  body="Keep Codex and switch between Together's curated open models."
                />
                <ArticleLink
                  href="/guides/use-together-ai-models-with-chatgpt-desktop"
                  eyebrow="Desktop app"
                  title="How to use open source models in ChatGPT Desktop"
                  body="Configure the app and learn how to restore your OpenAI profile."
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
          datePublished="2026-07-21"
          dateModified="2026-07-21"
          faqs={faqs}
        />
      </main>
    </GuideShell>
  );
}
