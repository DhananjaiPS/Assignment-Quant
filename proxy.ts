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
  // Allow all routes to be accessed publicly so recruiters/guests don't get forced to login
})

export const config = {
  matcher: [
    // Skip Next.js internals and all static files, unless found in search params
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    // Always run for API routes
    '/(api|trpc)(.*)',
  ],
}
