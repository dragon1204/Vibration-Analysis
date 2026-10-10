import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { api, onAuthChange, tryRestore } from './api/client'
import { ROLE_RANK } from './utils/format'

export type Me = { id: number; email: string; name?: string; role: string; sites: string[] }

const Ctx = createContext<{ me?: Me; ready: boolean; loggedIn: boolean; can: (role: string) => boolean }>({
  ready: false, loggedIn: false, can: () => false,
})

export function AuthProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false)
  const [loggedIn, setLoggedIn] = useState(false)
  const qc = useQueryClient()
  useEffect(() => {
    tryRestore().then((ok) => {
      setLoggedIn(ok)
      setReady(true)
    })
    return onAuthChange((v) => {
      setLoggedIn(v)
      if (!v) qc.clear()
    }) as () => void
  }, [qc])
  const { data: me } = useQuery<Me>({ queryKey: ['me'], queryFn: () => api('/me'), enabled: loggedIn, staleTime: 300_000 })
  const can = (role: string) => !!me && (ROLE_RANK[me.role] || 0) >= (ROLE_RANK[role] || 99)
  return <Ctx.Provider value={{ me, ready, loggedIn, can }}>{children}</Ctx.Provider>
}

export const useAuth = () => useContext(Ctx)
