import type { Metadata } from "next";
import "./globals.css";
import { Inter } from "next/font/google";
import StoreProvider from "@/redux/StoreProvider";
// import { createClient } from "@/supabase/server";

export const metadata: Metadata = {
  title: "Seidou",
  description: "Ecommerce platform",
};

const inter = Inter({ 
  subsets: ["latin"], 
  weight: ['400', '200', '600', '700', '900'], 
  display: "swap", 
});

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // const supabase = await createClient()
  // const { data: { user } } = await supabase.auth.getUser()
  
  return (
    <html lang="en">
      <link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200&family=Material+Symbols+Rounded:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200&family=Material+Symbols+Sharp:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200&display=swap" rel="stylesheet" precedence="default"/>
      <body className={`${inter.className} antialiased bg-[#eeeeee]`}>
        <StoreProvider>
          <div className="max-w-md mx-auto overflow-hidden min-h-dvh bg-white">
            {children}
          </div>
        </StoreProvider>
      </body>
    </html>
  );
}
