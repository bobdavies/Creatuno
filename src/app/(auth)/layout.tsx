import Image from 'next/image'
import Link from 'next/link'

const AUTH_VALUE_PROPS = [
  'Secure role-based onboarding for creatives, mentors, employers, and investors.',
  'Fast payments and transparent transaction flows from contract to payout.',
  'Portfolio-first collaboration with mentorship and investment support.',
]

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="relative min-h-screen overflow-hidden bg-background">
      <div className="pointer-events-none absolute inset-0">
        <div className="auth-orb auth-orb-primary" />
        <div className="auth-orb auth-orb-secondary" />
      </div>

      <div className="relative z-10 mx-auto grid min-h-screen w-full max-w-[1260px] lg:grid-cols-[0.95fr_1.05fr]">
        <aside className="hidden lg:flex border-r border-border/60">
          <div className="auth-panel-reveal flex w-full flex-col justify-between px-8 py-9 xl:px-10 xl:py-10">
            <Link href="/" className="inline-flex items-center gap-3">
              <Image
                src="/branding/logo-horizontal-dark.svg"
                alt="Creatuno"
                width={156}
                height={24}
                className="h-6 w-auto dark:hidden"
                priority
              />
              <Image
                src="/branding/logo-horizontal-bright.svg"
                alt="Creatuno"
                width={156}
                height={24}
                className="hidden h-6 w-auto dark:block"
                priority
              />
            </Link>

            <div className="max-w-lg space-y-6">
              <p className="inline-flex rounded-full border border-brand-purple-300/40 bg-brand-purple-100/60 px-3 py-1 text-xs font-semibold tracking-wide text-brand-purple-700 dark:border-brand-purple-300/20 dark:bg-brand-purple-900/30 dark:text-brand-purple-200">
                Welcome To Creatuno
              </p>
              <h1 className="text-4xl font-bold leading-tight text-foreground xl:text-5xl">
                Build, collaborate, and get paid with confidence.
              </h1>
              <p className="max-w-md text-base text-muted-foreground">
                A trusted ecosystem where opportunities, creative delivery, mentorship, and payouts stay in sync.
              </p>
              <ul className="space-y-3">
                {AUTH_VALUE_PROPS.map((item) => (
                  <li
                    key={item}
                    className="flex items-start gap-3 text-sm text-foreground/90"
                  >
                    <span className="mt-1 inline-block h-2 w-2 shrink-0 rounded-full bg-brand-500" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>

            <p className="text-xs text-muted-foreground">
              Secure authentication powered by Clerk.
            </p>
          </div>
        </aside>

        <section className="flex items-center justify-center p-4 sm:p-6 lg:px-8 lg:py-10 xl:px-10">
          <div className="w-full max-w-[27rem]">
            <div className="mb-6 flex items-center justify-center lg:hidden">
              <Link href="/" className="inline-flex items-center">
                <Image
                  src="/branding/logo-horizontal-dark.svg"
                  alt="Creatuno"
                  width={146}
                  height={22}
                  className="h-6 w-auto dark:hidden"
                  priority
                />
                <Image
                  src="/branding/logo-horizontal-bright.svg"
                  alt="Creatuno"
                  width={146}
                  height={22}
                  className="hidden h-6 w-auto dark:block"
                  priority
                />
              </Link>
            </div>
            <div className="auth-form-reveal">{children}</div>
          </div>
        </section>
      </div>
    </div>
  )
}
