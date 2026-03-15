/**
 * Shared helpers for invoice Edge Functions.
 *
 * Handles reliable image downloading from Supabase Storage using
 * the service role client (bypasses all RLS), with format detection
 * via magic bytes and WebP→JPEG conversion through the authenticated
 * image transformation render endpoint.
 */

import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { InvoiceItem, InvoiceData, detectImageFormat } from './invoice-pdf.ts'

const IMAGE_BUCKET = 'public-images'
const DEFAULT_FX_RATE = 655.957

// ─── env helpers ─────────────────────────────────────────────────────────────

function getSupabaseUrl(): string {
  return (typeof Deno !== 'undefined' ? Deno.env.get('SUPABASE_URL') : '') || ''
}

function getServiceRoleKey(): string {
  return (typeof Deno !== 'undefined' ? Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') : '') || ''
}

// ─── image helpers ──────────────────────────────────────────────────────────

/**
 * Normalize a storage path. Handles:
 *   - Full public URLs (extracts relative path from the URL)
 *   - Paths accidentally prefixed with the bucket name
 *   - Clean relative paths (returned as-is)
 */
function normalizeStoragePath(raw: string): string {
  if (!raw) return raw

  if (raw.startsWith('http')) {
    const markers = [
      `/object/public/${IMAGE_BUCKET}/`,
      `/storage/v1/object/public/${IMAGE_BUCKET}/`,
      `/object/public/`,
      `/storage/v1/object/public/`,
    ]
    for (const m of markers) {
      const idx = raw.indexOf(m)
      if (idx >= 0) return raw.slice(idx + m.length)
    }
    try { return new URL(raw).pathname.replace(/^\/+/, '') } catch { /* fall through */ }
  }

  if (raw.startsWith(`${IMAGE_BUCKET}/`)) return raw.slice(IMAGE_BUCKET.length + 1)
  return raw
}

/**
 * Download image bytes from Storage using the service role client.
 * Detects format from magic bytes. For WebP (unsupported by pdf-lib),
 * converts to JPEG via the authenticated image transformation endpoint.
 */
export async function fetchImageBytes(
  supabase: SupabaseClient,
  supabaseUrl: string,
  rawPath: string,
): Promise<{ bytes: Uint8Array; format: 'png' | 'jpeg' } | null> {
  if (!rawPath) return null

  const storagePath = normalizeStoragePath(rawPath)
  console.log(`[invoice] fetchImageBytes: raw="${rawPath}" → normalized="${storagePath}"`)

  try {
    // 1) Direct download via service role client
    const { data: blob, error } = await supabase.storage
      .from(IMAGE_BUCKET)
      .download(storagePath)

    if (error || !blob) {
      console.warn(`[invoice] Storage download FAILED for "${storagePath}":`, error?.message)
      // Try public URL as fallback for download
      return await fetchViaPublicUrl(supabaseUrl, storagePath)
    }

    const bytes = new Uint8Array(await blob.arrayBuffer())
    if (bytes.length < 100) {
      console.warn(`[invoice] Image "${storagePath}" too small (${bytes.length} bytes), skipping`)
      return null
    }

    const fmt = detectImageFormat(bytes)
    console.log(`[invoice] Image "${storagePath}": ${fmt}, ${bytes.length} bytes`)

    if (fmt === 'png') return { bytes, format: 'png' }
    if (fmt === 'jpeg') return { bytes, format: 'jpeg' }

    // WebP or unknown → try conversion
    if (fmt === 'webp' || fmt === 'unknown') {
      console.log(`[invoice] Converting "${storagePath}" (${fmt}) → JPEG via render endpoint`)
      const converted = await convertViaRenderEndpoint(supabase, supabaseUrl, storagePath)
      if (converted) return converted
      console.warn(`[invoice] All conversion methods failed for "${storagePath}"`)
    }

    return null
  } catch (e) {
    console.warn(`[invoice] fetchImageBytes error for "${storagePath}":`, (e as Error).message)
    return null
  }
}

/**
 * Fallback: fetch image bytes via its public URL (for public buckets).
 */
async function fetchViaPublicUrl(
  supabaseUrl: string,
  storagePath: string,
): Promise<{ bytes: Uint8Array; format: 'png' | 'jpeg' } | null> {
  try {
    const url = `${supabaseUrl}/storage/v1/object/public/${IMAGE_BUCKET}/${storagePath}`
    console.log(`[invoice] Trying public URL: ${url}`)
    const res = await fetch(url)
    if (!res.ok) {
      console.warn(`[invoice] Public URL ${res.status} for "${storagePath}"`)
      return null
    }
    const bytes = new Uint8Array(await res.arrayBuffer())
    if (bytes.length < 100) return null

    const fmt = detectImageFormat(bytes)
    if (fmt === 'png') return { bytes, format: 'png' }
    if (fmt === 'jpeg') return { bytes, format: 'jpeg' }

    console.warn(`[invoice] Public URL returned ${fmt} (${bytes.length} bytes) — not embeddable`)
    return null
  } catch (e) {
    console.warn(`[invoice] Public URL error:`, (e as Error).message)
    return null
  }
}

/**
 * Convert a WebP (or unknown-format) image to JPEG/PNG using Supabase's
 * image transformation pipeline.
 *
 * Tries in order:
 *   1. Authenticated render endpoint (service role — works regardless of bucket policies)
 *   2. Public render endpoint (works for public buckets)
 *   3. Signed URL with transform parameters
 */
async function convertViaRenderEndpoint(
  supabase: SupabaseClient,
  supabaseUrl: string,
  storagePath: string,
): Promise<{ bytes: Uint8Array; format: 'png' | 'jpeg' } | null> {
  const serviceKey = getServiceRoleKey()
  const renderParams = 'width=200&height=200&resize=contain&format=jpeg&quality=80'

  const checkResult = (bytes: Uint8Array): { bytes: Uint8Array; format: 'png' | 'jpeg' } | null => {
    if (bytes.length < 100) return null
    const fmt = detectImageFormat(bytes)
    if (fmt === 'jpeg') return { bytes, format: 'jpeg' }
    if (fmt === 'png') return { bytes, format: 'png' }
    return null
  }

  // 1. Authenticated render endpoint
  if (serviceKey) {
    try {
      const authUrl = `${supabaseUrl}/storage/v1/render/image/authenticated/${IMAGE_BUCKET}/${storagePath}?${renderParams}`
      const res = await fetch(authUrl, {
        headers: { Authorization: `Bearer ${serviceKey}`, apikey: serviceKey },
      })
      if (res.ok) {
        const result = checkResult(new Uint8Array(await res.arrayBuffer()))
        if (result) {
          console.log(`[invoice] Authenticated render OK for "${storagePath}" (${result.format}, ${result.bytes.length} bytes)`)
          return result
        }
      } else {
        console.warn(`[invoice] Authenticated render ${res.status} for "${storagePath}"`)
      }
    } catch (e) {
      console.warn(`[invoice] Authenticated render error:`, (e as Error).message)
    }
  }

  // 2. Public render endpoint
  try {
    const publicUrl = `${supabaseUrl}/storage/v1/render/image/public/${IMAGE_BUCKET}/${storagePath}?${renderParams}`
    const res = await fetch(publicUrl)
    if (res.ok) {
      const result = checkResult(new Uint8Array(await res.arrayBuffer()))
      if (result) {
        console.log(`[invoice] Public render OK for "${storagePath}" (${result.format}, ${result.bytes.length} bytes)`)
        return result
      }
    } else {
      console.warn(`[invoice] Public render ${res.status} for "${storagePath}"`)
    }
  } catch (e) {
    console.warn(`[invoice] Public render error:`, (e as Error).message)
  }

  // 3. Signed URL with transform (another way to trigger the transformation pipeline)
  try {
    const { data: signedData } = await supabase.storage
      .from(IMAGE_BUCKET)
      .createSignedUrl(storagePath, 120, {
        transform: { width: 200, height: 200 },
      } as any)
    if (signedData?.signedUrl) {
      const res = await fetch(signedData.signedUrl)
      if (res.ok) {
        const result = checkResult(new Uint8Array(await res.arrayBuffer()))
        if (result) {
          console.log(`[invoice] Signed URL transform OK for "${storagePath}" (${result.format}, ${result.bytes.length} bytes)`)
          return result
        }
      } else {
        console.warn(`[invoice] Signed URL transform ${res.status} for "${storagePath}"`)
      }
    }
  } catch (e) {
    console.warn(`[invoice] Signed URL transform error:`, (e as Error).message)
  }

  return null
}

/**
 * Download logo bytes from Storage. Tries multiple paths in order.
 */
export async function fetchLogoBytes(
  supabase: SupabaseClient,
  supabaseUrl: string,
): Promise<Uint8Array | null> {
  const configuredPath = (typeof Deno !== 'undefined' ? Deno.env.get('INVOICE_LOGO_PATH') : '') || ''

  const pathsToTry = [
    configuredPath,
    'brand/invoice-logo.png',
    'brand/logo.png',
    'logo/logo.png',
    'logo.png',
  ].filter(Boolean)

  for (const path of pathsToTry) {
    try {
      const { data: blob, error } = await supabase.storage
        .from(IMAGE_BUCKET)
        .download(path)
      if (!error && blob) {
        const bytes = new Uint8Array(await blob.arrayBuffer())
        if (bytes.length > 100) {
          const fmt = detectImageFormat(bytes)
          if (fmt === 'png' || fmt === 'jpeg') {
            console.log(`[invoice] Logo loaded from "${path}" (${fmt}, ${bytes.length} bytes)`)
            return bytes
          }
          const converted = await convertViaRenderEndpoint(supabase, supabaseUrl, path)
          if (converted) {
            console.log(`[invoice] Logo loaded from "${path}" via render conversion`)
            return converted.bytes
          }
        }
      }
    } catch {
      continue
    }
  }

  console.log('[invoice] No logo found in Storage, text fallback will be used')
  return null
}

// ─── locale / currency detection ────────────────────────────────────────────

/**
 * Derive the order locale ('FR' | 'CI') from the best available data.
 *
 * After paystack-verify, payment_data is overwritten with the raw Paystack
 * transaction object. The locale then lives inside payment_data.metadata
 * (set during paystack-initialize), NOT at the top level.
 *
 * Priority:
 *   1. order.locale                 (column set by paystack-initialize)
 *   2. payment_data.locale          (top-level, set by paystack-initialize before verify)
 *   3. payment_data.metadata.locale (inside Paystack txn response after verify)
 *   4. payment_data.country / .market
 *   5. Fallback: 'CI'
 */
function resolveLocale(order: any): 'FR' | 'CI' {
  const match = (v: any): 'FR' | 'CI' | null => {
    const s = (v || '').toString().toUpperCase()
    if (s === 'FR') return 'FR'
    if (s === 'CI') return 'CI'
    return null
  }

  if (order.locale) {
    const r = match(order.locale)
    if (r) return r
  }

  const pd = order.payment_data
  if (pd && typeof pd === 'object') {
    const r1 = match(pd.locale) || match(pd.country) || match(pd.market)
    if (r1) return r1

    const meta = pd.metadata
    if (meta && typeof meta === 'object') {
      const r2 = match(meta.locale) || match(meta.country) || match(meta.market)
      if (r2) return r2
    }
  }

  return 'CI'
}

/**
 * Derive the invoice display currency.
 *   FR → EUR  (item prices already stored in EUR)
 *   CI → XOF  (item prices stored in EUR, will be converted)
 */
function resolveCurrency(locale: 'FR' | 'CI'): 'EUR' | 'XOF' {
  return locale === 'FR' ? 'EUR' : 'XOF'
}

// ─── invoice data builder ───────────────────────────────────────────────────

/**
 * Build a complete InvoiceData object from a raw Supabase order row
 * (with nested client, items, variant, produit, taille, colors).
 *
 * Downloads product thumbnails and logo from Storage.
 *
 * Currency handling:
 *   - `commande_item.prix_unitaire` is ALWAYS stored in EUR.
 *   - For FR orders: invoice displays EUR — no conversion needed.
 *   - For CI orders: invoice displays XOF — prices are converted
 *     using the FX rate (EUR × rate = XOF).
 *   - `commande.shipping_cost` / `commande.express_cost` are stored in the
 *     order's native currency by paystack-initialize; NOT re-converted here.
 *   - Grand total is ALWAYS computed from items + shipping + express to
 *     avoid trusting `commande.total` which may be stale or in EUR.
 */
export async function buildInvoiceData(
  supabase: SupabaseClient,
  supabaseUrl: string,
  order: any,
  orderId: string,
): Promise<InvoiceData> {
  const client = order.client
  const locale = resolveLocale(order)
  const currency = resolveCurrency(locale)
  const orderItems = order.items || []

  // FX rate (EUR → XOF)
  const envRate = typeof Deno !== 'undefined' ? Deno.env.get('EUR_XOF_FALLBACK_RATE') : ''
  const fxRate = envRate ? parseFloat(envRate) : DEFAULT_FX_RATE

  console.log(`[invoice-helpers] locale=${locale} currency=${currency} fxRate=${fxRate} total_db=${order.total}`)

  // Build items with thumbnails (fetch in parallel)
  const itemPromises = orderItems.map(async (item: any): Promise<InvoiceItem> => {
    const produit = item.variant?.produit
    const taille = item.variant?.taille
    const colors = item.variant?.colors

    let imageBytes: Uint8Array | null = null
    let imageFormat: 'png' | 'jpeg' = 'jpeg'

    const imgPath = produit?.front_photo_path
    if (imgPath) {
      const result = await fetchImageBytes(supabase, supabaseUrl, imgPath)
      if (result) {
        imageBytes = result.bytes
        imageFormat = result.format
        console.log(`[invoice-helpers] Image OK: "${imgPath}" → ${result.format} (${result.bytes.length} bytes)`)
      } else {
        console.warn(`[invoice-helpers] Image MISSING: "${imgPath}" — placeholder will be used`)
      }
    } else {
      console.warn(`[invoice-helpers] No front_photo_path for product "${produit?.nom || '?'}"`)
    }

    // prix_unitaire is always EUR in the DB
    const unitPriceEur = Number(item.prix_unitaire) || 0
    const unitPrice = currency === 'XOF'
      ? Math.round(unitPriceEur * fxRate)
      : unitPriceEur

    return {
      name: produit?.nom || 'Produit',
      taille: taille?.libelle || undefined,
      couleur: colors?.nom || undefined,
      couleurHex: colors?.hex || undefined,
      qty: item.quantite,
      unitPrice,
      lineTotal: unitPrice * item.quantite,
      imageBytes,
      imageFormat,
    }
  })

  const items = await Promise.all(itemPromises)

  // Logo
  const logoBytes = await fetchLogoBytes(supabase, supabaseUrl)

  // Subtotal from converted item prices
  const subtotal = items.reduce((sum, i) => sum + i.lineTotal, 0)

  // Shipping/express: paystack-initialize stores these in the order's native
  // currency (XOF for CI tariffs, EUR for FR tariffs). Do NOT re-convert —
  // multiplying an already-XOF value by fxRate would be a catastrophic
  // double-conversion.
  const shippingCost = currency === 'XOF'
    ? Math.round(Number(order.shipping_cost) || 0)
    : Number(order.shipping_cost) || 0
  const expressCost = currency === 'XOF'
    ? Math.round(Number(order.express_cost) || 0)
    : Number(order.express_cost) || 0

  // Always compute total from the converted line items + native-currency
  // shipping/express. Do NOT use order.total — it may still hold the EUR
  // value from the checkout's initial insert if paystack-initialize's
  // multi-column update failed silently.
  const total = subtotal + shippingCost + expressCost

  const dbTotal = Number(order.total) || 0
  if (dbTotal > 0 && Math.abs(dbTotal - total) > 1) {
    console.warn(`[invoice-helpers] TOTAL MISMATCH: db=${dbTotal} computed=${total} (${currency}) — using computed`)
  }

  console.log(`[invoice-helpers] subtotal=${subtotal} shipping=${shippingCost} express=${expressCost} total=${total} (${currency})`)

  return {
    orderId,
    orderNumber: order.order_number || orderId.slice(0, 8),
    orderDate: order.created_at || new Date().toISOString(),
    paymentReference: order.payment_reference || '',
    locale,
    currency,
    customerName: client ? `${client.prenom} ${client.nom}` : 'Client',
    customerEmail: client?.email || '',
    customerPhone: client?.telephone || undefined,
    shippingZone: order.shipping_zone_code || undefined,
    expressDelivery: !!order.express_delivery,
    items,
    subtotal,
    shippingCost,
    expressCost,
    total,
    fxRate,
    logoBytes,
  }
}
