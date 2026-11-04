import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { buildConfig } from 'payload'
import { th } from '@payloadcms/translations/languages/th'
import { en } from '@payloadcms/translations/languages/en'
import { postgresAdapter } from '@payloadcms/db-postgres'
import { r2Storage } from '@payloadcms/storage-r2'
import { seoPlugin } from '@payloadcms/plugin-seo'
import { CloudflareContext, getCloudflareContext } from '@opennextjs/cloudflare'
import type { GetPlatformProxyOptions } from 'wrangler'

import { Users } from './collections/Users'
import { Media } from './collections/Media'
import { Posts } from './collections/Posts'
import { Pages } from './collections/Pages'
import { Programs } from './collections/Programs'
import { Lotteries } from './collections/Lotteries'
import { Categories } from './collections/Categories'
import { Tags } from './collections/Tags'
import { Positions } from './collections/Positions'
import { articleEditor } from './lib/editor'
import { mediaFileURL, MEDIA_URL, WEB_URL } from './lib/env'
import { cloudflareEmailAdapter } from './lib/email'
import { postPath } from './lib/paths'

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)
const realpath = (value: string) => (fs.existsSync(value) ? fs.realpathSync(value) : undefined)

const isCLI = process.argv.some((value) => realpath(value)?.endsWith(path.join('payload', 'bin.js')))
const isProduction = process.env.NODE_ENV === 'production'
// Scripts (WordPress import) run in Node: Postgres via DATABASE_URL, R2 via Wrangler.
const isScript = process.env.PAYLOAD_SCRIPT === '1'
// `next build` only needs the config, never the database.
const isBuild = process.env.NEXT_PHASE === 'phase-production-build'
// Node (dev server, payload CLI, scripts) talks to Postgres directly;
// the deployed Worker goes through the Hyperdrive binding.
const isNode = isCLI || isScript || !isProduction

const createLog =
  (level: string, fn: typeof console.log) => (objOrMsg: object | string, msg?: string) => {
    if (typeof objOrMsg === 'string') fn(JSON.stringify({ level, msg: objOrMsg }))
    else fn(JSON.stringify({ level, ...objOrMsg, msg: msg ?? (objOrMsg as { msg?: string }).msg }))
  }

const cloudflareLogger = {
  level: process.env.PAYLOAD_LOG_LEVEL || 'info',
  trace: createLog('trace', console.debug),
  debug: createLog('debug', console.debug),
  info: createLog('info', console.log),
  warn: createLog('warn', console.warn),
  error: createLog('error', console.error),
  fatal: createLog('fatal', console.error),
  silent: () => {},
} as any // eslint-disable-line @typescript-eslint/no-explicit-any

/** R2 / Hyperdrive / Images bindings (exported for the import scripts). */
export const cloudflare = isBuild
  ? ({ env: {} } as unknown as CloudflareContext)
  : isNode
    ? await getCloudflareContextFromWrangler()
    : await getCloudflareContext({ async: true })

const hyperdrive = (cloudflare.env as unknown as { HYPERDRIVE?: { connectionString: string } }).HYPERDRIVE
const connectionString = isNode ? process.env.DATABASE_URL : hyperdrive?.connectionString

export default buildConfig({
  serverURL: process.env.CMS_URL || undefined,
  admin: {
    user: Users.slug,
    meta: { titleSuffix: ' — Bright TV CMS' },
    importMap: { baseDir: path.resolve(dirname) },
  },
  i18n: {
    supportedLanguages: { th, en },
    fallbackLanguage: 'th',
  },
  collections: [Posts, Programs, Lotteries, Pages, Categories, Tags, Positions, Media, Users],
  editor: articleEditor,
  // Forgot-password and other auth mail via Cloudflare Email Sending.
  email: cloudflareEmailAdapter,
  secret: process.env.PAYLOAD_SECRET || '',
  cors: [WEB_URL],
  typescript: { outputFile: path.resolve(dirname, 'payload-types.ts') },
  db: postgresAdapter({
    pool: {
      connectionString: connectionString || 'postgres://build:build@127.0.0.1:1/build',
      // Workers can't share a socket between requests: one use per client.
      // Hyperdrive keeps the real connections to PlanetScale warm.
      ...(isNode ? { max: Number(process.env.PG_POOL_MAX ?? 10) } : { maxUses: 1 }),
    },
    // Imported content keeps its WordPress ids (featured images, tags, ?p=ID redirects).
    allowIDOnCreate: true,
    // Schema changes always go through migrations (pnpm migrate:create).
    push: false,
    migrationDir: path.resolve(dirname, 'migrations'),
  }),
  logger: isProduction && !isNode ? cloudflareLogger : undefined,
  graphQL: { disable: true },
  plugins: [
    r2Storage({
      bucket: cloudflare.env.R2 as never,
      // Keep the per-file `prefix` (wp-content/uploads/yyyy/mm/…) without a collection prefix.
      alwaysInsertFields: true,
      collections: {
        media: {
          // Serve files straight from the public R2 domain (cdn.brighttv.co.th).
          ...(MEDIA_URL
            ? {
                disablePayloadAccessControl: true as const,
                generateFileURL: ({ filename, prefix }) => mediaFileURL(prefix, filename),
              }
            : {}),
        },
      },
    }),
    seoPlugin({
      collections: ['posts', 'programs', 'lotteries', 'pages', 'categories', 'tags'],
      uploadsCollection: 'media',
      generateTitle: ({ doc }) => (doc as { title?: string; name?: string }).title ?? (doc as { name?: string }).name ?? '',
      generateDescription: ({ doc }) =>
        (doc as { excerpt?: string; description?: string }).excerpt ?? (doc as { description?: string }).description ?? '',
      generateURL: ({ doc, collectionSlug }) => {
        const d = doc as { slug?: string; primaryCategory?: unknown }
        if (collectionSlug === 'categories') return `${WEB_URL}/category/${d.slug}`
        if (collectionSlug === 'tags') return `${WEB_URL}/tag/${d.slug}`
        if (collectionSlug === 'pages') return `${WEB_URL}/${d.slug}`
        if (collectionSlug === 'programs') return `${WEB_URL}/program/${d.slug}`
        if (collectionSlug === 'lotteries') return `${WEB_URL}/lottery/${d.slug}`
        return `${WEB_URL}${postPath(d)}`
      },
      // Yoast values kept from WordPress.
      fields: ({ defaultFields }) => [
        ...defaultFields,
        { name: 'focusKeyword', label: 'คีย์เวิร์ดหลัก', type: 'text' },
        { name: 'canonical', label: 'Canonical URL', type: 'text', admin: { description: 'เว้นว่าง = URL ของหน้านี้' } },
        { name: 'noindex', label: 'noindex', type: 'checkbox', defaultValue: false },
        { name: 'nofollow', label: 'nofollow', type: 'checkbox', defaultValue: false },
      ],
    }),
  ],
})

// Adapted from the Payload Cloudflare template / opennextjs-cloudflare getCloudflareContext.
function getCloudflareContextFromWrangler(): Promise<CloudflareContext> {
  // PAYLOAD_REMOTE=1 (scripts that touch R2) uses the real bucket via the "remote" env.
  const remote = process.env.PAYLOAD_REMOTE === '1'
  return import(/* webpackIgnore: true */ `${'__wrangler'.replaceAll('_', '')}`).then(({ getPlatformProxy }) =>
    getPlatformProxy({
      environment: remote ? 'remote' : process.env.CLOUDFLARE_ENV,
      remoteBindings: remote,
      persist: process.env.WRANGLER_PERSIST_TO ? { path: process.env.WRANGLER_PERSIST_TO } : undefined,
    } satisfies GetPlatformProxyOptions),
  )
}
