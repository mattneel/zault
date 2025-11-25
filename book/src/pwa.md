# PWA Chat App

Zault includes a Progressive Web App for post-quantum encrypted P2P chat, live at [zault.chat](https://zault.chat).

## Features

- **No accounts** - Your identity is a cryptographic keypair
- **End-to-end encrypted** - Messages decrypted only in your browser
- **Post-quantum secure** - ML-KEM-768 for key exchange
- **1:1 and group chat** - With key rotation on member removal
- **Offline-first** - Works without network, syncs when connected
- **30+ themes** - DaisyUI theme support
- **PWA** - Install on any device

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        Browser                               │
├─────────────────────────────────────────────────────────────┤
│  SolidJS UI                                                  │
│  ┌─────────────┬─────────────┬─────────────┬──────────────┐ │
│  │ Home        │ Chat        │ Groups      │ Settings     │ │
│  │ (Contacts)  │ (Messages)  │ (Group Chat)│ (Themes)     │ │
│  └─────────────┴─────────────┴─────────────┴──────────────┘ │
├─────────────────────────────────────────────────────────────┤
│  State Management                                            │
│  ┌─────────────┬─────────────┬─────────────┬──────────────┐ │
│  │ storage.ts  │ p2p.ts      │ sync.ts     │ settings.ts  │ │
│  │ (IndexedDB) │ (WebSocket) │ (CRDT)      │ (Prefs)      │ │
│  └─────────────┴─────────────┴─────────────┴──────────────┘ │
├─────────────────────────────────────────────────────────────┤
│  Crypto Layer (zault.wasm)                                   │
│  ┌─────────────┬─────────────┬─────────────┬──────────────┐ │
│  │ Identity    │ ML-KEM-768  │ ChaCha20    │ ML-DSA-65    │ │
│  │ Management  │ (1:1 Chat)  │ (Groups)    │ (Signatures) │ │
│  └─────────────┴─────────────┴─────────────┴──────────────┘ │
└─────────────────────────────────────────────────────────────┘
                              │
                              │ WebSocket
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  SolidStart Server (Signaling Only)                          │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │ WebSocket Handler                                        │ │
│  │ - Peer registration                                      │ │
│  │ - Message routing (encrypted payloads only)              │ │
│  │ - Presence notifications                                 │ │
│  │ - NO message storage, NO decryption                      │ │
│  └─────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

## Security Model

### What the Server CANNOT See

- Message contents (encrypted with ML-KEM-768 or ChaCha20)
- Private keys (never leave your device)
- Contact relationships (only short IDs, not full identities)
- Group memberships (encrypted group keys)

### What the Server CAN See

- Short peer IDs (first 16 chars of public key hash)
- Online/offline status
- Message routing metadata (who sends to whom)
- Timing information

### Key Management

**1:1 Chat:**
- Messages encrypted with ML-KEM-768 to recipient's public key
- Sender also encrypts to self for local storage
- Each message has unique encapsulated key

**Group Chat:**
- Shared symmetric key (ChaCha20-Poly1305)
- Key encrypted to each member's ML-KEM-768 public key
- Key rotation on member removal

## Development

### Prerequisites

- Bun 1.0+
- Node.js 18+ (for Playwright)

### Setup

```bash
cd pwa
bun install
```

### Development Server

```bash
bun run dev
# Opens http://localhost:3000
```

### Build

```bash
bun run build
# Output in .output/
```

### Testing

```bash
# Run all E2E tests
bunx playwright test

# Run specific test file
bunx playwright test tests/chat.spec.ts

# Run with UI
bunx playwright test --ui

# Debug mode
bunx playwright test --debug
```

### Test Coverage

| Suite | Tests | Coverage |
|-------|-------|----------|
| Identity | 5 | Generation, persistence, sharing |
| Contacts | 3 | Add via link/JSON, navigation |
| Chat | 5 | Send/receive, persistence, offline sync |
| Groups | 5 | Create, messaging, settings, members |
| Connection | 4 | Status, reconnection, peer count |

## Project Structure

```
pwa/
├── src/
│   ├── app.tsx              # Main app component
│   ├── app.css              # Global styles (DaisyUI)
│   ├── entry-client.tsx     # Client entry
│   ├── entry-server.tsx     # Server entry (SSR)
│   ├── ws.ts                # WebSocket signaling server
│   ├── lib/
│   │   ├── crypto.ts        # WASM wrapper
│   │   ├── storage.ts       # IndexedDB persistence
│   │   ├── p2p.ts           # WebSocket client
│   │   ├── sync.ts          # CRDT sync logic
│   │   ├── group-crypto.ts  # Group key management
│   │   └── settings.ts      # User preferences
│   ├── routes/
│   │   ├── index.tsx        # Home (contacts/groups)
│   │   ├── add.tsx          # Add contact
│   │   ├── settings.tsx     # Settings page
│   │   ├── chat/[id].tsx    # 1:1 chat
│   │   ├── group/new.tsx    # Create group
│   │   ├── group/[id].tsx   # Group chat
│   │   └── group-settings/[id].tsx
│   └── components/
│       └── OfflineIndicator.tsx
├── tests/
│   ├── helpers.ts           # Test utilities
│   ├── identity.spec.ts
│   ├── contacts.spec.ts
│   ├── chat.spec.ts
│   ├── groups.spec.ts
│   └── connection.spec.ts
├── public/
│   ├── zault.wasm           # Crypto module
│   └── icons/               # PWA icons
├── app.config.ts            # SolidStart + PWA config
├── playwright.config.ts     # Test config
├── fly.toml                 # Fly.io deployment
└── Dockerfile               # Container build
```

## Configuration

### `app.config.ts`

```typescript
import { defineConfig } from "@solidjs/start/config";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  server: {
    experimental: { websocket: true },
  },
  vite: {
    plugins: [
      VitePWA({
        registerType: "autoUpdate",
        manifest: {
          name: "Zault",
          short_name: "Zault",
          theme_color: "#1a1a2e",
          background_color: "#1a1a2e",
          display: "standalone",
        },
        workbox: {
          globPatterns: ["**/*.{js,css,html,wasm,png,svg,ico}"],
          navigateFallback: "/",
        },
      }),
    ],
  },
}).addRouter({
  name: "ws",
  type: "http",
  handler: "./src/ws.ts",
  target: "server",
  base: "/ws",
});
```

## Deployment

### Fly.io

```bash
# Install Fly CLI
curl -L https://fly.io/install.sh | sh

# Login
fly auth login

# Deploy
fly deploy
```

### `fly.toml`

```toml
app = 'zault-chat'
primary_region = 'iad'

[build]

[env]
  NODE_ENV = "production"

[http_service]
  internal_port = 3000
  force_https = true
  auto_stop_machines = 'off'
  min_machines_running = 1

  [http_service.http_options]
    h2_backend = false  # Required for WebSocket

[[vm]]
  size = 'shared-cpu-1x'
```

### Docker

```bash
docker build -t zault-pwa .
docker run -p 3000:3000 zault-pwa
```

## Theming

The PWA supports 30+ DaisyUI themes:

```typescript
// Available themes
const themes = [
  // Light
  "light", "cupcake", "bumblebee", "emerald", "corporate",
  "retro", "cyberpunk", "valentine", "garden", "lofi",
  "pastel", "fantasy", "wireframe", "cmyk", "autumn",
  "acid", "lemonade", "winter", "nord",
  // Dark
  "dark", "synthwave", "halloween", "forest", "aqua",
  "black", "luxury", "dracula", "night", "coffee",
  "dim", "sunset", "zault"  // Custom dark theme
];
```

Users can select themes in Settings. The choice persists in IndexedDB.

## Offline Support

The PWA works offline with:

1. **Service Worker** - Caches all static assets
2. **IndexedDB** - Stores identity, contacts, messages
3. **CRDT Sync** - Merges messages when back online

### Sync Protocol

```
Alice (offline)          Server          Bob (online)
     │                     │                  │
     │ ─── send msg ───▶   │                  │
     │     (queued)        │                  │
     │                     │                  │
     │ ◀── peer_online ─── │ ◀─ Bob comes ─── │
     │                     │                  │
     │ ─── sync_request ─▶ │ ─── forward ───▶ │
     │                     │                  │
     │ ◀── sync_response ─ │ ◀── response ─── │
     │     (merge)         │                  │
```

## Contributing

See the main [CONTRIBUTING.md](../CONTRIBUTING.md) for guidelines.

### Running Tests Locally

```bash
cd pwa
bun install
bunx playwright install  # Install browsers

# Run tests
bunx playwright test

# With headed browsers
bunx playwright test --headed
```

