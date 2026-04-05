import { cookies } from "next/headers"
import { eq } from "drizzle-orm"
import { setRequestLocale, getTranslations } from "next-intl/server"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Link } from "@/i18n/routing"
import { db } from "@/lib/db"
import { caretakerLink, user } from "@/lib/schema"

export default async function InvitePage({
  params,
}: {
  params: Promise<{ code: string; locale: string }>
}) {
  const { code, locale } = await params
  setRequestLocale(locale)
  const t = await getTranslations("invite")

  const link = await db
    .select()
    .from(caretakerLink)
    .where(eq(caretakerLink.inviteCode, code))
    .then((rows) => rows[0] ?? null)

  const isInvalid = !link || (link.caretakerId && link.patientId)

  if (isInvalid) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center px-5 py-8">
        <Card className="w-full max-w-md">
          <CardContent className="flex flex-col items-center gap-6 p-8 text-center">
            <p className="text-lg text-muted-foreground">{t("invalid")}</p>
            <Button
              size="lg"
              className="h-14 w-full text-lg font-semibold"
              asChild
            >
              <Link href="/register">{t("goToSignup")}</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  const inviterId = link.caretakerId ?? link.patientId
  const inviter = inviterId
    ? await db
        .select({ name: user.name })
        .from(user)
        .where(eq(user.id, inviterId))
        .then((rows) => rows[0] ?? null)
    : null

  const inviterName = inviter?.name ?? "MedBuddy"

  const cookieStore = await cookies()
  cookieStore.set("invite_code", code, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 7,
    path: "/",
  })

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center px-5 py-8">
      <Card className="w-full max-w-md">
        <CardContent className="flex flex-col items-center gap-6 p-8 text-center">
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
            {t("title")}
          </h1>
          <p className="text-lg leading-relaxed text-muted-foreground">
            {t("subtitle", { name: inviterName })}
          </p>
          <Button
            size="lg"
            className="h-14 w-full text-lg font-semibold"
            asChild
          >
            <Link href="/register">{t("signUp")}</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
