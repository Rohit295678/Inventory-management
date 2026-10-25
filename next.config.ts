import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // jspdf pulls optional browser-only deps; keep it out of the server bundle
  // and let Node resolve it at runtime instead.
  serverExternalPackages: ["jspdf", "jspdf-autotable"],
};

export default nextConfig;
