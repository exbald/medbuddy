"use client"

import { useState, useCallback, useRef, useSyncExternalStore } from "react"
import { Mic, MicOff } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

interface VoiceButtonProps {
  onResult: (transcript: string) => void
  lang?: string
  disabled?: boolean
  listeningLabel?: string
  inputLabel?: string
}

type SpeechRecognitionInstance = {
  lang: string
  interimResults: boolean
  continuous: boolean
  start: () => void
  stop: () => void
  abort: () => void
  onresult: ((event: { results: { [index: number]: { [index: number]: { transcript: string } }; length: number }; resultIndex: number }) => void) | null
  onerror: ((event: { error: string }) => void) | null
  onend: (() => void) | null
}

function getSpeechRecognition(): (new () => SpeechRecognitionInstance) | null {
  if (typeof window === "undefined") return null
  const w = window as unknown as {
    SpeechRecognition?: new () => SpeechRecognitionInstance
    webkitSpeechRecognition?: new () => SpeechRecognitionInstance
  }
  return w.SpeechRecognition || w.webkitSpeechRecognition || null
}

export function VoiceButton({
  onResult,
  lang = "zh-TW",
  disabled = false,
  listeningLabel = "Listening...",
  inputLabel = "Voice Input",
}: VoiceButtonProps) {
  const [isListening, setIsListening] = useState(false)
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null)

  const isSupported = useSyncExternalStore(
    () => () => {},
    () => getSpeechRecognition() !== null,
    () => false
  )

  const toggleListening = useCallback(() => {
    const SpeechRecognitionClass = getSpeechRecognition()
    if (!SpeechRecognitionClass) return

    if (isListening && recognitionRef.current) {
      recognitionRef.current.stop()
      setIsListening(false)
      return
    }

    const recognition = new SpeechRecognitionClass()
    recognition.lang = lang
    recognition.interimResults = false
    recognition.continuous = false
    recognitionRef.current = recognition

    recognition.onresult = (event) => {
      const last = event.results.length - 1
      const result = event.results[last]
      if (!result) return
      const transcript = result[0]?.transcript ?? ""
      if (transcript.trim()) {
        onResult(transcript.trim())
      }
    }

    recognition.onerror = () => {
      setIsListening(false)
    }

    recognition.onend = () => {
      setIsListening(false)
    }

    recognition.start()
    setIsListening(true)
  }, [isListening, lang, onResult])

  if (!isSupported) return null

  return (
    <Button
      type="button"
      variant={isListening ? "destructive" : "outline"}
      size="icon"
      onClick={toggleListening}
      disabled={disabled}
      className={cn(
        "h-12 w-12 shrink-0 rounded-full",
        isListening && "animate-pulse"
      )}
      aria-label={isListening ? listeningLabel : inputLabel}
    >
      {isListening ? (
        <MicOff className="h-6 w-6" />
      ) : (
        <Mic className="h-6 w-6" />
      )}
    </Button>
  )
}
