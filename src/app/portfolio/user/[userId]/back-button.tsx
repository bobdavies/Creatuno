'use client'

import { HugeiconsIcon } from "@hugeicons/react";
import { ArrowLeft01Icon } from "@hugeicons/core-free-icons";
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'

export function BackButton() {
  const router = useRouter()

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={() => router.back()}
    >
      <HugeiconsIcon icon={ArrowLeft01Icon} className="w-4 h-4 mr-1" />
      Back
    </Button>
  )
}
