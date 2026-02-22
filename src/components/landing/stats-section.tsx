'use client'

import { useEffect, useRef, useState } from 'react'
import { motion, useInView } from 'motion/react'
import Counter from '@/components/Counter'

interface PlatformStats {
  creatives: number
  portfolios: number
  opportunities: number
  connections: number
}

function StatCounter({ value }: { value: number }) {
  const ref = useRef(null)
  const inView = useInView(ref, { once: true, margin: '-50px' })

  return (
    <span ref={ref}>
      {inView ? (
        <Counter
          value={value}
          fontSize={36}
          padding={0}
          gap={2}
          borderRadius={0}
          horizontalPadding={0}
          textColor="inherit"
          fontWeight="bold"
          gradientHeight={0}
          gradientFrom="transparent"
          gradientTo="transparent"
        />
      ) : (
        <span>0</span>
      )}
    </span>
  )
}

export function StatsSection() {
  const [stats, setStats] = useState<PlatformStats>({
    creatives: 0,
    portfolios: 0,
    opportunities: 0,
    connections: 0,
  })

  useEffect(() => {
    async function fetchStats() {
      try {
        const response = await fetch('/api/stats')
        if (response.ok) {
          const data = await response.json()
          setStats(data)
        }
      } catch (error) {
        console.error('Failed to fetch stats:', error)
      }
    }
    fetchStats()
  }, [])

  const items = [
    { label: 'Creative Professionals', value: stats.creatives },
    { label: 'Portfolios Created', value: stats.portfolios },
    { label: 'Opportunities Posted', value: stats.opportunities },
    { label: 'Successful Connections', value: stats.connections },
  ]

  return (
    <section className="relative border-y border-border/60 bg-card/50">
      <div className="container mx-auto px-4 sm:px-6 py-8 sm:py-10 md:py-14">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 sm:gap-8 md:gap-12">
          {items.map((stat, index) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 15 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-50px' }}
              transition={{ duration: 0.4, delay: index * 0.08 }}
              className="text-center"
            >
              <div className="text-2xl sm:text-3xl md:text-4xl font-bold text-foreground mb-0.5 sm:mb-1">
                <StatCounter value={stat.value} />
              </div>
              <div className="text-xs sm:text-sm text-muted-foreground leading-snug">{stat.label}</div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}
