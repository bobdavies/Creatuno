import Link from 'next/link'
import Image from 'next/image'

const footerLinks = {
  platform: [
    { label: 'Portfolios', href: '/portfolios' },
    { label: 'Opportunities', href: '/opportunities' },
    { label: 'Mentorship', href: '/mentorship' },
    { label: 'Community Feed', href: '/feed' },
  ],
  company: [
    { label: 'About Us', href: '/about' },
    { label: 'Blog', href: '/blog' },
    { label: 'Careers', href: '/careers' },
    { label: 'Contact', href: '/contact' },
  ],
  resources: [
    { label: 'Help Center', href: '/help' },
    { label: 'Privacy Policy', href: '/privacy' },
    { label: 'Terms of Service', href: '/terms' },
    { label: 'Cookie Policy', href: '/cookie-policy' },
  ],
}

export function FooterSection() {
  return (
    <footer className="border-t border-border/60 bg-background">
      <div className="container mx-auto px-4 sm:px-6">
        {/* Main footer */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-8 sm:gap-8 py-10 sm:py-12 md:py-16">
          {/* Brand */}
          <div className="sm:col-span-2 md:col-span-1">
            <Link href="/" className="inline-block mb-3 sm:mb-4">
              <Image
                src="/branding/logo-horizontal-dark.svg"
                alt="Creatuno"
                width={140}
                height={20}
                className="h-6 w-auto dark:hidden"
              />
              <Image
                src="/branding/logo-horizontal-bright.svg"
                alt="Creatuno"
                width={140}
                height={20}
                className="h-6 w-auto hidden dark:block"
              />
            </Link>
            <p className="text-sm text-muted-foreground leading-relaxed max-w-[280px]">
              The portfolio platform for creatives who work offline. An offline-first platform for creative professionals.
            </p>
          </div>

          {/* Platform links */}
          <div>
            <h4 className="text-sm font-semibold text-foreground mb-3 sm:mb-4 uppercase tracking-wider">Platform</h4>
            <ul className="space-y-2.5 sm:space-y-3">
              {footerLinks.platform.map((link) => (
                <li key={link.label}>
                  <Link href={link.href} className="text-sm text-muted-foreground hover:text-brand-purple-500 dark:hover:text-brand-400 transition-colors py-0.5 inline-block">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Company links */}
          <div>
            <h4 className="text-sm font-semibold text-foreground mb-3 sm:mb-4 uppercase tracking-wider">Company</h4>
            <ul className="space-y-2.5 sm:space-y-3">
              {footerLinks.company.map((link) => (
                <li key={link.label}>
                  <Link href={link.href} className="text-sm text-muted-foreground hover:text-brand-purple-500 dark:hover:text-brand-400 transition-colors py-0.5 inline-block">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Resources links */}
          <div>
            <h4 className="text-sm font-semibold text-foreground mb-3 sm:mb-4 uppercase tracking-wider">Resources</h4>
            <ul className="space-y-2.5 sm:space-y-3">
              {footerLinks.resources.map((link) => (
                <li key={link.label}>
                  <Link href={link.href} className="text-sm text-muted-foreground hover:text-brand-purple-500 dark:hover:text-brand-400 transition-colors py-0.5 inline-block">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="border-t border-border/60 py-5 sm:py-6 flex flex-col sm:flex-row items-center justify-between gap-3 sm:gap-4">
          <p className="text-xs text-muted-foreground/60">
            &copy; {new Date().getFullYear()} Creatuno. All rights reserved.
          </p>
          <div className="flex items-center gap-1 text-xs text-muted-foreground/60">
            From Sierra Leone, for the world
          </div>
        </div>
      </div>
    </footer>
  )
}
