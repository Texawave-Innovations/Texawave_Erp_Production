import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Workspace packages are consumed as raw TS source (no build step of
  // their own) — this tells Next's compiler to transpile them itself
  // instead of trying to load them as pre-built. Add a package here the
  // moment apps/ui imports from it.
  transpilePackages: [
    "@texawave-erp/core",
    "@texawave-erp/api-types",
    "@texawave-erp/ui-kit",
  ],
};

export default nextConfig;
