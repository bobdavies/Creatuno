import { SignIn } from '@clerk/nextjs'

export default function SignInPage() {
  return (
    <div className="space-y-3">
      <div className="space-y-1 text-center">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-brand-purple-600 dark:text-brand-purple-300">
          Secure Access
        </p>
        <h2 className="text-2xl font-semibold leading-tight text-foreground">
          Sign in to your account
        </h2>
        <p className="mx-auto max-w-sm text-sm text-muted-foreground">
          Continue your projects, payouts, and collaborations.
        </p>
      </div>
      <SignIn
        fallbackRedirectUrl="/dashboard"
        signUpFallbackRedirectUrl="/onboarding"
        appearance={{
          elements: {
            rootBox: 'mx-auto w-full',
            card: 'w-full rounded-2xl bg-card/95 border-border shadow-xl shadow-brand-purple-900/5 dark:shadow-black/25 backdrop-blur',
          },
        }}
      />
    </div>
  )
}
