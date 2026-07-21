import { createFileRoute } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { useEffect, useRef, useState } from "react";
import { ChatGPTMark, ClaudeMark, CodexMark, GrokMark } from "../components/harness-marks";

const installCommand = "curl -fsSL https://togetherlink.vercel.app/install.sh | sh";
const githubUrl = "https://github.com/Nutlope/togetherlink";
const siteUrl = "https://togetherlink.vercel.app/";
const pageTitle = "Use Together AI Models in Claude Code, Codex & ChatGPT";
const pageDescription =
  "Run GLM 5.2 and other Together AI models in Claude Code, OpenAI Codex CLI, OpenCode, and the ChatGPT desktop app with togetherlink.";
const togetherReferralUrl =
  "https://togetherai.link/?utm_source=togetherlink&utm_medium=referral&utm_campaign=example-app";

type ProofItem = {
  value: string;
  label: string;
  href?: string;
  icon?: ReactNode;
};

const features = [
  {
    title: "OpenCode",
    command: "topencode",
    tag: "100% supported",
    tagTone: "live",
    body: (
      <>
        OpenCode launches with Together GLM 5.2 wired in - config injected only for that launch.
        Close it and your OpenCode setup is exactly as it was, while sessions can still resume.
      </>
    ),
    supportLabel: "Support",
    supportValue: "100%",
    icon: <OpenCodeMark />,
    accent: undefined,
  },
  {
    title: "Claude Code",
    command: "tclaude",
    tag: "Beta",
    tagTone: "beta",
    body: (
      <>
        Claude Code routes through a local translation proxy - no edits to your real config. You
        keep your Claude Code subscription and login the whole time.
      </>
    ),
    icon: <ClaudeMark />,
    accent: undefined,
  },
  {
    title: "Codex CLI",
    command: "tcodex",
    tag: "Beta",
    tagTone: "beta",
    body: (
      <>
        Codex talks to Together through a local Responses-to-chat proxy. Settings are injected per
        run, with headless <code>exec</code> support for fast checks.
      </>
    ),
    icon: <CodexMark />,
    accent: undefined,
  },
  {
    title: "Pi Code",
    command: "tpi",
    tag: "100% supported",
    tagTone: "live",
    body: (
      <>
        Pi Code launches with Pi's official Together provider, a temporary Pi config directory, and
        normal local session persistence.
      </>
    ),
    supportLabel: "Support",
    supportValue: "100%",
    icon: <PiMark />,
    accent: undefined,
  },
  {
    title: "Grok Build",
    command: "tgrok",
    tag: "Beta",
    tagTone: "beta",
    body: (
      <>
        Grok Build launches directly on Together with the curated model catalog in a temporary home.
        Your Grok config stays untouched and sessions still resume.
      </>
    ),
    icon: <GrokMark />,
    accent: undefined,
  },
];

const heroTools = [
  { name: "Claude Code", command: "tclaude", icon: <ClaudeMark /> },
  { name: "ChatGPT App", command: "chatgpt", icon: <ChatGPTHeroMark /> },
  { name: "OpenCode", command: "topencode", icon: <OpenCodeMark /> },
  { name: "Codex CLI", command: "tcodex", icon: <CodexMark /> },
  { name: "Pi Code", command: "tpi", icon: <PiMark /> },
  { name: "Grok Build", command: "tgrok", icon: <GrokMark /> },
];

const heroProof: ProofItem[] = [
  { value: "6", label: "integrations" },
  { value: "1", label: "install command" },
  { value: "GitHub", label: "see the code", href: githubUrl, icon: <GitHubMark /> },
];

const heroToolPositions = [
  "sm:absolute sm:left-[5%] sm:top-[7%]",
  "sm:absolute sm:left-1/2 sm:top-[7%] sm:-translate-x-1/2",
  "sm:absolute sm:right-[5%] sm:top-[7%]",
  "sm:absolute sm:left-[5%] sm:bottom-[7%]",
  "sm:absolute sm:left-1/2 sm:bottom-[7%] sm:-translate-x-1/2",
  "sm:absolute sm:right-[5%] sm:bottom-[7%]",
];

const codexAppCommands = [
  {
    command: "togetherlink chatgpt",
    label: "Configure",
    description:
      "Patches ChatGPT Desktop config to route through Together. The change stays active until you restore.",
  },
  {
    command: "togetherlink chatgpt --restore",
    label: "Restore",
    description:
      "Brings back your OpenAI / ChatGPT subscription profile and removes the togetherlink config.",
  },
];

const guideLinks = [
  {
    href: "/guides/use-together-ai-models-with-codex",
    label: "Codex CLI",
    title: "Run open models in Codex without editing config",
    body: "Route Codex through Together and switch between six current open models.",
    icon: <CodexMark className="size-6" />,
  },
  {
    href: "/guides/use-glm-5-2-with-grok-build",
    label: "Grok Build",
    title: "Launch Grok Build with GLM 5.2",
    body: "Keep the Grok Build terminal harness while Together AI serves GLM 5.2.",
    icon: <GrokMark className="size-6" />,
  },
  {
    href: "/guides/use-together-ai-models-with-chatgpt-desktop",
    label: "ChatGPT Desktop",
    title: "Add open models to the ChatGPT Desktop app",
    body: "Configure the desktop app, understand the persistent change, and restore safely.",
    icon: <ChatGPTMark className="size-6 rounded-md" />,
  },
];

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: pageTitle },
      { name: "description", content: pageDescription },
      { name: "robots", content: "index, follow, max-image-preview:large" },
      { name: "googlebot", content: "index, follow, max-image-preview:large" },
      { property: "og:type", content: "website" },
      { property: "og:site_name", content: "togetherlink" },
      { property: "og:title", content: pageTitle },
      { property: "og:description", content: pageDescription },
      { property: "og:url", content: siteUrl },
      { property: "og:image", content: `${siteUrl}togetherlink-cover.png` },
      { property: "og:image:type", content: "image/png" },
      { property: "og:image:width", content: "1200" },
      { property: "og:image:height", content: "630" },
      {
        property: "og:image:alt",
        content:
          "TogetherLink connecting OpenCode, Codex CLI, Grok Build, Claude Code, ChatGPT Desktop, and Pi Code",
      },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: pageTitle },
      { name: "twitter:description", content: pageDescription },
      { name: "twitter:image", content: `${siteUrl}togetherlink-cover.png` },
      {
        name: "twitter:image:alt",
        content:
          "TogetherLink connecting OpenCode, Codex CLI, Grok Build, Claude Code, ChatGPT Desktop, and Pi Code",
      },
    ],
    links: [{ rel: "canonical", href: siteUrl }],
  }),
  component: Home,
});

function Home() {
  const [copyState, setCopyState] = useState<"idle" | "copied" | "select">("idle");
  const [version, setVersion] = useState("MIT");
  const [latestRelease, setLatestRelease] = useState<ProofItem>({
    value: "auto",
    label: "updates in place",
  });
  const [copiedExplicitCommand, setCopiedExplicitCommand] = useState<string | null>(null);
  const commandRef = useRef<HTMLElement>(null);
  const commandShellRef = useRef<HTMLDivElement>(null);
  const [commandFontSize, setCommandFontSize] = useState(14);

  useEffect(() => {
    fetch("/latest.json", { cache: "no-store" })
      .then((response) => response.json())
      .then((manifest: { version?: string; publishedAt?: string }) => {
        if (manifest.version) setVersion(`v${manifest.version} - MIT`);
        const releaseAge = formatReleaseAge(manifest.publishedAt);
        if (releaseAge) {
          setLatestRelease({
            value: releaseAge,
            label: "latest release",
          });
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    const shell = commandShellRef.current;
    const command = commandRef.current;
    if (!shell || !command) return;

    const resizeObserver = new ResizeObserver(() => {
      const availableWidth = command.getBoundingClientRect().width;
      const estimatedCharacterWidth = 0.62;
      const nextSize = Math.min(
        14,
        Math.max(
          10,
          Math.floor(availableWidth / (installCommand.length * estimatedCharacterWidth)),
        ),
      );

      setCommandFontSize(nextSize);
    });

    resizeObserver.observe(shell);
    return () => resizeObserver.disconnect();
  }, []);

  const proofItems = [...heroProof, latestRelease];

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(installCommand);
      setCopyState("copied");
      window.setTimeout(() => setCopyState("idle"), 1400);
    } catch {
      const command = commandRef.current;
      if (command) {
        const range = document.createRange();
        range.selectNode(command);
        window.getSelection()?.removeAllRanges();
        window.getSelection()?.addRange(range);
      }
      setCopyState("select");
      window.setTimeout(() => setCopyState("idle"), 1600);
    }
  };

  const handleCopyExplicitCommand = async (command: string) => {
    try {
      await copyText(command);
      setCopiedExplicitCommand(command);
      window.setTimeout(() => setCopiedExplicitCommand(null), 1400);
    } catch {
      setCopiedExplicitCommand(null);
    }
  };

  return (
    <main className="mx-auto max-w-[1120px] px-6 max-[520px]:px-[18px]">
      <header className="flex items-center gap-2.5 pt-6 max-[520px]:flex-wrap max-[520px]:gap-y-3.5">
        <div className="flex items-center gap-2 text-base font-semibold text-ink">
          <img
            className="block size-[22px]"
            src="/togetherlink-logo.svg"
            alt=""
            aria-hidden="true"
          />
          togetherlink
        </div>
        <nav className="ml-auto flex items-center gap-[22px] text-sm font-medium text-muted max-[520px]:ml-0 max-[520px]:basis-full max-[520px]:gap-[18px]">
          <a
            className="inline-flex items-center gap-1.5 transition-colors hover:text-ink"
            href={githubUrl}
            target="_blank"
            rel="noopener noreferrer"
          >
            <GitHubMark className="size-4" />
            GitHub
          </a>
          <a
            className="transition-colors hover:text-ink"
            href={togetherReferralUrl}
            target="_blank"
            rel="noopener noreferrer"
          >
            Get Together API key
          </a>
        </nav>
      </header>

      <section className="py-[74px] pb-4 text-center max-[520px]:pt-14">
        <a
          href={togetherReferralUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="mb-7 inline-flex items-center gap-2 rounded-full border border-line-strong bg-white px-3.5 py-1.5 text-[13px] font-medium text-muted shadow-[0_1px_2px_rgba(10,10,10,.04)] transition-colors hover:text-ink"
        >
          <span>Powered by</span>
          <img className="block h-[15px] w-auto" src="/together-ai.png" alt="Together AI" />
        </a>
        <h1 className="m-0 text-balance text-[clamp(34px,6vw,52px)] font-semibold leading-[1.08] text-ink">
          Use Open source models
          <br />
          in Codex and Claude Code
        </h1>
        <p className="mx-auto mt-5 mb-9 max-w-[560px] text-pretty text-[19px] leading-normal text-muted">
          Install once, then run GLM 5.2 in Claude Code or Codex with short commands. TogetherLink
          injects Together settings for that run only, so your normal tool configs stay clean.
        </p>

        <div className="relative mx-auto mb-9 flex min-h-[360px] max-w-[760px] items-center justify-center overflow-hidden rounded-[24px] bg-[radial-gradient(circle_at_center,#f5f5f4_0,#ffffff_58%,#fafafa_100%)] px-5 py-8 shadow-[inset_0_0_0_1px_rgba(229,231,235,.9),0_1px_2px_rgba(10,10,10,.04)] max-[680px]:min-h-0 max-[680px]:flex-col max-[680px]:gap-5 max-[680px]:rounded-[18px]">
          <div className="pointer-events-none absolute inset-x-12 top-1/2 hidden h-px bg-[linear-gradient(90deg,transparent,#d1d5db,transparent)] sm:block" />
          <div className="pointer-events-none absolute inset-y-8 left-1/2 hidden w-px bg-[linear-gradient(180deg,transparent,#d1d5db,transparent)] sm:block" />
          <div className="relative z-10 flex size-[134px] flex-col items-center justify-center rounded-full bg-white text-ink shadow-[0_1px_2px_rgba(10,10,10,.04),0_24px_70px_-28px_rgba(10,10,10,.32),inset_0_0_0_1px_rgba(229,231,235,.96)]">
            <img
              className="mb-1 size-[42px]"
              src="/togetherlink-logo.svg"
              alt=""
              aria-hidden="true"
            />
            <span className="text-[15px] font-semibold">TogetherLink</span>
            <span className="mt-0.5 text-[11px] font-medium text-faint">per-run routing</span>
          </div>
          <div className="contents max-[680px]:grid max-[680px]:grid-cols-2 max-[680px]:gap-2.5 max-[380px]:w-full max-[380px]:grid-cols-1">
            {heroTools.map((tool, index) => (
              <HeroTool key={tool.name} index={index} {...tool} />
            ))}
          </div>
        </div>

        <div
          ref={commandShellRef}
          className="mx-auto mb-4 flex max-w-[600px] items-center gap-3 rounded-xl border border-line-strong bg-code py-4 pr-4 pl-[18px] text-left font-mono text-sm shadow-[0_1px_2px_rgba(10,10,10,.04),0_8px_24px_rgba(10,10,10,.05)] max-[520px]:grid max-[520px]:grid-cols-[auto_1fr] max-[520px]:items-start max-[520px]:pr-[18px]"
        >
          <span className="select-none text-faint">$</span>
          <code
            ref={commandRef}
            className="min-w-0 flex-1 break-words leading-snug text-ink [overflow-wrap:anywhere] data-[fit=true]:whitespace-nowrap"
            data-fit={commandFontSize > 10}
            style={{ fontSize: commandFontSize }}
          >
            <InstallCommandText />
          </code>
          <button
            type="button"
            onClick={handleCopy}
            aria-label="Copy install command"
            className="min-w-[58px] cursor-pointer whitespace-nowrap rounded-lg border border-line-strong bg-white px-[13px] py-[7px] font-sans text-[13px] font-medium text-muted transition hover:border-ink hover:text-ink active:scale-95 data-[copied=true]:border-ink data-[copied=true]:bg-ink data-[copied=true]:text-white max-[520px]:col-span-2 max-[520px]:min-h-10"
            data-copied={copyState === "copied"}
          >
            {copyState === "copied" ? "Copied" : copyState === "select" ? "Select Cmd+C" : "Copy"}
          </button>
        </div>
        <div className="text-[13px] text-faint">
          macOS & Linux - installs Bun if needed - keeps itself up to date
        </div>

        <div className="mx-auto mt-7 grid max-w-[720px] grid-cols-4 gap-2.5 max-[680px]:grid-cols-2">
          {proofItems.map((item) => (
            <ProofCard key={item.label} item={item} />
          ))}
        </div>
      </section>

      <section className="mt-[52px] mb-[72px] grid gap-3.5 md:grid-cols-2 lg:grid-cols-6">
        {features.map((feature, index) => (
          <article
            key={feature.title}
            className={`flex h-full flex-col rounded-[14px] border border-line-strong bg-white px-[22px] pt-6 pb-[22px] transition hover:border-faint hover:shadow-[0_1px_2px_rgba(10,10,10,.04),0_8px_24px_rgba(10,10,10,.05)] lg:col-span-2 ${index === 3 ? "lg:col-start-2" : index === 4 ? "lg:col-start-4" : ""}`}
          >
            <div className="flex items-start justify-between gap-3.5">
              <span
                className="inline-flex size-[42px] shrink-0 items-center justify-center rounded-[10px] border border-line-strong bg-code text-ink shadow-[inset_0_1px_0_rgba(255,255,255,.72)] data-[accent=emerald]:border-emerald-200 data-[accent=emerald]:bg-emerald-50 data-[accent=emerald]:text-emerald-600"
                data-accent={feature.accent}
              >
                {feature.icon}
              </span>
              <span
                className="inline-flex items-center gap-1.5 rounded-md border border-transparent bg-code px-[9px] py-1 text-[11px] font-semibold tracking-[.05em] text-muted uppercase data-[tone=beta]:rotate-[-1.5deg] data-[tone=beta]:border-amber-300 data-[tone=beta]:bg-amber-50 data-[tone=beta]:text-amber-900 data-[tone=beta]:shadow-[0_1px_0_rgba(255,255,255,.85)_inset,0_1px_2px_rgba(146,64,14,.12)] data-[tone=dark]:bg-neutral-100 data-[tone=dark]:text-ink data-[tone=live]:bg-neutral-100 data-[tone=live]:text-ink"
                data-tone={feature.tagTone}
              >
                <span
                  className="size-1.5 rounded-full bg-faint data-[tone=beta]:bg-amber-500 data-[tone=dark]:bg-ink data-[tone=live]:bg-green-500"
                  data-tone={feature.tagTone}
                />
                {feature.tag}
              </span>
            </div>
            <h3 className="mt-3.5 mb-2 text-[17px] font-semibold text-ink">{feature.title}</h3>
            <p className="m-0 text-[14.5px] leading-normal text-muted [&_code]:text-ink">
              {feature.body}
            </p>
            {feature.supportLabel ? (
              <div className="mt-auto flex items-baseline justify-between gap-3 pt-[18px] text-xs font-semibold text-muted">
                <span>{feature.supportLabel}</span>
                <strong className="whitespace-nowrap text-[13px] text-ink tabular-nums">
                  {feature.supportValue}
                </strong>
              </div>
            ) : null}
            <div className={feature.supportLabel ? "mt-4" : "mt-auto pt-4"}>
              <button
                type="button"
                onClick={() => handleCopyExplicitCommand(feature.command)}
                aria-label={`Copy ${feature.command}`}
                className="flex min-h-10 w-full cursor-pointer items-center justify-between gap-3 rounded-lg border border-line-strong bg-code px-3 py-2.5 text-left font-mono text-[13px] leading-none text-ink transition-[background-color,border-color,transform] duration-150 hover:border-faint hover:bg-white active:scale-[0.96] data-[copied=true]:border-ink data-[copied=true]:bg-white"
                data-copied={copiedExplicitCommand === feature.command}
              >
                <code>
                  <span className="select-none text-faint">$ </span>
                  {feature.command}
                </code>
                <span
                  className="inline-flex shrink-0 items-center gap-1.5 text-[12px] font-medium text-muted data-[copied=true]:text-ink"
                  data-copied={copiedExplicitCommand === feature.command}
                >
                  {copiedExplicitCommand === feature.command ? "Copied" : "Copy"}
                  {copiedExplicitCommand === feature.command ? <CheckMark /> : <CopyMark />}
                </span>
              </button>
            </div>
          </article>
        ))}
      </section>

      <section className="mx-auto mt-2 mb-20 max-w-[880px]">
        <div className="overflow-hidden rounded-[16px] border border-amber-300 bg-amber-50/60 shadow-[0_1px_2px_rgba(10,10,10,.04),0_8px_24px_rgba(146,64,14,.06)]">
          <div className="flex flex-wrap items-center gap-3 border-b border-amber-300/70 px-[22px] pt-6 pb-5 max-[520px]:px-5">
            <span className="inline-flex size-[42px] shrink-0 items-center justify-center rounded-[10px] border border-amber-300 bg-white text-ink shadow-[inset_0_1px_0_rgba(255,255,255,.72)]">
              <ChatGPTMark />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2.5">
                <h2 className="m-0 text-[19px] font-semibold text-ink">ChatGPT Desktop App</h2>
                <span className="inline-flex rotate-[-1.5deg] items-center gap-1.5 rounded-md border border-amber-300 bg-amber-50 px-[9px] py-1 text-[11px] font-semibold uppercase tracking-[.05em] text-amber-900 shadow-[0_1px_0_rgba(255,255,255,.85)_inset,0_1px_2px_rgba(146,64,14,.12)]">
                  <span className="size-1.5 rounded-full bg-amber-500" />
                  Alpha
                </span>
              </div>
              <p className="m-0 mt-1.5 text-[14.5px] leading-normal text-muted">
                Also works with the ChatGPT desktop app. Unlike the per-run CLI wrappers above, this
                persistently patches ChatGPT Desktop config so the app talks to Together. When you
                want your OpenAI subscription back, run the restore command.
              </p>
            </div>
          </div>
          <div className="grid gap-px bg-amber-300/70 sm:grid-cols-2">
            {codexAppCommands.map((entry) => (
              <div
                key={entry.command}
                className="flex flex-col gap-2 bg-amber-50/60 px-[22px] py-5 max-[520px]:px-5"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[12.5px] font-semibold uppercase tracking-[.05em] text-amber-900/80">
                    {entry.label}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => handleCopyExplicitCommand(entry.command)}
                  aria-label={`Copy ${entry.command}`}
                  className="group flex min-h-10 cursor-pointer items-center gap-2 rounded-lg border border-amber-300 bg-white px-3 py-2 text-left font-mono text-[13px] text-ink transition hover:border-amber-500 active:scale-[.98] data-[copied=true]:border-ink data-[copied=true]:bg-ink data-[copied=true]:text-white"
                  data-copied={copiedExplicitCommand === entry.command}
                >
                  <span className="select-none text-faint group-data-[copied=true]:text-white/70">
                    $
                  </span>
                  <code className="min-w-0 flex-1 truncate [overflow-wrap:anywhere]">
                    {entry.command}
                  </code>
                  <span
                    className="inline-flex size-4 shrink-0 items-center justify-center text-faint data-[copied=true]:text-white"
                    data-copied={copiedExplicitCommand === entry.command}
                    aria-hidden="true"
                  >
                    {copiedExplicitCommand === entry.command ? <CheckMark /> : <CopyMark />}
                  </span>
                </button>
                <p className="m-0 text-[13px] leading-snug text-muted">{entry.description}</p>
              </div>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-amber-300/70 px-[22px] py-3.5 text-[12.5px] text-muted max-[520px]:px-5">
            <span className="font-medium text-amber-900/80">Heads up</span>
            <span>
              Configure stays active until you restore. Backups live under{" "}
              <code className="rounded-md border border-amber-300 bg-white px-[7px] py-0.5 font-mono text-[12px] text-ink">
                ~/.togetherlink/backup/codex-app/
              </code>
              .
            </span>
          </div>
        </div>
      </section>

      <section className="mx-auto mt-2 mb-20 max-w-[880px]">
        <h2 className="m-0 mb-5 text-xl font-semibold text-ink">Get started</h2>
        <div className="mb-4 flex items-center gap-2 rounded-lg border border-line-strong bg-code px-3.5 py-2.5 font-mono text-[13px] text-ink shadow-[0_1px_2px_rgba(10,10,10,.04)] max-[520px]:grid max-[520px]:grid-cols-[auto_1fr] max-[520px]:items-start">
          <span className="select-none text-faint">$</span>
          <code className="min-w-0 flex-1 [overflow-wrap:anywhere]">
            <InstallCommandText />
          </code>
          <button
            type="button"
            onClick={handleCopy}
            aria-label="Copy install command"
            className="ml-auto min-h-10 cursor-pointer whitespace-nowrap rounded-lg border border-line-strong bg-white px-[13px] py-[7px] font-sans text-[13px] font-medium text-muted transition hover:border-ink hover:text-ink active:scale-95 data-[copied=true]:border-ink data-[copied=true]:bg-ink data-[copied=true]:text-white max-[520px]:col-span-2 max-[520px]:ml-0"
            data-copied={copyState === "copied"}
          >
            {copyState === "copied" ? "Copied" : copyState === "select" ? "Select Cmd+C" : "Copy"}
          </button>
        </div>
        <Step number="1">
          Install with the one-liner above. It drops the binary at <code>~/.togetherlink/bin/</code>{" "}
          and adds <code>togetherlink</code>, <code>tclaude</code>, <code>topencode</code>,{" "}
          <code>tcodex</code>, <code>tgrok</code>, and <code>tpi</code>.
        </Step>
        <Step number="2">
          Run <code>topencode</code>, <code>tclaude</code>, <code>tcodex</code>, <code>tgrok</code>,
          or <code>tpi</code>. For the ChatGPT desktop app run <code>togetherlink chatgpt</code>{" "}
          (alpha), and restore it with <code>togetherlink chatgpt --restore</code>. On first launch
          it asks once for your Together API key - press Enter to skip and add it later.
        </Step>
        <Step number="3">
          That's it. Your tool runs against Together models and stays up to date on its own. Change
          your mind? Just stop using it - no agent config was saved, so your subscriptions and your
          OpenCode/Claude Code/Codex CLI/Grok Build/Pi Code config are untouched.
        </Step>
      </section>

      <section className="mx-auto mb-20 max-w-[880px]" aria-labelledby="guides-heading">
        <div className="mb-5 flex items-end justify-between gap-4">
          <div>
            <span className="text-[12px] font-semibold tracking-[.07em] text-[#c2410c] uppercase">
              Step-by-step
            </span>
            <h2 id="guides-heading" className="m-0 mt-2 text-xl font-semibold text-ink">
              TogetherLink guides
            </h2>
          </div>
          <a className="text-sm font-medium text-muted hover:text-ink" href="/guides">
            View all →
          </a>
        </div>
        <div className="grid gap-3 md:grid-cols-3">
          {guideLinks.map((guide) => (
            <a
              key={guide.href}
              href={guide.href}
              className="group flex min-h-[190px] flex-col rounded-[14px] border border-line-strong bg-white p-[22px] transition-[border-color,box-shadow,transform] duration-150 hover:-translate-y-0.5 hover:border-faint hover:shadow-[0_1px_2px_rgba(10,10,10,.04),0_8px_24px_rgba(10,10,10,.05)] active:scale-[0.96]"
            >
              <span className="inline-flex size-10 items-center justify-center rounded-[10px] bg-code text-ink shadow-[inset_0_0_0_1px_rgba(229,231,235,.95)]">
                {guide.icon}
              </span>
              <span className="mt-4 font-mono text-[10.5px] text-faint uppercase">
                {guide.label}
              </span>
              <h3 className="m-0 mt-2 text-[16px] font-semibold text-balance group-hover:underline group-hover:underline-offset-4">
                {guide.title}
              </h3>
              <p className="m-0 mt-2 text-pretty text-[13px] leading-relaxed text-muted">
                {guide.body}
              </p>
            </a>
          ))}
        </div>
      </section>

      <footer className="border-t border-line py-8 pb-14 text-sm text-faint">
        <div className="mb-2.5 flex flex-wrap gap-[22px] text-muted">
          <a className="transition-colors hover:text-ink" href="/guides">
            Guides
          </a>
          <a className="transition-colors hover:text-ink" href={githubUrl}>
            GitHub
          </a>
          <a className="transition-colors hover:text-ink" href={`${githubUrl}#readme`}>
            Docs
          </a>
          <a className="transition-colors hover:text-ink" href="/llms.txt">
            LLM docs
          </a>
          <a
            className="transition-colors hover:text-ink"
            href={togetherReferralUrl}
            target="_blank"
            rel="noopener noreferrer"
          >
            Together AI
          </a>
          <a
            className="transition-colors hover:text-ink"
            href="https://opencode.ai"
            target="_blank"
            rel="noopener noreferrer"
          >
            OpenCode
          </a>
          <a
            className="transition-colors hover:text-ink"
            href="https://github.com/openai/codex"
            target="_blank"
            rel="noopener noreferrer"
          >
            Codex CLI
          </a>
          <a
            className="transition-colors hover:text-ink"
            href="https://github.com/xai-org/grok-build"
            target="_blank"
            rel="noopener noreferrer"
          >
            Grok Build
          </a>
        </div>
        <p className="m-0 text-[13px]">{version}</p>
      </footer>
    </main>
  );
}

async function copyText(text: string) {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return;
    } catch {}
  }

  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.left = "-9999px";
  document.body.appendChild(textarea);
  textarea.select();

  try {
    if (!document.execCommand("copy")) {
      throw new Error("Copy command failed");
    }
  } finally {
    document.body.removeChild(textarea);
  }
}

function formatReleaseAge(publishedAt: string | undefined) {
  if (!publishedAt) return null;

  const timestamp = new Date(publishedAt).getTime();
  if (!Number.isFinite(timestamp)) return null;

  const diffMs = Math.max(0, Date.now() - timestamp);
  const minute = 60 * 1000;
  const hour = 60 * minute;
  const day = 24 * hour;
  const week = 7 * day;

  if (diffMs < minute) return "just now";
  if (diffMs < hour) return `${Math.floor(diffMs / minute)}m ago`;
  if (diffMs < day) return `${Math.floor(diffMs / hour)}h ago`;
  if (diffMs < week) return `${Math.floor(diffMs / day)}d ago`;

  return `${Math.floor(diffMs / week)}w ago`;
}

function InstallCommandText() {
  return (
    <>
      curl -fsSL https://togetherlink.vercel.app/
      <wbr />
      install.sh | sh
    </>
  );
}

function Step({ number, children }: Readonly<{ number: string; children: ReactNode }>) {
  return (
    <div className="flex items-baseline gap-[18px] border-t border-line py-[18px] first:border-t-0 first:pt-1">
      <span className="min-w-[18px] text-sm font-semibold text-faint">{number}</span>
      <div className="text-[15px] text-muted [&_code]:rounded-md [&_code]:border [&_code]:border-line-strong [&_code]:bg-code [&_code]:px-[7px] [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-[13px] [&_code]:text-ink">
        {children}
      </div>
    </div>
  );
}

function ProofCard({ item }: Readonly<{ item: ProofItem }>) {
  const content = (
    <>
      <div className="flex items-center gap-2 text-[20px] font-semibold leading-none text-ink tabular-nums">
        {item.icon ? <span className="inline-flex size-5">{item.icon}</span> : null}
        {item.value}
      </div>
      <div className="mt-1.5 text-[12.5px] font-medium leading-snug text-muted">{item.label}</div>
    </>
  );
  const className =
    "rounded-[12px] bg-code px-4 py-3 text-left shadow-[inset_0_0_0_1px_rgba(229,231,235,.9)] max-[380px]:px-3.5";

  if (item.href) {
    return (
      <a
        className={`${className} transition-[background-color,box-shadow,transform] duration-150 hover:bg-white hover:shadow-[inset_0_0_0_1px_rgba(209,213,219,.95),0_8px_20px_-16px_rgba(10,10,10,.32)] active:scale-[0.96]`}
        href={item.href}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="See togetherlink on GitHub"
      >
        {content}
      </a>
    );
  }

  return <div className={className}>{content}</div>;
}

function HeroTool({
  name,
  command,
  icon,
  index,
}: Readonly<{
  name: string;
  command: string;
  icon: ReactNode;
  index: number;
}>) {
  return (
    <div
      className={`${heroToolPositions[index]} z-10 flex min-w-[170px] items-center gap-3 rounded-[16px] bg-white px-3.5 py-3 text-left shadow-[0_1px_2px_rgba(10,10,10,.05),0_18px_50px_-30px_rgba(10,10,10,.34),inset_0_0_0_1px_rgba(229,231,235,.95)] transition-transform duration-200 ease-out hover:-translate-y-0.5 max-[680px]:min-w-0 max-[680px]:gap-2.5 max-[680px]:rounded-[12px] max-[680px]:px-3 max-[680px]:py-2.5 max-[380px]:w-full`}
    >
      <span className="inline-flex size-[40px] shrink-0 items-center justify-center rounded-[10px] bg-code text-ink shadow-[inset_0_0_0_1px_rgba(229,231,235,.95)]">
        {icon}
      </span>
      <span className="min-w-0">
        <span className="block text-[14px] leading-tight font-semibold text-ink">{name}</span>
        <code className="mt-0.5 block truncate font-mono text-[12px] text-muted">{command}</code>
      </span>
    </div>
  );
}

function OpenCodeMark() {
  return (
    <svg className="h-7 w-[22px]" viewBox="0 0 240 300" fill="none" aria-hidden="true">
      <path d="M180 240H60V120H180V240Z" fill="#CFCECD" />
      <path d="M180 60H60V240H180V60ZM240 300H0V0H240V300Z" fill="#211E1E" />
    </svg>
  );
}

function ChatGPTHeroMark() {
  return (
    <img
      className="block size-[40px] rounded-[10px] object-cover"
      src="/chatgpt-icon.png"
      alt=""
      aria-hidden="true"
    />
  );
}

function PiMark() {
  return (
    <svg className="size-[26px]" viewBox="0 0 800 800" aria-hidden="true">
      <path
        fill="currentColor"
        fillRule="evenodd"
        d="M165.29 165.29H517.36V400H400V517.36H282.65V634.72H165.29ZM282.65 282.65V400H400V282.65Z"
      />
      <path fill="currentColor" d="M517.36 400H634.72V634.72H517.36Z" />
    </svg>
  );
}

function GitHubMark({ className = "size-5" }: { className?: string } = {}) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 .7a11.5 11.5 0 0 0-3.64 22.41c.58.11.79-.25.79-.56v-2.24c-3.22.7-3.9-1.37-3.9-1.37-.53-1.34-1.29-1.7-1.29-1.7-1.05-.72.08-.71.08-.71 1.17.08 1.78 1.2 1.78 1.2 1.04 1.78 2.72 1.27 3.38.97.1-.75.4-1.27.74-1.56-2.57-.29-5.27-1.28-5.27-5.68 0-1.26.45-2.28 1.2-3.09-.12-.29-.52-1.47.11-3.05 0 0 .97-.31 3.16 1.18A10.96 10.96 0 0 1 12 6.11c.98 0 1.96.13 2.87.39 2.19-1.49 3.16-1.18 3.16-1.18.63 1.58.23 2.76.11 3.05.75.81 1.2 1.83 1.2 3.09 0 4.41-2.71 5.38-5.29 5.67.42.36.79 1.06.79 2.14v3.28c0 .31.21.68.8.56A11.5 11.5 0 0 0 12 .7Z" />
    </svg>
  );
}

function CopyMark() {
  return (
    <svg className="size-[15px]" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="8" y="8" width="11" height="11" rx="2" stroke="currentColor" strokeWidth="1.8" />
      <path
        d="M5 15.5V6.8C5 5.8 5.8 5 6.8 5h8.7"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

function CheckMark() {
  return (
    <svg className="size-[15px]" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M5 12.5l4.2 4L19 7.5"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
