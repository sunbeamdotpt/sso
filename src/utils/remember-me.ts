const REMEMBER_KEY = "kratos:rememberMe";
const SESSION_KEY = "kratos:sessionActive";
const BROADCAST_CHANNEL = "kratos:sessionSync";

let broadcastChannel: BroadcastChannel | null = null;

function getBroadcastChannel(): BroadcastChannel | null {
  if (typeof window === "undefined") return null;
  if (!broadcastChannel && "BroadcastChannel" in window) {
    broadcastChannel = new BroadcastChannel(BROADCAST_CHANNEL);
    broadcastChannel.onmessage = (event) => {
      if (event.data?.type === "sessionActive" && event.data?.value) {
        try {
          sessionStorage.setItem(SESSION_KEY, event.data.value);
        } catch {
          // ignore
        }
      }
      if (event.data?.type === "requestSession") {
        try {
          const token = sessionStorage.getItem(SESSION_KEY);
          if (token) {
            broadcastChannel?.postMessage({
              type: "sessionActive",
              value: token,
            });
          }
        } catch {
          // ignore
        }
      }
    };
  }
  return broadcastChannel;
}

/**
 * Store the user's remember-me preference after login.
 * - remember=true: keep session across browser restarts
 * - remember=false: session is cleared when browser closes
 */
export function storeRememberMePreference(remember: boolean): void {
  try {
    localStorage.setItem(REMEMBER_KEY, String(remember));
    if (remember) {
      sessionStorage.removeItem(SESSION_KEY);
    } else {
      const token = crypto.randomUUID?.() ?? String(Date.now());
      sessionStorage.setItem(SESSION_KEY, token);
      getBroadcastChannel()?.postMessage({
        type: "sessionActive",
        value: token,
      });
    }
  } catch {
    // ignore storage errors
  }
}

/**
 * Request a session token from other tabs via BroadcastChannel.
 * Returns a promise that resolves when a token is received or times out.
 */
function requestSessionFromOtherTabs(timeoutMs = 100): Promise<string | null> {
  return new Promise((resolve) => {
    if (typeof window === "undefined" || !("BroadcastChannel" in window)) {
      resolve(null);
      return;
    }

    const channel = getBroadcastChannel();
    if (!channel) {
      resolve(null);
      return;
    }

    const handler = (event: MessageEvent) => {
      if (event.data?.type === "sessionActive" && event.data?.value) {
        channel.removeEventListener("message", handler);
        resolve(event.data.value as string);
      }
    };

    channel.addEventListener("message", handler);
    channel.postMessage({ type: "requestSession" });

    setTimeout(() => {
      channel.removeEventListener("message", handler);
      resolve(null);
    }, timeoutMs);
  });
}

/**
 * Check whether the current browsing session should be treated as valid.
 * Returns true if:
 *   - user checked "remember me" (persist across browser restarts)
 *   - user is in the same browsing session (sessionStorage intact or synced from another tab)
 * Returns false if:
 *   - user unchecked "remember me" AND browser was closed/reopened
 */
export async function isSessionValidForThisBrowsingSession(): Promise<boolean> {
  try {
    const rememberMe = localStorage.getItem(REMEMBER_KEY);
    const sessionActive = sessionStorage.getItem(SESSION_KEY);

    // No remember-me preference stored → backward compatibility, allow
    if (rememberMe === null) return true;

    // Remember me checked → always valid
    if (rememberMe === "true") return true;

    // Same browsing session (tab didn't close)
    if (sessionActive) return true;

    // Try to sync from another tab in the same browsing session
    const syncedToken = await requestSessionFromOtherTabs();
    if (syncedToken) {
      sessionStorage.setItem(SESSION_KEY, syncedToken);
      return true;
    }

    // No remember me AND new browsing session → invalid
    return false;
  } catch {
    return true; // fail open
  }
}

/**
 * Clear remember-me state on logout.
 */
export function clearRememberMeState(): void {
  try {
    localStorage.removeItem(REMEMBER_KEY);
    sessionStorage.removeItem(SESSION_KEY);
  } catch {
    // ignore
  }
}
