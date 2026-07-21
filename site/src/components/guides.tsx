import type { ReactNode } from "react";
import { useState } from "react";
import { guideOgPath, type GuideOgKey } from "../lib/guide-og";
import { GuideOgArtwork } from "./guide-og-artwork";

export const SITE_URL = "https://togetherlink.vercel.app";
export const GITHUB_URL = "https://github.com/Nutlope/togetherlink";
export const TOGETHER_API_KEY_URL = "https://api.together.ai/settings/api-keys";
export const INSTALL_COMMAND = "curl -fsSL https://togetherlink.vercel.app/install.sh | sh";

export type Faq = {
  question: string;
  answer: string;
};

export type GuideDefinition = {
  path: `/guides/${string}`;
  title: string;
  description: string;
  breadcrumbLabel: string;
  ogKey: GuideOgKey;
  ogAlt: string;
  datePublished: string;
  dateModified: string;
  faqs: Faq[];
};

export function defineGuide<const T extends GuideDefinition>(guide: T): T {
  return guide;
}

export function buildGuideHead(guide: GuideDefinition) {
  const url = SITE_URL + guide.path;
  const image = SITE_URL + guideOgPath(guide.ogKey);

  return {
    meta: [
      { title: guide.title },
      { name: "description", content: guide.description },
      { name: "robots", content: "index, follow, max-image-preview:large" },
      { name: "googlebot", content: "index, follow, max-image-preview:large" },
      { property: "og:type", content: "article" },
      { property: "og:site_name", content: "TogetherLink" },
      { property: "og:title", content: guide.title },
      { property: "og:description", content: guide.description },
      { property: "og:url", content: url },
      { property: "og:image", content: image },
      { property: "og:image:width", content: "1200" },
      { property: "og:image:height", content: "630" },
      { property: "og:image:alt", content: guide.ogAlt },
      { property: "article:published_time", content: guide.datePublished },
      { property: "article:modified_time", content: guide.dateModified },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: guide.title },
      { name: "twitter:description", content: guide.description },
      { name: "twitter:image", content: image },
      { name: "twitter:image:alt", content: guide.ogAlt },
    ],
    links: [{ rel: "canonical", href: url }],
  };
}

export function GuideShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-white text-ink">
      <GuideHeader />
      {children}
      <GuideFooter />
    </div>
  );
}

export function GuideArticlePage({
  guide,
  children,
}: {
  guide: GuideDefinition;
  children: ReactNode;
}) {
  return (
    <GuideShell>
      <main>
        <article>{children}</article>
        <GuideStructuredData guide={guide} />
      </main>
    </GuideShell>
  );
}

export function GuideHeader() {
  return (
    <header className="mx-auto flex max-w-[1120px] items-center gap-3 px-6 pt-6 max-[520px]:flex-wrap max-[520px]:px-[18px]">
      <a className="flex items-center gap-2 text-base font-semibold" href="/">
        <img className="size-[22px]" src="/togetherlink-logo.svg" alt="" aria-hidden="true" />
        togetherlink
      </a>
      <nav className="ml-auto flex items-center gap-5 text-sm font-medium text-muted max-[520px]:order-3 max-[520px]:ml-0 max-[520px]:basis-full">
        <a
          className="transition-colors hover:text-ink"
          href={GITHUB_URL}
          target="_blank"
          rel="noreferrer"
        >
          GitHub
        </a>
        <a
          className="transition-colors hover:text-ink"
          href={TOGETHER_API_KEY_URL}
          target="_blank"
          rel="noreferrer"
        >
          Get API key
        </a>
      </nav>
    </header>
  );
}

export function GuideFooter() {
  return (
    <footer className="mx-auto mt-24 max-w-[1120px] border-t border-line px-6 py-8 pb-14 text-sm text-faint max-[520px]:px-[18px]">
      <div className="mb-2.5 flex flex-wrap gap-x-6 gap-y-2 text-muted">
        <a className="hover:text-ink" href="/guides">
          All guides
        </a>
        <a className="hover:text-ink" href={GITHUB_URL}>
          GitHub
        </a>
        <a className="hover:text-ink" href="/llms.txt">
          LLM docs
        </a>
        <a className="hover:text-ink" href={TOGETHER_API_KEY_URL}>
          Together API key
        </a>
      </div>
      <p className="m-0 text-[13px]">Open source · MIT</p>
    </footer>
  );
}

export function Breadcrumbs({ guide }: { guide: GuideDefinition }) {
  return (
    <nav aria-label="Breadcrumb" className="mb-7 text-[13px] font-medium text-faint">
      <ol className="m-0 flex list-none items-center gap-2 p-0">
        <li>
          <a className="transition-colors hover:text-ink" href="/">
            Home
          </a>
        </li>
        <li aria-hidden="true">/</li>
        <li>
          <a className="transition-colors hover:text-ink" href="/guides">
            Guides
          </a>
        </li>
        <li aria-hidden="true">/</li>
        <li className="truncate text-muted" aria-current="page">
          {guide.breadcrumbLabel}
        </li>
      </ol>
    </nav>
  );
}

export function GuideByline({
  guide,
  className = "",
}: {
  guide: GuideDefinition;
  className?: string;
}) {
  const published = formatGuideDate(guide.datePublished);
  const modified = formatGuideDate(guide.dateModified);

  return (
    <p className={`m-0 mt-5 text-pretty text-[13px] leading-relaxed text-faint ${className}`}>
      By <span className="font-medium text-muted">TogetherLink</span>
      <span aria-hidden="true"> · </span>
      <time dateTime={guide.datePublished}>Published {published}</time>
      {guide.dateModified !== guide.datePublished ? (
        <>
          <span aria-hidden="true"> · </span>
          <time dateTime={guide.dateModified}>Updated {modified}</time>
        </>
      ) : null}
    </p>
  );
}

function formatGuideDate(value: string): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(value));
}

export type GuideCoverVariant = GuideOgKey;

export function GuideCover({
  variant,
  compact = false,
  className = "",
}: {
  variant: GuideCoverVariant;
  compact?: boolean;
  className?: string;
}) {
  return (
    <GuideOgArtwork
      guide={variant}
      className={`block aspect-[1200/630] h-auto w-full bg-code outline outline-1 -outline-offset-1 outline-black/10 ${compact ? "rounded-[12px]" : "rounded-[18px] max-[620px]:rounded-[14px]"} ${className}`}
      data-guide-cover={variant}
    />
  );
}

export function ApiKeyCallout({ compact = false }: { compact?: boolean }) {
  return (
    <aside
      className={`border-l-2 border-[#ff5200] ${compact ? "py-1 pl-4" : "py-1 pl-5"}`}
      aria-label="Together API key required"
    >
      <h2 className="m-0 text-[15px] font-semibold">A Together API key is required</h2>
      <p className="m-0 mt-1.5 text-[14px] leading-relaxed text-muted">
        Together AI runs and bills the model. Your OpenAI or Anthropic subscription does not cover
        these requests. Create a key in the Together dashboard, then save it with{" "}
        <code>togetherlink configure</code>.
      </p>
      <a
        className="mt-2.5 inline-flex text-[13px] font-semibold text-ink underline decoration-line-strong underline-offset-4 hover:decoration-ink"
        href={TOGETHER_API_KEY_URL}
        target="_blank"
        rel="noreferrer"
      >
        Create a Together API key →
      </a>
    </aside>
  );
}

export function CommandBlock({ command, label }: { command: string; label?: string }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(command);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1400);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div>
      {label ? (
        <div className="mb-1.5 text-[12px] font-semibold tracking-[.07em] text-faint uppercase">
          {label}
        </div>
      ) : null}
      <div className="flex min-h-11 items-stretch gap-2.5 rounded-[10px] bg-code px-3.5 py-0.5 font-mono text-[13px] shadow-[inset_0_0_0_1px_rgba(229,231,235,.95),0_1px_2px_rgba(10,10,10,.04)]">
        <span className="flex self-stretch select-none items-center leading-none text-faint">
          $
        </span>
        <code className="flex min-w-0 flex-1 self-stretch items-center">
          <span className="block min-w-0 whitespace-pre-wrap break-words leading-[1.45]">
            {command}
          </span>
        </code>
        <button
          className="relative min-h-10 cursor-pointer self-center px-2.5 py-0 font-sans text-[12px] leading-none font-semibold text-muted transition-[color,transform] before:absolute before:inset-x-0 before:inset-y-1 before:rounded-[7px] before:border before:border-line-strong before:bg-white before:content-[''] hover:text-ink hover:before:border-ink active:scale-[0.96]"
          type="button"
          onClick={copy}
          aria-label={`Copy ${command}`}
        >
          <span className="relative">{copied ? "Copied" : "Copy"}</span>
        </button>
      </div>
    </div>
  );
}

export function NumberedStep({
  number,
  title,
  children,
}: {
  number: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="grid grid-cols-[36px_1fr] gap-4 border-t border-line py-7 first:border-0 first:pt-0">
      <span className="inline-flex size-9 items-center justify-center rounded-[10px] bg-code font-mono text-[13px] font-semibold text-ink shadow-[inset_0_0_0_1px_rgba(229,231,235,.95),inset_0_1px_0_rgba(255,255,255,.72)]">
        {number}
      </span>
      <div>
        <h3 className="m-0 text-[18px] font-semibold">{title}</h3>
        <div className="mt-2 text-[15px] leading-relaxed text-muted [&_code]:text-ink">
          {children}
        </div>
      </div>
    </div>
  );
}

export function TerminalFigure({ kind, caption }: { kind: "codex" | "claude"; caption: string }) {
  const screenshot =
    kind === "codex"
      ? {
          src: "/guides/codex-glm-5-2-warp.png",
          width: 1612,
          height: 1012,
          alt: "Real Warp terminal running TogetherLink with Codex and GLM 5.2 in a TypeScript sample repository",
        }
      : {
          src: "/guides/claude-code-glm-5-2-warp.png",
          width: 1152,
          height: 712,
          alt: "Real Warp terminal running TogetherLink with Claude Code and GLM 5.2 in a TypeScript sample repository",
        };

  return (
    <figure className="m-0">
      <img
        className="block h-auto w-full rounded-[16px] bg-[#101114] outline outline-1 -outline-offset-1 outline-black/10 shadow-[0_18px_50px_-28px_rgba(10,10,10,.65)]"
        src={screenshot.src}
        width={screenshot.width}
        height={screenshot.height}
        alt={screenshot.alt}
      />
      <figcaption className="mt-3 text-[13px] leading-relaxed text-faint">{caption}</figcaption>
    </figure>
  );
}

export function FaqSection({ faqs }: { faqs: Faq[] }) {
  return (
    <section aria-labelledby="faq-heading">
      <div className="mb-6">
        <div className="text-[12px] font-semibold tracking-[.08em] text-muted uppercase">
          Common questions
        </div>
        <h2 id="faq-heading" className="m-0 mt-2 text-[28px] font-semibold tracking-[-.02em]">
          FAQ
        </h2>
      </div>
      <div className="border-t border-line-strong">
        {faqs.map((faq) => (
          <details key={faq.question} className="group border-b border-line-strong py-5">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-[16px] font-semibold [&::-webkit-details-marker]:hidden">
              {faq.question}
              <span className="text-xl font-normal text-faint transition-transform group-open:rotate-45">
                +
              </span>
            </summary>
            <p className="m-0 max-w-[720px] pt-3 text-[15px] leading-relaxed text-muted">
              {faq.answer}
            </p>
          </details>
        ))}
      </div>
    </section>
  );
}

export function GuideStructuredData({ guide }: { guide: GuideDefinition }) {
  const url = `${SITE_URL}${guide.path}`;
  const graph = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Article",
        headline: guide.title,
        description: guide.description,
        url,
        image: `${SITE_URL}${guideOgPath(guide.ogKey)}`,
        datePublished: guide.datePublished,
        dateModified: guide.dateModified,
        author: { "@type": "Organization", name: "TogetherLink", url: SITE_URL },
        publisher: {
          "@type": "Organization",
          name: "TogetherLink",
          url: SITE_URL,
          logo: {
            "@type": "ImageObject",
            url: `${SITE_URL}/togetherlink-logo.png`,
            width: 1024,
            height: 1024,
          },
        },
        mainEntityOfPage: { "@type": "WebPage", "@id": url },
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Home", item: SITE_URL },
          { "@type": "ListItem", position: 2, name: "Guides", item: `${SITE_URL}/guides` },
          { "@type": "ListItem", position: 3, name: guide.breadcrumbLabel, item: url },
        ],
      },
    ],
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(graph) }}
    />
  );
}

export function ArticleLink({
  href,
  eyebrow,
  title,
  body,
}: {
  href: string;
  eyebrow: string;
  title: string;
  body: string;
}) {
  return (
    <a
      href={href}
      className="group block border-l-2 border-line-strong py-1 pl-5 transition-[border-color] hover:border-[#ff5200]"
    >
      <span className="text-[11px] font-semibold tracking-[.08em] text-muted uppercase">
        {eyebrow}
      </span>
      <h3 className="m-0 mt-2 text-[17px] font-semibold group-hover:underline group-hover:underline-offset-4">
        {title}
      </h3>
      <p className="m-0 mt-2 text-[13.5px] leading-relaxed text-muted">{body}</p>
    </a>
  );
}

export function RelatedGuides({
  title = "Related guides",
  links,
  className = "mt-20",
}: {
  title?: string;
  links: Array<{ href: string; eyebrow: string; title: string; body: string }>;
  className?: string;
}) {
  return (
    <section className={className} aria-label={title}>
      <h2 className="m-0 text-[24px] font-semibold">{title}</h2>
      <div className="mt-5 grid gap-4 md:grid-cols-2">
        {links.map((link) => (
          <ArticleLink key={link.href} {...link} />
        ))}
      </div>
    </section>
  );
}
