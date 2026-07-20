import type { NextConfig } from "next";
import { networkInterfaces } from "node:os";

const localIpv4Origins = Object.values(networkInterfaces()).flatMap(
  (networks) =>
    networks
      ?.filter((network) => network.family === "IPv4" && !network.internal)
      .map((network) => network.address) ?? [],
);

const nextConfig: NextConfig = {
  allowedDevOrigins: localIpv4Origins,
  webpack: (config) => {
    // Required for react-pdf / pdfjs-dist
    config.resolve.alias.canvas = false;
    return config;
  },
};

export default nextConfig;
