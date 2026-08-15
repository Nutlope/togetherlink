import type { ReactNode } from "react";
import {
  ApiKeyCallout,
  Breadcrumbs,
  CommandBlock,
  FaqSection,
  type Faq,
  type GuideDefinition,
  GuideArticlePage,
  GuideByline,
  GuideCover,
  INSTALL_COMMAND,
  NumberedStep,
  RelatedGuides,
} from "./guides";

export type DirectHarnessGuideConfig = {
  guide: GuideDefinition;
  eyebrow: string;
  intro: string;
  harnessName: string;
  upstreamInstallCommand: string;
  upstreamInstallUrl: string;
  upstreamInstallLabel: string;
  launchCommand: string;
  launchLabel: string;
  alternateCommand: string;
  alternateLabel: string;
  banner: string;
  shortAnswer: ReactNode;
  specialHeading: string;
  specialBody: ReactNode;
  preservedState: string;
  generatedConfig: string;
  featureItems: Array<[string, string]>;
  faqs: Faq[];
  related: Array<{ href: string; eyebrow: string; title: string; body: string }>;
};

const models = [
  ["Kimi K3", "moonshotai/Kimi-K3", "Default · vision · 1M context"],
  ["GLM 5.2", "zai-org/GLM-5.2", "Text · 512K context"],
  ["MiniMax M3", "MiniMaxAI/MiniMax-M3", "Vision · 512K context"],
  ["Qwen 3.7 Max", "Qwen/Qwen3.7-Max", "Vision · 1M context"],
  ["DeepSeek V4 Flash", "deepseek-ai/DeepSeek-V4-Flash-0731", "Text · reasoning · 1M context"],
] as const;

export function DirectHarnessGuidePage(config: DirectHarnessGuideConfig) {
  const { guide } = config;
  return (
    <GuideArticlePage guide={guide}>
      <header className="mx-auto max-w-[1000px] px-6 pt-16 max-[520px]:px-[18px] max-[520px]:pt-12">
        <Breadcrumbs guide={guide} />
        <div className="mx-auto max-w-[800px] text-center">
          <div className="text-[12px] font-semibold tracking-[.09em] text-muted uppercase">
            {config.eyebrow}
          </div>
          <h1 className="m-0 mt-4 text-balance text-[clamp(40px,7vw,68px)] font-semibold leading-[1.02] tracking-[-.05em]">
            {guide.title}
          </h1>
          <p className="mx-auto mt-6 mb-0 max-w-[720px] text-[18px] leading-relaxed text-muted">
            {config.intro}
          </p>
          <GuideByline guide={guide} className="mx-auto" />
        </div>
        <GuideCover variant={guide.ogKey} className="mt-11" />
      </header>

      <div className="mx-auto mt-14 max-w-[760px] px-6 max-[520px]:px-[18px]">
        <section aria-labelledby="answer-heading">
          <div className="border-l-2 border-[#ff5200] py-1 pl-5">
            <h2 id="answer-heading" className="m-0 text-[24px] font-semibold tracking-[-.02em]">
              The short answer
            </h2>
            <div className="mt-3 text-[16px] leading-relaxed text-muted">{config.shortAnswer}</div>
          </div>
        </section>

        <div className="mt-10">
          <ApiKeyCallout />
        </div>

        <section className="mt-16" aria-labelledby="setup-heading">
          <div className="text-[12px] font-semibold tracking-[.08em] text-muted uppercase">
            Install and launch
          </div>
          <h2 id="setup-heading" className="m-0 mt-2 text-[30px] font-semibold tracking-[-.03em]">
            Start a first Together-backed session
          </h2>
          <div className="mt-8">
            <NumberedStep number="1" title={`Install ${config.harnessName}`}>
              <p className="m-0">
                Use the upstream project&apos;s supported installer. See the{" "}
                <a
                  className="text-ink underline decoration-line-strong underline-offset-4 hover:decoration-ink"
                  href={config.upstreamInstallUrl}
                  target="_blank"
                  rel="noreferrer"
                >
                  {config.upstreamInstallLabel}
                </a>{" "}
                for platform-specific options.
              </p>
              <div className="mt-4">
                <CommandBlock command={config.upstreamInstallCommand} />
              </div>
            </NumberedStep>
            <NumberedStep number="2" title="Install and configure TogetherLink">
              <p className="m-0">
                Save a Together API key once. The selected model is billed by Together AI, not by
                the harness vendor.
              </p>
              <div className="mt-4 space-y-4">
                <CommandBlock command={INSTALL_COMMAND} label="Install TogetherLink" />
                <CommandBlock command="togetherlink configure" label="Save the API key" />
              </div>
            </NumberedStep>
            <NumberedStep number="3" title={`Launch ${config.harnessName}`}>
              <div className="space-y-4">
                <CommandBlock command={config.launchCommand} label={config.launchLabel} />
                <CommandBlock command={config.alternateCommand} label={config.alternateLabel} />
              </div>
            </NumberedStep>
          </div>
        </section>

        <section className="mt-18" aria-labelledby="boundary-heading">
          <h2 id="boundary-heading" className="m-0 text-[30px] font-semibold tracking-[-.03em]">
            What TogetherLink changes—and what it leaves alone
          </h2>
          <div className="mt-7 overflow-x-auto">
            <table className="w-full border-collapse text-left text-[14px]">
              <thead>
                <tr className="border-y border-line-strong text-[12px] tracking-[.05em] text-faint uppercase">
                  <th className="py-3 pr-5 font-semibold">Area</th>
                  <th className="py-3 font-semibold">Behavior</th>
                </tr>
              </thead>
              <tbody className="align-top">
                {[
                  [
                    "Model requests",
                    "The harness calls Together AI directly through its OpenAI-compatible API.",
                  ],
                  [
                    "Together key",
                    "Provided only to the launched process; it is not written into the generated provider metadata.",
                  ],
                  ["Harness state", config.preservedState],
                  ["Provider setup", config.generatedConfig],
                  [
                    "Usage reporting",
                    "TogetherLink records launch lifecycle only. Token and cost totals are not available locally for this direct harness.",
                  ],
                ].map(([area, behavior]) => (
                  <tr key={area} className="border-b border-line">
                    <th className="py-4 pr-5 font-semibold">{area}</th>
                    <td className="py-4 leading-relaxed text-muted">{behavior}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section
          className="mt-18 border-l-2 border-[#ff5200] py-1 pl-5"
          aria-labelledby="special-heading"
        >
          <h2 id="special-heading" className="m-0 text-[20px] font-semibold">
            {config.specialHeading}
          </h2>
          <div className="mt-2 text-[14px] leading-relaxed text-muted">{config.specialBody}</div>
        </section>

        <section className="mt-18" aria-labelledby="features-heading">
          <div className="text-[12px] font-semibold tracking-[.08em] text-muted uppercase">
            Keep the harness
          </div>
          <h2
            id="features-heading"
            className="m-0 mt-2 text-[30px] font-semibold tracking-[-.03em]"
          >
            Together changes the model, not the workflow
          </h2>
          <div className="mt-7 grid gap-5 sm:grid-cols-2">
            {config.featureItems.map(([heading, body]) => (
              <div key={heading} className="border-t border-line-strong pt-4">
                <h3 className="m-0 text-[15px] font-semibold">{heading}</h3>
                <p className="m-0 mt-2 text-[13.5px] leading-relaxed text-muted">{body}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-18" aria-labelledby="models-heading">
          <div className="text-[12px] font-semibold tracking-[.08em] text-muted uppercase">
            Curated model catalog
          </div>
          <h2 id="models-heading" className="m-0 mt-2 text-[30px] font-semibold tracking-[-.03em]">
            Five models, with Kimi K3 as the default
          </h2>
          <p className="mt-4 text-[15px] leading-relaxed text-muted">
            To override the model, put <code>--model</code> before the harness name. Arguments after
            the harness name belong to the underlying tool.
          </p>
          <div className="mt-6 border-t border-line-strong">
            {models.map(([name, id, note]) => (
              <div
                key={id}
                className="grid gap-2 border-b border-line-strong py-4 sm:grid-cols-[150px_1fr]"
              >
                <span className="text-[14px] font-semibold">{name}</span>
                <div>
                  <code className="text-[12px] text-ink">{id}</code>
                  <p className="m-0 mt-1 text-[13px] text-muted">{note}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-18" aria-labelledby="verify-heading">
          <h2 id="verify-heading" className="m-0 text-[28px] font-semibold tracking-[-.03em]">
            Verify the launch before starting work
          </h2>
          <p className="mt-4 text-[15px] leading-relaxed text-muted">
            TogetherLink prints a launch line before the harness opens. For the default command,
            look for:
          </p>
          <blockquote className="m-0 mt-5 rounded-[12px] bg-code px-5 py-4 font-mono text-[13px] leading-relaxed shadow-[inset_0_0_0_1px_rgba(229,231,235,.95)]">
            {config.banner}
          </blockquote>
          <p className="mt-4 text-[14px] leading-relaxed text-muted">
            Launching the upstream binary directly skips TogetherLink and uses that tool&apos;s
            normal provider configuration.
          </p>
        </section>

        <div className="mt-20">
          <FaqSection faqs={config.faqs} />
        </div>

        <RelatedGuides links={config.related} />
      </div>
    </GuideArticlePage>
  );
}
