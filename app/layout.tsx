import type { Metadata } from "next";
import { Space_Grotesk, JetBrains_Mono } from "next/font/google";
import {
  getDefaultLeagueSeason,
  getLastUpdated,
  getPlayerIndex,
} from "@/lib/players";
import { CommandPalette } from "@/components/command-palette";
import { SettingsModal } from "@/components/settings-modal";
import { PlayerModal } from "@/components/player-modal";
import type { PlayerIndexRow } from "@/lib/types";
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
  title: "OtoScout — FBref scouting",
  description: "A local, single-user football scouting tool. Press ⌘K to find a player.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Small player search index, read server-side from scouting.db and handed to
  // the ⌘K palette. Empty when the DB hasn't been built yet.
  const ls = getDefaultLeagueSeason();
  const index: PlayerIndexRow[] = ls ? getPlayerIndex(ls.league, ls.season) : [];
  const lastUpdated = getLastUpdated();

  return (
    <html lang="en" className={`${spaceGrotesk.variable} ${jetbrainsMono.variable}`}>
      <body>
        {children}
        <CommandPalette index={index} />
        <SettingsModal lastUpdated={lastUpdated} />
        <PlayerModal />
      </body>
    </html>
  );
}
