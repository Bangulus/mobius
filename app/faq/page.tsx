import type { Metadata } from 'next'
import FAQPageClient from './FAQPageClient'

export const metadata: Metadata = {
  title: 'FAQ – Häufige Fragen zu Prognosemärkten | Möbius',
  description: 'Wie funktionieren Prognosemärkte, Dukaten und Preisbildung auf Möbius? Antworten zu Handel, Auflösung, Limit-Orders und Datenschutz.',
}

export default function FAQPage() {
  return <FAQPageClient />
}
