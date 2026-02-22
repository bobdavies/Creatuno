'use client'

import { HugeiconsIcon } from "@hugeicons/react";
import { Briefcase01Icon, Cancel01Icon, Login01Icon, Mail01Icon, Message01Icon, Mortarboard01Icon, SparklesIcon, UserAdd01Icon } from "@hugeicons/core-free-icons";
import { useState } from 'react'
import { useUser } from '@clerk/nextjs'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { motion, AnimatePresence } from 'motion/react'
import { Button } from '@/components/ui/button'
import SpotlightCard from '@/components/SpotlightCard'

interface ContactCreatorButtonProps {
  creatorName: string
  creatorUsername: string
  portfolioPath: string
}

const ease = [0.23, 1, 0.32, 1] as const

export function ContactCreatorButton({ creatorName, creatorUsername, portfolioPath }: ContactCreatorButtonProps) {
  const { user, isLoaded } = useUser()
  const router = useRouter()
  const [showDialog, setShowDialog] = useState(false)

  const redirectUrl = encodeURIComponent(portfolioPath)
  const isAuth = isLoaded && !!user

  const contactOptions = [
    {
      icon: Briefcase01Icon,
      label: 'Offer a Job / Gig',
      description: 'Hire this creative for your project',
      href: '/opportunities/create',
      color: 'from-brand-500 to-brand-purple-500',
      bg: 'bg-brand-purple-500/10 dark:bg-brand-500/10',
    },
    {
      icon: Message01Icon,
      label: 'Send a Message',
      description: 'Start a conversation',
      href: `/messages`,
      color: 'from-brand-purple-500 to-brand-purple-500',
      bg: 'bg-brand-purple-500/10',
    },
    {
      icon: Mortarboard01Icon,
      label: 'Request Mentorship',
      description: 'Learn from their experience',
      href: '/mentorship',
      color: 'from-brand-purple-500 to-brand-purple-500',
      bg: 'bg-brand-purple-500/10',
    },
  ]

  return (
    <>
      {/* Floating CTA Button — mobile sticky */}
      <div className="fixed bottom-6 left-4 right-4 z-40 sm:hidden">
        <motion.button
          onClick={() => setShowDialog(true)}
          className="w-full flex items-center justify-center gap-2 py-3.5 rounded-full bg-brand-500 text-brand-dark font-semibold text-sm shadow-lg shadow-brand-purple-500/30 dark:shadow-brand-500/30"
          whileTap={{ scale: 0.97 }}
        >
          <HugeiconsIcon icon={Mail01Icon} className="w-4 h-4" />
          Contact {creatorName.split(' ')[0]}
        </motion.button>
      </div>

      {/* Desktop CTA */}
      <motion.button
        onClick={() => setShowDialog(true)}
        className="hidden sm:inline-flex items-center gap-2 px-6 py-3 rounded-full bg-brand-500 text-brand-dark font-semibold text-sm shadow-lg shadow-brand-purple-500/20 dark:shadow-brand-500/20 hover:shadow-brand-purple-500/30 dark:shadow-brand-500/30 transition-shadow"
        whileHover={{ scale: 1.03 }}
        whileTap={{ scale: 0.97 }}
      >
        <HugeiconsIcon icon={Mail01Icon} className="w-4 h-4" />
        Contact Creator
      </motion.button>

      {/* Dialog Overlay */}
      <AnimatePresence>
        {showDialog && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={() => setShowDialog(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ duration: 0.35, ease }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-md bg-card border border-border/50 rounded-3xl p-6 shadow-2xl"
            >
              {/* Close */}
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="text-lg font-bold text-foreground">
                    {isAuth ? `Contact ${creatorName.split(' ')[0]}` : 'Sign in to Connect'}
                  </h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {isAuth
                      ? 'Choose how you would like to connect'
                      : `Create an account to hire, collaborate, or sponsor ${creatorName.split(' ')[0]}`
                    }
                  </p>
                </div>
                <button onClick={() => setShowDialog(false)} className="p-1.5 rounded-full hover:bg-muted transition-colors text-muted-foreground">
                  <HugeiconsIcon icon={Cancel01Icon} className="w-4 h-4" />
                </button>
              </div>

              {isAuth ? (
                /* ─── Authenticated ─── */
                <div className="space-y-2">
                  {contactOptions.map((opt, i) => (
                    <motion.div
                      key={opt.label}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.07, ease }}
                    >
                      <Link
                        href={opt.href}
                        className="flex items-center gap-4 p-4 rounded-2xl border border-border/50 hover:border-brand-500/30 hover:bg-muted/30 transition-all group"
                        onClick={() => setShowDialog(false)}
                      >
                        <div className={`w-10 h-10 rounded-xl ${opt.bg} flex items-center justify-center flex-shrink-0`}>
                          <HugeiconsIcon icon={opt.icon} className="w-5 h-5 text-foreground" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-foreground group-hover:text-brand-purple-600 dark:group-hover:text-brand-400 transition-colors">{opt.label}</p>
                          <p className="text-[11px] text-muted-foreground">{opt.description}</p>
                        </div>
                      </Link>
                    </motion.div>
                  ))}
                </div>
              ) : (
                /* ─── Not Authenticated ─── */
                <div className="space-y-4">
                  <div className="rounded-2xl bg-gradient-to-br from-brand-500/10 via-brand-purple-500/5 to-transparent p-5 text-center border border-brand-500/10">
                    <div className="w-12 h-12 rounded-2xl bg-brand-purple-500/10 dark:bg-brand-500/10 flex items-center justify-center mx-auto mb-3">
                      <HugeiconsIcon icon={SparklesIcon} className="w-6 h-6 text-brand-purple-600 dark:text-brand-400" />
                    </div>
                    <p className="text-sm text-foreground font-medium mb-1">Join Creatuno</p>
                    <p className="text-[11px] text-muted-foreground leading-relaxed">
                      Sign in to contact {creatorName.split(' ')[0]}, offer jobs, collaborate, or request mentorship.
                    </p>
                  </div>

                  <div className="flex flex-col gap-2">
                    <Button
                      className="w-full rounded-full bg-brand-500 hover:bg-brand-600 text-brand-dark"
                      asChild
                    >
                      <Link href={`/sign-in?redirect_url=${redirectUrl}`}>
                        <HugeiconsIcon icon={Login01Icon} className="w-4 h-4 mr-2" />
                        Sign In
                      </Link>
                    </Button>
                    <Button
                      variant="outline"
                      className="w-full rounded-full"
                      asChild
                    >
                      <Link href={`/sign-up?redirect_url=${redirectUrl}`}>
                        <HugeiconsIcon icon={UserAdd01Icon} className="w-4 h-4 mr-2" />
                        Create Account
                      </Link>
                    </Button>
                  </div>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
