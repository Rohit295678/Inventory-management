import { networkInterfaces } from "node:os";
import type { NextConfig } from "next";

// This machine's current LAN IPv4 addresses, so phones on the same Wi-Fi can
// use the dev server. Computed at startup instead of hard-coded because
// DHCP hands out a new IP every so often. (Dev-only setting.)
function lanAddresses(): string[] {
  return Object.values(networkInterfaces())
    .flat()
    .filter((net) => net && net.family === "IPv4" && !net.internal)
    .map((net) => net!.address);
}

const nextConfig: NextConfig = {
  // jspdf pulls optional browser-only deps; keep it out of the server bundle
  // and let Node resolve it at runtime instead.
  serverExternalPackages: ["jspdf", "jspdf-autotable"],
  // Dev-only badge: keep it off the sidebar's "Sign out" button.
  devIndicators: { position: "bottom-right" },
  allowedDevOrigins: lanAddresses(),
};

export default nextConfig;
