import { createFileRoute } from "@tanstack/react-router";
import { DirectHarnessGuidePage } from "../../components/direct-harness-guide";
import { buildGuideHead, defineGuide, type Faq } from "../../components/guides";

const faqs: Faq[] = [
  {
    question: "Can DeepSeek Harness use Together AI models?",
    answer:
      "Yes. TogetherLink starts DSH's web UI with a generated Cordis patch that adds the curated Together provider and selects the requested model.",
  },
  {
    question: "Do I need to install DSH first?",
    answer:
      "Not necessarily. If dsh is missing when you explicitly run tdeepseek or select DeepSeek Harness, TogetherLink installs @deepseek-ai/dsh globally with npm and then launches it. No other harness is auto-installed.",
  },
  {
    question: "Why is this integration labeled alpha?",
    answer:
      "DeepSeek calls DSH a developer preview and warns that compatibility-breaking changes are expected. TogetherLink labels the adapter alpha for the same reason.",
  },
  {
    question: "Where does the web UI open?",
    answer:
      "DSH serves its web UI at http://127.0.0.1:3080 by default. Pass DSH options after the harness name, such as: togetherlink deepseek --port 4080.",
  },
  {
    question: "Does TogetherLink report DSH token cost?",
    answer:
      "No. DSH calls Together directly, so TogetherLink records session lifecycle but does not see the inference stream or produce local token and cost totals.",
  },
];

const guide = defineGuide({
  path: "/guides/use-together-ai-models-with-deepseek-harness",
  title: "Try DeepSeek Harness with Together AI Models",
  description:
    "Launch the DeepSeek Harness developer-preview web UI with Kimi K3, DeepSeek V4 Flash, GLM 5.2, MiniMax M3, or Qwen 3.7 Max through an ephemeral Together provider patch.",
  breadcrumbLabel: "DeepSeek Harness with Together AI models",
  ogKey: "together-deepseek",
  ogAlt: "DeepSeek Harness web UI using open models from Together AI through TogetherLink",
  datePublished: "2026-08-14T12:00:00+02:00",
  dateModified: "2026-08-15T12:00:00+02:00",
  faqs,
});

export const Route = createFileRoute("/guides/use-together-ai-models-with-deepseek-harness")({
  head: () => buildGuideHead(guide),
  component: DeepseekHarnessGuide,
});

function DeepseekHarnessGuide() {
  return (
    <DirectHarnessGuidePage
      guide={guide}
      eyebrow="Alpha integration · developer preview · 7 min"
      intro="Open DeepSeek Harness's browser UI with a temporary Together provider and model selection. DSH remains the agent interface; Together serves the model."
      harnessName="DeepSeek Harness"
      upstreamInstallCommand="npm install -g @deepseek-ai/dsh"
      upstreamInstallUrl="https://github.com/deepseek-ai/deepseek-harness"
      upstreamInstallLabel="DeepSeek Harness repository"
      launchCommand="tdeepseek"
      launchLabel="Install if needed, then open on Kimi K3"
      alternateCommand="togetherlink --model deepseek-ai/DeepSeek-V4-Flash-0731 deepseek --port 4080"
      alternateLabel="Use DeepSeek V4 Flash on another port"
      banner="togetherlink ▸ Launching DeepSeek Harness web UI with Together AI (alpha)."
      shortAnswer={
        <p className="m-0">
          TogetherLink launches <code>dsh web</code> with a credential-free Cordis patch that adds
          Together's curated catalog. The key is supplied only to the DSH process, and the normal
          DSH configuration is not rewritten.
        </p>
      }
      specialHeading="This is an alpha adapter for a developer-preview harness"
      specialBody={
        <p className="m-0">
          DeepSeek explicitly warns that DSH is iterating rapidly and may make
          compatibility-breaking changes. Keep TogetherLink current, and treat the generated web
          workflow as experimental.
        </p>
      }
      preservedState="TogetherLink does not rewrite DSH's normal user configuration. Native DeepSeek models remain available only when DEEPSEEK_API_KEY is already set."
      generatedConfig="A credential-free, content-addressed Cordis patch is stored under ~/.togetherlink/deepseek-harness and passed with --patch for this launch."
      featureItems={[
        [
          "Browser UI",
          "DSH serves its web interface on 127.0.0.1:3080 by default; port flags pass through normally.",
        ],
        [
          "Plugin architecture",
          "The Together provider is added as a Cordis patch without replacing the harness or its plugin system.",
        ],
        [
          "Demand install",
          "TogetherLink installs DSH only after you explicitly invoke or select it, never during configure or startup.",
        ],
        [
          "Native provider boundary",
          "Without DEEPSEEK_API_KEY, native DeepSeek models are hidden so the active provider choice is unambiguous.",
        ],
      ]}
      faqs={faqs}
      related={[
        {
          href: "/guides/use-together-ai-models-with-hermes-agent",
          eyebrow: "Terminal + desktop",
          title: "Use Together models in Hermes",
          body: "Keep Hermes sessions and skills through an isolated provider overlay.",
        },
        {
          href: "/guides/use-together-ai-models-with-prime-agent",
          eyebrow: "Long-running agent",
          title: "Run Prime Agent on Together AI",
          body: "Use Prime's RLM and daemon-backed sessions with the curated catalog.",
        },
      ]}
    />
  );
}
