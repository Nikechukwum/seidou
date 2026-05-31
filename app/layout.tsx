import type { Metadata } from "next";
import "./globals.css";
import { Inter } from "next/font/google";
import StoreProvider from "@/redux/StoreProvider";
import { Footer } from "@/components/Footer";
import { Toast } from "@/components/Toast";

export const metadata: Metadata = {
  title: "Seidou",
  description: "Ecommerce platform",
};

const inter = Inter({ 
  subsets: ["latin"], 
  weight: [ '200', '400', '500', '600', '700', '900'], 
  display: "swap", 
});

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
 
  return (
    <html lang="en">
      <link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200&family=Material+Symbols+Rounded:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200&family=Material+Symbols+Sharp:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200&display=swap" rel="stylesheet" precedence="default"/>
      <body className={`${inter.className} antialiased bg-[#eeeeee] overscroll-contain`}>
        <StoreProvider>
          <Toast />
          <div id="main" className="max-w-md mx-auto overflow-scroll h-screen bg-white">
            {children}
            <Footer />
          </div>
        </StoreProvider>
      </body>
    </html>
  );
}
