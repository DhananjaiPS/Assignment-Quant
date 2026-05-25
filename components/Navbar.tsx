'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Menu, X, LayoutDashboard, UploadCloud, Activity, ShoppingBag, BellRing, Webhook, Sparkles, User as UserIcon } from 'lucide-react';
import useSWR from 'swr';
import { UserButton, useUser, useAuth } from '@clerk/nextjs';

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export default function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  
  const { user: clerkUser } = useUser();
  const { isSignedIn: clerkIsSignedIn } = useAuth();
  
  const isSignedIn = true;
  const user = clerkUser || { primaryEmailAddress: { emailAddress: 'mahakkr111@gmail.com' } };
  
  const { data: alertData } = useSWR('/api/alerts', fetcher, { refreshInterval: 5000 });

  const isLoginPage = pathname === '/login';

  const activeAlertsCount = alertData?.success ? alertData.alerts.filter((a: any) => !a.isRead).length : 0;

  const links = [
    { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
    { name: 'Ingestion Hub', href: '/upload', icon: UploadCloud },
    { name: 'Jobs Queue', href: '/jobs', icon: Activity },
    { name: 'Inventory Catalog', href: '/products', icon: ShoppingBag },
    {
      name: 'Alerts',
      href: '/alerts',
      icon: BellRing,
      badge: activeAlertsCount > 0 ? activeAlertsCount : undefined,
    },
    { name: 'Webhooks', href: '/webhooks', icon: Webhook },
  ];

  return (
    <header className="sticky top-0 z-50 w-full glass-panel border-b border-slate-200 bg-white/80 backdrop-blur-md px-6 py-4 flex items-center justify-between relative">
      <div className="flex items-center gap-2">
        <div className="bg-gradient-to-tr from-blue-500 to-blue-700 p-2 rounded-lg text-white shadow-lg animate-pulse-glow">
          <Sparkles className="w-5 h-5" />
        </div>
        <Link href="/" className="font-bold text-xl tracking-tight text-slate-900 flex items-center gap-1.5">
          Quantacus <span className="text-xs bg-blue-50 text-blue-600 font-semibold px-2 py-0.5 rounded-full border border-blue-150">PRO</span>
        </Link>
      </div>

      {/* Navigation links - only displayed when authenticated and not on login page */}
      {!isLoginPage && isSignedIn && (
        <>
          <nav className="hidden lg:flex items-center gap-1">
            {links.map((link) => {
              const Icon = link.icon;
              const isActive = pathname === link.href || (link.href !== '/' && pathname?.startsWith(link.href));

              return (
                <Link
                  key={link.name}
                  href={link.href}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-semibold transition-all ${
                    isActive
                      ? 'bg-blue-50 border border-blue-100 text-blue-600 shadow-inner'
                      : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100/60'
                  }`}
                >
                  <Icon className={`w-4 h-4 ${isActive ? 'text-blue-600' : 'text-slate-400'}`} />
                  <span>{link.name}</span>
                  {link.badge !== undefined && (
                    <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white ring-2 ring-white animate-bounce">
                      {link.badge}
                    </span>
                  )}
                </Link>
              );
            })}
          </nav>

          {/* User profile & Logout Trigger */}
          <div className="hidden md:flex items-center gap-4 border-l border-slate-200 pl-4">
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-600 bg-slate-50 border border-slate-150 px-3 py-1.5 rounded-full">
              <span>{user?.primaryEmailAddress?.emailAddress}</span>
            </div>
            
            {clerkIsSignedIn ? (
              <UserButton 
                appearance={{
                  elements: {
                    avatarBox: "w-8 h-8 rounded-xl shadow-sm border border-slate-200"
                  }
                }}
              />
            ) : (
              <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-blue-500 to-indigo-600 text-white flex items-center justify-center font-bold text-xs shadow-sm border border-blue-200" title="Signed in as guest">
                M
              </div>
            )}
          </div>
        </>
      )}

      {/* Mobile / Tablet Hamburger & Controls */}
      {!isLoginPage && isSignedIn && (
        <div className="lg:hidden flex items-center gap-3">
          {activeAlertsCount > 0 && (
            <Link href="/alerts" className="relative p-2 rounded-lg bg-slate-100 text-red-600 border border-slate-200">
              <BellRing className="w-5 h-5 animate-pulse" />
              <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[8px] font-bold text-white">
                {activeAlertsCount}
              </span>
            </Link>
          )}
          <button
            onClick={() => setIsOpen(!isOpen)}
            className="p-2 rounded-lg bg-slate-100 text-slate-600 hover:text-slate-900 border border-slate-200 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
            aria-label="Toggle menu"
          >
            {isOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      )}

      {/* Mobile Dropdown Nav Menu */}
      {isOpen && !isLoginPage && isSignedIn && (
        <div className="absolute top-[68px] left-6 right-6 bg-white border border-slate-200 rounded-2xl p-4 shadow-xl z-50 flex flex-col gap-2.5 lg:hidden animate-scale-up">
          
          <div className="flex items-center justify-between px-3 py-2 bg-slate-50 border border-slate-150 rounded-xl text-xs font-semibold text-slate-600">
            <span className="flex items-center gap-1.5"><UserIcon className="w-4 h-4 text-blue-500" /> {user?.primaryEmailAddress?.emailAddress}</span>
            {clerkIsSignedIn ? (
              <UserButton />
            ) : (
              <div className="w-6 h-6 rounded-lg bg-gradient-to-tr from-blue-500 to-indigo-600 text-white flex items-center justify-center font-bold text-[10px]">
                M
              </div>
            )}
          </div>

          {links.map((link) => {
            const Icon = link.icon;
            const isActive = pathname === link.href || (link.href !== '/' && pathname?.startsWith(link.href));

            return (
              <Link
                key={link.name}
                href={link.href}
                onClick={() => setIsOpen(false)}
                className={`flex items-center justify-between px-4 py-3 rounded-xl text-sm font-semibold transition-all ${
                  isActive
                    ? 'bg-blue-50 border border-blue-100 text-blue-600 shadow-inner'
                    : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100/60'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon className={`w-4 h-4 ${isActive ? 'text-blue-600' : 'text-slate-400'}`} />
                  <span>{link.name}</span>
                </div>
                {link.badge !== undefined && (
                  <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white ring-2 ring-white">
                    {link.badge}
                  </span>
                )}
              </Link>
            );
          })}
        </div>
      )}

      {/* Login button for signed out users on public pages */}
      {!isLoginPage && !isSignedIn && (
        <Link 
          href="/login" 
          className="hidden md:flex items-center gap-1.5 px-4 py-2 border border-blue-600 text-white bg-blue-600 hover:bg-blue-700 rounded-xl text-sm font-bold transition-all shadow-lg shadow-blue-500/20"
        >
          Sign In
        </Link>
      )}
    </header>
  );
}
