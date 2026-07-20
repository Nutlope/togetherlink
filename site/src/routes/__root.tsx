/// <reference types="vite/client" />
import type { ReactNode } from "react";
import { createRootRoute, HeadContent, Outlet, Scripts } from "@tanstack/react-router";
import appCss from "../styles/app.css?url";

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      {
        name: "google-site-verification",
        content: "hw2T7bF1pTb1gIVdn0dudbJ-RdGyOkp6hYt8LH5kaeA",
      },
      {
        title: "togetherlink - Together AI models in OpenCode, Claude Code, Codex & Pi Code",
      },
      {
        name: "description",
        content:
          "A single self-updating binary that routes OpenCode, Claude Code, Codex, and Pi Code through Together AI models.",
      },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "icon", href: "/favicon.ico", sizes: "any" },
      {
        rel: "icon",
        href: "/togetherlink-logo.svg",
        type: "image/svg+xml",
      },
      { rel: "apple-touch-icon", href: "/apple-touch-icon.png" },
      { rel: "llms-txt", href: "/llms.txt" },
    ],
  }),
  component: RootComponent,
});

function RootComponent() {
  return (
    <RootDocument>
      <Outlet />
    </RootDocument>
  );
}

function RootDocument({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}
