import { createFileRoute } from "@tanstack/react-router";
import { DirectHarnessGuidePage } from "../../components/direct-harness-guide";
import { buildGuideHead, defineGuide, type Faq } from "../../components/guides";

const faqs: Faq[] = [
  {
    question: "Can Hermes Agent use Together AI models?",
    answer:
      "Yes. TogetherLink creates a temporary Hermes home overlay with a Together provider, then launches Hermes with the selected curated model.",
  },
  {
    question: "Does it work with Hermes Desktop?",
    answer:
      "Yes. Run togetherlink hermes desktop. Quit any existing Hermes Desktop process first so the app starts with the temporary Together runtime.",
  },
  {
    question: "Will it overwrite ~/.hermes?",
    answer:
      "No. TogetherLink copies or links ordinary Hermes state into a temporary overlay, isolates credential files and provider configuration, and removes the overlay when the launched process exits.",
  },
  {
    question: "Are my sessions, skills, and memory available?",
    answer:
      "Yes. Ordinary non-credential Hermes state is linked into the temporary runtime, so native sessions, skills, memories, and preferences remain available and resumable.",
  },
  {
    question: "Does TogetherLink report Hermes token cost?",
    answer:
      "No. Hermes calls Together directly, so TogetherLink records session lifecycle but does not see the inference stream or produce local token and cost totals.",
  },
];

const guide = defineGuide({
  path: "/guides/use-together-ai-models-with-hermes-agent",
  title: "Use Together AI Models in Hermes Agent and Hermes Desktop",
  description:
    "Launch Hermes Agent or Hermes Desktop with Together AI models through an isolated per-run provider while preserving sessions, skills, memory, and preferences.",
  breadcrumbLabel: "Hermes Agent and Hermes Desktop with Together AI",
  ogKey: "together-hermes",
  ogAlt: "Hermes Agent and Hermes Desktop using open models from Together AI through TogetherLink",
  datePublished: "2026-08-14T12:00:00+02:00",
  dateModified: "2026-08-14T12:00:00+02:00",
  faqs,
});

export const Route = createFileRoute("/guides/use-together-ai-models-with-hermes-agent")({
  head: () => buildGuideHead(guide),
  component: HermesAgentGuide,
});

function HermesAgentGuide() {
  return (
    <DirectHarnessGuidePage
      guide={guide}
      eyebrow="Hermes Agent + Hermes Desktop guide · 9 min"
      intro="Use Together's curated models in Hermes while keeping its sessions, skills, memory, preferences, terminal interface, and native desktop app."
      harnessName="Hermes Agent"
      upstreamInstallCommand="curl -fsSL https://hermes-agent.nousresearch.com/install.sh | bash"
      upstreamInstallUrl="https://hermes-agent.nousresearch.com/docs/getting-started/quickstart/"
      upstreamInstallLabel="official Hermes quickstart"
      launchCommand="thermes"
      launchLabel="Launch Hermes in the terminal"
      alternateCommand="togetherlink hermes desktop"
      alternateLabel="Launch Hermes Desktop"
      banner="togetherlink ▸ Launching Hermes with Together AI."
      shortAnswer={
        <p className="m-0">
          TogetherLink creates an isolated Hermes runtime for one launch and adds a Together
          provider to it. Hermes still owns the interface, tools, sessions, skills, memory, and
          desktop experience.
        </p>
      }
      specialHeading="Quit Hermes Desktop before launching the Together version"
      specialBody={
        <p className="m-0">
          An already-running Desktop process keeps the environment it started with. Quit it
          completely, then run <code>togetherlink hermes desktop</code> so the new process receives
          the temporary provider and selected model.
        </p>
      }
      preservedState="Sessions, skills, memories, preferences, and other non-credential state are linked from the normal Hermes home and remain resumable."
      generatedConfig="A temporary HERMES_HOME contains the Together provider and isolated credentials. It is removed when the launched Hermes process exits."
      featureItems={[
        [
          "Terminal and Desktop",
          "Use the CLI/TUI or the native desktop app against the same curated Together catalog.",
        ],
        [
          "Native sessions",
          "Start or resume Hermes conversations while keeping the normal session store available.",
        ],
        [
          "Skills and memory",
          "Hermes' native skills, memories, and preferences remain visible through the temporary overlay.",
        ],
        [
          "Hermes tools",
          "Together supplies model inference; Hermes continues to run its own terminal, browser, and other enabled tools.",
        ],
      ]}
      faqs={faqs}
      related={[
        {
          href: "/guides/use-together-ai-models-with-prime-agent",
          eyebrow: "Long-running coding",
          title: "Run Prime Agent on Together AI",
          body: "Use persistent RLM sessions and subagents with the curated model catalog.",
        },
        {
          href: "/guides/use-together-ai-models-with-deepseek-harness",
          eyebrow: "Developer preview",
          title: "Try DeepSeek Harness with Together AI",
          body: "Launch DSH's web UI with a per-launch Together provider patch.",
        },
      ]}
    />
  );
}
