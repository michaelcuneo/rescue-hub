/** Exact compiled web-app identity, not the latest GitHub branch head. */
export type BuildInfo = {
  version: string;
  gitCommit: string | null;
  gitBranch: string | null;
  builtAt: string;
};

// Vite replaces the constant while compiling both the client and SSR bundles.
export const buildInfo: BuildInfo = __RESCUE_HUB_BUILD_INFO__;
