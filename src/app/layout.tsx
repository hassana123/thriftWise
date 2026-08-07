import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";

import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryProvider } from "@/providers/query-provider";
import { ThriftProvider } from "@/providers/thrift-provider";
import { AuthProvider } from "@/providers/auth-provider";
import { AppLoading } from "@/components/app-loading";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "ThriftWise — Family Vacation Thrift",
    template: "%s · ThriftWise",
  },
  description:
    "Save together, vacation together. ThriftWise helps families track daily savings, weekly contributions, and progress toward a shared vacation goal.",
  manifest: "/manifest.json",
  icons: {
    icon: "/favicon.ico",
  },
};

export const viewport: Viewport = {
  themeColor: "#16A34A",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full">
        <ThemeProvider>
          <QueryProvider>
            <ThriftProvider>
              <AuthProvider>
                <TooltipProvider delayDuration={200}>
                  <AppLoading>{children}</AppLoading>
                </TooltipProvider>
              </AuthProvider>
            </ThriftProvider>
          </QueryProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
