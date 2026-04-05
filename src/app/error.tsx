"use client";

import { useEffect, useMemo } from "react";
import { AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

// Inline translations for the global error boundary, which lives outside
// the [locale] route and therefore cannot use next-intl hooks.
const translations = {
  en: {
    somethingWentWrong: "Something went wrong",
    unexpectedError:
      "An unexpected error occurred. Please try again or contact support if the problem persists.",
    errorId: (id: string) => `Error ID: ${id}`,
    tryAgain: "Try again",
    goHome: "Go home",
  },
  "zh-TW": {
    somethingWentWrong: "出了一些問題",
    unexpectedError: "發生了意外錯誤，請重試或聯繫客服。",
    errorId: (id: string) => `錯誤代碼：${id}`,
    tryAgain: "重試",
    goHome: "回首頁",
  },
} as const;

type Locale = keyof typeof translations;

function detectLocale(): Locale {
  if (typeof window === "undefined") return "zh-TW";
  const path = window.location.pathname;
  // If the path starts with /en, use English; otherwise default to zh-TW
  if (path.startsWith("/en")) return "en";
  return "zh-TW";
}

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  // Capture the error digest for display; the error object itself
  // should be forwarded to an error-reporting service in production.
  useEffect(() => {
    // TODO: forward to error reporting service (e.g. Sentry)
  }, [error]);

  const locale = useMemo(() => detectLocale(), []);
  const t = translations[locale];

  return (
    <div className="container mx-auto px-4 py-16">
      <div className="max-w-md mx-auto text-center">
        <div className="flex justify-center mb-6">
          <AlertCircle className="h-16 w-16 text-destructive" />
        </div>
        <h1 className="text-2xl font-bold mb-4">{t.somethingWentWrong}</h1>
        <p className="text-muted-foreground mb-6">{t.unexpectedError}</p>
        {error.digest && (
          <p className="text-xs text-muted-foreground mb-4">
            {t.errorId(error.digest)}
          </p>
        )}
        <div className="flex gap-4 justify-center">
          <Button onClick={reset}>{t.tryAgain}</Button>
          <Button
            variant="outline"
            onClick={() => {
              const homePath = locale === "en" ? "/en" : "/";
              window.location.href = homePath;
            }}
          >
            {t.goHome}
          </Button>
        </div>
      </div>
    </div>
  );
}
