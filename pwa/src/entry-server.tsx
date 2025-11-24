// @refresh reload
import { createHandler, StartServer } from "@solidjs/start/server";

export default createHandler(() => (
  <StartServer
    document={({ assets, children, scripts }) => (
      <html lang="en" data-theme="dark">
        <head>
          <meta charset="utf-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
          <meta name="theme-color" content="#1a1a2e" />
          <meta name="description" content="Post-quantum encrypted P2P messaging" />
          
          {/* PWA */}
          <link rel="manifest" href="/manifest.webmanifest" />
          <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
          <link rel="icon" href="/favicon-32x32.png" type="image/png" sizes="32x32" />
          <link rel="icon" href="/favicon-16x16.png" type="image/png" sizes="16x16" />
          <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
          
          {/* iOS PWA */}
          <meta name="mobile-web-app-capable" content="yes" />
          <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
          <meta name="apple-mobile-web-app-title" content="Zault" />
          
          {assets}
          
          {/* Theme initialization - runs before React to prevent flash */}
          <script innerHTML={`
            (function() {
              try {
                var theme = localStorage.getItem('zault_settings');
                if (theme) {
                  var parsed = JSON.parse(theme);
                  if (parsed && parsed.theme) {
                    document.documentElement.setAttribute('data-theme', parsed.theme);
                  }
                }
              } catch (e) {}
            })();
          `} />
        </head>
        <body>
          <div id="app">{children}</div>
          {scripts}
        </body>
      </html>
    )}
  />
));
