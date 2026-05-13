import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const sans = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
  axes: ["opsz"],
});

const mono = JetBrains_Mono({
  variable: "--font-jbm",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "PullBrief",
    template: "%s · PullBrief",
  },
  description: "Ranked, structured review briefs for GitHub pull requests.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`dark ${sans.variable} ${mono.variable} h-full`}
      suppressHydrationWarning
    >
      <body className="min-h-full bg-background text-foreground font-sans antialiased">
        {children}
      </body>
    </html>
  );
}
