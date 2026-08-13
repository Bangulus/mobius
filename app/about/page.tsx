import type { Metadata } from 'next'
import AboutPageClient from './AboutPageClient'

export const metadata: Metadata = {
  title: 'Über Möbius – Wie Prognosemärkte funktionieren',
  description: 'Wie Prognosemärkte kollektives Wissen in Wahrscheinlichkeiten verwandeln – erklärt mit Hayek, Christiansen und aktueller Forschung zu Spielgeld-Prognosemärkten.',
}

export default function AboutPage() {
  return <AboutPageClient />
}
