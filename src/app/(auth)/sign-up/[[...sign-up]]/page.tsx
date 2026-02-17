import { SignUp } from '@clerk/nextjs'

export default function SignUpPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <SignUp 
        fallbackRedirectUrl="/onboarding"
        signInFallbackRedirectUrl="/dashboard"
        appearance={{
          elements: {
            rootBox: 'mx-auto',
            card: 'bg-card border-border',
          },
        }}
      />
    </div>
  )
}
