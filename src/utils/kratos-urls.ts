/**
 * Build the Kratos login browser-flow URL.
 *
 * Invariant: this must always include `refresh=true`. If it doesn't, Kratos will
 * redirect an already-authenticated session to `default_browser_return_url`,
 * which can create an infinite loop when that URL is `/login`.
 */
export function getLoginBrowserUrl(returnTo?: string): string {
  const params = new URLSearchParams();
  params.set("refresh", "true");
  if (returnTo) params.set("return_to", returnTo);
  return `/api/self-service/login/browser?${params.toString()}`;
}

/**
 * Build the Kratos recovery browser-flow URL.
 */
export function getRecoveryBrowserUrl(): string {
  return "/api/self-service/recovery/browser";
}
