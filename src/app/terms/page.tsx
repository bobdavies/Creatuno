'use client'

import Link from 'next/link'
import { HugeiconsIcon } from '@hugeicons/react'
import { FileAttachmentIcon } from '@hugeicons/core-free-icons'
import { LegalPageShell } from '@/components/landing/legal-page-shell'

const LAST_UPDATED = 'February 11, 2026'
const EFFECTIVE_DATE = 'February 11, 2026'

const sections = [
  { id: 'acceptance', title: '1. Acceptance of Terms' },
  { id: 'eligibility', title: '2. Eligibility' },
  { id: 'accounts', title: '3. User Accounts' },
  { id: 'content-ip', title: '4. User Content & IP' },
  { id: 'usage-rules', title: '5. Platform Usage Rules' },
  { id: 'opportunities', title: '6. Opportunities & Work' },
  { id: 'mentorship', title: '7. Mentorship' },
  { id: 'prohibited', title: '8. Prohibited Conduct' },
  { id: 'disclaimers', title: '9. Disclaimers' },
  { id: 'liability', title: '10. Limitation of Liability' },
  { id: 'indemnification', title: '11. Indemnification' },
  { id: 'termination', title: '12. Termination' },
  { id: 'governing-law', title: '13. Governing Law' },
  { id: 'changes', title: '14. Changes to Terms' },
  { id: 'contact', title: '15. Contact Us' },
]

const relatedLinks = [
  { label: 'Privacy Policy', href: '/privacy' },
  { label: 'Cookie Policy', href: '/cookie-policy' },
  { label: 'Help Center', href: '/help' },
]

export default function TermsOfServicePage() {
  return (
    <LegalPageShell
      badge={{ icon: (props) => <HugeiconsIcon icon={FileAttachmentIcon} {...props} />, label: 'Legal' }}
      title="Terms of Service"
      subtitle={`Last updated: ${LAST_UPDATED} · Effective: ${EFFECTIVE_DATE}`}
      sections={sections}
      relatedLinks={relatedLinks}
    >
      <section id="acceptance">
        <h2>1. Acceptance of Terms</h2>
        <p>
          By accessing or using Creatuno (&ldquo;the Platform&rdquo;), you agree to be bound by these Terms of Service (&ldquo;Terms&rdquo;). If you do not agree to these Terms, you may not access or use the Platform. These Terms constitute a legally binding agreement between you and Creatuno.
        </p>
      </section>

      <section id="eligibility">
        <h2>2. Eligibility</h2>
        <p>
          To use Creatuno, you must be at least 16 years of age and have the legal capacity to enter into binding agreements. By creating an account, you represent that you meet these requirements. If you are using the Platform on behalf of an organisation, you represent that you have the authority to bind that organisation to these Terms.
        </p>
      </section>

      <section id="accounts">
        <h2>3. User Accounts</h2>
        <p>
          You are responsible for maintaining the confidentiality of your account credentials and for all activity that occurs under your account. You agree to:
        </p>
        <ul>
          <li>Provide accurate, current, and complete information during registration</li>
          <li>Keep your account information up to date</li>
          <li>Notify us immediately of any unauthorised access to your account</li>
          <li>Not share your account credentials with others</li>
          <li>Not create multiple accounts for deceptive purposes</li>
        </ul>
        <p>
          We reserve the right to suspend or terminate accounts that violate these Terms or are inactive for an extended period.
        </p>
      </section>

      <section id="content-ip">
        <h2>4. User Content & Intellectual Property</h2>

        <h3>Your Content</h3>
        <p>
          You retain ownership of all content you create and upload to Creatuno, including portfolio items, project files, posts, messages, and other materials (&ldquo;User Content&rdquo;). By posting User Content, you grant Creatuno a non-exclusive, worldwide, royalty-free licence to host, store, display, and distribute your content solely for the purpose of operating and improving the Platform.
        </p>

        <h3>Intellectual Property</h3>
        <p>
          The Creatuno platform, including its design, logos, features, and original content, is owned by Creatuno and protected by intellectual property laws. You may not copy, modify, or distribute any part of the Platform without our prior written consent.
        </p>

        <h3>Respecting Others&apos; Rights</h3>
        <p>
          You agree not to upload content that infringes on the intellectual property rights of others. If you believe your work has been copied in a way that constitutes infringement, please contact us through our Help Center.
        </p>
      </section>

      <section id="usage-rules">
        <h2>5. Platform Usage Rules</h2>
        <p>When using Creatuno, you agree to:</p>
        <ul>
          <li>Use the Platform only for its intended purposes</li>
          <li>Respect other users and maintain professional conduct</li>
          <li>Provide honest and accurate information in your profile, portfolios, and applications</li>
          <li>Not use the Platform to spam, harass, or deceive others</li>
          <li>Not attempt to circumvent security measures or exploit vulnerabilities</li>
          <li>Comply with all applicable local, national, and international laws</li>
        </ul>
      </section>

      <section id="opportunities">
        <h2>6. Opportunities & Work Submissions</h2>

        <h3>For Employers</h3>
        <p>
          When posting opportunities, you agree to provide accurate descriptions, fair compensation terms, and to respond to applications in a timely manner. You are responsible for all obligations arising from hiring decisions made through the Platform.
        </p>

        <h3>For Creatives</h3>
        <p>
          When applying for opportunities, you agree to represent your skills and experience honestly. Work submissions should be original and completed according to the agreed terms. Creatives may submit revisions as requested by employers, up to the limits set by the Platform.
        </p>

        <h3>Platform Role</h3>
        <p>
          Creatuno facilitates connections between employers and creatives but is not a party to any employment or service agreement between users. We do not guarantee the quality of work, payment, or fulfilment of any obligations between users.
        </p>
      </section>

      <section id="mentorship">
        <h2>7. Mentorship</h2>
        <p>
          Creatuno provides tools to facilitate mentorship connections. Mentors and mentees participate voluntarily. We do not guarantee the quality, availability, or outcomes of any mentorship relationship. Both mentors and mentees should conduct themselves professionally and respectfully.
        </p>
      </section>

      <section id="prohibited">
        <h2>8. Prohibited Conduct</h2>
        <p>You may not:</p>
        <ul>
          <li>Use the Platform for any illegal or unauthorised purpose</li>
          <li>Upload malicious software, viruses, or harmful code</li>
          <li>Impersonate another person or misrepresent your affiliation</li>
          <li>Harvest or collect user information without consent</li>
          <li>Interfere with or disrupt the Platform or its infrastructure</li>
          <li>Post false, misleading, or defamatory content</li>
          <li>Engage in discrimination, harassment, or hate speech</li>
          <li>Use automated tools to access the Platform without permission</li>
          <li>Attempt to reverse-engineer the Platform</li>
        </ul>
      </section>

      <section id="disclaimers">
        <h2>9. Disclaimers</h2>
        <p>
          THE PLATFORM IS PROVIDED &ldquo;AS IS&rdquo; AND &ldquo;AS AVAILABLE&rdquo; WITHOUT WARRANTIES OF ANY KIND, EITHER EXPRESS OR IMPLIED. WE DO NOT WARRANT THAT THE PLATFORM WILL BE UNINTERRUPTED, ERROR-FREE, OR SECURE. WE DISCLAIM ALL WARRANTIES, INCLUDING BUT NOT LIMITED TO WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND NON-INFRINGEMENT.
        </p>
        <p>
          The offline functionality of Creatuno relies on your device&apos;s capabilities and storage. We do not guarantee that all features will work identically in offline mode.
        </p>
      </section>

      <section id="liability">
        <h2>10. Limitation of Liability</h2>
        <p>
          TO THE MAXIMUM EXTENT PERMITTED BY LAW, CREATUNO SHALL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, INCLUDING BUT NOT LIMITED TO LOSS OF PROFITS, DATA, OR GOODWILL, ARISING OUT OF OR RELATED TO YOUR USE OF THE PLATFORM.
        </p>
        <p>
          OUR TOTAL LIABILITY FOR ANY CLAIMS ARISING UNDER THESE TERMS SHALL NOT EXCEED THE AMOUNT YOU PAID TO CREATUNO IN THE TWELVE (12) MONTHS PRECEDING THE CLAIM, OR ONE HUNDRED US DOLLARS (US $100), WHICHEVER IS GREATER.
        </p>
      </section>

      <section id="indemnification">
        <h2>11. Indemnification</h2>
        <p>
          You agree to indemnify, defend, and hold harmless Creatuno, its officers, directors, employees, and agents from and against any claims, liabilities, damages, losses, and expenses (including reasonable legal fees) arising out of or related to your use of the Platform, your User Content, or your violation of these Terms.
        </p>
      </section>

      <section id="termination">
        <h2>12. Termination</h2>
        <p>
          You may terminate your account at any time by contacting our support team. We may suspend or terminate your account at any time if you violate these Terms or if we decide to discontinue the Platform. Upon termination:
        </p>
        <ul>
          <li>Your right to access the Platform will cease immediately</li>
          <li>We may retain certain data as required by law or legitimate business needs</li>
          <li>Provisions that by their nature should survive (such as intellectual property, disclaimers, and limitations of liability) will continue to apply</li>
        </ul>
      </section>

      <section id="governing-law">
        <h2>13. Governing Law</h2>
        <p>
          These Terms shall be governed by and construed in accordance with the laws of Sierra Leone, without regard to conflict of law principles. Any disputes arising from these Terms shall be resolved through good-faith negotiation first, and if necessary, through the courts of Sierra Leone.
        </p>
      </section>

      <section id="changes">
        <h2>14. Changes to Terms</h2>
        <p>
          We may update these Terms from time to time. We will notify you of material changes by posting the updated Terms on this page with a new effective date. Your continued use of the Platform after changes are posted constitutes acceptance of the revised Terms.
        </p>
      </section>

      <section id="contact">
        <h2>15. Contact Us</h2>
        <p>If you have questions about these Terms, please contact us:</p>
        <ul>
          <li>Through our <Link href="/help" className="text-brand-purple-600 dark:text-brand-400 hover:underline font-medium">Help Center</Link></li>
          <li>By email: <span className="text-foreground font-medium">legal@creatuno.com</span></li>
        </ul>
      </section>
    </LegalPageShell>
  )
}
