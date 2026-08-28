import type { Metadata } from 'next'
import ImpressumPageClient from './ImpressumPageClient'

export const metadata: Metadata = {
  title: 'Impressum | Möbius',
  description: 'Impressum und Anbieterkennzeichnung von Möbius gemäß § 5 TMG.',
}

export default function ImpressumPage() {
  return <ImpressumPageClient />
}
