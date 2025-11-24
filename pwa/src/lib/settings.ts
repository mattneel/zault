/**
 * User settings and theme management
 */
import { createSignal, createEffect } from "solid-js";
import { isServer } from "solid-js/web";
import localforage from "localforage";

// All built-in daisyUI themes
export const DAISY_THEMES = [
  // Dark themes
  { name: "dark", label: "Dark", dark: true },
  { name: "night", label: "Night", dark: true },
  { name: "dracula", label: "Dracula", dark: true },
  { name: "synthwave", label: "Synthwave", dark: true },
  { name: "halloween", label: "Halloween", dark: true },
  { name: "forest", label: "Forest", dark: true },
  { name: "black", label: "Black", dark: true },
  { name: "luxury", label: "Luxury", dark: true },
  { name: "business", label: "Business", dark: true },
  { name: "coffee", label: "Coffee", dark: true },
  { name: "dim", label: "Dim", dark: true },
  { name: "sunset", label: "Sunset", dark: true },
  { name: "abyss", label: "Abyss", dark: true },
  { name: "aqua", label: "Aqua", dark: true },
  
  // Light themes
  { name: "light", label: "Light", dark: false },
  { name: "cupcake", label: "Cupcake", dark: false },
  { name: "bumblebee", label: "Bumblebee", dark: false },
  { name: "emerald", label: "Emerald", dark: false },
  { name: "corporate", label: "Corporate", dark: false },
  { name: "retro", label: "Retro", dark: false },
  { name: "cyberpunk", label: "Cyberpunk", dark: false },
  { name: "valentine", label: "Valentine", dark: false },
  { name: "garden", label: "Garden", dark: false },
  { name: "lofi", label: "Lo-Fi", dark: false },
  { name: "pastel", label: "Pastel", dark: false },
  { name: "fantasy", label: "Fantasy", dark: false },
  { name: "wireframe", label: "Wireframe", dark: false },
  { name: "cmyk", label: "CMYK", dark: false },
  { name: "autumn", label: "Autumn", dark: false },
  { name: "acid", label: "Acid", dark: false },
  { name: "lemonade", label: "Lemonade", dark: false },
  { name: "winter", label: "Winter", dark: false },
  { name: "nord", label: "Nord", dark: false },
  { name: "caramellatte", label: "Caramel Latte", dark: false },
  { name: "silk", label: "Silk", dark: false },
] as const;

export type ThemeName = typeof DAISY_THEMES[number]["name"];

// Default theme
export const DEFAULT_THEME: ThemeName = "dark";

// Settings interface
export interface UserSettings {
  theme: ThemeName;
}

const DEFAULT_SETTINGS: UserSettings = {
  theme: DEFAULT_THEME,
};

// Settings store
const SETTINGS_KEY = "zault_settings";

// Create reactive settings signal
const [settings, setSettingsInternal] = createSignal<UserSettings>(DEFAULT_SETTINGS);

// Initialize settings from storage
export async function initSettings(): Promise<UserSettings> {
  if (isServer) return DEFAULT_SETTINGS;
  
  try {
    const stored = await localforage.getItem<UserSettings>(SETTINGS_KEY);
    if (stored) {
      // Merge with defaults to handle new settings added in updates
      const merged = { ...DEFAULT_SETTINGS, ...stored };
      setSettingsInternal(merged);
      applyTheme(merged.theme);
      return merged;
    }
  } catch (e) {
    console.error("[Settings] Failed to load:", e);
  }
  
  // Apply default theme
  applyTheme(DEFAULT_THEME);
  return DEFAULT_SETTINGS;
}

// Save settings to storage
async function saveSettings(newSettings: UserSettings): Promise<void> {
  if (isServer) return;
  
  try {
    await localforage.setItem(SETTINGS_KEY, newSettings);
  } catch (e) {
    console.error("[Settings] Failed to save:", e);
  }
}

// Update settings
export function updateSettings(updates: Partial<UserSettings>): void {
  const current = settings();
  const updated = { ...current, ...updates };
  setSettingsInternal(updated);
  saveSettings(updated);
  
  // Apply theme if changed
  if (updates.theme && updates.theme !== current.theme) {
    applyTheme(updates.theme);
  }
}

// Get current settings
export function getSettings(): UserSettings {
  return settings();
}

// Apply theme to document
export function applyTheme(theme: ThemeName): void {
  if (isServer) return;
  
  document.documentElement.setAttribute("data-theme", theme);
  
  // Update meta theme-color for mobile browsers
  const themeInfo = DAISY_THEMES.find(t => t.name === theme);
  const metaThemeColor = document.querySelector('meta[name="theme-color"]');
  if (metaThemeColor) {
    // Use dark color for dark themes, light for light themes
    metaThemeColor.setAttribute("content", themeInfo?.dark ? "#1a1a2e" : "#ffffff");
  }
}

// Get theme info
export function getThemeInfo(theme: ThemeName) {
  return DAISY_THEMES.find(t => t.name === theme);
}

// Check if current theme is dark
export function isDarkTheme(): boolean {
  const current = settings().theme;
  const info = getThemeInfo(current);
  return info?.dark ?? true;
}

// Export settings signal for reactive use
export { settings };

