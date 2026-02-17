import type { Metadata, Viewport } from "next";
import { Inter, Cinzel } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/providers";
import { Toaster } from "@/components/ui/toaster";

const inter = Inter({ subsets: ["latin"] });
const cinzel = Cinzel({ 
  subsets: ["latin"],
  variable: "--font-cinzel",
  weight: ["400", "500", "600", "700"],
});

const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://vector-equine.vercel.app";

export const metadata: Metadata = {
  metadataBase: new URL(appUrl),
  title: "Vector Equine - Connect, Learn, Compete",
  description: "A platform for equestrians to connect, learn, and compete. Join challenges, attend events, and grow your riding journey.",
  manifest: "/manifest.json",
  icons: {
    icon: [
      { url: "/favicon.png", sizes: "32x32", type: "image/png" },
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [
      { url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Vector Equine",
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    siteName: "Vector Equine",
    title: "Vector Equine - Connect, Learn, Compete",
    description: "A platform for equestrians to connect, learn, and compete. Join challenges, attend events, and grow your riding journey.",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "Vector Equine - The Equestrian Community Platform",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Vector Equine - Connect, Learn, Compete",
    description: "A platform for equestrians to connect, learn, and compete.",
    images: ["/og-image.png"],
  },
  keywords: ["equestrian", "horse riding", "dressage", "jumping", "horse community", "riding challenges", "equine events"],
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${inter.className} ${cinzel.variable}`}>
        <Providers>
          {children}
          <Toaster />
        </Providers>
      </body>
    </html>
  );
}
