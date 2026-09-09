import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/person/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "no-store, max-age=0, must-revalidate",
          },
        ],
      },
    ];
  },
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
