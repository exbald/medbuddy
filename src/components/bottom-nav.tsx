"use client"

import { Home, Pill, MessageCircle, User, HeartPulse } from "lucide-react"
import { useTranslations } from "next-intl"
import { usePathname, Link } from "@/i18n/routing"
import { cn } from "@/lib/utils"

type NavItem = {
  href: string
  icon: typeof Home
  labelKey: string
}

const patientNavItems: NavItem[] = [
  { href: "/home", icon: Home, labelKey: "home" },
  { href: "/medications", icon: Pill, labelKey: "medications" },
  { href: "/chat", icon: MessageCircle, labelKey: "chat" },
  { href: "/profile", icon: User, labelKey: "profile" },
]

const caretakerNavItems: NavItem[] = [
  { href: "/caretaker", icon: HeartPulse, labelKey: "patient" },
  { href: "/medications", icon: Pill, labelKey: "medications" },
  { href: "/chat", icon: MessageCircle, labelKey: "chat" },
  { href: "/profile", icon: User, labelKey: "profile" },
]

interface BottomNavProps {
  role?: string
}

export function BottomNav({ role = "patient" }: BottomNavProps) {
  const t = useTranslations("nav")
  const pathname = usePathname()

  const navItems = role === "caretaker" ? caretakerNavItems : patientNavItems

  return (
    <nav className="fixed inset-x-0 bottom-0 z-50 border-t bg-background/95 backdrop-blur-sm supports-[backdrop-filter]:bg-background/80">
      <div className="mx-auto flex h-16 max-w-lg items-center justify-around">
        {navItems.map((item) => {
          const isActive = pathname.startsWith(item.href)
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex min-h-12 min-w-12 flex-col items-center justify-center gap-0.5 rounded-lg px-3 py-1 text-sm transition-colors",
                isActive
                  ? "font-medium text-primary"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <item.icon
                className={cn("h-6 w-6", isActive && "stroke-[2.5px]")}
              />
              <span className="text-sm">{t(item.labelKey)}</span>
            </Link>
          )
        })}
      </div>
      {/* Safe area padding for iOS devices with home indicator */}
      <div className="h-[env(safe-area-inset-bottom)]" />
    </nav>
  )
}
