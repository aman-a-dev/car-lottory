"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { authenticateTelegram } from "@/actions/auth";

declare global {
  interface Window {
    Telegram?: {
      WebApp: {
        initData: string;
        initDataUnsafe: { user?: { id: number } };
        ready: () => void;
        expand: () => void;
        setHeaderColor?: (c: string) => void;
      };
    };
  }
}

export function TelegramInit() {
  const router = useRouter();
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;

    const run = async () => {
      const tg = window.Telegram?.WebApp;
      if (!tg) return;

      tg.ready();
      tg.expand(); // optional: full-height
      tg.setHeaderColor?.("#ffffff");

      const initData = tg.initData; // raw signed string
      if (!initData) return; // opened outside Telegram

      const result = await authenticateTelegram(initData);
      if (!result.ok) {
        console.error("[telegram-auth]", result.error);
        return;
      }

      // Refresh the server components so get-user() picks up the new user
      router.refresh();
    };

    // The SDK script may not be ready yet on first paint
    if (typeof window !== "undefined" && window.Telegram) {
      void run();
    } else {
      const onLoad = () => void run();
      window.addEventListener("load", onLoad, { once: true });
      return () => window.removeEventListener("load", onLoad);
    }
  }, [router]);

  return null;
}