import type { AppData } from '../lib/types'

interface GvizCell {
  v: unknown
}

interface GvizRow {
  c: (GvizCell | null)[]
}

interface GvizColumn {
  label: string | null
}

interface GvizResponse {
  table?: {
    cols?: (GvizColumn | null)[]
    rows?: (GvizRow | null)[]
  }
}

export interface AppWithDetails extends AppData {
  trackId: number
  trackName: string
  artworkUrl100: string
  primaryGenreName: string
  genres: string[]
  trackViewUrl: string
  screenshotUrls?: string[]
  ipadScreenshotUrls?: string[]
  appletvScreenshotUrls?: string[]
  dominantColor?: string
}

export class AppService {
  private static readonly SHEET_ID = '1-6D3ft-5hg-SfE_ptLmS1WOni2si73XgY9kSnBf--CM'
  private static readonly GVIZ_URL = `https://docs.google.com/spreadsheets/d/${AppService.SHEET_ID}/gviz/tq?tqx=out:json`
  
  // Use API endpoint in production, direct URL in development
  private static getSheetsUrl(): string {
    // In production (Vercel), use the API endpoint
    // In development, can use direct URL or API endpoint
    if (typeof window !== 'undefined' && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
      return '/api/sheets'
    }
    // For development, use direct URL (works locally)
    return AppService.GVIZ_URL
  }

  private static async loadAppsFromSheet(): Promise<AppData[]> {
    try {
      const url = this.getSheetsUrl()
      const response = await fetch(url)
      
      let payload: GvizResponse
      
      if (url === '/api/sheets') {
        // API endpoint returns JSON directly
        payload = await response.json()
      } else {
        // Direct Google Sheets URL returns text with JSON embedded
        const text = await response.text()
        // gviz returns JS like: google.visualization.Query.setResponse({...})
        const jsonStart = text.indexOf('{')
        const jsonEnd = text.lastIndexOf('}') + 1
        payload = JSON.parse(text.slice(jsonStart, jsonEnd))
      }

      const cols = (payload?.table?.cols ?? []).filter((col): col is GvizColumn => Boolean(col))
      const rows = (payload?.table?.rows ?? []).filter((row): row is GvizRow => Boolean(row))

      // Build a label -> index map for robust extraction
      const labelToIndex: Record<string, number> = {}
      cols.forEach((col, idx) => {
        if (typeof col.label === 'string') {
          labelToIndex[col.label.trim().toLowerCase()] = idx
        }
      })

      const getVal = (row: GvizRow, label: string) => {
        const idx = labelToIndex[label]
        if (idx == null) return null
        const cell = row.c[idx]
        return cell && cell.v != null ? cell.v : null
      }

      const apps: AppData[] = rows
        .map((row) => {
          const idRaw = getVal(row, 'id')
          const name = (getVal(row, 'name') as string | null) ?? ''
          const appStoreIdRaw = getVal(row, 'app_store_id')
          const category = (getVal(row, 'category') as string | null) ?? undefined
          const createdAt = (getVal(row, 'created_at') as string | null) ?? undefined
          const updatedAt = (getVal(row, 'updated_at') as string | null) ?? undefined

          const id = typeof idRaw === 'number' ? idRaw : parseInt(String(idRaw || '0'), 10)
          const app_store_id = appStoreIdRaw != null ? String(appStoreIdRaw) : ''

          return {
            id,
            name,
            app_store_id,
            category,
            created_at: createdAt ? String(createdAt) : undefined,
            updated_at: updatedAt ? String(updatedAt) : undefined
          } as AppData
        })
        // Filter out invalid/empty rows
        .filter(a => Number.isFinite(a.id) && a.name && a.app_store_id)

      return apps
    } catch (error) {
      console.error('Error loading apps from Google Sheet:', error)
      throw error
    }
  }

  // Fetch all apps from Supabase
  static async getAllApps(): Promise<AppData[]> {
    const apps = await this.loadAppsFromSheet()
    return apps.sort((a, b) => a.name.localeCompare(b.name))
  }

  // Fetch apps by category
  static async getAppsByCategory(categories: string[]): Promise<AppData[]> {
    if (categories.includes('all')) {
      return this.getAllApps()
    }

    const apps = await this.loadAppsFromSheet()
    const filtered = apps.filter(a => a.category && categories.includes(a.category))
    return filtered.sort((a, b) => a.name.localeCompare(b.name))
  }

  // Search apps by name and category
  static async searchAppsByCategory(searchTerm: string, categories: string[]): Promise<AppData[]> {
    const apps = await this.loadAppsFromSheet()
    const term = searchTerm.trim().toLowerCase()
    const byName = apps.filter(a => a.name.toLowerCase().includes(term))
    const result = categories.includes('all')
      ? byName
      : byName.filter(a => a.category && categories.includes(a.category))
    return result.sort((a, b) => a.name.localeCompare(b.name))
  }

  // Get app details from iTunes API
  static async getAppDetails(appStoreIds: string[]): Promise<AppWithDetails[]> {
    try {
      const batchSize = 10
      const batches = []
      
      for (let i = 0; i < appStoreIds.length; i += batchSize) {
        const batch = appStoreIds.slice(i, i + batchSize)
        batches.push(batch)
      }

      // Use API endpoint in production, direct URL in development
      const getItunesUrl = (ids: string): string => {
        if (typeof window !== 'undefined' && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
          return `/api/itunes?id=${ids}`
        }
        return `https://itunes.apple.com/lookup?id=${ids}`
      }

      const results = await Promise.all(
        batches.map(batch => {
          const url = getItunesUrl(batch.join(','))
          return fetch(url).then(res => res.json())
        })
      )

      return results.flatMap(result => result.results || [])
    } catch (error) {
      console.error('Error fetching app details:', error)
      throw error
    }
  }

  // Get dominant color from app icon
  static async getDominantColor(imageUrl: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const img = new Image()
      img.crossOrigin = 'Anonymous'
      img.onload = () => {
        const canvas = document.createElement('canvas')
        const ctx = canvas.getContext('2d')
        if (!ctx) {
          reject(new Error('Could not get canvas context'))
          return
        }

        canvas.width = img.width
        canvas.height = img.height
        ctx.drawImage(img, 0, 0)

        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
        const data = imageData.data
        const colorCounts: { [key: string]: number } = {}

        // Sample pixels to find dominant color
        for (let i = 0; i < data.length; i += 4) {
          const r = data[i]
          const g = data[i + 1]
          const b = data[i + 2]
          // Convert RGB to hex
          const hex = '#' + [r, g, b].map(x => {
            const hex = x.toString(16)
            return hex.length === 1 ? '0' + hex : hex
          }).join('')
          colorCounts[hex] = (colorCounts[hex] || 0) + 1
        }

        // Find the most common color
        let maxCount = 0
        let dominantColor = '#666666' // Fallback color
        for (const [color, count] of Object.entries(colorCounts)) {
          if (count > maxCount) {
            maxCount = count
            dominantColor = color
          }
        }

        resolve(dominantColor)
      }
      img.onerror = reject
      img.src = imageUrl
    })
  }
}
