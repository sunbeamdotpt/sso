/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL: string;
  readonly VITE_SUNBEAM_OTLP_URL?: string;
  readonly VITE_REGISTRATION_DISABLED?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
