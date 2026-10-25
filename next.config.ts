import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // jspdf pulls optional browser-only deps; keep it out of the server bundle
  // and let Node resolve it at runtime instead.
  serverExternalPackages: ["jspdf", "jspdf-autotable"],
  // Dev-only badge: keep it off the sidebar's "Sign out" button.
  devIndicators: { position: "bottom-right" },
};

export default nextConfig;
