import type { Metadata } from "next";
import "./globals.css";
import "./cloud.css";

export const metadata: Metadata = {
  title: "Echoes Foundry",
  description: "EVE Echoes inventory and manufacturing tracker",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
