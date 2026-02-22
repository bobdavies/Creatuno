import type { Metadata } from 'next'
import { OfflineContent } from './offline-content'

export const metadata: Metadata = {
  title: 'Offline',
}

export default function OfflinePage() {
  return <OfflineContent />
}
