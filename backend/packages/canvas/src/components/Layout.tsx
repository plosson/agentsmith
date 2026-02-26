import type { FC, PropsWithChildren } from "hono/jsx";

type LayoutProps = PropsWithChildren<{
  title: string;
}>;

export const Layout: FC<LayoutProps> = ({ title, children }) => (
  <html lang="en">
    <head>
      <meta charset="UTF-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <title>{title} — AgentSmith</title>

      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="anonymous" />
      <link
        href="https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600;700&family=Fira+Mono:wght@400;500&display=swap"
        rel="stylesheet"
      />

      <script src="https://cdn.tailwindcss.com"></script>
      <script
        dangerouslySetInnerHTML={{
          __html: `
            tailwind.config = {
              theme: {
                extend: {
                  fontFamily: {
                    sans: ['Geist', 'system-ui', 'sans-serif'],
                    mono: ['Fira Mono', 'monospace'],
                  }
                }
              }
            }
          `,
        }}
      />

      <script src="https://unpkg.com/htmx.org@2.0.8"></script>
      <script defer src="https://unpkg.com/alpinejs@3.15.3/dist/cdn.min.js"></script>
    </head>
    <body class="font-sans bg-gray-50 text-gray-900 min-h-screen">
      <header class="border-b border-gray-200 bg-white px-6 py-4">
        <div class="flex items-center gap-3">
          <a href="/" class="text-lg font-semibold tracking-tight">AgentSmith</a>
          <span class="text-sm text-gray-400">Canvas</span>
        </div>
      </header>
      <main class="max-w-5xl mx-auto px-6 py-8">{children}</main>
    </body>
  </html>
);
