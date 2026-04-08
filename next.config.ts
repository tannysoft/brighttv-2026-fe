import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactCompiler: true,
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "cdn.brighttv.co.th" },
      { protocol: "https", hostname: "www.brighttv.co.th" },
      { protocol: "https", hostname: "brighttv.co.th" },
      { protocol: "https", hostname: "secure.gravatar.com" },
    ],
  },
};

export default nextConfig;
