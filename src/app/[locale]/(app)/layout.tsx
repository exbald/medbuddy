import { headers } from "next/headers"
import { eq } from "drizzle-orm"
import { BottomNav } from "@/components/bottom-nav"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { user } from "@/lib/schema"

/**
 * Fetch the current user's role from the database.
 * Falls back to "patient" if the session or user is unavailable.
 */
async function getUserRole(): Promise<string> {
  try {
    const session = await auth.api.getSession({ headers: await headers() })
    if (!session) return "patient"

    const [currentUser] = await db
      .select({ role: user.role })
      .from(user)
      .where(eq(user.id, session.user.id))
      .limit(1)

    return currentUser?.role ?? "patient"
  } catch {
    return "patient"
  }
}

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const role = await getUserRole()

  return (
    <div className="flex min-h-dvh flex-col">
      <main className="flex-1 pb-20">{children}</main>
      <BottomNav role={role} />
    </div>
  )
}
