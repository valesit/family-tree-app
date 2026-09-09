import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "hbiw2z0a2ykd1udm.public.blob.vercel-storage.com",
        port: "",
        pathname: "/persons/**",
        search: "",
      },
    ],
  },
};

export default nextConfig;
