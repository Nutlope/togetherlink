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

const path = "/guides/use-together-ai-models-with-chatgpt-desktop";
const ogImage = guideOgPath("together-chatgpt");
const title = "Add Open Models to the ChatGPT Desktop App";
const description =
  "Configure the ChatGPT desktop app to use open models from Together AI with TogetherLink, then safely restore your normal OpenAI profile when you are done.";

const faqs: Faq[] = [
  {
    question: "Can the ChatGPT desktop app use Together AI models?",
    answer:
      "TogetherLink's alpha integration adds a dedicated local provider to the desktop app configuration and routes its model requests to Together AI through a local Responses-compatible proxy.",
  },
  {
    question: "Do I need a Together API key?",
    answer:
      "Yes. Together AI serves and bills the selected model. A ChatGPT subscription or OpenAI API key does not cover these requests.",
  },
  {
    question: "Is this change temporary like the CLI wrappers?",
    answer:
      "No. The desktop integration persists because the app launches separately from the TogetherLink command. It remains active until you run togetherlink chatgpt --restore.",
  },
  {
    question: "Can I get my normal ChatGPT profile back?",
    answer:
      "Yes. TogetherLink backs up the affected configuration before changing it. Run togetherlink chatgpt --restore, then restart the app if it was open.",
  },
  {
    question: "Is the ChatGPT Desktop integration stable?",
    answer:
      "It is currently labeled alpha. The restore path and backup are part of the normal workflow, so keep the restore command nearby while testing it.",
  },
];

export const Route = createFileRoute("/guides/use-together-ai-models-with-chatgpt-desktop")({
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
  component: ChatGptDesktopGuide,
});

function ChatGptDesktopGuide() {
  return (
    <GuideShell>
      <main>
        <article>
          <header className="mx-auto max-w-[960px] px-6 pt-16 max-[520px]:px-[18px] max-[520px]:pt-12">
            <Breadcrumbs current="Add open models to ChatGPT Desktop" />
            <div className="max-w-[820px]">
              <div className="text-[12px] font-semibold tracking-[.09em] text-muted uppercase">
                ChatGPT Desktop · alpha · 8 min
              </div>
              <h1 className="m-0 mt-4 text-balance text-[clamp(40px,7vw,68px)] font-semibold leading-[1.02] tracking-[-.05em]">
                Add open models to the ChatGPT Desktop app
              </h1>
              <p className="m-0 mt-6 max-w-[740px] text-pretty text-[18px] leading-relaxed text-muted">
                Add Together's open models to the desktop coding experience, with a local proxy, an
                automatic backup, and one explicit command to return to your normal OpenAI profile.
              </p>
            </div>
            <GuideCover variant="together-chatgpt" className="mt-12" />
          </header>

          <div className="mx-auto mt-14 max-w-[760px] px-6 max-[520px]:px-[18px]">
            <ApiKeyCallout />

            <section
              className="mt-14 border-y border-amber-300 bg-amber-50/60 px-6 py-6"
              aria-labelledby="alpha-heading"
            >
              <div className="text-[12px] font-semibold tracking-[.08em] text-muted uppercase">
                Alpha integration
              </div>
              <h2
                id="alpha-heading"
                className="m-0 mt-2 text-[24px] font-semibold tracking-[-.02em]"
              >
                This setup persists until you restore it
              </h2>
              <p className="m-0 mt-3 text-[14.5px] leading-relaxed text-muted">
                CLI wrappers can inject settings for one child process. The ChatGPT app runs on its
                own, so TogetherLink writes a managed provider into the desktop configuration. It
                backs up the previous state first, but you should expect the Together profile to
                remain active after the setup command exits.
              </p>
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
                  Configure the desktop app
                </h2>
              </div>
              <NumberedStep number="1" title="Install TogetherLink">
                <CommandBlock command={INSTALL_COMMAND} />
              </NumberedStep>
              <NumberedStep number="2" title="Save your Together API key">
                <CommandBlock command="togetherlink configure" />
              </NumberedStep>
              <NumberedStep number="3" title="Configure and open ChatGPT Desktop">
                <CommandBlock command="togetherlink chatgpt" />
                <p className="m-0 mt-4">
                  If the app is already open, TogetherLink asks before restarting it. Restart
                  manually if you decline so the app reloads the new provider.
                </p>
              </NumberedStep>
            </section>

            <section className="mt-16" aria-labelledby="changes-heading">
              <h2 id="changes-heading" className="m-0 text-[30px] font-semibold tracking-[-.03em]">
                What gets changed
              </h2>
              <div className="mt-6 border-t border-line-strong">
                {[
                  [
                    "Provider",
                    "Adds a managed TogetherLink provider pointing at the local Responses proxy.",
                  ],
                  [
                    "Model catalog",
                    "Writes a generated catalog so the desktop model picker knows the available Together models.",
                  ],
                  [
                    "Backup",
                    "Stores the previous configuration under ~/.togetherlink/backup/codex-app/.",
                  ],
                  [
                    "App profile",
                    "Keeps using the Together route until you run the restore command.",
                  ],
                ].map(([label, body]) => (
                  <div
                    key={label}
                    className="grid gap-2 border-b border-line-strong py-5 sm:grid-cols-[140px_1fr]"
                  >
                    <div className="text-[14px] font-semibold">{label}</div>
                    <p className="m-0 text-[14px] leading-relaxed text-muted">{body}</p>
                  </div>
                ))}
              </div>
            </section>

            <section
              className="mt-16 border-y border-line-strong py-9"
              aria-labelledby="restore-heading"
            >
              <div className="text-[12px] font-semibold tracking-[.08em] text-muted uppercase">
                Return to OpenAI
              </div>
              <h2
                id="restore-heading"
                className="m-0 mt-2 text-[30px] font-semibold tracking-[-.03em]"
              >
                Restore your previous profile
              </h2>
              <p className="mt-4 text-[15px] leading-relaxed text-muted">
                Run the restore command whenever you want the desktop app to use your previous
                OpenAI profile again. TogetherLink restores the backup, removes its generated model
                catalog and session registration, and clears the app's model cache.
              </p>
              <div className="mt-5">
                <CommandBlock command="togetherlink chatgpt --restore" />
              </div>
            </section>

            <section className="mt-16" aria-labelledby="model-heading">
              <div className="text-[12px] font-semibold tracking-[.08em] text-muted uppercase">
                Optional model choice
              </div>
              <h2
                id="model-heading"
                className="m-0 mt-2 text-[30px] font-semibold tracking-[-.03em]"
              >
                Pick another model after setup
              </h2>
              <p className="mt-4 text-[15px] leading-relaxed text-muted">
                Start with <code>togetherlink chatgpt</code> and the default GLM 5.2 profile. To
                override it later, put the model flag after <code>chatgpt</code>.
              </p>
              <div className="mt-5 space-y-4">
                <CommandBlock
                  command="togetherlink chatgpt --model zai-org/GLM-5.2"
                  label="GLM 5.2"
                />
                <CommandBlock
                  command="togetherlink chatgpt --model Qwen/Qwen3.7-Max"
                  label="Qwen 3.7 Max"
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
                  title="Run open models in Codex without editing config"
                  body="Use the same model catalog with per-run CLI configuration."
                />
                <ArticleLink
                  href="/guides/use-glm-5-2-with-grok-build"
                  eyebrow="Grok Build"
                  title="Launch Grok Build with GLM 5.2"
                  body="Keep a terminal coding harness and use temporary model configuration."
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
