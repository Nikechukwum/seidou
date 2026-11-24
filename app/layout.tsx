import type { Metadata } from "next";
import "./globals.css";
import localFont from "next/font/local";
import StoreProvider from "@/redux/StoreProvider";
import { Footer } from "@/components/Footer";
import { Toast } from "@/components/Toast";
import { SoundEffects } from "@/components/SoundEffects";

export const metadata: Metadata = {
  title: "Seidou",
  description: "Ecommerce platform",
};

// Inter, stored in the project (app/fonts) instead of next/font/google.
// next/font/google downloads the font from Google during every build, and
// when that download failed Vercel's production build broke ("Can't resolve
// '@vercel/turbopack-next/internal/font/google/font'"). This is the variable
// version of the font (Latin, from @fontsource-variable/inter, OFL licence),
// so one file covers every weight 100–900.
const inter = localFont({
  src: "./fonts/inter-latin-variable.woff2",
  weight: "100 900",
  style: "normal",
  display: "swap",
});

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
 
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200&family=Material+Symbols+Rounded:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200&family=Material+Symbols+Sharp:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200&display=swap" rel="stylesheet" precedence="default"/>
      </head>
      <body className={`${inter.className} antialiased bg-[#eeeeee] overscroll-contain`}>
        <StoreProvider>
          <Toast />
          <SoundEffects />
          <div id="main" className="max-w-md mx-auto overflow-scroll h-screen bg-white">
            {children}
            <Footer />
          </div>
        </StoreProvider>
      </body>
    </html>
  );
}
