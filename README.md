# Bright TV (brighttv.co.th)

Monorepo ของเว็บไซต์และระบบจัดการเนื้อหา รันบน Cloudflare ทั้งระบบ

| แอป | คืออะไร | รันบน |
| --- | --- | --- |
| `apps/web` | เว็บไซต์ข่าว (Next.js 16) | Cloudflare Workers ผ่าน OpenNext |
| `apps/cms` | Payload CMS 3 ระบบหลังบ้านแทน WordPress | Cloudflare Workers + PlanetScale Postgres (ผ่าน Hyperdrive) + R2 (ไฟล์สื่อ) |
| `apps/lotto` | job ดึงผลสลากจากสำนักงานสลากฯ เก็บลง D1 | Cloudflare Workers (Cron Triggers) + D1 |
| `apps/data` | API อ่านอย่างเดียวของข้อมูลหวยและดูดวง (ให้เว็บเรียกแบบเดียวกับ CMS) | Cloudflare Workers + D1 |

```
packages/
  shared/  โค้ดที่ CMS และเว็บใช้ร่วมกัน (ขนาดรูปย่อ)
apps/
  web/   เว็บไซต์ — อ่านเนื้อหาจาก CMS ผ่าน REST API (หรือ WordPress เดิม ด้วย CMS_SOURCE=wordpress)
  cms/   Payload CMS — /admin สำหรับกองบรรณาธิการ
    scripts/migrate-wp/   สคริปต์ย้ายข้อมูลจาก WordPress
    scripts/wp-plugin/    ปลั๊กอินชั่วคราวฝั่ง WordPress สำหรับส่งออกค่า Yoast
```

## ทำไมใช้ Postgres ไม่ใช่ D1

ข่าว 172k เรื่อง + รูป 659k + แท็ก 170k รวม draft/เวอร์ชันแล้วประมาณ 10 GB ชนเพดาน 10 GB ของ D1
จึงใช้ PlanetScale Postgres (region AWS ap-southeast-1) ต่อผ่าน Hyperdrive ซึ่งรวมอยู่ใน Workers Paid ไม่มีค่าเพิ่ม

- Worker ของ CMS ตั้ง `placement` ไว้ที่ `aws:ap-southeast-1` ให้อยู่ใกล้ฐานข้อมูล
- บน Workers ใช้ `maxUses: 1` (ห้ามใช้ connection ข้าม request) Hyperdrive เป็นตัว pool connection จริง
- บนเครื่อง (dev, payload CLI, สคริปต์) ต่อ Postgres ตรงด้วย `DATABASE_URL`

## เริ่มต้นพัฒนา

ต้องใช้ Node 24 (`nvm use`), pnpm 10 และ Docker (Postgres บนเครื่อง)

```bash
pnpm install
pnpm db:up                                    # Postgres 17 ที่ localhost:54329
cp apps/cms/.env.example apps/cms/.env        # ใส่ PAYLOAD_SECRET (openssl rand -hex 32)
cp apps/web/.env.example apps/web/.env.local
pnpm --filter @brighttv/cms migrate:db        # สร้างตาราง
pnpm dev                                      # web :3000, cms :3001
```

- หลังบ้าน: http://localhost:3001/admin (ครั้งแรกจะให้สร้างบัญชีผู้ดูแลเอง)
- เว็บ: http://localhost:3000 — ตั้ง `CMS_SOURCE=wordpress` ใน `apps/web/.env.local` เพื่อกลับไปอ่านจาก WordPress เดิมได้ทุกเมื่อ

### แก้ schema ของ CMS

แก้ไฟล์ใน `apps/cms/src/collections` แล้ว

```bash
pnpm --filter @brighttv/cms generate:types
pnpm --filter @brighttv/cms migrate:create <ชื่อ>
pnpm --filter @brighttv/cms migrate:db
```

(ปิด `push` ไว้ ทุกการเปลี่ยน schema ต้องผ่าน migration เพื่อให้ local และ production ตรงกัน)

## โครงสร้างข้อมูลใน CMS (เทียบ WordPress)

| WordPress | Payload | หมายเหตุ |
| --- | --- | --- |
| post | `posts` | id เดิม, URL `/{หมวดหลัก}/{slug}` เหมือนเดิม (slug ไม่ซ้ำ), draft/เวอร์ชัน, ตั้งเวลาเผยแพร่ด้วย `publishedAt`, แกลเลอรี, YouTube ID |
| program | `programs` | `/program/{slug}`, เวลาออกอากาศ |
| lottery | `lotteries` | `/lottery/{slug}`, ผลรางวัลแยกช่อง (จาก ACF) |
| page | `pages` | |
| category | `categories` | หมวดแม่, คำอธิบาย + เนื้อหา SEO ท้ายหน้า (ACF heading_2 / contents) |
| post_tag | `tags` | `postCount` นับอัตโนมัติ |
| position | `positions` | ตำแหน่งบนหน้าเว็บ (Slide 1–5, Sticky…) |
| attachment | `media` | ไฟล์ใน R2 bucket `brighttv` (cdn.brighttv.co.th) key เดิมของ WP Offload Media |
| user | `users` | admin / editor / author, ไม่มีรหัสผ่าน (ใช้ “ลืมรหัสผ่าน” ตั้งใหม่) |
| Yoast SEO | `meta` (SEO plugin) | title, description, คีย์เวิร์ดหลัก, canonical, noindex/nofollow, หมวดหลัก |

เนื้อหาเก็บเป็น Lexical (แก้ไขได้ใน editor) และสร้าง `contentHtml` อัตโนมัติทุกครั้งที่บันทึก เว็บอ่าน HTML นี้โดยตรง

### รูปภาพ

ใช้ชื่อและขนาดรูปย่อเดียวกับ WordPress (`packages/shared/src/image-sizes.ts`: thumbnail, medium, medium_large, large, slide, list-thumbnail, post-thumbnail, 1536x1536)
รูปเดิม 659k ไฟล์มีรูปย่อ WebP ใน R2 อยู่แล้ว (WordPress สร้างไว้) จึงไม่ต้องสร้างใหม่ — สคริปต์ย้ายแค่บันทึกชื่อไฟล์ไว้ใน `variants`

- อัปโหลดใหม่ใน CMS: เก็บที่ `wp-content/uploads/{ปี}/{เดือน}/` และสร้างรูปย่อ WebP ด้วย Cloudflare Images binding
- ไฟล์ต้นฉบับเก็บไว้เสมอ

## ย้ายข้อมูลจาก WordPress

สคริปต์อยู่ที่ `apps/cms/scripts/migrate-wp` อ่าน WordPress REST API แล้วเขียนลง Postgres ตาม `DATABASE_URL` โดยคง id เดิม

```bash
cd apps/cms
pnpm migrate:wp --steps=posts --limit=1000   # ทดลองก่อน (วัดขนาดต่อเรื่อง)
pnpm migrate:wp                              # ทุกขั้น
pnpm migrate:wp --since=2026-11-01           # เฉพาะที่แก้ไขหลังวันที่ (อัปเดตของเดิมด้วย)
pnpm migrate:wp --steps=files                # ตรวจว่าไฟล์ทุกไฟล์มีใน R2
```

ลำดับ: categories → positions → tags → media → users → posts → programs → lotteries → pages → counts → sequences

- ข่าวและรูปดึงทีละเดือน (WordPress ไม่ต้อง OFFSET ลึก) รันซ้ำได้ จำเดือนที่ทำถึงไว้ใน `.migrate/state.json` (`--from=2020-01` เริ่มที่เดือนที่กำหนด, `--restart` เริ่มใหม่)
- ตัวเลือก: `--update` เขียนทับของเดิม, `--ids=1,2,3`, `--concurrency=6`, `--limit=N`
- **Yoast**: ค่า SEO ไม่เปิดผ่าน REST — ติดตั้ง `scripts/wp-plugin/bright-migrate.php` เป็น mu-plugin บน WordPress, ตั้ง `define('BRIGHT_MIGRATE_KEY', '...')` ใน wp-config.php และใส่ค่าเดียวกันใน `WP_MIGRATE_KEY` ของ `apps/cms/.env` (ไม่ติดตั้งก็ย้ายได้ แต่จะไม่มี SEO title/description ที่ตั้งเอง และหมวดหลักจะใช้ค่าจาก REST)
- `WP_USER` + `WP_APP_PASSWORD` (Application Password) ใน `.env` เพื่อดึงฉบับร่างและอีเมลผู้ใช้ด้วย ถ้าไม่ใส่จะได้เฉพาะที่เผยแพร่แล้ว
- ภาพที่หาในคลังสื่อไม่เจอและเรื่องที่ย้ายไม่สำเร็จ บันทึกใน `.migrate/*-warnings.log`
- ขั้น `sequences` ตั้ง id ถัดไปของเนื้อหาที่สร้างใน CMS ให้เริ่มที่ 10,000,000 ไม่ชนกับ id ที่ WordPress ยังออกให้ระหว่างรอ cutover
- ไฟล์สื่อที่ WordPress มีหลาย record ชี้ไฟล์เดียวกัน นำเข้าแค่รายการแรก (รายการที่ข้ามอยู่ใน `.migrate/media-skipped.log` ข่าวที่ใช้จะจับคู่ตาม path ไฟล์)
- ผู้ใช้ที่ย้ายมาแสดงชื่อเป็นผู้เขียนเหมือนเว็บเดิม (ปิดได้รายคนด้วย “แสดงชื่อเป็นผู้เขียน”)

### สิ่งที่ตัดสินใจไว้แล้วสำหรับตอนย้ายเข้า Payload (ยังไม่ได้ทำ)

- **หมวดบันเทิงย้ายไปอยู่ใต้หมวด "ข่าว"** (ตัดสินใจ 5 พ.ย. 2569) ข่าวบันเทิงจะเปลี่ยนจาก `/entertain/{slug}` เป็น `/news/entertain/{slug}` และบันเทิงเกาหลีจาก `/entertain/korea/{slug}` เป็น `/news/entertain/korea/{slug}` ตอนทำต้อง:
  1. ตั้ง `parent` ของหมวด `entertain` (id 5) เป็น `news` (id 24972) ตอน import ใน `apps/cms/scripts/migrate-wp` (หรือแก้ใน CMS หลัง import)
  2. `apps/web/src/lib/categories.ts`: เพิ่ม `entertain: "news"` ใน `CATEGORY_PARENT` และเอา `entertain` ออกจาก `CATEGORY_PATH_OVERRIDE`
  3. redirect 301 จาก `/entertain/:path*` ไป `/news/entertain/:path*` (ระวังอย่าให้ชนกับหน้าหมวดและหน้าอื่น) แล้วทดสอบข่าวเก่าหลายปี
  4. รอบ `--since` ตอน cutover ต้องไม่เขียน parent กลับเป็นค่าจาก WordPress
  - ผลกระทบ: URL ข่าวบันเทิงราว 42,700 อันเปลี่ยน อันดับในหมวดนี้มักแกว่งช่วงแรกระหว่างที่ Google เก็บ URL ใหม่ ตอนนี้ (ก่อนย้าย) หน้าหมวดอยู่ที่ `/news/entertain` แล้ว แต่ข่าวยังอยู่ `/entertain/{slug}`

ย้ายตรงเข้า PlanetScale ได้เลย (ไม่กินดิสก์เครื่อง): ใส่ connection string ของ PlanetScale ใน `DATABASE_URL` แล้วรัน `pnpm migrate:db` และ `pnpm migrate:wp`

## Deploy บน Cloudflare

ครั้งแรก: สร้าง resource แล้วใส่ id ใน `wrangler.jsonc` ของแต่ละแอป

```bash
cd apps/cms
# PlanetScale Postgres (สร้างใน Cloudflare dashboard → Storage & databases หรือ planetscale.com, region ap-southeast-1)
npx wrangler hyperdrive create brighttv-cms --connection-string="postgres://…"   # → id ใน apps/cms/wrangler.jsonc
npx wrangler secret put PAYLOAD_SECRET
npx wrangler secret put REVALIDATE_SECRET
npx wrangler secret put PREVIEW_SECRET
npx wrangler email sending enable notify.brighttv.co.th

cd ../web
npx wrangler d1 create brighttv-web-tags          # → database_id ใน apps/web/wrangler.jsonc
npx wrangler d1 create brighttv-web-views         # → database_id (ยอดวิวสำหรับ "ข่าวยอดนิยม")
npx wrangler d1 migrations apply brighttv-web-views --remote
npx wrangler r2 bucket create brighttv-web-cache
npx wrangler secret put REVALIDATE_SECRET         # ค่าเดียวกับฝั่ง CMS
npx wrangler secret put PREVIEW_SECRET            # ค่าเดียวกับฝั่ง CMS
npx wrangler secret put CMS_PREVIEW_API_KEY       # API key ของผู้ใช้ใน CMS
```

แล้ว deploy (จาก main):

```bash
DATABASE_URL=… pnpm --filter @brighttv/cms deploy:database   # payload migrate → PlanetScale
pnpm --filter @brighttv/cms deploy:app
pnpm --filter @brighttv/web run deploy   # SITE_NOINDEX=1 ใน wrangler.jsonc ช่วงทดสอบ new.brighttv.co.th
```

## ยอดวิว (“ข่าวยอดนิยม”)

แทนปลั๊กอิน seed-stat: หน้าข่าวส่ง beacon ไป `/api/views` นับรายชั่วโมงใน D1 `brighttv-web-views` และจัดอันดับย้อนหลัง 48 ชั่วโมง
ช่วงแรกที่ยังมีข้อมูลน้อย จะใช้รายการจาก WordPress เดิม (ถ้ายังเปิดอยู่) แล้วค่อยเป็นข่าวล่าสุด

## ผลสลาก (`/lotto`)

- `apps/lotto` (worker `brighttv-lotto`) เช็ก API ของสำนักงานสลากฯ ทุก 10 นาที ช่วง 14:00–18:59 น. ทุกวัน แล้วเก็บแต่ละงวดลง D1 `brighttv-lotto` (ตาราง `lotto_draws` หนึ่งแถวต่องวด) เขียนเฉพาะเมื่อมีงวดใหม่หรือผลเปลี่ยน แล้วยิง `/api/revalidate` (tag `lotto`) ให้เว็บอัปเดตทันที
- เว็บไม่ต่อ D1 ตรงและไม่เรียก API ของสลากฯ เอง แต่อ่านผ่าน `apps/data` (ดูหัวข้อถัดไป): `/lotto` งวดล่าสุด, `/lotto/01-11-2569` แต่ละงวด (รูปแบบเดียวกับ URL เดิมของ WordPress), ตรวจเลขกับงวดที่เปิดอยู่ และเลือกงวดย้อนหลังได้จาก sidebar
- ข้อมูลย้อนหลังตั้งแต่ มี.ค. 2553 (398 งวด ณ พ.ย. 2569) ดึงครั้งเดียวด้วย `pnpm --filter @brighttv/lotto run backfill` (รันซ้ำได้ ทับของเดิม)
- secret `REVALIDATE_SECRET` ของ `brighttv-lotto` ต้องตรงกับของ `brighttv-web`
- ทดสอบ job บนเครื่อง: `pnpm --filter @brighttv/lotto run dev` แล้วเปิด `http://localhost:8787/__scheduled`

## API ข้อมูลหวยและดูดวง (`apps/data`)

- worker `brighttv-data` (https://brighttv-data.tannysoft.workers.dev) อ่าน D1 `brighttv-lotto` และ `brighttv-horoscope` แล้วตอบเป็น JSON (GET อย่างเดียว รายการ path อยู่ใน `apps/data/src/index.ts`)
- เว็บเรียกแบบเดียวกับเรียก CMS (`apps/web/src/lib/data-api.ts`): ตอนรันบน Workers ผ่าน service binding `DATA_API`, ตอน `next build` / `next dev` ผ่าน URL (`DATA_API_URL`) หน้าที่สร้างตอน deploy จึงมีข้อมูลตั้งแต่แรก
- ต้อง deploy `brighttv-data` ก่อนเว็บ (`pnpm --filter @brighttv/data run deploy`) Workers Builds: Path `/apps/data`, Build `pnpm install --frozen-lockfile`, Deploy `pnpm exec wrangler deploy`, Watch `apps/data/*`
- ทดสอบบนเครื่อง: `pnpm --filter @brighttv/data run dev` (port 8788, อ่าน D1 จริง) แล้วรันเว็บด้วย `DATA_API_URL=http://localhost:8788`
- เมื่อย้ายข้อมูลหวย/ดูดวงเข้า Payload: แก้แค่ `lotto.ts` / `horoscope.ts` ให้เรียก API ของ CMS แทน แล้วเลิกใช้ worker นี้

## หน้าดูดวง (`/horoscope`)

- ส่วน "ดวงประจำตัวคุณ" (ตามวันเกิด/ราศี) และ "Pick a card" อ่านจาก D1 `brighttv-horoscope` (ผ่าน `apps/data`) ซึ่งตัดมาจากบทความดูดวงของเว็บ (ข้อความของหมอดูเอง มีลิงก์กลับไปบทความทุกชิ้น)
- สร้าง/อัปเดตข้อมูล: `cd apps/web && node scripts/horoscope/extract.ts` (เพิ่ม `--local` สำหรับ D1 บนเครื่องของ `apps/data`, `--dry` ดู SQL ก่อน)
  - บทความที่ใช้ทำ "ดวงประจำตัว" เลือกไว้ใน `PROFILE_SOURCES` ในสคริปต์ (เฉพาะเรื่องที่ไม่ผูกกับวันเวลา เช่น นิสัย เลขมงคล สีเสริมดวง คู่แท้) ถ้ามีบทความใหม่แบบแยก 7 วันเกิด/12 ราศี ให้เพิ่ม id และหัวข้อแล้วรันใหม่
  - Pick a card ดึงทุกบทความที่แบ่งเป็น "กอง 1/2/3" อัตโนมัติ (ตัดคำถามที่ผูกกับช่วงเวลาออก) คำถามประจำวันเปลี่ยนทุกวันตามลำดับ
- ตัวเลขศาสตร์และสีประจำวันเกิดอยู่ใน `apps/web/src/lib/horoscope-data.ts`

## Cutover (ย้ายโดเมนจริง)

1. งดแก้ไขใน WordPress
2. `pnpm migrate:wp --since=<วันที่ย้ายรอบแรก>` (ชี้ `DATABASE_URL` ไปที่ PlanetScale)
3. `apps/web/wrangler.jsonc`: เปิด routes `www.brighttv.co.th` / `brighttv.co.th`, ลบ `SITE_NOINDEX`; `apps/cms/wrangler.jsonc` และ `apps/lotto/wrangler.jsonc`: `WEB_URL=https://www.brighttv.co.th` แล้ว deploy ทุกแอป (deploy ใหม่ได้ build ID ใหม่ หน้าที่ cache ไว้ตอนยัง noindex จะไม่ถูกใช้ต่อ)
4. ล้าง cache ให้แน่ใจว่าไม่มีหน้าเก่าที่ยังเป็น noindex: Cloudflare dashboard → `brighttv.co.th` → Caching → Purge Everything แล้วสุ่มเช็ก `curl -s https://www.brighttv.co.th/<หน้าใดก็ได้> | grep 'name="robots"'` ต้องไม่มี `noindex` และ `curl https://www.brighttv.co.th/robots.txt` ต้องเป็น `Allow` พร้อมบรรทัด `Sitemap:`
5. ส่ง sitemap ใหม่ใน Search Console (`/sitemap_index.xml` และ `/news-sitemap.xml`) และสมัคร Google News Publisher Center ถ้ายังไม่ได้ทำ

## URL ของเว็บใหม่ (เทียบ WordPress)

| หน้า | URL ใหม่ | URL เดิม (redirect 301 มาที่ใหม่) |
| --- | --- | --- |
| ข่าวล่าสุดทุกหมวด | `/news` | — |
| หมวด | `/news/politics`, `/entertain/korea` (path เดียวกับที่ข่าวใช้) | `/category/news/politics`, `/category/politics`, `/politics` |
| บันเทิง | `/news/entertain` (ข่าวยังเป็น `/entertain/{slug}`) | `/entertain`, `/category/entertain` |
| ข่าวหวย | `/lotto/news` (ข่าวยังเป็น `/lotto/{slug}`) | `/category/lotto` |
| หน้าถัดไป | `/news/politics/page/2` | `?page=2`, `/category/news/politics/page/2` |
| RSS หมวด | `/feed/news/politics` | `/category/news/politics/feed` |

ตำแหน่งหมวด (หมวดย่อยอยู่ใต้หมวดไหน) อยู่ที่ `CATEGORY_PARENT` ใน `apps/web/src/lib/categories.ts` ถ้าเพิ่มหมวดย่อยใหม่ต้องเพิ่มที่นี่ด้วย
