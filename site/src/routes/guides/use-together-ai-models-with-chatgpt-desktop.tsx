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
    question: "Can the Codex coding experience in ChatGPT Desktop use Together models?",
    answer:
      "Yes. TogetherLink's alpha integration merges Together models into the normal Codex picker. Native GPT models keep using your ChatGPT sign-in, while Together model requests go through a local Responses-compatible router to Together AI. It does not change ordinary ChatGPT conversations.",
  },
  {
    question: "Do I need a Together API key?",
    answer:
      "Yes. Together AI serves and bills the selected model. A ChatGPT subscription or OpenAI API key does not cover these requests.",
  },
  {
    question: "Is this change temporary like the CLI wrappers?",
    answer:
      "No. ChatGPT Desktop launches separately from TogetherLink, so the additive catalog and local router stay in its Codex configuration until you run tchatgpt off. Native GPT models remain available while it is enabled.",
  },
  {
    question: "Can I restore my previous app configuration?",
    answer:
      "Yes. TogetherLink backs up the affected configuration before changing it. Run tchatgpt off, then restart the app if it was open.",
  },
  {
    question: "Is the ChatGPT Desktop integration stable?",
    answer:
      "It is currently labeled alpha because ChatGPT Desktop behavior can change between app releases. TogetherLink includes a backup and restore path, so keep the restore command nearby while testing it.",
  },
];

const guide = defineGuide({
  path: "/guides/use-together-ai-models-with-chatgpt-desktop",
  title: "Use Open Models in Codex for the ChatGPT Desktop App",
  description:
    "Configure the Codex coding experience in ChatGPT Desktop to use open models through TogetherLink, then safely restore your previous app configuration.",
  breadcrumbLabel: "Use open models in Codex for ChatGPT Desktop",
  ogKey: "together-chatgpt",
  ogAlt: "TogetherLink connecting open models to Codex in the ChatGPT Desktop app",
  datePublished: "2026-07-21T12:00:00+02:00",
  dateModified: "2026-07-31T18:00:00+02:00",
  faqs,
});

export const Route = createFileRoute("/guides/use-together-ai-models-with-chatgpt-desktop")({
  head: () => buildGuideHead(guide),
  component: ChatGptDesktopGuide,
});

function ChatGptDesktopGuide() {
  return (
    <GuideArticlePage guide={guide}>
      <header className="mx-auto max-w-[960px] px-6 pt-16 max-[520px]:px-[18px] max-[520px]:pt-12">
        <Breadcrumbs guide={guide} />
        <div className="max-w-[820px]">
          <div className="text-[12px] font-semibold tracking-[.09em] text-muted uppercase">
            Codex in ChatGPT Desktop · alpha · 8 min
          </div>
          <h1 className="m-0 mt-4 text-balance text-[clamp(40px,7vw,68px)] font-semibold leading-[1.02] tracking-[-.05em]">
            {guide.title}
          </h1>
          <p className="m-0 mt-6 max-w-[740px] text-pretty text-[18px] leading-relaxed text-muted">
            Add open models beside Sol, Terra, Luna, and your other native GPT choices in the Codex
            picker. A local router sends each model to the right provider, while an automatic backup
            and one restore command keep the change reversible. Ordinary ChatGPT conversations are
            not changed.
          </p>
          <GuideByline guide={guide} />
        </div>
        <GuideCover variant={guide.ogKey} className="mt-12" />
      </header>

      <div className="mx-auto mt-14 max-w-[760px] px-6 max-[520px]:px-[18px]">
        <ApiKeyCallout />

        <section className="mt-14 border-y border-line-strong py-8" aria-labelledby="alpha-heading">
          <div className="text-[12px] font-semibold tracking-[.08em] text-muted uppercase">
            Alpha integration
          </div>
          <h2 id="alpha-heading" className="m-0 mt-2 text-[27px] font-semibold tracking-[-.025em]">
            Native GPT and Together models stay in one picker
          </h2>
          <p className="m-0 mt-3 text-[14.5px] leading-relaxed text-muted">
            TogetherLink preserves the built-in OpenAI provider, merges native and Together model
            metadata, and routes requests by the selected model. The router configuration persists
            because ChatGPT Desktop runs separately from the CLI. TogetherLink backs up the previous
            file first.
          </p>
        </section>

        <section className="mt-16" aria-labelledby="before-heading">
          <div className="text-[12px] font-semibold tracking-[.08em] text-muted uppercase">
            Before you start
          </div>
          <h2 id="before-heading" className="m-0 mt-2 text-[30px] font-semibold tracking-[-.03em]">
            Keep ChatGPT signed in
          </h2>
          <p className="mt-4 text-[15px] leading-relaxed text-muted">
            Install ChatGPT Desktop with the Codex coding workspace and complete the normal OpenAI
            sign-in. That session continues to serve and bill native GPT choices. Together AI serves
            and bills only the Together models you select.
          </p>
          <p className="mt-4 border-l-2 border-[#e34d13] pl-5 text-[14px] leading-relaxed text-muted">
            This guide currently targets macOS. The code path and generated configuration were
            checked against ChatGPT 26.715.61943 on July 21, 2026. App behavior may change while
            this integration remains alpha.
          </p>
        </section>

        <section className="mt-16" aria-labelledby="setup-heading">
          <div className="mb-8">
            <div className="text-[12px] font-semibold tracking-[.08em] text-muted uppercase">
              Setup
            </div>
            <h2 id="setup-heading" className="m-0 mt-2 text-[30px] font-semibold tracking-[-.03em]">
              Configure the desktop coding workspace
            </h2>
          </div>
          <NumberedStep number="1" title="Install TogetherLink">
            <CommandBlock command={INSTALL_COMMAND} />
          </NumberedStep>
          <NumberedStep number="2" title="Save your Together API key">
            <CommandBlock command="togetherlink configure" />
            <p className="m-0 mt-4">
              Press Enter to skip the optional Exa key if you do not need web search.
            </p>
          </NumberedStep>
          <NumberedStep number="3" title="Configure and open ChatGPT Desktop">
            <CommandBlock command="tchatgpt" />
            <p className="m-0 mt-4">
              If the app is already open, TogetherLink asks before restarting it. If you decline,
              quit and reopen the app manually so it reloads the provider and model catalog.
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
                "Codex configuration",
                "Adds a local OpenAI-base-URL router and generated catalog path in ~/.codex/config.toml. Your native provider and default model are preserved unless you pass --model.",
              ],
              [
                "Routing",
                "Native GPT slugs keep their ChatGPT authentication; Together slugs use the Together API key. Credentials are never forwarded across providers.",
              ],
              [
                "Model catalog",
                "Writes ~/.codex/togetherlink-codex-app-models.json with native GPT metadata plus the available Together models.",
              ],
              [
                "Backup",
                "Stores the previous configuration under ~/.togetherlink/backup/codex-app/.",
              ],
              [
                "Active provider",
                "Keeps the built-in OpenAI provider active so native GPT models remain selectable.",
              ],
            ].map(([label, body]) => (
              <div
                key={label}
                className="grid gap-2 border-b border-line-strong py-5 sm:grid-cols-[160px_1fr]"
              >
                <div className="text-[14px] font-semibold">{label}</div>
                <p className="m-0 text-[14px] leading-relaxed text-muted">{body}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-16" aria-labelledby="verify-heading">
          <div className="text-[12px] font-semibold tracking-[.08em] text-muted uppercase">
            Verify before opening a task
          </div>
          <h2 id="verify-heading" className="m-0 mt-2 text-[30px] font-semibold tracking-[-.03em]">
            Check the additive router without exposing your key
          </h2>
          <p className="mt-4 text-[15px] leading-relaxed text-muted">
            This command prints the managed routing settings. The provider should remain
            <code> openai</code> (or be absent, which means the built-in default), your existing
            model should remain selected unless you passed <code>--model</code>, and the catalog
            path should point to the generated JSON file.
          </p>
          <div className="mt-5">
            <CommandBlock
              command={
                "grep -E '^(model|model_provider|model_catalog_json|openai_base_url) =' ~/.codex/config.toml"
              }
            />
          </div>
          <p className="mt-4 text-[14px] leading-relaxed text-muted">
            In ChatGPT Desktop, open the Codex coding workspace and check that the model picker
            shows the same model before starting a repository task.
          </p>
        </section>

        <section
          className="mt-16 border-y border-line-strong py-9"
          aria-labelledby="restore-heading"
        >
          <div className="text-[12px] font-semibold tracking-[.08em] text-muted uppercase">
            Undo TogetherLink
          </div>
          <h2 id="restore-heading" className="m-0 mt-2 text-[30px] font-semibold tracking-[-.03em]">
            Restore your previous app configuration
          </h2>
          <p className="mt-4 text-[15px] leading-relaxed text-muted">
            TogetherLink restores the backup, removes its generated model catalog and session
            registration, and clears the app's model cache. If the app is open, approve the restart
            or quit and reopen it manually so it loads the restored configuration.
          </p>
          <div className="mt-5">
            <CommandBlock command="tchatgpt off" />
          </div>
        </section>

        <section className="mt-16" aria-labelledby="model-heading">
          <div className="text-[12px] font-semibold tracking-[.08em] text-muted uppercase">
            Optional model choice
          </div>
          <h2 id="model-heading" className="m-0 mt-2 text-[30px] font-semibold tracking-[-.03em]">
            Make another model the default
          </h2>
          <p className="mt-4 text-[15px] leading-relaxed text-muted">
            The generated catalog lets you switch between GPT and Together models in the app. To
            make a Together model the default, rerun setup with <code>--model</code> after
            <code> chatgpt</code>.
          </p>
          <div className="mt-5 space-y-4">
            <CommandBlock command="tchatgpt --model zai-org/GLM-5.2" label="GLM 5.2" />
            <CommandBlock command="tchatgpt --model Qwen/Qwen3.7-Max" label="Qwen 3.7 Max" />
          </div>
        </section>

        <section
          className="mt-16 border-l-2 border-[#e34d13] pl-5"
          aria-labelledby="trouble-heading"
        >
          <h2 id="trouble-heading" className="m-0 text-[22px] font-semibold tracking-[-.02em]">
            If the models do not appear
          </h2>
          <p className="m-0 mt-3 text-[14px] leading-relaxed text-muted">
            Fully quit and reopen ChatGPT Desktop. To undo setup, run the restore command instead of
            manually deleting configuration blocks.
          </p>
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
              body: "Use the same model catalog with configuration scoped to one CLI run.",
            },
            {
              href: "/guides/use-glm-5-2-with-grok-build",
              eyebrow: "Grok Build",
              title: "Launch Grok Build with GLM 5.2",
              body: "Keep coding in your terminal with temporary model configuration.",
            },
          ]}
        />
      </div>
    </GuideArticlePage>
  );
}
