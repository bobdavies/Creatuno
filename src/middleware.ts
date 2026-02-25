import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'

// Define public routes that don't require authentication
const isPublicRoute = createRouteMatcher([
  '/',
  '/sign-in(.*)',
  '/sign-up(.*)',
  '/portfolio/(.*)', // Public portfolio viewing
  '/portfolios', // Public portfolio discovery
  '/opportunities', // Public opportunities listing
  '/opportunities/(.*)', // Public opportunity detail
  '/feed', // Public community feed (read-only)
  '/search', // Public search
  '/help', // Help center
  '/privacy', // Privacy policy
  '/terms', // Terms of service
  '/cookie-policy', // Cookie policy
  '/about', // About us
  '/blog', // Blog
  '/careers', // Careers
  '/contact', // Contact
  '/api/support', // Public support form endpoint
  '/api/blog-subscribe', // Blog subscription endpoint
  '/api/careers-apply', // Career application endpoint
  '/api/webhooks/(.*)', // Webhook endpoints
  '/api/payments/webhook', // Monime payment webhook (server-to-server)
  '/api/payments/success', // Monime post-payment redirect (employer payments)
  '/api/payments/pitch-success', // Monime post-payment redirect (pitch funding)
  '/payment-return(.*)', // Public post-payment landing page
  '/api/public/(.*)', // Public API routes
  '/api/portfolios/public', // Public portfolios API
  '/api/opportunities', // Public opportunities API (GET)
  '/api/stats', // Public platform stats
])

// Define routes that should be accessible to authenticated users only
const isProtectedRoute = createRouteMatcher([
  '/dashboard(.*)',
  '/onboarding(.*)',
  '/settings(.*)',
  '/mentorship(.*)',
  '/opportunities/create(.*)',
  '/opportunities/my(.*)',
])

export default clerkMiddleware(async (auth, req) => {
  // Allow public routes immediately to avoid Clerk handshake redirects
  // on external provider callbacks (e.g. Monime success webhooks/returns).
  if (isPublicRoute(req)) {
    return NextResponse.next()
  }

  const { userId } = await auth()

  // Protect authenticated routes
  if (isProtectedRoute(req) && !userId) {
    const signInUrl = new URL('/sign-in', req.url)
    signInUrl.searchParams.set('redirect_url', req.url)
    return NextResponse.redirect(signInUrl)
  }

  // For other routes, check if user is authenticated
  if (!userId) {
    // Allow API routes with proper error response
    if (req.nextUrl.pathname.startsWith('/api/')) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }
    
    // Redirect to sign-in for other routes
    const signInUrl = new URL('/sign-in', req.url)
    signInUrl.searchParams.set('redirect_url', req.url)
    return NextResponse.redirect(signInUrl)
  }

  return NextResponse.next()
})

export const config = {
  matcher: [
    // Skip Next.js internals and all static files
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    // Always run for API routes
    '/(api|trpc)(.*)',
  ],
}
