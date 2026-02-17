'use client'

import Link from 'next/link'
import { HugeiconsIcon } from '@hugeicons/react'
import { Shield01Icon } from '@hugeicons/core-free-icons'
import { LegalPageShell } from '@/components/landing/legal-page-shell'

const LAST_UPDATED = 'February 11, 2026'

const sections = [
  { id: 'introduction', title: '1. Introduction' },
  { id: 'information-we-collect', title: '2. Information We Collect' },
  { id: 'how-we-use', title: '3. How We Use Your Information' },
  { id: 'data-sharing', title: '4. Data Sharing & Disclosure' },
  { id: 'cookies', title: '5. Cookies & Tracking' },
  { id: 'data-retention', title: '6. Data Retention' },
  { id: 'your-rights', title: '7. Your Rights' },
  { id: 'data-security', title: '8. Data Security' },
  { id: 'children', title: "9. Children's Privacy" },
  { id: 'international', title: '10. International Data Transfers' },
  { id: 'changes', title: '11. Changes to This Policy' },
  { id: 'contact', title: '12. Contact Us' },
]

const relatedLinks = [
  { label: 'Terms of Service', href: '/terms' },
  { label: 'Cookie Policy', href: '/cookie-policy' },
  { label: 'Help Center', href: '/help' },
]

export default function PrivacyPolicyPage() {
  return (
    <LegalPageShell
      badge={{ icon: (props) => <HugeiconsIcon icon={Shield01Icon} {...props} />, label: 'Privacy' }}
      title="Privacy Policy"
      subtitle={`Last updated: ${LAST_UPDATED}`}
      sections={sections}
      relatedLinks={relatedLinks}
    >
      <section id="introduction">
        <h2>1. Introduction</h2>
        <p>
          Welcome to Creatuno (&ldquo;we&rdquo;, &ldquo;our&rdquo;, or &ldquo;us&rdquo;). We are committed to protecting the privacy of our users. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use the Creatuno platform, including our website and Progressive Web Application.
        </p>
        <p>
          Creatuno is an offline-first platform designed for creative professionals, mentors, employers, and investors primarily in Sierra Leone. By using our platform, you consent to the practices described in this policy.
        </p>
      </section>

      <section id="information-we-collect">
        <h2>2. Information We Collect</h2>

        <h3>Account Information</h3>
        <p>When you create an account, we collect:</p>
        <ul>
          <li>Full name and email address</li>
          <li>Profile photo (avatar)</li>
          <li>Role selection (creative, mentor, employer, or investor)</li>
          <li>Skills, bio, and location information</li>
        </ul>

        <h3>Content You Create</h3>
        <p>We store content you voluntarily provide, including:</p>
        <ul>
          <li>Portfolios, projects, and associated images or media</li>
          <li>Opportunity listings and job postings</li>
          <li>Applications, work submissions, and messages</li>
          <li>Posts, comments, and likes on the community feed</li>
          <li>Mentorship requests and feedback</li>
        </ul>

        <h3>Usage Data</h3>
        <p>We automatically collect certain information when you use Creatuno, including:</p>
        <ul>
          <li>Device information (browser type, operating system)</li>
          <li>Pages visited and features used</li>
          <li>Time and date of access</li>
          <li>Offline usage patterns and sync activity</li>
        </ul>
      </section>

      <section id="how-we-use">
        <h2>3. How We Use Your Information</h2>
        <p>We use your information to:</p>
        <ul>
          <li>Provide, maintain, and improve the Creatuno platform</li>
          <li>Enable portfolio creation, discovery, and sharing</li>
          <li>Facilitate opportunity matching, applications, and work submissions</li>
          <li>Support mentorship connections and feedback</li>
          <li>Enable messaging between users</li>
          <li>Send notifications about relevant activity</li>
          <li>Provide offline functionality and data synchronisation</li>
          <li>Analyse usage patterns to improve the platform experience</li>
          <li>Ensure platform security and prevent abuse</li>
        </ul>
      </section>

      <section id="data-sharing">
        <h2>4. Data Sharing & Disclosure</h2>
        <p>We do not sell your personal information. We may share data with:</p>
        <ul>
          <li><strong>Other users:</strong> Your public profile, portfolios, and posts are visible to other Creatuno users and the public as configured by your privacy settings.</li>
          <li><strong>Service providers:</strong> We use third-party services to operate our platform, including Clerk (authentication), Supabase (database and storage), and Vercel (hosting). These providers process data on our behalf under strict privacy agreements.</li>
          <li><strong>Legal requirements:</strong> We may disclose information if required by law, regulation, or legal process.</li>
          <li><strong>Business transfers:</strong> In the event of a merger, acquisition, or sale of assets, your data may be transferred as part of that transaction.</li>
        </ul>
      </section>

      <section id="cookies">
        <h2>5. Cookies & Tracking</h2>
        <p>
          We use cookies and similar technologies to maintain your session, remember preferences, and improve our services. For detailed information about the cookies we use, please see our{' '}
          <Link href="/cookie-policy" className="text-brand-purple-600 dark:text-brand-400 hover:underline font-medium">Cookie Policy</Link>.
        </p>
      </section>

      <section id="data-retention">
        <h2>6. Data Retention</h2>
        <p>
          We retain your personal data for as long as your account is active or as needed to provide our services. If you request account deletion, we will remove your data within 30 days, except where we are required to retain it for legal or legitimate business purposes.
        </p>
        <p>
          Offline data stored on your device through our Progressive Web App is managed locally and can be cleared through your device settings or the Creatuno Settings page.
        </p>
      </section>

      <section id="your-rights">
        <h2>7. Your Rights</h2>
        <p>Depending on your location, you may have the right to:</p>
        <ul>
          <li><strong>Access:</strong> Request a copy of the personal data we hold about you.</li>
          <li><strong>Correction:</strong> Update or correct inaccurate personal data.</li>
          <li><strong>Deletion:</strong> Request deletion of your account and associated data.</li>
          <li><strong>Data portability:</strong> Request your data in a structured, commonly used format.</li>
          <li><strong>Objection:</strong> Object to certain types of data processing.</li>
        </ul>
        <p>
          To exercise any of these rights, please contact us through our{' '}
          <Link href="/help" className="text-brand-purple-600 dark:text-brand-400 hover:underline font-medium">Help Center</Link>.
        </p>
      </section>

      <section id="data-security">
        <h2>8. Data Security</h2>
        <p>
          We implement appropriate technical and organisational security measures to protect your personal data. These include encrypted data transmission (HTTPS), secure authentication through Clerk, row-level security policies in our database, and secure file storage. However, no method of transmission over the Internet is 100% secure, and we cannot guarantee absolute security.
        </p>
      </section>

      <section id="children">
        <h2>9. Children&apos;s Privacy</h2>
        <p>
          Creatuno is not intended for children under the age of 16. We do not knowingly collect personal information from children. If we become aware that a child under 16 has provided us with personal data, we will take steps to delete that information.
        </p>
      </section>

      <section id="international">
        <h2>10. International Data Transfers</h2>
        <p>
          Your information may be transferred to and processed in countries other than your own, including the United States, where our service providers operate. We ensure that appropriate safeguards are in place for such transfers in accordance with applicable data protection laws.
        </p>
      </section>

      <section id="changes">
        <h2>11. Changes to This Policy</h2>
        <p>
          We may update this Privacy Policy from time to time. We will notify you of any material changes by posting the updated policy on this page with a new &ldquo;Last updated&rdquo; date. Your continued use of Creatuno after any changes constitutes acceptance of the updated policy.
        </p>
      </section>

      <section id="contact">
        <h2>12. Contact Us</h2>
        <p>If you have questions about this Privacy Policy or our data practices, please contact us:</p>
        <ul>
          <li>Through our <Link href="/help" className="text-brand-purple-600 dark:text-brand-400 hover:underline font-medium">Help Center</Link></li>
          <li>By email: <span className="text-foreground font-medium">privacy@creatuno.com</span></li>
        </ul>
      </section>
    </LegalPageShell>
  )
}
