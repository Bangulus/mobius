import type { Metadata } from 'next'
import AgbPageClient from './AgbPageClient'

export const metadata: Metadata = {
  title: 'Nutzungsbedingungen | Möbius',
  description: 'Nutzungsbedingungen (AGB) von Möbius.',
}

export default function AgbPage() {
  return <AgbPageClient />
}
