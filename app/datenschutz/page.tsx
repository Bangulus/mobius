import type { Metadata } from 'next'
import DatenschutzPageClient from './DatenschutzPageClient'

export const metadata: Metadata = {
  title: 'Datenschutzerklärung | Möbius',
  description: 'Datenschutzerklärung von Möbius gemäß Art. 13 DSGVO.',
}

export default function DatenschutzPage() {
  return <DatenschutzPageClient />
}
