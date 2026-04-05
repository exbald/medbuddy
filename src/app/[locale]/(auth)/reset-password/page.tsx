import { Suspense } from "react"
import { headers } from "next/headers"
import { getTranslations, setRequestLocale } from "next-intl/server"
import { ResetPasswordForm } from "@/components/auth/reset-password-form"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { redirect } from "@/i18n/routing"
import { auth } from "@/lib/auth"

export default async function ResetPasswordPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  setRequestLocale(locale)

  const session = await auth.api.getSession({ headers: await headers() })

  if (session) {
    redirect({ href: "/home", locale })
  }

  const t = await getTranslations("authPages.resetPassword")
  const tCommon = await getTranslations("common")

  return (
    <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle>{t("title")}</CardTitle>
          <CardDescription>{t("subtitle")}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col items-center">
          <Suspense fallback={<div>{tCommon("loading")}</div>}>
            <ResetPasswordForm />
          </Suspense>
        </CardContent>
      </Card>
    </div>
  )
}
