import { A } from "@solidjs/router";
import { For, createSignal, onMount, Show } from "solid-js";
import { 
  settings, 
  updateSettings, 
  DAISY_THEMES, 
  type ThemeName,
  initSettings 
} from "~/lib/settings";
import { clearAllData } from "~/lib/storage";

export default function Settings() {
  const [confirmClear, setConfirmClear] = createSignal(false);
  const [cleared, setCleared] = createSignal(false);

  onMount(() => {
    initSettings();
  });

  const handleThemeChange = (theme: ThemeName) => {
    updateSettings({ theme });
  };

  const handleClearData = async () => {
    if (!confirmClear()) {
      setConfirmClear(true);
      return;
    }
    
    await clearAllData();
    setCleared(true);
    setConfirmClear(false);
    
    // Reload after a moment
    setTimeout(() => {
      window.location.href = "/";
    }, 1500);
  };

  const darkThemes = DAISY_THEMES.filter(t => t.dark);
  const lightThemes = DAISY_THEMES.filter(t => !t.dark);

  return (
    <div class="min-h-screen bg-base-100 flex flex-col">
      {/* Header */}
      <div class="navbar bg-base-200 border-b border-base-300">
        <div class="navbar-start">
          <A href="/" class="btn btn-ghost btn-sm btn-square">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
            </svg>
          </A>
        </div>
        <div class="navbar-center">
          <span class="text-lg font-semibold">Settings</span>
        </div>
        <div class="navbar-end" />
      </div>

      {/* Content */}
      <div class="flex-1 overflow-y-auto p-4 space-y-6">
        
        {/* Theme Section */}
        <div class="card bg-base-200">
          <div class="card-body">
            <h2 class="card-title text-base">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
              </svg>
              Theme
            </h2>
            
            <div class="form-control">
              <label class="label">
                <span class="label-text-alt text-base-content/60">
                  Current: {DAISY_THEMES.find(t => t.name === settings().theme)?.label}
                </span>
              </label>
              
              {/* Dark Themes */}
              <div class="mb-4">
                <div class="text-xs uppercase tracking-wide text-base-content/50 mb-2">Dark</div>
                <div class="grid grid-cols-3 sm:grid-cols-4 gap-2">
                  <For each={darkThemes}>
                    {(theme) => (
                      <button
                        class={`btn btn-sm ${settings().theme === theme.name ? 'btn-primary' : 'btn-ghost'}`}
                        onClick={() => handleThemeChange(theme.name)}
                      >
                        {theme.label}
                      </button>
                    )}
                  </For>
                </div>
              </div>
              
              {/* Light Themes */}
              <div>
                <div class="text-xs uppercase tracking-wide text-base-content/50 mb-2">Light</div>
                <div class="grid grid-cols-3 sm:grid-cols-4 gap-2">
                  <For each={lightThemes}>
                    {(theme) => (
                      <button
                        class={`btn btn-sm ${settings().theme === theme.name ? 'btn-primary' : 'btn-ghost'}`}
                        onClick={() => handleThemeChange(theme.name)}
                      >
                        {theme.label}
                      </button>
                    )}
                  </For>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* About Section */}
        <div class="card bg-base-200">
          <div class="card-body">
            <h2 class="card-title text-base">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              About
            </h2>
            
            <div class="space-y-2 text-sm">
              <div class="flex justify-between">
                <span class="text-base-content/60">Version</span>
                <span class="font-mono">0.2.0</span>
              </div>
              <div class="flex justify-between">
                <span class="text-base-content/60">Encryption</span>
                <span class="font-mono text-xs">ML-KEM-768 + ChaCha20</span>
              </div>
              <div class="flex justify-between">
                <span class="text-base-content/60">Signatures</span>
                <span class="font-mono text-xs">ML-DSA-65</span>
              </div>
            </div>
            
            <div class="divider my-2"></div>
            
            <div class="flex gap-2">
              <a 
                href="https://github.com/cryptodeal/zault" 
                target="_blank" 
                rel="noopener noreferrer"
                class="btn btn-ghost btn-sm flex-1"
              >
                GitHub
              </a>
              <a 
                href="https://zault.chat" 
                target="_blank" 
                rel="noopener noreferrer"
                class="btn btn-ghost btn-sm flex-1"
              >
                Website
              </a>
            </div>
          </div>
        </div>

        {/* Danger Zone */}
        <div class="card bg-base-200 border border-error/20">
          <div class="card-body">
            <h2 class="card-title text-base text-error">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              Danger Zone
            </h2>
            
            <p class="text-sm text-base-content/60">
              Clear all local data including your identity, contacts, and messages. This cannot be undone.
            </p>
            
            <Show when={cleared()}>
              <div class="alert alert-success">
                <span>Data cleared. Redirecting...</span>
              </div>
            </Show>
            
            <Show when={!cleared()}>
              <button 
                class={`btn ${confirmClear() ? 'btn-error' : 'btn-outline btn-error'}`}
                onClick={handleClearData}
              >
                {confirmClear() ? "Confirm: Delete Everything" : "Clear All Data"}
              </button>
              
              <Show when={confirmClear()}>
                <button 
                  class="btn btn-ghost btn-sm"
                  onClick={() => setConfirmClear(false)}
                >
                  Cancel
                </button>
              </Show>
            </Show>
          </div>
        </div>

        {/* Bottom padding for safe area */}
        <div class="h-8"></div>
      </div>
    </div>
  );
}

