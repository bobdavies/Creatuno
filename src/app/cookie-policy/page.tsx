'use client'

import React from 'react'
import Link from 'next/link'
import { MdCookie } from 'react-icons/md'
import SpotlightCard from '@/components/SpotlightCard'
import { LegalPageShell } from '@/components/landing/legal-page-shell'

const LAST_UPDATED = 'February 11, 2026'

const sections = [
  { id: 'what-are-cookies', title: '1. What Are Cookies' },
  { id: 'how-we-use', title: '2. How We Use Cookies' },
  { id: 'types', title: '3. Types of Cookies We Use' },
  { id: 'third-party', title: '4. Third-Party Cookies' },
  { id: 'managing', title: '5. Managing Cookies' },
  { id: 'changes', title: '6. Changes to This Policy' },
  { id: 'contact', title: '7. Contact Us' },
]

const cookieTable = [
  {
    category: 'Essential Cookies',
    description: 'Required for the platform to function. Cannot be disabled.',
    cookies: [
      { name: '__clerk_session', purpose: 'Maintains your authenticated session', duration: 'Session' },
      { name: '__clerk_db_jwt', purpose: 'Secure authentication token', duration: '1 year' },
      { name: '__client_uat', purpose: 'Clerk user authentication tracking', duration: '1 year' },
      { name: 'creatuno_settings', purpose: 'Stores your app preferences (theme, language)', duration: '1 year' },
    ],
  },
  {
    category: 'Functional Cookies',
    description: 'Enable enhanced features and personalisation.',
    cookies: [
      { name: 'creatuno_offline_sync', purpose: 'Tracks offline data sync state', duration: 'Persistent' },
      { name: 'creatuno_cache_version', purpose: 'Manages PWA cache versioning', duration: 'Persistent' },
      { name: 'creatuno_draft_*', purpose: 'Saves draft content (messages, posts) for offline use', duration: '30 days' },
    ],
  },
  {
    category: 'Performance Cookies',
    description: 'Help us understand how users interact with the platform.',
    cookies: [
      { name: 'creatuno_analytics', purpose: 'Anonymous usage analytics to improve the platform', duration: '1 year' },
    ],
  },
]

const relatedLinks = [
  { label: 'Privacy Policy', href: '/privacy' },
  { label: 'Terms of Service', href: '/terms' },
  { label: 'Help Center', href: '/help' },
]

export default function CookiePolicyPage() {
  return (
    <LegalPageShell
      badge={{ icon: MdCookie, label: 'Cookies' }}
      title="Cookie Policy"
      subtitle={`Last updated: ${LAST_UPDATED}`}
      sections={sections}
      relatedLinks={relatedLinks}
    >
      <section id="what-are-cookies">
        <h2>1. What Are Cookies</h2>
        <p>
          Cookies are small text files that are placed on your device when you visit a website or use a web application. They are widely used to make websites work more efficiently, provide a better user experience, and give site owners useful information.
        </p>
        <p>
          Creatuno uses cookies and similar technologies (such as IndexedDB for offline storage) to ensure the platform functions correctly, remember your preferences, and improve your experience.
        </p>
      </section>

      <section id="how-we-use">
        <h2>2. How We Use Cookies</h2>
        <p>We use cookies for the following purposes:</p>
        <ul>
          <li><strong>Authentication:</strong> To keep you signed in and secure your session</li>
          <li><strong>Preferences:</strong> To remember your settings like theme (light/dark), language (English/Krio), and notification preferences</li>
          <li><strong>Offline functionality:</strong> To support our Progressive Web App&apos;s offline capabilities, including caching content and tracking sync state</li>
          <li><strong>Performance:</strong> To understand how the platform is used and identify areas for improvement</li>
        </ul>
      </section>

      <section id="types">
        <h2>3. Types of Cookies We Use</h2>
        <p>Below is a detailed breakdown of the cookies used on Creatuno:</p>

        <div className="space-y-6 mt-4">
          {cookieTable.map((group) => (
            <div key={group.category}>
              <h3>{group.category}</h3>
              <p className="text-xs text-muted-foreground mb-3">{group.description}</p>

              {/* Desktop table */}
              <div className="hidden sm:block rounded-xl border border-border/50 overflow-hidden">
                <div className="grid grid-cols-[1fr_2fr_auto] gap-px bg-border/30">
                  <div className="bg-card/60 px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Cookie</div>
                  <div className="bg-card/60 px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Purpose</div>
                  <div className="bg-card/60 px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Duration</div>
                  {group.cookies.map((cookie) => (
                    <React.Fragment key={cookie.name}>
                      <div className="bg-card/30 px-3 py-2.5 text-xs font-mono text-foreground break-all border-t border-border/20">{cookie.name}</div>
                      <div className="bg-card/30 px-3 py-2.5 text-xs border-t border-border/20">{cookie.purpose}</div>
                      <div className="bg-card/30 px-3 py-2.5 text-xs whitespace-nowrap border-t border-border/20">{cookie.duration}</div>
                    </React.Fragment>
                  ))}
                </div>
              </div>

              {/* Mobile cards */}
              <div className="sm:hidden space-y-2">
                {group.cookies.map((cookie) => (
                  <SpotlightCard key={cookie.name} className="p-4 sm:p-5 space-y-1.5">
                    <p className="text-xs font-mono text-foreground font-medium break-all">{cookie.name}</p>
                    <p className="text-xs text-muted-foreground">{cookie.purpose}</p>
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground/70">Duration: {cookie.duration}</p>
                  </SpotlightCard>
                ))}
              </div>
            </div>
          ))}
        </div>

        <h3>IndexedDB (Offline Storage)</h3>
        <p>
          In addition to cookies, Creatuno uses IndexedDB -- a browser-based database -- to store data locally for offline access. This includes cached portfolios, messages, notifications, and draft content. This data remains on your device and is not transmitted to our servers until you sync.
        </p>
      </section>

      <section id="third-party">
        <h2>4. Third-Party Cookies</h2>
        <p>Some cookies on Creatuno are set by third-party services we use:</p>
        <ul>
          <li>
            <strong>Clerk</strong> (authentication): Sets session and authentication cookies to keep you securely signed in. Clerk&apos;s privacy practices are governed by their own privacy policy at{' '}
            <a href="https://clerk.com/privacy" target="_blank" rel="noopener noreferrer" className="text-brand-purple-600 dark:text-brand-400 hover:underline font-medium">clerk.com/privacy</a>.
          </li>
          <li>
            <strong>Supabase</strong> (backend services): May set cookies related to API communication and real-time connections. Supabase&apos;s privacy practices are governed by their privacy policy at{' '}
            <a href="https://supabase.com/privacy" target="_blank" rel="noopener noreferrer" className="text-brand-purple-600 dark:text-brand-400 hover:underline font-medium">supabase.com/privacy</a>.
          </li>
        </ul>
      </section>

      <section id="managing">
        <h2>5. Managing Your Cookie Preferences</h2>
        <p>You can manage cookies in several ways:</p>

        <h3>Browser Settings</h3>
        <p>
          Most browsers allow you to control cookies through their settings. You can typically find these options in your browser&apos;s &ldquo;Privacy&rdquo; or &ldquo;Security&rdquo; settings. Note that blocking essential cookies may prevent Creatuno from functioning properly.
        </p>

        <h3>Creatuno Settings</h3>
        <p>
          You can manage offline storage and cached data from the Creatuno{' '}
          <Link href="/settings" className="text-brand-purple-600 dark:text-brand-400 hover:underline font-medium">Settings page</Link>{' '}
          under &ldquo;Data & Storage&rdquo;. The &ldquo;Clear Cache&rdquo; option removes locally stored offline data.
        </p>

        <h3>Common Browser Links</h3>
        <ul>
          <li><a href="https://support.google.com/chrome/answer/95647" target="_blank" rel="noopener noreferrer" className="text-brand-purple-600 dark:text-brand-400 hover:underline font-medium">Google Chrome</a></li>
          <li><a href="https://support.mozilla.org/en-US/kb/cookies-information-websites-store-on-your-computer" target="_blank" rel="noopener noreferrer" className="text-brand-purple-600 dark:text-brand-400 hover:underline font-medium">Mozilla Firefox</a></li>
          <li><a href="https://support.apple.com/en-us/105082" target="_blank" rel="noopener noreferrer" className="text-brand-purple-600 dark:text-brand-400 hover:underline font-medium">Safari</a></li>
          <li><a href="https://support.microsoft.com/en-us/microsoft-edge/delete-cookies-in-microsoft-edge-63947406-40ac-c3b8-57b9-2a946a29ae09" target="_blank" rel="noopener noreferrer" className="text-brand-purple-600 dark:text-brand-400 hover:underline font-medium">Microsoft Edge</a></li>
        </ul>
      </section>

      <section id="changes">
        <h2>6. Changes to This Policy</h2>
        <p>
          We may update this Cookie Policy from time to time to reflect changes in our practices or applicable regulations. Any changes will be posted on this page with an updated &ldquo;Last updated&rdquo; date. We encourage you to review this policy periodically.
        </p>
      </section>

      <section id="contact">
        <h2>7. Contact Us</h2>
        <p>If you have questions about our use of cookies, please contact us:</p>
        <ul>
          <li>Through our <Link href="/help" className="text-brand-purple-600 dark:text-brand-400 hover:underline font-medium">Help Center</Link></li>
          <li>By email: <span className="text-foreground font-medium">privacy@creatuno.com</span></li>
        </ul>
      </section>
    </LegalPageShell>
  )
}
