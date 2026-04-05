"use client"

import { useEffect, useRef, useState, useCallback } from "react"
import { useChat } from "@ai-sdk/react"
import { Send, Volume2, VolumeOff, MessageCircle, ImageIcon, X, SquarePen } from "lucide-react"
import { useLocale, useTranslations } from "next-intl"
import { ChatBubble } from "@/components/chat-bubble"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { VoiceButton } from "@/components/voice-button"
import type { UIMessage } from "ai"

function getMessageText(message: UIMessage): string {
  return message.parts
    .filter((p): p is { type: "text"; text: string } => p.type === "text")
    .map((p) => p.text)
    .join("")
}

function readAloud(text: string, lang: string) {
  if (!("speechSynthesis" in globalThis) || !text) return
  window.speechSynthesis.cancel()
  const utterance = new SpeechSynthesisUtterance(text)
  utterance.lang = lang
  utterance.rate = 0.9
  window.speechSynthesis.speak(utterance)
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

export default function ChatPage() {
  const t = useTranslations("chat")
  const locale = useLocale()
  const speechLang = locale === "en" ? "en-US" : "zh-TW"

  const [autoRead, setAutoRead] = useState(false)
  const [hasSpeech, setHasSpeech] = useState(false)
  const [loadingHistory, setLoadingHistory] = useState(true)
  const [input, setInput] = useState("")
  const [selectedImage, setSelectedImage] = useState<File | null>(null)
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const prevMessageCountRef = useRef(0)

  const {
    messages,
    sendMessage,
    status,
    setMessages,
    error,
  } = useChat({
    onFinish: ({ message }) => {
      if (autoRead && message.role === "assistant") {
        readAloud(getMessageText(message), speechLang)
      }
    },
  })

  const isLoading = status === "submitted" || status === "streaming"

  // Detect speech synthesis after mount to avoid hydration mismatch
  useEffect(() => {
    setHasSpeech("speechSynthesis" in window)
  }, [])

  // Load history on mount
  useEffect(() => {
    async function loadHistory() {
      try {
        const res = await fetch("/api/chat/messages")
        if (res.ok) {
          const data = await res.json()
          if (data.messages && data.messages.length > 0) {
            const uiMessages: UIMessage[] = data.messages.map(
              (m: { id: string; role: string; content: string; imageUrl?: string | null }) => {
                const parts: UIMessage["parts"] = []
                if (m.imageUrl) {
                  parts.push({
                    type: "file" as const,
                    mediaType: "image/jpeg",
                    url: m.imageUrl,
                  })
                }
                if (m.content) {
                  parts.push({ type: "text" as const, text: m.content })
                }
                if (parts.length === 0) {
                  parts.push({ type: "text" as const, text: "" })
                }
                return {
                  id: m.id,
                  role: m.role as "user" | "assistant",
                  parts,
                }
              }
            )
            setMessages(uiMessages)
          }
        }
      } catch {
        // Silently fail — fresh chat is fine
      } finally {
        setLoadingHistory(false)
      }
    }
    loadHistory()
  }, [setMessages])

  // Auto-scroll on new messages and during streaming
  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: messages.length !== prevMessageCountRef.current ? "smooth" : "instant",
    })
    prevMessageCountRef.current = messages.length
  }, [messages])

  // Auto-resize textarea
  useEffect(() => {
    const el = inputRef.current
    if (el) {
      el.style.height = "auto"
      el.style.height = `${Math.min(el.scrollHeight, 120)}px`
    }
  }, [input])

  // Cleanup preview URL on unmount or clear
  useEffect(() => {
    return () => {
      if (imagePreviewUrl) URL.revokeObjectURL(imagePreviewUrl)
    }
  }, [imagePreviewUrl])

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (!file) return

      if (!file.type.startsWith("image/")) {
        alert(t("invalidFileType"))
        return
      }
      if (file.size > 10 * 1024 * 1024) {
        alert(t("fileTooLarge"))
        return
      }

      if (imagePreviewUrl) URL.revokeObjectURL(imagePreviewUrl)
      setSelectedImage(file)
      setImagePreviewUrl(URL.createObjectURL(file))

      // Reset input so same file can be re-selected
      e.target.value = ""
    },
    [imagePreviewUrl, t]
  )

  const handleRemoveImage = useCallback(() => {
    if (imagePreviewUrl) URL.revokeObjectURL(imagePreviewUrl)
    setSelectedImage(null)
    setImagePreviewUrl(null)
  }, [imagePreviewUrl])

  const handleSend = useCallback(async () => {
    const text = input.trim()
    if ((!text && !selectedImage) || isLoading) return

    const files: Array<{ type: "file"; mediaType: string; url: string }> = []
    if (selectedImage) {
      const dataUrl = await fileToDataUrl(selectedImage)
      files.push({
        type: "file",
        mediaType: selectedImage.type,
        url: dataUrl,
      })
    }

    setInput("")
    handleRemoveImage()

    if (files.length > 0) {
      sendMessage({ text: text || undefined, files })
    } else {
      sendMessage({ text })
    }
  }, [input, isLoading, selectedImage, sendMessage, handleRemoveImage])

  const handleNewChat = useCallback(() => {
    setMessages([])
    handleRemoveImage()
    setInput("")
  }, [setMessages, handleRemoveImage])

  const handleVoiceResult = useCallback(
    (transcript: string) => {
      if (!transcript.trim() || isLoading) return
      setInput("")
      sendMessage({ text: transcript.trim() })
    },
    [isLoading, sendMessage]
  )

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault()
        handleSend()
      }
    },
    [handleSend]
  )

  return (
    <div className="flex h-[calc(100dvh-5rem)] flex-col">
      {/* Header */}
      <div className="flex items-center justify-between border-b px-4 py-3">
        <h1 className="text-xl font-bold">{t("title")}</h1>
        <div className="flex items-center gap-1">
        {messages.length > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleNewChat}
            className="gap-2 text-base"
            aria-label={t("newChat")}
          >
            <SquarePen className="h-5 w-5" />
            <span className="hidden sm:inline">{t("newChat")}</span>
          </Button>
        )}
        {hasSpeech && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setAutoRead((prev) => {
                if (prev) window.speechSynthesis.cancel()
                return !prev
              })
            }}
            className="gap-2 text-base"
          >
            {autoRead ? (
              <Volume2 className="h-5 w-5" />
            ) : (
              <VolumeOff className="h-5 w-5" />
            )}
            <span className="hidden sm:inline">{t("autoRead")}</span>
          </Button>
        )}
        </div>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {loadingHistory ? (
          <div className="space-y-3">
            <Skeleton className="h-16 w-3/4" />
            <Skeleton className="ml-auto h-12 w-2/3" />
            <Skeleton className="h-20 w-3/4" />
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center space-y-4 px-6">
            <div className="rounded-full bg-primary/10 p-6">
              <MessageCircle className="h-12 w-12 text-primary" />
            </div>
            <div>
              <p className="text-xl font-medium">{t("emptyState")}</p>
              <p className="mt-2 text-muted-foreground text-lg">{t("emptyHint")}</p>
            </div>
            <p className="text-sm text-muted-foreground max-w-sm">
              {t("disclaimer")}
            </p>
          </div>
        ) : (
          messages.map((message) => (
            <ChatBubble
              key={message.id}
              role={message.role as "user" | "assistant"}
              parts={message.parts.map((p) => {
                if (p.type === "text") return { type: "text", text: p.text }
                if (p.type === "file") return { type: "file", url: p.url, mediaType: p.mediaType }
                return { type: p.type }
              })}
              onReadAloud={message.role === "assistant" ? speechLang : undefined}
            />
          ))
        )}
        {status === "submitted" && (
          <div className="flex justify-start">
            <div className="max-w-[85%] rounded-2xl rounded-bl-md bg-muted px-4 py-3">
              <div className="flex items-center gap-1">
                <span className="h-2 w-2 rounded-full bg-foreground/40 animate-bounce" style={{ animationDelay: "0ms" }} />
                <span className="h-2 w-2 rounded-full bg-foreground/40 animate-bounce" style={{ animationDelay: "150ms" }} />
                <span className="h-2 w-2 rounded-full bg-foreground/40 animate-bounce" style={{ animationDelay: "300ms" }} />
              </div>
            </div>
          </div>
        )}
        {error && (
          <div className="mx-auto max-w-sm rounded-lg bg-destructive/10 px-4 py-3 text-center text-destructive">
            {t("errorSending")}
          </div>
        )}
      </div>

      {/* Image preview */}
      {imagePreviewUrl && (
        <div className="border-t bg-muted/50 px-4 py-2">
          <div className="relative inline-block">
            <img
              src={imagePreviewUrl}
              alt=""
              className="h-20 w-20 rounded-lg object-cover"
            />
            <button
              type="button"
              onClick={handleRemoveImage}
              className="absolute -right-2 -top-2 rounded-full bg-destructive p-1 text-destructive-foreground"
              aria-label={t("removePhoto")}
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        </div>
      )}

      {/* Input bar */}
      <div className="border-t bg-background px-4 py-3">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleFileSelect}
        />
        <div className="flex items-end gap-2">
          <VoiceButton
            onResult={handleVoiceResult}
            lang={speechLang}
            disabled={isLoading}
            listeningLabel={t("voiceListening")}
            inputLabel={t("voiceInput")}
          />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            disabled={isLoading}
            onClick={() => fileInputRef.current?.click()}
            className="h-12 w-12 shrink-0"
            aria-label={t("attachPhoto")}
          >
            <ImageIcon className="h-5 w-5" />
          </Button>
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={t("placeholder")}
            rows={1}
            disabled={isLoading}
            aria-label={t("placeholder")}
            className="flex-1 resize-none rounded-2xl border bg-muted px-4 py-3 text-lg leading-normal placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50"
            style={{ minHeight: "48px", maxHeight: "120px" }}
          />
          <Button
            type="button"
            size="icon"
            disabled={isLoading || (!input.trim() && !selectedImage)}
            onClick={handleSend}
            className="h-12 w-12 shrink-0 rounded-full"
          >
            <Send className="h-5 w-5" />
          </Button>
        </div>
      </div>
    </div>
  )
}
