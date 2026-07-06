/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** PostHog project API key (public client key). Absent -> analytics is a no-op. */
  readonly VITE_POSTHOG_KEY?: string;
  /** PostHog ingestion host. Defaults to EU cloud when unset. */
  readonly VITE_POSTHOG_HOST?: string;
  /** Build-time app version string. Defaults to 'dev' when unset. */
  readonly VITE_APP_VERSION?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
