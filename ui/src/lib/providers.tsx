import { type ReactNode } from "react";
import { QueryClient } from "@tanstack/react-query";
import { QueryProvider, AuthProvider } from "@sunbeam/g2v/providers";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, refetchOnWindowFocus: false },
  },
});

/**
 * Wires up the sunbeam-g2v framework providers without a Connect transport.
 *
 * Kratos and Hydra speak REST, so we don't need ConnectRPC here — we just want
 * g2v's QueryProvider (TanStack Query) and AuthProvider (legend-state auth
 * store) to manage cache + session state.
 */
export function FrameworkProviders({ children }: { children: ReactNode }) {
  return (
    <QueryProvider client={queryClient}>
      <AuthProvider>{children}</AuthProvider>
    </QueryProvider>
  );
}
