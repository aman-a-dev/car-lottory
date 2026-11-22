import type { Metadata } from "next";
import "./globals.css";
import { Toaster } from "@/components/ui/toast"
import Script from "next/script";
import { TelegramInit } from "@/components/blocks/telegram-init";

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`h-full antialiased`}
    >
      <Script
        src="https://telegram.org/js/telegram-web-app.js"
        strategy="beforeInteractive"
      />
      <body className="min-h-full flex flex-col pb-30">
        {children}
        <Toaster />
      </body>
      <TelegramInit />
    </html>
  );
}
