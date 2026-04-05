"use client"

import { useCallback } from "react"
import { Volume2 } from "lucide-react"
import { useTranslations } from "next-intl"
import { cn } from "@/lib/utils"

interface ChatBubblePart {
  type: string
  text?: string
  url?: string
  mediaType?: string
}

interface ChatBubbleProps {
  role: "user" | "assistant"
  parts: ChatBubblePart[]
  timestamp?: Date | null
  onReadAloud?: string | undefined
}

export function ChatBubble({ role, parts, timestamp, onReadAloud }: ChatBubbleProps) {
  const t = useTranslations("chat")
  const isUser = role === "user"

  const textContent = parts
    .filter((p) => p.type === "text" && p.text)
    .map((p) => p.text)
    .join("")

  const handleReadAloud = useCallback(() => {
    if (!onReadAloud || !("speechSynthesis" in globalThis) || !textContent) return
    window.speechSynthesis.cancel()
    const utterance = new SpeechSynthesisUtterance(textContent)
    utterance.lang = onReadAloud
    utterance.rate = 0.9
    window.speechSynthesis.speak(utterance)
  }, [textContent, onReadAloud])

  return (
    <div
      className={cn(
        "flex w-full",
        isUser ? "justify-end" : "justify-start"
      )}
    >
      <div
        className={cn(
          "max-w-[85%] rounded-2xl px-4 py-3 text-lg leading-relaxed",
          isUser
            ? "bg-primary text-primary-foreground rounded-br-md"
            : "bg-muted text-foreground rounded-bl-md"
        )}
      >
        {parts.map((part, i) => {
          if (part.type === "file" && part.url) {
            return (
              <img
                key={i}
                src={part.url}
                alt=""
                className="max-w-full rounded-lg"
                style={{ maxHeight: "300px" }}
              />
            )
          }
          if (part.type === "text" && part.text) {
            return (
              <div key={i} className="whitespace-pre-wrap break-words">
                {part.text}
              </div>
            )
          }
          return null
        })}
        <div
          className={cn(
            "mt-1 flex items-center gap-2 text-xs opacity-60",
            isUser ? "justify-end" : "justify-start"
          )}
        >
          {timestamp && (
            <span>
              {new Date(timestamp).toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>
          )}
          {!isUser && onReadAloud && "speechSynthesis" in globalThis && (
            <button
              type="button"
              onClick={handleReadAloud}
              className="hover:opacity-100 opacity-60 transition-opacity p-1"
              aria-label={t("readAloud")}
            >
              <Volume2 className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
