import type { Metadata, Viewport } from "next";
import { Montserrat, DM_Sans } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/providers";

const montserrat = Montserrat({
  subsets: ["latin"],
  variable: "--font-montserrat",
});

const dmSans = DM_Sans({
  subsets: ["latin"],
  variable: "--font-dm-sans",
});

export const metadata: Metadata = {
  title: {
    default: "Creatuno - The Creative Portfolio Platform",
    template: "%s | Creatuno",
  },
  description:
    "Build professional portfolios, discover opportunities, and connect with mentors. An offline-first platform for creative professionals in low-bandwidth environments.",
  keywords: [
    "portfolio",
    "creative professionals",
    "jobs",
    "mentorship",
    "Sierra Leone",
    "Sierra Leone",
    "offline-first",
    "PWA",
  ],
  authors: [{ name: "Creatuno" }],
  creator: "Creatuno",
  publisher: "Creatuno",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Creatuno",
  },
  formatDetection: {
    telephone: false,
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "https://creatuno.app",
    siteName: "Creatuno",
    title: "Creatuno - Empowering Local Talent through Digital Visibility",
    description:
      "Build professional portfolios, discover opportunities, and connect with mentors.",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "Creatuno",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Creatuno",
    description: "Empowering Local Talent through Digital Visibility",
    images: ["/og-image.png"],
  },
  robots: {
    index: true,
    follow: true,
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#FEC714" },
    { media: "(prefers-color-scheme: dark)", color: "#1B0F28" },
  ],
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="icon" href="/favicon.ico" sizes="any" />
        <link rel="icon" href="/icon.svg" type="image/svg+xml" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
      </head>
      <body
        className={`${montserrat.variable} ${dmSans.variable} font-sans antialiased min-h-screen bg-background`}
      >
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
