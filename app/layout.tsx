import type { Metadata } from "next";
import { Space_Grotesk, JetBrains_Mono } from "next/font/google";
import { getLastUpdated } from "@/lib/players";
import { CommandPalette } from "@/components/command-palette";
import { SettingsModal } from "@/components/settings-modal";
import { SetupWizard } from "@/components/setup-wizard";
import { PlayerModal } from "@/components/player-modal";
import { TeamModal } from "@/components/team-modal";
import "./globals.css";

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-space-grotesk",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "OtoScout",
  description: "A local, single-user football scouting tool. Press ⌘K to find a player.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // The ⌘K palette fetches its (all-league) index itself on first open — see
  // /api/search-index — so it stays out of every page's payload.
  const lastUpdated = getLastUpdated();

  return (
    <html lang="en" className={`${spaceGrotesk.variable} ${jetbrainsMono.variable}`}>
      <body>
        {children}
        <CommandPalette />
        <SettingsModal lastUpdated={lastUpdated} />
        <PlayerModal />
        <TeamModal />
        <SetupWizard />
      </body>
    </html>
  );
}
