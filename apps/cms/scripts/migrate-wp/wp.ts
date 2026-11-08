/**
 * Minimal WordPress REST client for the import: retries and paging.
 *
 * With WP_MIGRATE_KEY (the bright-migrate plugin, scripts/wp-plugin) every
 * core REST read goes through the plugin's proxy, which runs it as an
 * administrator: drafts/pending/private/future posts, raw content, every user
 * with email and role. The plugin also exports custom fields, SEO, terms,
 * redirects, menus and options. Without it the public API only returns
 * published content (an Application Password via WP_USER/WP_APP_PASSWORD
 * also works for drafts).
 */
export type WPRendered = { rendered: string; raw?: string }

export type WPUser = {
  id: number
  name: string
  slug: string
  description?: string
  email?: string
  roles?: string[]
  acf?: { author_image?: string }
}
export type WPTerm = { id: number; name: string; slug: string; description: string; parent?: number; count: number; acf?: Record<string, unknown> }
export type WPMedia = {
  id: number
  date_gmt: string
  modified_gmt: string
  title: WPRendered
  caption: WPRendered
  alt_text: string
  mime_type: string
  source_url: string
  media_details?: {
    width?: number
    height?: number
    file?: string
    filesize?: number
    sizes?: Record<string, { file: string; width: number; height: number; mime_type?: string }>
  }
  author: number
}
export type WPPost = {
  id: number
  type?: string
  date_gmt: string
  modified_gmt: string
  slug: string
  status: string
  link: string
  title: WPRendered
  content: WPRendered
  excerpt: WPRendered
  author: number
  featured_media: number
  categories?: number[]
  tags?: number[]
  position?: number[]
  sticky?: boolean
  format?: string
  acf?: Record<string, unknown> | []
  /** contents/v1 extras */
  primary_category?: Array<{ id: number }>
  gallery_images?: Array<{ id: number }>
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

export class WordPress {
  readonly api: string
  // iThemes Security on brighttv.co.th blocks bot-looking user agents.
  private headers: Record<string, string> = {
    'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36 brighttv-migrate',
    accept: 'application/json',
  }

  constructor(
    readonly base: string,
    auth?: { user: string; password: string },
    readonly migrateKey?: string,
  ) {
    this.base = base.replace(/\/$/, '')
    this.api = `${this.base}/wp-json/wp/v2`
    if (auth?.user && auth.password)
      this.headers.authorization = `Basic ${Buffer.from(`${auth.user}:${auth.password}`).toString('base64')}`
  }

  get authenticated() {
    return Boolean(this.headers.authorization || this.migrateKey)
  }

  private get pluginBase() {
    return `${this.base}/wp-json/bright-migrate/v1`
  }

  async fetch(url: string, tries = 6, extra: Record<string, string> = {}): Promise<Response> {
    let lastErr: unknown
    for (let i = 0; i < tries; i++) {
      try {
        const res = await fetch(url, { headers: { ...this.headers, ...extra } })
        if (res.ok || (res.status >= 400 && res.status < 500 && res.status !== 429)) return res
        lastErr = new Error(`${res.status} ${url}`)
      } catch (err) {
        lastErr = err
      }
      await sleep(Math.min(30_000, 1000 * 2 ** i))
    }
    throw lastErr
  }

  async json<T>(path: string, params: Record<string, string | number | undefined> = {}) {
    // Core routes through the plugin's admin proxy when it's configured.
    const viaProxy = Boolean(this.migrateKey) && !path.startsWith('http')
    const url = new URL(path.startsWith('http') ? path : viaProxy ? `${this.pluginBase}/proxy` : `${this.api}${path}`)
    if (viaProxy) url.searchParams.set('route', `/wp/v2${path}`)
    for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== '') url.searchParams.set(k, String(v))
    const res = await this.fetch(url.toString(), 6, viaProxy ? { 'x-migrate-key': this.migrateKey! } : {})
    if (!res.ok) throw new Error(`WordPress ${res.status}: ${url}`)
    return {
      data: (await res.json()) as T,
      total: Number(res.headers.get('x-wp-total') ?? 0),
      totalPages: Number(res.headers.get('x-wp-totalpages') ?? 1),
    }
  }

  /** Every item of a collection, page by page (oldest id first). */
  async *pages<T>(path: string, params: Record<string, string | number | undefined> = {}, startPage = 1) {
    let page = startPage
    for (;;) {
      const { data, total, totalPages } = await this.json<T[]>(path, {
        per_page: 100,
        orderby: 'id',
        order: 'asc',
        ...params,
        page,
      })
      yield { items: data, page, totalPages, total }
      if (page >= totalPages || data.length === 0) return
      page++
    }
  }

  /**
   * Posts/media one calendar month at a time (by publish date), oldest first.
   * Keeps WordPress's OFFSET small on a 170k-row table; `month` = "YYYY-MM"
   * is the resume point.
   */
  async *months<T>(path: string, params: Record<string, string | number | undefined>, from: string, to = new Date()) {
    let [y, m] = from.split('-').map(Number)
    const endKey = to.getUTCFullYear() * 12 + to.getUTCMonth()
    while (y * 12 + (m - 1) <= endKey) {
      const after = new Date(Date.UTC(y, m - 1, 1) - 1000).toISOString().slice(0, 19)
      const before = new Date(Date.UTC(y, m, 1)).toISOString().slice(0, 19)
      const month = `${y}-${String(m).padStart(2, '0')}`
      // orderby=id: stable paging (many uploads share one timestamp).
      for await (const page of this.pages<T>(path, { ...params, after, before, orderby: 'id', order: 'asc' }))
        yield { ...page, month }
      m++
      if (m > 12) {
        m = 1
        y++
      }
    }
  }

  /** GET a bright-migrate plugin endpoint; null when the plugin isn't configured or answers an error. */
  async plugin<T>(endpoint: string, params: Record<string, string | number> = {}): Promise<T | null> {
    if (!this.migrateKey) return null
    const url = new URL(`${this.pluginBase}/${endpoint}`)
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, String(v))
    const res = await this.fetch(url.toString(), 4, { 'x-migrate-key': this.migrateKey })
    if (!res.ok) {
      if (res.status === 401 || res.status === 403) throw new Error(`bright-migrate plugin refused the key (HTTP ${res.status}) — check WP_MIGRATE_KEY`)
      return null
    }
    return (await res.json()) as T
  }

  /** Yoast fields of up to 100 items; null when the plugin isn't installed. */
  seo(ids: number[]) {
    return ids.length ? this.plugin<Record<string, SeoExport>>('seo', { ids: ids.join(',') }) : Promise.resolve(null)
  }

  /** Every custom field (raw ACF + other meta) of up to 100 items. */
  meta(ids: number[]) {
    return ids.length ? this.plugin<Record<string, MetaExport>>('meta', { ids: ids.join(',') }) : Promise.resolve(null)
  }

  /** Profile custom fields of up to 100 users. */
  userMeta(ids: number[]) {
    return ids.length ? this.plugin<Record<string, UserMetaExport>>('user-meta', { ids: ids.join(',') }) : Promise.resolve(null)
  }

  /** Every term of a taxonomy with term meta, raw ACF and Yoast term SEO. */
  async terms(taxonomy: string): Promise<TermExport[] | null> {
    if (!this.migrateKey) return null
    const all: TermExport[] = []
    for (let page = 1; ; page++) {
      const items = await this.plugin<TermExport[]>('terms', { taxonomy, page })
      if (!items) return page === 1 ? null : all
      all.push(...items)
      if (items.length < 500) return all
    }
  }
}

type Fields = Record<string, unknown>
export type MetaExport = { acf: Fields; meta: Fields; template: string | null; password_protected: boolean }
export type UserMetaExport = { login: string; registered: string; url: string | null; roles: string[]; acf: Fields; meta: Fields }
export type TermExport = WPTerm & {
  acf: Fields
  meta: Fields
  seo: { title?: string; description?: string; focusKeyword?: string; canonical?: string; noindex?: boolean } | null
}

export type SeoExport = {
  title: string | null
  description: string | null
  focusKeyword: string | null
  canonical: string | null
  noindex: boolean
  nofollow: boolean
  ogTitle?: string | null
  ogDescription?: string | null
  ogImage: string | null
  primaryCategory: number | null
}
