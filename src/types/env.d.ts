/**
 * Types for the `EXPO_PUBLIC_*` variables Metro inlines into the bundle.
 *
 * Declared here rather than relying on the generated `expo-env.d.ts`, which is
 * gitignored and absent on a fresh clone until the dev server has run once.
 * Adding a variable here makes it autocomplete inside `@/config/env`.
 */
declare namespace NodeJS {
  interface ProcessEnv {
    readonly EXPO_PUBLIC_API_URL?: string;
    readonly EXPO_PUBLIC_SUPABASE_URL?: string;
    readonly EXPO_PUBLIC_SUPABASE_ANON_KEY?: string;
    /** Whether the AI assistant is enabled; the provider itself is server-side. */
    readonly EXPO_PUBLIC_AI_ENABLED?: string;
  }
}

declare const process: {
  readonly env: NodeJS.ProcessEnv;
};
