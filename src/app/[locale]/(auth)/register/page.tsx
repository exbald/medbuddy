import { headers } from "next/headers"
import { eq } from "drizzle-orm"
import { getTranslations, setRequestLocale } from "next-intl/server"
import { SignUpForm } from "@/components/auth/sign-up-form"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { redirect } from "@/i18n/routing"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { user } from "@/lib/schema"

export default async function RegisterPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  setRequestLocale(locale)

  const session = await auth.api.getSession({ headers: await headers() })

  if (session) {
    const [currentUser] = await db
      .select({ role: user.role })
      .from(user)
      .where(eq(user.id, session.user.id))
      .limit(1)
    const dest = currentUser?.role === "caretaker" ? "/caretaker" : "/home"
    redirect({ href: dest, locale })
  }

  const t = await getTranslations("authPages.register")

  return (
    <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle>{t("title")}</CardTitle>
          <CardDescription>{t("subtitle")}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col items-center">
          <SignUpForm />
        </CardContent>
      </Card>
    </div>
  )
}
