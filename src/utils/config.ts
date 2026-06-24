// Runtime public UI configuration injected by the Rust backend into index.html.
// In local Vite dev the placeholder is not replaced, so we fall back to defaults.

export type RuntimeConfig = {
  /** Whether new account registration is exposed in the UI. */
  signupsEnabled?: boolean;
};

function loadRuntimeConfig(): RuntimeConfig {
  if (typeof document === "undefined") {
    return {};
  }

  const raw = document.documentElement.dataset.sunbeamConfig;
  if (!raw || raw.includes("%SUNBEAM_CONFIG%")) {
    return {};
  }

  try {
    return JSON.parse(raw) as RuntimeConfig;
  } catch {
    return {};
  }
}

const runtimeConfig = loadRuntimeConfig();

export const signupsEnabled = runtimeConfig.signupsEnabled ?? false;
