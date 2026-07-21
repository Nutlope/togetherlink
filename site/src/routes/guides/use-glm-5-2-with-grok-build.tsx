import { createFileRoute } from "@tanstack/react-router";
import {
  ApiKeyCallout,
  Breadcrumbs,
  buildGuideHead,
  CommandBlock,
  defineGuide,
  FaqSection,
  type Faq,
  GuideArticlePage,
  GuideByline,
  GuideCover,
  INSTALL_COMMAND,
  NumberedStep,
  RelatedGuides,
} from "../../components/guides";

const faqs: Faq[] = [
  {
    question: "Does Grok Build support GLM 5.2?",
    answer:
      "Yes. TogetherLink gives Grok Build a temporary model catalog whose default points to zai-org/GLM-5.2 on Together AI.",
  },
  {
    question: "Is the model still Grok?",
    answer:
      "No. Grok Build is the command-line coding tool in this setup. GLM 5.2 is the model, and Together AI serves the request.",
  },
  {
    question: "Do I need an xAI API key?",
    answer:
      "No xAI key is used for this setup. You need a Together API key because the selected model runs on Together AI.",
  },
  {
    question: "Does TogetherLink overwrite my Grok Build config?",
    answer:
      "No. It creates a temporary Grok home for the launch, writes the Together model catalog there, and leaves your normal Grok config.toml untouched. Sessions and other supported local state are preserved.",
  },
  {
    question: "Can I run Grok Build headlessly with GLM 5.2?",
    answer:
      "Yes. Pass Grok Build's prompt and output flags after the grok subcommand. Keep TogetherLink's model flag before the subcommand.",
  },
  {
    question: "Does Grok Build web search work with TogetherLink?",
    answer:
      "No. TogetherLink disables Grok Build's native xAI-backed web search for this launch. Local coding tools and model requests through Together AI still work.",
  },
];

const guide = defineGuide({
  path: "/guides/use-glm-5-2-with-grok-build",
  title: "Launch Grok Build with GLM 5.2",
  description:
    "Run GLM 5.2 inside the Grok Build coding CLI through Together AI. Install TogetherLink, add your Together API key, launch Grok Build, and confirm GLM 5.2 is the active model.",
  breadcrumbLabel: "Launch Grok Build with GLM 5.2",
  ogKey: "glm-grok",
  ogAlt: "Grok Build using GLM 5.2 through TogetherLink and Together AI",
  datePublished: "2026-07-21",
  dateModified: "2026-07-21",
  faqs,
});

export const Route = createFileRoute("/guides/use-glm-5-2-with-grok-build")({
  head: () => buildGuideHead(guide),
  component: GlmGrokGuide,
});

function GlmGrokGuide() {
  return (
    <GuideArticlePage guide={guide}>
      <header className="mx-auto max-w-[960px] px-6 pt-16 max-[520px]:px-[18px] max-[520px]:pt-12">
        <Breadcrumbs guide={guide} />
        <div className="max-w-[780px]">
          <div className="text-[12px] font-semibold tracking-[.09em] text-muted uppercase">
            Grok Build CLI · GLM 5.2 model · 8 min
          </div>
          <h1 className="m-0 mt-4 text-balance text-[clamp(40px,7vw,68px)] font-semibold leading-[1.02] tracking-[-.05em]">
            {guide.title}
          </h1>
          <p className="m-0 mt-6 max-w-[720px] text-pretty text-[18px] leading-relaxed text-muted">
            Keep Grok Build's terminal workflow, local coding tools, and sessions while GLM 5.2
            handles model requests through Together AI. Grok Build provides the coding interface;
            GLM 5.2 produces the answers.
          </p>
          <GuideByline guide={guide} />
        </div>
        <GuideCover variant={guide.ogKey} className="mt-12" />
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
            catalog. That catalog points directly at Together AI and names GLM 5.2 as the default.
            No xAI model endpoint is involved in this launch.
          </p>
          <dl className="mt-7 grid border-y border-line-strong sm:grid-cols-3">
            {[
              ["Tool", "Grok Build"],
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
            <h2 id="setup-heading" className="m-0 mt-2 text-[30px] font-semibold tracking-[-.03em]">
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
            <p className="m-0 mt-4">
              If it asks for an Exa key, press Enter to skip it. Grok Build's native web search is
              not used in this setup.
            </p>
          </NumberedStep>
          <NumberedStep number="4" title="Launch Grok Build on GLM 5.2">
            <CommandBlock command="tgrok" />
            <p className="m-0 mt-4">
              Use the full <code>togetherlink --model ... grok</code> form in scripts when you want
              the model choice to be explicit.
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
            model catalog there. It copies your existing preferences, then applies TogetherLink's
            temporary model and privacy settings. It also links your session and state folders so
            they remain available. When Grok exits, TogetherLink deletes the temporary home—not your
            real <code>~/.grok/config.toml</code>.
          </p>
        </section>

        <section className="mt-16" aria-labelledby="proof-heading">
          <div className="text-[12px] font-semibold tracking-[.08em] text-muted uppercase">
            Verified output
          </div>
          <h2 id="proof-heading" className="m-0 mt-2 text-[30px] font-semibold tracking-[-.03em]">
            Read the relevant field from the final JSON event
          </h2>
          <p className="mt-4 text-[15px] leading-relaxed text-muted">
            A real headless run on July 21, 2026 returned the requested text and named GLM 5.2 in
            the final <code>modelUsage</code> object. This field verifies the backend without asking
            the model to identify itself.
          </p>
          <pre className="m-0 mt-5 overflow-x-auto rounded-[12px] bg-code p-4 font-mono text-[12px] leading-relaxed text-ink shadow-[inset_0_0_0_1px_rgba(229,231,235,.95)]">
            <code>{'"modelUsage":{"zai-org/GLM-5.2":{"modelCalls":1}}'}</code>
          </pre>
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
            TogetherLink options come before <code>grok</code>. Grok Build options come after it.
            The final JSON event includes token usage and the model ID used for the run.
          </p>
          <div className="mt-5">
            <CommandBlock
              command={
                'togetherlink --model zai-org/GLM-5.2 grok --output-format streaming-json -p "Review the current diff"'
              }
            />
          </div>
        </section>

        <div className="mt-16">
          <FaqSection faqs={faqs} />
        </div>

        <RelatedGuides
          className="mt-16"
          links={[
            {
              href: "/guides/use-together-ai-models-with-codex",
              eyebrow: "Codex CLI",
              title: "Run open models in Codex without replacing config",
              body: "Keep Codex and switch between Together's curated open models.",
            },
            {
              href: "/guides/use-together-ai-models-with-chatgpt-desktop",
              eyebrow: "Desktop app",
              title: "Configure open models for ChatGPT Desktop's Codex workspace",
              body: "Configure the desktop coding experience and learn how to restore your previous app configuration.",
            },
          ]}
        />
      </div>
    </GuideArticlePage>
  );
}
