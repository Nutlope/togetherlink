import { createFileRoute } from '@tanstack/react-router'
import type { ReactNode } from 'react'
import { useEffect, useRef, useState } from 'react'

const installCommand = 'curl -fsSL https://togetherlink.vercel.app/install.sh | sh'

const features = [
  {
    title: 'OpenCode',
    tag: '100% supported',
    tagTone: 'live',
    body: (
      <>
        Run <code>topencode</code> and OpenCode launches with Together GLM 5.2
        wired in - config injected into an ephemeral session, nothing written
        to disk. Close it and your OpenCode setup is exactly as it was.
      </>
    ),
    supportLabel: 'Status',
    supportValue: '100%',
    icon: <OpenCodeMark />,
    accent: undefined,
  },
  {
    title: 'Claude Code',
    tag: 'Beta',
    tagTone: 'beta',
    body: (
      <>
        Run <code>tclaude</code> and Claude Code routes through a local
        translation proxy - no edits to your real config. You keep your Claude
        Code subscription and login the whole time.
      </>
    ),
    icon: <ClaudeMark />,
    accent: undefined,
  },
  {
    title: 'Codex',
    tag: 'Beta',
    tagTone: 'beta',
    body: (
      <>
        Run <code>tcodex</code> and Codex talks to Together through a local
        Responses-to-chat proxy. Terminal sessions stay ephemeral, with
        headless <code>exec</code> support for fast checks.
      </>
    ),
    icon: <CodexMark />,
    accent: undefined,
  },
  {
    title: 'Pi Code',
    tag: '100% supported',
    tagTone: 'live',
    body: (
      <>
        Run <code>tpi</code> and Pi Code launches with Pi's official Together
        provider, an ephemeral session, and a temporary Pi config directory.
      </>
    ),
    supportLabel: 'Status',
    supportValue: '100%',
    icon: <PiMark />,
    accent: undefined,
  },
]

export const Route = createFileRoute('/')({
  component: Home,
})

function Home() {
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'select'>(
    'idle',
  )
  const [version, setVersion] = useState('Apache-2.0')
  const commandRef = useRef<HTMLElement>(null)

  useEffect(() => {
    fetch('/latest.json', { cache: 'no-store' })
      .then((response) => response.json())
      .then((manifest: { version?: string }) => {
        if (manifest.version) setVersion(`v${manifest.version} - Apache-2.0`)
      })
      .catch(() => {})
  }, [])

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(installCommand)
      setCopyState('copied')
      window.setTimeout(() => setCopyState('idle'), 1400)
    } catch {
      const command = commandRef.current
      if (command) {
        const range = document.createRange()
        range.selectNode(command)
        window.getSelection()?.removeAllRanges()
        window.getSelection()?.addRange(range)
      }
      setCopyState('select')
      window.setTimeout(() => setCopyState('idle'), 1600)
    }
  }

  return (
    <main className="mx-auto max-w-[1120px] px-6 max-[520px]:px-[18px]">
      <header className="flex items-center gap-2.5 pt-6 max-[520px]:flex-wrap max-[520px]:gap-y-3.5">
        <a
          href="https://www.together.ai/"
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Together AI"
          className="opacity-90 transition-opacity hover:opacity-100"
        >
          <img
            className="block h-[22px] w-auto"
            src="/together-ai.png"
            alt="Together AI"
          />
        </a>
        <span className="h-[18px] w-px bg-line" />
        <div className="flex items-center gap-2 text-base font-semibold text-ink">
          <img
            className="block size-[22px]"
            src="/togetherlink-logo.svg"
            alt=""
            aria-hidden="true"
          />
          togetherlink
        </div>
        <nav className="ml-auto flex gap-[22px] text-sm font-medium text-muted max-[520px]:ml-0 max-[520px]:basis-full max-[520px]:gap-[18px]">
          <a
            className="transition-colors hover:text-ink"
            href="https://github.com/riccardogiorato"
          >
            GitHub
          </a>
          <a
            className="transition-colors hover:text-ink"
            href="https://api.together.ai/settings/api-keys"
            target="_blank"
            rel="noopener noreferrer"
          >
            API keys
          </a>
        </nav>
      </header>

      <section className="py-[88px] pb-4 text-center max-[520px]:pt-16">
        <span className="mb-7 inline-block rounded-full border border-line-strong bg-white px-3.5 py-1.5 text-[13px] font-medium text-muted">
          Together AI - for OpenCode, Claude Code, Codex & Pi Code
        </span>
        <h1 className="m-0 text-balance text-[clamp(34px,6vw,52px)] font-semibold leading-[1.08] text-ink">
          Together models,
          <br />
          right inside your editor.
        </h1>
        <p className="mx-auto mt-5 mb-9 max-w-[560px] text-pretty text-[19px] leading-normal text-muted">
          One tiny, always-current binary. Run{' '}
          <code className="text-ink">topencode</code> or{' '}
          <code className="text-ink">tclaude</code> or{' '}
          <code className="text-ink">tcodex</code> or{' '}
          <code className="text-ink">tpi</code> and your existing tools route
          through Together AI models - no proxy to run, no config to write.
        </p>

        <div className="mx-auto mb-4 flex max-w-[600px] items-center gap-3 rounded-xl border border-line-strong bg-code py-4 pr-4 pl-[18px] text-left font-mono text-sm shadow-[0_1px_2px_rgba(10,10,10,.04),0_8px_24px_rgba(10,10,10,.05)]">
          <span className="select-none text-faint">$</span>
          <code
            ref={commandRef}
            className="min-w-0 flex-1 [overflow-wrap:anywhere] text-[clamp(10px,2.4vw,14px)] leading-snug text-ink sm:whitespace-nowrap"
          >
            {installCommand}
          </code>
          <button
            type="button"
            onClick={handleCopy}
            aria-label="Copy install command"
            className="min-w-[58px] cursor-pointer whitespace-nowrap rounded-lg border border-line-strong bg-white px-[13px] py-[7px] font-sans text-[13px] font-medium text-muted transition hover:border-ink hover:text-ink active:scale-95 data-[copied=true]:border-ink data-[copied=true]:bg-ink data-[copied=true]:text-white"
            data-copied={copyState === 'copied'}
          >
            {copyState === 'copied'
              ? 'Copied'
              : copyState === 'select'
                ? 'Select Cmd+C'
                : 'Copy'}
          </button>
        </div>
        <div className="text-[13px] text-faint">
          macOS & Linux - installs Bun for you if needed - keeps itself up to
          date
        </div>

        <div className="mx-auto mt-8 max-w-[680px] overflow-hidden rounded-[18px] border border-emerald-200/70 bg-[linear-gradient(135deg,#f0fdf4_0%,#f7fee7_55%,#ffffff_100%)] text-left shadow-[0_1px_2px_rgba(10,10,10,.04),0_10px_30px_-12px_rgba(16,185,129,.18)]">
          <div className="flex flex-col gap-4 px-5 py-5 sm:flex-row sm:items-center sm:gap-5">
            <span className="inline-flex size-[34px] shrink-0 items-center justify-center rounded-full border border-emerald-300/70 bg-white text-emerald-600 shadow-[inset_0_1px_0_rgba(255,255,255,.8)]">
              <ShieldMark />
            </span>
            <p className="m-0 text-[14.5px] leading-relaxed text-muted">
              <strong className="font-semibold text-ink">
                Non-destructive by design.
              </strong>{' '}
              Every change happens in an ephemeral session - nothing is saved to
              disk, no files are rewritten. Your subscriptions and your existing
              OpenCode, Claude Code, Codex, or Pi Code config are never touched. Install
              and drop it any time; everything goes back exactly as it was.
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-y-2 border-t border-emerald-200/70 bg-white/55 px-5 py-3 text-[12px] font-medium text-muted max-[620px]:justify-start max-[620px]:gap-x-4">
            <Guarantee icon={<NoDiskMark />} label="Nothing written to disk" />
            <Guarantee icon={<NoDiskMark />} label="No config overwritten" />
            <Guarantee icon={<NoDiskMark />} label="Auto-updates atomically" />
            <Guarantee icon={<NoDiskMark />} label="Keep your subscription" />
          </div>
        </div>
      </section>

      <section className="mt-[52px] mb-[72px] grid grid-cols-[repeat(auto-fit,minmax(250px,1fr))] gap-3.5">
        {features.map((feature) => (
          <article
            key={feature.title}
            className="flex h-full flex-col rounded-[14px] border border-line-strong bg-white px-[22px] pt-6 pb-[22px] transition hover:border-faint hover:shadow-[0_1px_2px_rgba(10,10,10,.04),0_8px_24px_rgba(10,10,10,.05)]"
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
                <span className="size-1.5 rounded-full bg-faint data-[tone=beta]:bg-amber-500 data-[tone=dark]:bg-ink data-[tone=live]:bg-green-500" data-tone={feature.tagTone} />
                {feature.tag}
              </span>
            </div>
            <h3 className="mt-3.5 mb-2 text-[17px] font-semibold text-ink">
              {feature.title}
            </h3>
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
          </article>
        ))}
      </section>

      <section className="mx-auto mt-2 mb-20 max-w-[880px]">
        <h2 className="m-0 mb-5 text-xl font-semibold text-ink">Get started</h2>
        <div className="mb-4 flex items-center gap-2 rounded-lg border border-line-strong bg-code px-3.5 py-2.5 font-mono text-[13px] text-ink shadow-[0_1px_2px_rgba(10,10,10,.04)]">
          <span className="select-none text-faint">$</span>
          <code className="min-w-0 flex-1 [overflow-wrap:anywhere]">
            {installCommand}
          </code>
        </div>
        <Step number="1">
          Install with the one-liner above. It drops the binary at{' '}
          <code>~/.togetherlink/bin/</code> and adds{' '}
          <code>togetherlink</code>, <code>tclaude</code>,{' '}
          <code>topencode</code>, <code>tcodex</code>, and <code>tpi</code>.
        </Step>
        <Step number="2">
          Run <code>topencode</code>, <code>tclaude</code>, or{' '}
          <code>tcodex</code>, or <code>tpi</code>. On first launch it asks
          once for your Together API key - press Enter to skip and add it later.
        </Step>
        <Step number="3">
          That's it. Your tool runs against Together models and stays up to date
          on its own. Change your mind? Just stop using it - nothing was saved,
          so your subscriptions and your OpenCode/Claude Code/Codex/Pi Code config are
          untouched.
        </Step>
        <p className="m-0 border-t border-line pt-[18px] text-[15px] leading-relaxed text-muted [&_code]:rounded-md [&_code]:border [&_code]:border-line-strong [&_code]:bg-code [&_code]:px-[7px] [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-[13px] [&_code]:text-ink">
          Prefer explicit commands? Use <code>togetherlink opencode</code>,{' '}
          <code>togetherlink claude</code>, <code>togetherlink codex</code>, or{' '}
          <code>togetherlink pi</code> instead of the short wrappers.
        </p>
      </section>

      <footer className="border-t border-line py-8 pb-14 text-sm text-faint">
        <div className="mb-2.5 flex flex-wrap gap-[22px] text-muted">
          <a className="transition-colors hover:text-ink" href="https://github.com/riccardogiorato">
            GitHub
          </a>
          <a
            className="transition-colors hover:text-ink"
            href="https://github.com/riccardogiorato/togetherlink#readme"
          >
            Docs
          </a>
          <a
            className="transition-colors hover:text-ink"
            href="https://api.together.ai"
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
            Codex
          </a>
        </div>
        <p className="m-0 text-[13px]">{version}</p>
      </footer>
    </main>
  )
}

function Step({
  number,
  children,
}: Readonly<{ number: string; children: ReactNode }>) {
  return (
    <div className="flex items-baseline gap-[18px] border-t border-line py-[18px] first:border-t-0 first:pt-1">
      <span className="min-w-[18px] text-sm font-semibold text-faint">
        {number}
      </span>
      <div className="text-[15px] text-muted [&_code]:rounded-md [&_code]:border [&_code]:border-line-strong [&_code]:bg-code [&_code]:px-[7px] [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-[13px] [&_code]:text-ink">
        {children}
      </div>
    </div>
  )
}

function OpenCodeMark() {
  return (
    <svg className="h-7 w-[22px]" viewBox="0 0 240 300" fill="none" aria-hidden="true">
      <path d="M180 240H60V120H180V240Z" fill="#CFCECD" />
      <path d="M180 60H60V240H180V60ZM240 300H0V0H240V300Z" fill="#211E1E" />
    </svg>
  )
}

function ClaudeMark() {
  return (
    <svg className="size-[26px]" viewBox="0 0 1200 1200" aria-hidden="true">
      <path
        fill="#d97757"
        d="M233.96 800.215 468.644 668.537l3.947-11.436-3.947-6.363h-11.436l-39.221-2.416-134.094-3.624-116.296-4.832-112.671-6.04-28.349-6.041L0 592.752l2.738-17.477 23.839-16.027 34.148 2.98 75.463 5.155 113.235 7.812 82.148 4.832 121.691 12.644h19.329l2.738-7.812-6.604-4.832-5.154-4.832-117.182-79.41-126.846-83.919-66.442-48.322-35.92-24.483-18.12-22.953-7.813-50.094 32.617-35.92 43.812 2.98 11.195 2.98 44.376 34.148 94.792 73.369 123.785 91.168 18.121 15.06 7.248-5.154.886-3.624-8.134-13.611-67.329-121.691-71.839-123.785-31.973-51.302-8.456-30.765c-2.98-12.644-5.154-23.275-5.154-36.241L312.322 13.208l20.537-6.604 49.53 6.604 20.859 18.121 30.765 70.389 49.852 110.819 77.316 150.684 22.631 44.698 12.08 41.396 4.511 12.645h7.812v-7.248l6.362-84.886 11.759-104.215 11.436-134.094 3.946-37.772 18.685-45.262L697.53 24l28.993 13.852L750.363 72l-3.302 22.067-14.175 92.134-27.785 144.322-18.121 96.645h10.55l12.081-12.081 48.886-64.912 82.148-102.685 36.241-40.752 42.282-45.02 27.141-21.423h51.302l37.772 56.134-16.913 57.987-52.832 67.007-43.812 56.778-62.819 84.564-39.221 67.651 3.624 5.396 9.342-.886 141.906-30.201 76.671-13.852 91.49-15.705 41.396 19.329 4.51 19.651-16.268 40.188-97.852 24.161-114.765 22.953-170.899 40.429-2.094 1.53 2.416 2.98 76.993 7.248 32.94 1.772h80.617l150.121 11.195 39.221 25.933 23.517 31.732-3.946 24.161-60.403 30.765-81.503-19.329-190.228-45.262-65.235-16.268h-9.02v5.396l54.362 53.154 99.624 89.96 124.752 115.973 6.362 28.671-16.027 22.631-16.912-2.416-109.611-82.47-42.282-37.127-95.758-80.618h-6.363v8.456l22.067 32.295 116.537 175.168 6.04 53.718-8.456 17.476-30.201 10.55-33.181-6.04-68.215-95.758-70.389-107.839-56.779-96.644-6.926 3.946-33.503 360.886-15.705 18.443L565.53 1200l-30.201-22.953-16.027-37.127 16.027-73.369 19.329-95.758 15.705-76.107 14.174-94.55 8.456-31.41-.563-2.095-6.927.886-71.275 97.852-108.402 146.497-85.772 91.812-20.537 8.134-35.597-18.443 3.302-32.939 19.893-29.316 118.711-151.007 71.597-93.583 46.228-54.04-.323-7.812h-2.738L205.289 929.396l-56.135 7.248-24.161-22.63 2.98-37.128 11.436-12.081 94.792-65.234-.322.322Z"
      />
    </svg>
  )
}

function CodexMark() {
  return (
    <svg
      className="size-[30px]"
      height="1em"
      style={{ flex: 'none', lineHeight: 1 }}
      viewBox="2 2.7 20 18.7"
      width="1em"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <title>Codex</title>
      <path
        d="M9.064 3.344a4.578 4.578 0 012.285-.312c1 .115 1.891.54 2.673 1.275.01.01.024.017.037.021a.09.09 0 00.043 0 4.55 4.55 0 013.046.275l.047.022.116.057a4.581 4.581 0 012.188 2.399c.209.51.313 1.041.315 1.595a4.24 4.24 0 01-.134 1.223.123.123 0 00.03.115c.594.607.988 1.33 1.183 2.17.289 1.425-.007 2.71-.887 3.854l-.136.166a4.548 4.548 0 01-2.201 1.388.123.123 0 00-.081.076c-.191.551-.383 1.023-.74 1.494-.9 1.187-2.222 1.846-3.711 1.838-1.187-.006-2.239-.44-3.157-1.302a.107.107 0 00-.105-.024c-.388.125-.78.143-1.204.138a4.441 4.441 0 01-1.945-.466 4.544 4.544 0 01-1.61-1.335c-.152-.202-.303-.392-.414-.617a5.81 5.81 0 01-.37-.961 4.582 4.582 0 01-.014-2.298.124.124 0 00.006-.056.085.085 0 00-.027-.048 4.467 4.467 0 01-1.034-1.651 3.896 3.896 0 01-.251-1.192 5.189 5.189 0 01.141-1.6c.337-1.112.982-1.985 1.933-2.618.212-.141.413-.251.601-.33.215-.089.43-.164.646-.227a.098.098 0 00.065-.066 4.51 4.51 0 01.829-1.615 4.535 4.535 0 011.837-1.388zm3.482 10.565a.637.637 0 000 1.272h3.636a.637.637 0 100-1.272h-3.636zM8.462 9.23a.637.637 0 00-1.106.631l1.272 2.224-1.266 2.136a.636.636 0 101.095.649l1.454-2.455a.636.636 0 00.005-.64L8.462 9.23z"
        fill="url(#codex-mark-gradient)"
      />
      <defs>
        <linearGradient
          gradientUnits="userSpaceOnUse"
          id="codex-mark-gradient"
          x1="12"
          x2="12"
          y1="3"
          y2="21"
        >
          <stop stopColor="#B1A7FF" />
          <stop offset=".5" stopColor="#7A9DFF" />
          <stop offset="1" stopColor="#3941FF" />
        </linearGradient>
      </defs>
    </svg>
  )
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
  )
}

function ShieldMark() {
  return (
    <svg className="size-[17px]" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M12 3l7 2.5v5.2c0 4.6-3.1 8.9-7 10.3-3.9-1.4-7-5.7-7-10.3V5.5L12 3z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path
        d="M9 12l2 2 4-4.2"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function Guarantee({
  icon,
  label,
}: Readonly<{ icon: ReactNode; label: string }>) {
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
      <span className="text-emerald-500">{icon}</span>
      {label}
    </span>
  )
}

function NoDiskMark() {
  return (
    <svg className="size-[13px]" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M5 12.5l5 5 9-11"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}
