import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Cache Components is off on purpose: every page here depends on the
  // logged-in user's cookie, so pages must render fresh on each request.
};

export default nextConfig;