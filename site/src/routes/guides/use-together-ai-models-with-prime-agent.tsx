import { createFileRoute } from "@tanstack/react-router";
import { DirectHarnessGuidePage } from "../../components/direct-harness-guide";
import { buildGuideHead, defineGuide, type Faq } from "../../components/guides";

const faqs: Faq[] = [
  {
    question: "Can Prime Agent use Together AI models?",
    answer:
      "Yes. TogetherLink activates a credential-free provider extension for the launch, pins Prime Agent to Together AI, and supplies the key only at runtime.",
  },
  {
    question: "Does this replace Prime Agent's provider settings?",
    answer:
      "No. The Together provider is activated with a launch flag and the generated extension lives under TogetherLink's own home. Prime Agent's normal home and provider configuration are not rewritten.",
  },
  {
    question: "Do background agents keep working?",
    answer:
      "Prime Agent's daemon-backed sessions and workers remain Prime features. TogetherLink stores stable provider metadata under its own home so a detached worker can resolve the provider without storing your API key there.",
  },
  {
    question: "Can I use autonomous mode?",
    answer:
      "Yes. Put Prime Agent flags after the harness name, for example: tprime --autonomous. TogetherLink strips conflicting provider, model, model-list, and API-key overrides but preserves other Prime Agent arguments.",
  },
  {
    question: "Does TogetherLink report Prime token cost?",
    answer:
      "No. Prime Agent talks to Together directly, so TogetherLink records session lifecycle but does not see the inference stream or produce local token and cost totals.",
  },
];

const guide = defineGuide({
  path: "/guides/use-together-ai-models-with-prime-agent",
  title: "Run Prime Agent on Together AI Models",
  description:
    "Launch Prime Agent with Kimi K3, DeepSeek V4 Flash, GLM 5.2, MiniMax M3, or Qwen 3.7 Max through Together AI while preserving Prime's long-running agent workflow.",
  breadcrumbLabel: "Prime Agent with Together AI models",
  ogKey: "together-prime",
  ogAlt: "Prime Agent using open models from Together AI through TogetherLink",
  datePublished: "2026-08-14T12:00:00+02:00",
  dateModified: "2026-08-15T12:00:00+02:00",
  faqs,
});

export const Route = createFileRoute("/guides/use-together-ai-models-with-prime-agent")({
  head: () => buildGuideHead(guide),
  component: PrimeAgentGuide,
});

function PrimeAgentGuide() {
  return (
    <DirectHarnessGuidePage
      guide={guide}
      eyebrow="Prime Agent compatibility guide · 8 min"
      intro="Keep Prime Agent's persistent REPL, subagents, and long-running sessions while its selected model is served by Together AI."
      harnessName="Prime Agent"
      upstreamInstallCommand="curl -fsSL https://app.primeintellect.ai/prime-agent/install.sh | sh"
      upstreamInstallUrl="https://github.com/PrimeIntellect-ai/prime-agent"
      upstreamInstallLabel="Prime Agent quickstart"
      launchCommand="tprime"
      launchLabel="Launch on Kimi K3"
      alternateCommand="togetherlink --model zai-org/GLM-5.2 prime"
      alternateLabel="Launch on GLM 5.2"
      banner="togetherlink ▸ Launching Prime Agent with Together AI."
      shortAnswer={
        <p className="m-0">
          TogetherLink registers its curated catalog as an OpenAI-compatible Prime provider for this
          launch. Prime Agent still owns tools, sessions, the Python control environment, subagents,
          and background execution.
        </p>
      }
      specialHeading="Prime Agent is powerful, but it is not a security sandbox"
      specialBody={
        <p className="m-0">
          Prime Agent can execute model-generated Python and project commands with your user
          permissions. Use a reviewable worktree or external sandbox for untrusted repositories and
          instructions.
        </p>
      }
      preservedState="Prime's home, sessions, skills, memories, extensions, workers, and background services remain native and available."
      generatedConfig="A credential-free provider extension is stored under ~/.togetherlink/prime-agent and activated only for the TogetherLink launch."
      featureItems={[
        [
          "Persistent RLM",
          "Use Prime's IPython control environment and recursive subagents with the selected Together model.",
        ],
        [
          "Long-running work",
          "Detach, reattach, schedule, and continue daemon-backed sessions through Prime's native workflow.",
        ],
        [
          "Prime extensions",
          "User extensions and ordinary Prime arguments remain available after TogetherLink pins the provider and model.",
        ],
        [
          "Model choice",
          "Switch among the five curated Together models without editing Prime's normal configuration.",
        ],
      ]}
      faqs={faqs}
      related={[
        {
          href: "/guides/use-together-ai-models-with-hermes-agent",
          eyebrow: "Personal agent",
          title: "Run Hermes Agent on Together AI",
          body: "Use the same curated models in Hermes Agent and Hermes Desktop workflows.",
        },
        {
          href: "/guides/use-together-ai-models-with-codex",
          eyebrow: "Coding CLI",
          title: "Run open models in Codex",
          body: "Compare Prime's direct provider path with TogetherLink's Codex proxy.",
        },
      ]}
    />
  );
}
