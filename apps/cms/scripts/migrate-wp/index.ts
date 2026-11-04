/**
 * WordPress (www.brighttv.co.th) → Payload (Postgres) import.
 *
 *   pnpm migrate:wp                                   # everything into DATABASE_URL
 *   pnpm migrate:wp --steps=posts --limit=1000        # try a slice first
 *   pnpm migrate:wp --steps=posts --from=2024-01      # start at a month (resume point)
 *   pnpm migrate:wp --since=2026-11-01                # delta: changed since a date (upsert)
 *   pnpm migrate:wp --steps=posts --ids=1745050,1745038
 *   pnpm migrate:wp --steps=files                     # check every media file exists in R2
 *   DATABASE_URL=postgres://…planetscale… pnpm migrate:wp   # straight into PlanetScale
 *
 * Steps (dependency order): users → categories → positions → tags → media →
 * posts → programs → lotteries → pages → counts → sequences (→ files, only when asked).
 * Re-running is safe: existing ids are skipped (or updated with --update /
 * --since); posts and media resume at the last finished month (.migrate/state.json).
 *
 * WordPress ids are kept as Payload ids; URLs (/{category}/{slug}) are
 * resolved by slug, so they survive unchanged.
 */
import 'dotenv/config'
import fs from 'node:fs'
import path from 'node:path'
import { getPayload, type Payload } from 'payload'
import { editorConfigFactory } from '@payloadcms/richtext-lexical'
import { WordPress, type SeoExport, type WPMedia, type WPPost, type WPTerm, type WPUser } from './wp'
import { htmlToLexical, mediaPathKeys, resolveMediaUrl, type MediaIndex } from './html-to-lexical'
import { cleanExcerpt, decodeEntities, decodeSlug, gmt, stripHtml } from './text'
import { copyFiles } from './files'
import { mediaLocation } from './index-helpers'
import { lexicalToHTML, type MediaLite } from '../../src/lib/lexical-html'
import { articleEditor } from '../../src/lib/editor'

process.env.PAYLOAD_SCRIPT = '1'

// ---------- options ----------
const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [k, ...v] = a.replace(/^--/, '').split('=')
    return [k, v.length ? v.join('=') : 'true']
  }),
)
const ALL_STEPS = ['users', 'categories', 'positions', 'tags', 'media', 'posts', 'programs', 'lotteries', 'pages', 'counts', 'sequences'] as const
const steps = new Set((args.steps ?? ALL_STEPS.join(',')).split(','))
const LIMIT = args.limit ? Number(args.limit) : Infinity
const SINCE = args.since ? new Date(args.since).toISOString().slice(0, 19) : undefined
/** --ids=1,2,3: re-import just these posts (implies --update). */
const IDS = args.ids
const UPDATE = args.update === 'true' || Boolean(SINCE) || Boolean(IDS)
const CONCURRENCY = Number(args.concurrency ?? 6)
/** Oldest month on brighttv.co.th (first posts: 2016-12). */
const FIRST_MONTH = '2016-01'
const WP_URL = args.wp ?? process.env.WP_URL ?? 'https://www.brighttv.co.th'

const WORK_DIR = path.resolve(import.meta.dirname, '../../.migrate')
const STATE_FILE = path.join(WORK_DIR, 'state.json')
fs.mkdirSync(WORK_DIR, { recursive: true })

type State = Record<string, { month?: string; page?: number; done?: boolean }>
const state: State = fs.existsSync(STATE_FILE) ? JSON.parse(fs.readFileSync(STATE_FILE, 'utf8')) : {}
const saveState = () => fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2))
// A filtered or partial run must not move the saved cursor.
const trackProgress = !SINCE && !IDS && LIMIT === Infinity && !args.from && args.restart !== 'true'
if (args.restart === 'true') for (const k of Object.keys(state)) delete state[k]
/** Month to start a month-by-month step at: --from, the saved cursor, or the beginning. */
const startMonth = (key: string) => args.from ?? (trackProgress ? state[key]?.month : undefined) ?? FIRST_MONTH

const ctx = { disableRevalidate: true, disableTagCounts: true, skipContentHtml: true, skipSizes: true }
const log = (...m: unknown[]) => console.log(new Date().toISOString().slice(11, 19), ...m)

async function pool<T>(items: T[], n: number, fn: (item: T) => Promise<void>) {
  let i = 0
  await Promise.all(
    Array.from({ length: Math.min(n, items.length) }, async () => {
      while (i < items.length) await fn(items[i++])
    }),
  )
}

type PG = { query: (text: string, values?: unknown[]) => Promise<{ rows: Record<string, unknown>[]; rowCount: number | null }> }
const pg = (payload: Payload) => (payload.db as unknown as { pool: PG }).pool

async function existingIds(payload: Payload, table: string): Promise<Set<number>> {
  const { rows } = await pg(payload).query(`SELECT id FROM "${table}"`)
  return new Set(rows.map((r) => Number(r.id)))
}

/**
 * Multi-row INSERT for flat tables (tags, media). New rows only: ON CONFLICT
 * DO NOTHING (also skips media whose filename+folder already exists —
 * WordPress keeps duplicate attachment records for one file). With `update`,
 * existing ids are overwritten; a batch that hits another unique index is
 * retried row by row. Returns the ids that could not be written.
 */
async function bulkUpsert(
  payload: Payload,
  table: string,
  rows: Record<string, unknown>[],
  update: boolean,
): Promise<{ written: number; skipped: number[] }> {
  if (!rows.length) return { written: 0, skipped: [] }
  const run = async (batch: Record<string, unknown>[]) => {
    const cols = Object.keys(batch[0])
    const values: unknown[] = []
    const tuples = batch.map((r) => `(${cols.map((c) => (values.push(r[c]), `$${values.length}`)).join(',')})`)
    const set = cols.filter((c) => c !== 'id').map((c) => `"${c}" = EXCLUDED."${c}"`).join(', ')
    const sql = `INSERT INTO "${table}" (${cols.map((c) => `"${c}"`).join(',')}) VALUES ${tuples.join(',')}
      ON CONFLICT ${update ? `(id) DO UPDATE SET ${set}` : 'DO NOTHING'} RETURNING id`
    const res = await pg(payload).query(sql, values)
    return new Set(res.rows.map((r) => Number(r.id)))
  }
  try {
    const ids = await run(rows)
    return { written: ids.size, skipped: rows.map((r) => Number(r.id)).filter((id) => !ids.has(id)) }
  } catch {
    let written = 0
    const skipped: number[] = []
    for (const r of rows) {
      const ok = await run([r]).catch(() => new Set<number>())
      if (ok.size) written++
      else skipped.push(Number(r.id))
    }
    return { written, skipped }
  }
}

// ---------- users ----------
const ROLE: Record<string, 'admin' | 'editor' | 'author'> = { administrator: 'admin', editor: 'editor' }

/**
 * Accounts are created without a password (WordPress hashes can't be
 * converted): each person sets one with "Forgot password". Written straight
 * to the database so Payload doesn't require a password.
 */
async function migrateUsers(payload: Payload, wp: WordPress, media: () => Promise<MediaIndex>) {
  const have = await existingIds(payload, 'users')
  const params = wp.authenticated ? { context: 'edit' } : {}
  let n = 0
  for await (const { items } of wp.pages<WPUser>('/users', params)) {
    for (const u of items) {
      if (have.has(u.id) && !UPDATE) continue
      const role = u.roles?.map((r) => ROLE[r]).find(Boolean) ?? 'author'
      const avatarUrl = typeof u.acf?.author_image === 'string' ? u.acf.author_image : ''
      const avatar = avatarUrl ? resolveMediaUrl(avatarUrl, await media()) : null
      const row = {
        id: u.id,
        name: decodeEntities(u.name),
        slug: decodeSlug(u.slug),
        bio: u.description || null,
        role,
        // The current site credits every display name; editors can turn it off per person.
        show_byline: true,
        avatar_id: avatar,
        email: (u.email || `user-${u.id}@users.brighttv.invalid`).toLowerCase(),
      }
      const cols = Object.keys(row)
      const set = cols.filter((c) => c !== 'id' && c !== 'email' && c !== 'role').map((c) => `"${c}" = EXCLUDED."${c}"`)
      await pg(payload).query(
        `INSERT INTO users (${cols.map((c) => `"${c}"`).join(',')}) VALUES (${cols.map((_, i) => `$${i + 1}`).join(',')})
         ON CONFLICT (id) DO UPDATE SET ${set.join(', ')}`,
        Object.values(row),
      )
      n++
    }
  }
  log(`users: ${n} written (no passwords — use "Forgot password" at /admin)`)
}

// ---------- taxonomies ----------
async function migrateCategories(payload: Payload, wp: WordPress) {
  const have = await existingIds(payload, 'categories')
  const all: WPTerm[] = []
  for await (const { items } of wp.pages<WPTerm>('/categories', { hide_empty: 'false', _fields: 'id,name,slug,description,parent,count,acf' }))
    all.push(...items)
  // Parents first so the relation exists.
  const depth = (c: WPTerm): number => (c.parent ? 1 + depth(all.find((p) => p.id === c.parent) ?? ({} as WPTerm)) : 0)
  all.sort((a, b) => depth(a) - depth(b))
  for (const c of all) {
    const acf = (c.acf && !Array.isArray(c.acf) ? c.acf : {}) as { heading_2?: string; contents?: string }
    const data = {
      name: decodeEntities(c.name),
      slug: decodeSlug(c.slug),
      description: c.description || undefined,
      seoHeading: acf.heading_2 || undefined,
      seoContent: acf.contents || undefined,
      parent: c.parent || undefined,
    }
    if (have.has(c.id)) {
      if (UPDATE) await payload.update({ collection: 'categories', id: c.id, data: data as never, overrideAccess: true, context: ctx })
      continue
    }
    await payload.create({ collection: 'categories', data: { id: c.id, ...data } as never, overrideAccess: true, context: ctx })
  }
  log(`categories: ${all.length}`)
}

async function migratePositions(payload: Payload, wp: WordPress) {
  const have = await existingIds(payload, 'positions')
  let n = 0
  for await (const { items } of wp.pages<WPTerm>('/position', { hide_empty: 'false' })) {
    for (const t of items) {
      if (have.has(t.id)) continue
      await payload.create({
        collection: 'positions',
        data: { id: t.id, name: decodeEntities(t.name), slug: decodeSlug(t.slug) } as never,
        overrideAccess: true,
        context: ctx,
      })
      n++
    }
  }
  log(`positions: +${n}`)
}

async function migrateTags(payload: Payload, wp: WordPress) {
  const key = 'tags'
  let n = 0
  const start = trackProgress ? (state[key]?.page ?? 0) + 1 : 1
  for await (const { items, page, totalPages, total } of wp.pages<WPTerm>('/tags', { hide_empty: 'false', _fields: 'id,name,slug,description,count' }, start)) {
    const rows = items.map((t) => ({
      id: t.id,
      name: decodeEntities(t.name).slice(0, 500) || String(t.id),
      slug: decodeSlug(t.slug),
      description: t.description || null,
      post_count: t.count,
    }))
    const res = await bulkUpsert(payload, 'tags', rows, UPDATE)
    n += res.written
    // Rows skipped on a slug clash (an encoded/decoded pair): keep them under "{slug}-{id}".
    const have = res.skipped.length ? await existingIds(payload, 'tags') : new Set<number>()
    for (const id of res.skipped.filter((id) => !have.has(id))) {
      const row = rows.find((r) => r.id === id)!
      const retry = await bulkUpsert(payload, 'tags', [{ ...row, slug: `${row.slug}-${id}` }], UPDATE)
      n += retry.written
      log(`tag ${id}: slug "${row.slug}" taken, imported as "${row.slug}-${id}"`)
    }
    if (trackProgress) {
      state[key] = { page }
      saveState()
    }
    if (page % 50 === 0 || page === totalPages) log(`tags page ${page}/${totalPages} (+${n}, ${total} in WordPress)`)
  }
}

// ---------- media ----------
function mediaRow(m: WPMedia) {
  const loc = mediaLocation(m)
  if (!loc) return null
  // WordPress already wrote the resized copies next to the original.
  const variants = Object.fromEntries(
    Object.entries(m.media_details?.sizes ?? {})
      .filter(([name, s]) => name !== 'full' && s?.file && s.file !== loc.filename)
      .map(([name, s]) => [name, { file: s.file, width: s.width, height: s.height }]),
  )
  return {
    id: m.id,
    filename: loc.filename,
    prefix: loc.prefix,
    mime_type: m.mime_type || null,
    filesize: m.media_details?.filesize ?? null,
    width: m.media_details?.width ?? null,
    height: m.media_details?.height ?? null,
    alt: m.alt_text || null,
    caption: stripHtml(m.caption?.rendered ?? '') || null,
    variants: Object.keys(variants).length ? JSON.stringify(variants) : null,
    created_at: gmt(m.date_gmt),
    updated_at: gmt(m.modified_gmt),
  }
}

async function migrateMedia(payload: Payload, wp: WordPress) {
  const key = 'media'
  let n = 0
  let seen = 0
  const params = {
    _fields: 'id,date_gmt,modified_gmt,caption,alt_text,mime_type,source_url,media_details',
    ...(SINCE ? { modified_after: SINCE } : {}),
  }
  let lastMonth = ''
  const source = SINCE
    ? (async function* () {
        for await (const p of wp.pages<WPMedia>('/media', params)) yield { ...p, month: 'since' }
      })()
    : wp.months<WPMedia>('/media', params, startMonth(key))
  for await (const { items, month, page, totalPages } of source) {
    if (trackProgress && month !== lastMonth && lastMonth) {
      state[key] = { month }
      saveState()
    }
    const rows = items.map(mediaRow).filter((r): r is NonNullable<ReturnType<typeof mediaRow>> => Boolean(r))
    const res = await bulkUpsert(payload, 'media', rows, UPDATE)
    n += res.written
    // Duplicate attachment records of one file: posts using them are mapped by path (resolveFeatured).
    if (res.skipped.length) fs.appendFileSync(path.join(WORK_DIR, 'media-skipped.log'), res.skipped.join('\n') + '\n')
    seen += items.length
    if (month !== lastMonth || page === totalPages) log(`media ${month} page ${page}/${totalPages} — written ${n}, seen ${seen}`)
    lastMonth = month
    if (seen >= LIMIT) break
  }
}

async function loadMediaIndex(payload: Payload): Promise<MediaIndex> {
  const byId = new Map<number, MediaLite>()
  const byPath = new Map<string, number>()
  // Plain SQL: 660k rows through the Local API would be slow.
  const { rows } = await pg(payload).query('SELECT id, filename, prefix, alt, width, height, variants FROM media')
  for (const r of rows) {
    const m = {
      id: Number(r.id),
      filename: r.filename as string,
      prefix: r.prefix as string,
      alt: r.alt as string | null,
      width: r.width == null ? null : Number(r.width),
      height: r.height == null ? null : Number(r.height),
      variants: r.variants as MediaLite['variants'],
    }
    byId.set(m.id, m)
    if (m.filename) for (const k of mediaPathKeys(m.prefix, m.filename)) if (!byPath.has(k)) byPath.set(k, m.id)
  }
  log(`media index: ${byId.size} items`)
  return { byId, byPath }
}

/**
 * WordPress sometimes has several attachment records for one file, or a
 * featured image missing from the media API. Map an unknown id by its path.
 */
const featuredCache = new Map<number, number | undefined>()
async function resolveFeatured(wp: WordPress, id: number, media: MediaIndex): Promise<number | undefined> {
  if (!id) return undefined
  if (media.byId.has(id)) return id
  if (featuredCache.has(id)) return featuredCache.get(id)
  let found: number | undefined
  try {
    const { data } = await wp.json<WPMedia>(`/media/${id}`, { _fields: 'id,source_url,media_details' })
    found = resolveMediaUrl(data.source_url, media) ?? undefined
  } catch {
    found = undefined
  }
  featuredCache.set(id, found)
  return found
}

// ---------- SEO (Yoast) ----------
const SITE_NAME = 'Bright TV'
/** Yoast title template → text; null when it's the default or uses variables we can't fill. */
function yoastTitle(raw: string | null, title: string) {
  if (!raw) return undefined
  const t = raw
    .replace(/%%title%%/g, title)
    .replace(/%%sitename%%/g, SITE_NAME)
    .replace(/%%sep%%/g, '-')
    .replace(/%%(page|primary_category|category)%%/g, '')
    .replace(/\s+/g, ' ')
    .replace(/\s*-\s*Bright TV\s*$/i, '')
    .trim()
  if (!t || t.includes('%%') || t === title) return undefined
  return t
}
function seoMeta(s: SeoExport | undefined, title: string, link: string) {
  if (!s) return { noindex: false, nofollow: false }
  const description = s.description && !s.description.includes('%%') ? s.description.trim() : undefined
  const canonical = s.canonical && s.canonical.replace(/\/$/, '') !== link.replace(/\/$/, '') ? s.canonical : undefined
  return {
    title: yoastTitle(s.title, title),
    description,
    focusKeyword: s.focusKeyword || undefined,
    canonical,
    noindex: s.noindex,
    nofollow: s.nofollow,
  }
}

// ---------- posts, programs, lotteries, pages ----------
const WP_STATUS: Record<string, 'published' | 'draft'> = { publish: 'published', future: 'published', draft: 'draft', pending: 'draft', private: 'draft' }
type Kind = 'posts' | 'programs' | 'lotteries' | 'pages'
const WP_ENDPOINT: Record<Kind, string> = { posts: '/posts', programs: '/program', lotteries: '/lottery', pages: '/pages' }

const acfOf = (p: WPPost) => (p.acf && !Array.isArray(p.acf) ? p.acf : {}) as Record<string, unknown>
const str = (v: unknown) => (typeof v === 'string' || typeof v === 'number' ? String(v).trim() : '')
/** ACF date "20220316" → ISO noon UTC+7 of that day. */
const acfDate = (v: unknown) => {
  const m = str(v).match(/^(\d{4})(\d{2})(\d{2})$/)
  return m ? new Date(`${m[1]}-${m[2]}-${m[3]}T05:00:00.000Z`).toISOString() : undefined
}

async function migrateContent(
  payload: Payload,
  wp: WordPress,
  kind: Kind,
  media: MediaIndex,
  editorConfig: Awaited<ReturnType<typeof editorConfigFactory.fromEditor>>,
) {
  const have = await existingIds(payload, kind)
  const tags = kind === 'posts' || kind === 'lotteries' ? await existingIds(payload, 'tags') : new Set<number>()
  const cats = kind === 'posts' ? await existingIds(payload, 'categories') : new Set<number>()
  const positions = await existingIds(payload, 'positions')
  const users = await existingIds(payload, 'users')
  const fallbackCategory = [...cats].includes(24972) ? 24972 : [...cats][0] // "news"
  const report = fs.createWriteStream(path.join(WORK_DIR, `${kind}-warnings.log`), { flags: 'a' })
  let created = 0
  let updated = 0
  let failed = 0
  let seen = 0
  const started = Date.now()

  const fields = [
    'id,type,date_gmt,modified_gmt,slug,status,link,title,content,excerpt,author,featured_media',
    kind === 'posts' ? 'categories,tags,position,sticky,format,acf,primary_category,gallery_images' : '',
    kind === 'programs' ? 'position,acf' : '',
    kind === 'lotteries' ? 'tags,acf' : '',
  ]
    .filter(Boolean)
    .join(',')
  const params: Record<string, string> = {
    _fields: fields,
    ...(wp.authenticated ? { status: 'publish,future,draft,pending,private', context: 'edit' } : {}),
    ...(SINCE ? { modified_after: SINCE } : {}),
  }

  const one = (seo: Record<string, SeoExport> | null) => async (p: WPPost) => {
    const exists = have.has(p.id)
    if (exists && !UPDATE) return
    try {
      const title = decodeEntities(p.title.rendered).trim() || `(ไม่มีชื่อ ${p.id})`
      const featured = await resolveFeatured(wp, p.featured_media, media)
      const acf = acfOf(p)
      const s = seo?.[p.id]
      const common = {
        title,
        slug: decodeSlug(p.slug) || String(p.id),
        featuredImage: featured,
        publishedAt: gmt(p.date_gmt),
        _status: WP_STATUS[p.status] ?? 'draft',
        meta: seoMeta(s, title, p.link),
        createdAt: gmt(p.date_gmt),
      }
      let data: Record<string, unknown>
      if (kind === 'lotteries') {
        data = {
          ...common,
          drawDate: acfDate(acf.date_prize) ?? gmt(p.date_gmt),
          firstPrize: str(acf.first_prize),
          nearbyFirstPrize: str(acf.nearby_first_prize),
          secondPrize: str(acf.second_prize),
          thirdPrize: str(acf.third_prize),
          fourthPrize: str(acf.fourth_prize),
          fifthPrize: str(acf.fifth_prize),
          first3Prize: str(acf.first_3_prize),
          last3Prize: str(acf.last_3_prize),
          last2Prize: str(acf.last_2_prize),
          tags: (p.tags ?? []).filter((t) => tags.has(t)),
        }
      } else {
        const { state: content, mediaIds, warnings } = htmlToLexical(p.content?.rendered ?? '', { editorConfig, media })
        warnings.forEach((w) => report.write(`${p.id}\t${w}\n`))
        const lookup = new Map<number, MediaLite>(mediaIds.map((id) => [id, media.byId.get(id)!]))
        data = {
          ...common,
          content,
          contentHtml: lexicalToHTML(content as never, lookup),
          excerpt: cleanExcerpt(p.excerpt?.raw || p.excerpt?.rendered || '') || undefined,
          author: users.has(p.author) ? p.author : undefined,
        }
        if (kind === 'posts') {
          const categories = (p.categories ?? []).filter((c) => cats.has(c))
          const yoastPrimary = s?.primaryCategory ?? p.primary_category?.[0]?.id
          const primary = yoastPrimary && cats.has(yoastPrimary) ? yoastPrimary : categories[0]
          const youtube = str((acf as { youtube_id?: unknown }).youtube_id)
          Object.assign(data, {
            categories: categories.length ? categories : [fallbackCategory],
            primaryCategory: primary ?? fallbackCategory,
            tags: (p.tags ?? []).filter((t) => tags.has(t)),
            positions: (p.position ?? []).filter((t) => positions.has(t)),
            gallery: (p.gallery_images ?? []).map((g) => g.id).filter((id) => media.byId.has(id)),
            youtubeId: /^[\w-]{11}$/.test(youtube) ? youtube : undefined,
            sticky: Boolean(p.sticky),
            format: p.format === 'video' || p.format === 'gallery' ? p.format : 'standard',
          })
        }
        if (kind === 'pages') {
          delete data.excerpt
          delete data.author
        }
        if (kind === 'programs') {
          Object.assign(data, {
            dailyOnAir: str((acf as { daily_onair?: unknown }).daily_onair) || undefined,
            positions: (p.position ?? []).filter((t) => positions.has(t)),
          })
        }
      }
      if (exists) {
        await payload.update({ collection: kind, id: p.id, data: data as never, overrideAccess: true, context: ctx })
        updated++
      } else {
        await payload.create({ collection: kind, data: { id: p.id, ...data } as never, overrideAccess: true, context: ctx })
        created++
      }
      // Keep WordPress's timestamps (the import is not an edit) — sitemaps use them.
      await pg(payload).query(`UPDATE "${kind}" SET updated_at = $2, created_at = $3 WHERE id = $1`, [p.id, gmt(p.modified_gmt), gmt(p.date_gmt)])
      await pg(payload).query(`UPDATE "_${kind}_v" SET updated_at = $2, created_at = $3, version_updated_at = $2, version_created_at = $3 WHERE parent_id = $1 AND latest`, [
        p.id,
        gmt(p.modified_gmt),
        gmt(p.date_gmt),
      ])
    } catch (err) {
      failed++
      const msg = (err as Error).message.split('\n')[0]
      const detail = (err as { data?: { errors?: { path: string; message: string }[] } }).data?.errors?.map((e) => `${e.path}: ${e.message}`).join('; ')
      report.write(`${p.id}\tFAILED\t${msg}${detail ? ` (${detail})` : ''}\n`)
      log(`${kind} ${p.id} failed: ${msg}${detail ? ` (${detail})` : ''}`)
    }
  }

  const handle = async (items: WPPost[]) => {
    const batch = items.slice(0, Math.max(0, LIMIT - seen))
    seen += batch.length
    const todo = batch.filter((p) => UPDATE || !have.has(p.id))
    const seo = kind === 'pages' ? null : await wp.seo(todo.map((p) => p.id)).catch((): null => null)
    await pool(todo, CONCURRENCY, one(seo))
  }
  const rate = () => {
    const mins = (Date.now() - started) / 60000
    return `${((created + updated) / Math.max(mins, 0.01)).toFixed(0)}/min`
  }

  if (IDS) {
    // Groups of 100 (a long include= list overflows WordPress's response headers).
    const ids = IDS.split(',')
    for (let i = 0; i < ids.length; i += 100)
      for await (const { items } of wp.pages<WPPost>(WP_ENDPOINT[kind], { ...params, include: ids.slice(i, i + 100).join(',') }))
        await handle(items)
  } else if (kind === 'pages' || SINCE) {
    // --since: everything modified after the date, whatever its publish month.
    for await (const { items, page, totalPages } of wp.pages<WPPost>(WP_ENDPOINT[kind], params)) {
      await handle(items)
      log(`${kind} page ${page}/${totalPages} — created ${created}, updated ${updated}, failed ${failed}`)
      if (seen >= LIMIT) break
    }
  } else {
    let lastMonth = ''
    for await (const { items, month, page, totalPages, total } of wp.months<WPPost>(
      WP_ENDPOINT[kind],
      params,
      startMonth(kind),
    )) {
      if (trackProgress && lastMonth && month !== lastMonth) {
        state[kind] = { month }
        saveState()
      }
      lastMonth = month
      await handle(items)
      if (page === totalPages || page % 10 === 0)
        log(`${kind} ${month} page ${page}/${totalPages} (${total} this month) — created ${created}, updated ${updated}, failed ${failed} · ${rate()}`)
      if (seen >= LIMIT) break
    }
    if (trackProgress && seen < LIMIT) {
      state[kind] = { month: lastMonth, done: true }
      saveState()
    }
  }
  report.end()
  log(`${kind}: created ${created}, updated ${updated}, failed ${failed} (warnings: .migrate/${kind}-warnings.log)`)
}

// ---------- after the import ----------
async function recountTags(payload: Payload) {
  await pg(payload).query(`
    UPDATE tags t SET post_count = c.n FROM (
      SELECT r.tags_id AS id, COUNT(*) AS n FROM posts_rels r JOIN posts p ON p.id = r.parent_id
      WHERE r.path = 'tags' AND p._status = 'published' GROUP BY r.tags_id) c
    WHERE t.id = c.id AND t.post_count IS DISTINCT FROM c.n`)
  await pg(payload).query(`
    UPDATE tags t SET post_count = 0 WHERE post_count <> 0 AND NOT EXISTS (
      SELECT 1 FROM posts_rels r JOIN posts p ON p.id = r.parent_id
      WHERE r.path = 'tags' AND r.tags_id = t.id AND p._status = 'published')`)
  log('tag post counts recalculated')
}

/**
 * Explicit ids don't move Postgres sequences. Content tables start new ids at
 * 10,000,000 so stories made in the CMS never take an id WordPress may still
 * hand out before the cutover (a later --since run would overwrite them).
 */
const WP_TABLES = new Set(['posts', 'programs', 'lotteries', 'pages', 'categories', 'tags', 'positions', 'media', 'users'])
const CMS_ID_START = 10_000_000
async function fixSequences(payload: Payload) {
  const { rows } = await pg(payload).query(`
    SELECT c.table_name, pg_get_serial_sequence(quote_ident(c.table_name), 'id') AS seq
    FROM information_schema.columns c
    WHERE c.table_schema = 'public' AND c.column_name = 'id' AND c.column_default LIKE 'nextval%'`)
  for (const r of rows) {
    if (!r.seq) continue
    const floor = WP_TABLES.has(String(r.table_name)) ? CMS_ID_START : 1
    await pg(payload).query(`SELECT setval($1, GREATEST((SELECT COALESCE(MAX(id), 0) FROM "${r.table_name}"), $2))`, [r.seq, floor])
  }
  log(`sequences: ${rows.length} moved past the imported ids (content ids from ${CMS_ID_START})`)
}

// ---------- run ----------
const wp = new WordPress(
  WP_URL,
  { user: process.env.WP_USER ?? '', password: process.env.WP_APP_PASSWORD ?? '' },
  process.env.WP_MIGRATE_KEY || undefined,
)
log(
  `WordPress ${WP_URL}${wp.authenticated ? ' (authenticated: drafts included)' : ' (public API: published content only)'}` +
    `${wp.migrateKey ? '; Yoast via bright-migrate plugin' : '; no WP_MIGRATE_KEY: Yoast titles/descriptions skipped'}`,
)

const dbSteps = [...steps].filter((s) => s !== 'files')
if (dbSteps.length) {
  const { default: config } = await import('../../src/payload.config')
  const payload = await getPayload({ config })
  const target = (process.env.DATABASE_URL ?? '').replace(/\/\/[^@]*@/, '//***@')
  log(`target: ${target}; steps: ${dbSteps.join(', ')}`)

  let mediaIndex: MediaIndex | null = null
  const media = async (): Promise<MediaIndex> => (mediaIndex ??= await loadMediaIndex(payload))

  if (steps.has('categories')) await migrateCategories(payload, wp)
  if (steps.has('positions')) await migratePositions(payload, wp)
  if (steps.has('tags')) await migrateTags(payload, wp)
  if (steps.has('media')) await migrateMedia(payload, wp)
  // Users after media: avatars point at library images.
  if (steps.has('users')) await migrateUsers(payload, wp, media)
  const content = (['posts', 'programs', 'lotteries', 'pages'] as const).filter((k) => steps.has(k))
  if (content.length) {
    const editorConfig = await editorConfigFactory.fromEditor({ config: payload.config, editor: articleEditor })
    for (const kind of content) await migrateContent(payload, wp, kind, await media(), editorConfig)
  }
  if (steps.has('counts') || steps.has('posts')) await recountTags(payload)
  if (steps.has('sequences') || content.length || steps.has('media') || steps.has('tags')) await fixSequences(payload)
}

// Files live in the R2 bucket, not the database, see files.ts.
if (steps.has('files')) {
  await copyFiles(wp, {
    concurrency: Number(args['file-concurrency'] ?? 16),
    workDir: WORK_DIR,
    since: SINCE,
  })
}

log('done')
process.exit(0)
