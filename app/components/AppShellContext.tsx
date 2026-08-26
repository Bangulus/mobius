'use client'
import { createContext, useContext, Dispatch, SetStateAction, ReactNode } from 'react'
export const ADMIN_ID = 'b75edaf4-141d-41f1-9555-887a8ddbac58'
export interface Market {
  id: string
  question: string
  description?: string
  status: string
  b: number
  q_yes: number
  q_no: number
  closes_at: string
  group_title?: string
  short_label?: string
  category?: string
  resolved: boolean
  resolution?: string
  display_group?: string
  is_auto?: boolean
  coin?: string
  match_id?: string
  outcome?: string
  match_date?: string
  start_price?: number
  end_price?: number
}
export interface User {
  id: string
  username: string
  balance: number
  avatar_url?: string
  xp?: number
  level?: number
  rp?: number
  title?: string
  peak_title?: string
  created_at?: string
}
export type ViewType = 'markets' | 'portfolio' | 'admin' | 'profil'
export type MobileTab = 'markets' | 'portfolio' | 'ranking' | 'profil'
export type AuthMode = 'login' | 'register'
export interface AppShellContextValue {
  user: User | null
  setUser: Dispatch<SetStateAction<User | null>>
  logout: () => void
  darkMode: boolean
  setDarkMode: Dispatch<SetStateAction<boolean>>
  view: ViewType
  setView: Dispatch<SetStateAction<ViewType>>
  mobileTab: MobileTab
  category: string
  searchQuery: string
  setSearchQuery: Dispatch<SetStateAction<string>>
  selectCategory: (id: string) => void
  openAuth: (mode: AuthMode) => void
  // Seiten-spezifischer Slot in der globalen Nav-Bar (nav-left, neben dem Logo).
  // Genutzt z. B. von MarketPageClient für den Zurück-Button. null = nichts anzeigen.
  pageAction: ReactNode
  setPageAction: Dispatch<SetStateAction<ReactNode>>
}
export const AppShellContext = createContext<AppShellContextValue | null>(null)
export function useAppShell(): AppShellContextValue {
  const ctx = useContext(AppShellContext)
  if (!ctx) {
    throw new Error('useAppShell muss innerhalb von <Shell> verwendet werden')
  }
  return ctx
}
