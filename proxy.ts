import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'

// Routes that require authentication
const isProtectedRoute = createRouteMatcher([
  '/dashboard(.*)',
  '/upload(.*)',
  '/jobs(.*)',
  '/products(.*)',
  '/alerts(.*)',
  '/api-docs(.*)',
  '/api/jobs(.*)',
  '/api/products(.*)',
  '/api/alerts(.*)',
  '/api/analyze(.*)',
  '/api/upload(.*)',
  '/api/reports(.*)'
])

// Routes that are strictly public
const isPublicRoute = createRouteMatcher([
  '/',
  '/login(.*)',
  '/api/health',
  '/api/uploads(.*)'
])

export default clerkMiddleware(async (auth, req) => {
  if (isProtectedRoute(req) && !isPublicRoute(req)) {
    await auth.protect()
  }
})

export const config = {
  matcher: [
    // Skip Next.js internals and all static files, unless found in search params
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    // Always run for API routes
    '/(api|trpc)(.*)',
  ],
}
