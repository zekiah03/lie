const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'https://bxewkghaljeucxekwltd.supabase.co'
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ4ZXdrZ2hhbGpldWN4ZWt3bHRkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYzNjg0MzIsImV4cCI6MjA5MTk0NDQzMn0.Efo4opmFKm9TFrKamH4Yvg44nIXP8sD9JhH5Rq7KaqM'
const TWIN_URL = process.env.NEXT_PUBLIC_TWIN_URL ?? 'https://solnova.app'
const SESSION_KEY = 'solnova_twin_session'

interface TwinSession {
  access_token: string
  refresh_token: string
  expires_at: number
}

async function getTwinToken(): Promise<string | null> {
  try {
    const stored = localStorage.getItem(SESSION_KEY)
    if (stored) {
      const s: TwinSession = JSON.parse(stored)
      if (s.expires_at > Date.now() / 1000 + 60) return s.access_token
      const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', apikey: SUPABASE_ANON_KEY },
        body: JSON.stringify({ refresh_token: s.refresh_token }),
      })
      if (res.ok) {
        const d = await res.json()
        localStorage.setItem(SESSION_KEY, JSON.stringify({ access_token: d.access_token, refresh_token: d.refresh_token, expires_at: d.expires_at }))
        return d.access_token
      }
    }
    const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=anonymous`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: SUPABASE_ANON_KEY },
    })
    if (!res.ok) return null
    const d = await res.json()
    localStorage.setItem(SESSION_KEY, JSON.stringify({ access_token: d.access_token, refresh_token: d.refresh_token, expires_at: d.expires_at }))
    return d.access_token
  } catch {
    return null
  }
}

export async function contributeToTwin(
  appId: string,
  rawData: Record<string, unknown>
): Promise<void> {
  try {
    const token = await getTwinToken()
    if (!token) return
    await fetch(`${TWIN_URL}/api/twin/contribute`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ app_id: appId, raw_data: rawData }),
    })
  } catch (e) {
    console.error('[solnova-twin]', e)
  }
}
