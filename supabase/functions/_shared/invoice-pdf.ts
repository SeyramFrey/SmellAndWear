/**
 * Shared module: Invoice PDF generation with pdf-lib
 *
 * Produces a professional A4 invoice PDF with:
 *   - Brand header (embedded logo or styled text fallback)
 *   - Order number, date, payment reference
 *   - Customer + shipping info
 *   - Items table with embedded thumbnails, name, variant, qty, price, line total
 *   - Totals breakdown (subtotal, shipping, express, total)
 *   - Dual-currency equivalence box (EUR + XOF)
 *   - Footer with contact info
 *
 * Used by both invoice-generate and invoice-send Edge Functions.
 */

import {
  PDFDocument,
  PDFPage,
  PDFFont,
  rgb,
  StandardFonts,
  PDFImage,
} from 'https://esm.sh/pdf-lib@1.17.1'

// ─── types ──────────────────────────────────────────────────────────────────

export interface InvoiceItem {
  name: string
  taille?: string
  couleur?: string
  couleurHex?: string
  qty: number
  unitPrice: number
  lineTotal: number
  imageBytes?: Uint8Array | null
  imageFormat?: 'png' | 'jpeg'
}

export interface InvoiceData {
  orderId: string
  orderNumber: string
  orderDate: string
  paymentReference: string
  locale: string          // FR | CI
  currency: string        // EUR | XOF
  // Customer
  customerName: string
  customerEmail: string
  customerPhone?: string
  // Shipping
  shippingAddress?: string
  shippingZone?: string
  expressDelivery?: boolean
  // Items
  items: InvoiceItem[]
  // Totals
  subtotal: number
  shippingCost: number
  expressCost: number
  total: number
  // FX rate for currency equivalent box (EUR→XOF)
  fxRate: number
  // Logo (optional, raw PNG/JPEG bytes)
  logoBytes?: Uint8Array | null
}

// ─── constants ──────────────────────────────────────────────────────────────

const A4_W = 595.28
const A4_H = 841.89
const MARGIN = 50
const CONTENT_W = A4_W - MARGIN * 2
const BRAND_COLOR = rgb(181 / 255, 25 / 255, 12 / 255)  // #B5190C
const BRAND_DARK = rgb(26 / 255, 26 / 255, 26 / 255)    // #1A1A1A
const TEXT_COLOR = rgb(0.2, 0.2, 0.2)
const MUTED_COLOR = rgb(0.45, 0.45, 0.45)
const LINE_COLOR = rgb(0.85, 0.85, 0.85)
const BG_LIGHT = rgb(0.97, 0.97, 0.97)
const PLACEHOLDER_BG = rgb(0.92, 0.92, 0.92)
const PLACEHOLDER_BORDER = rgb(0.82, 0.82, 0.82)
const WHITE = rgb(1, 1, 1)

const DEFAULT_FX_RATE = 655.957

// ─── WinAnsi text safety ────────────────────────────────────────────────────

/**
 * Normalize a string so every character is safe for pdf-lib's WinAnsi
 * (Windows-1252) encoded standard fonts.
 *
 * Production Deno runtimes with full ICU data produce U+202F (NARROW
 * NO-BREAK SPACE) in Intl.NumberFormat / toLocaleDateString for locale
 * 'fr-FR'. That codepoint is NOT in WinAnsi and crashes pdf-lib with:
 *   "WinAnsi cannot encode ' ' (0x202f)"
 */
function normalizePdfText(s: string): string {
  if (!s) return ''
  return s
    .replace(/\u202F/g, ' ')  // NARROW NO-BREAK SPACE → regular space
    .replace(/\u200B/g, '')   // ZERO WIDTH SPACE → remove
    .replace(/\u00A0/g, ' ')  // NO-BREAK SPACE → regular space (cosmetic)
}

// ─── helpers ────────────────────────────────────────────────────────────────

function fmtNumber(amount: number, decimals: number): string {
  const fixed = amount.toFixed(decimals)
  const [intPart, decPart] = fixed.split('.')
  const grouped = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ' ')
  return decPart ? `${grouped},${decPart}` : grouped
}

function fmtEur(amount: number): string {
  return normalizePdfText(`${fmtNumber(amount, 2)} \u20AC`)
}

function fmtXof(amount: number): string {
  return normalizePdfText(`${fmtNumber(Math.round(amount), 0)} FCFA`)
}

function fmtCurrency(amount: number, currency: string): string {
  return currency === 'XOF' ? fmtXof(amount) : fmtEur(amount)
}

function fmtDate(iso: string): string {
  try {
    const d = new Date(iso)
    const raw = d.toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    })
    return normalizePdfText(raw)
  } catch {
    return iso
  }
}

function drawLine(page: PDFPage, x: number, y: number, w: number, thickness = 0.5) {
  page.drawLine({
    start: { x, y },
    end: { x: x + w, y },
    thickness,
    color: LINE_COLOR,
  })
}

function truncate(str: string, max: number): string {
  if (!str) return ''
  const clean = normalizePdfText(str)
  return clean.length > max ? clean.substring(0, max - 1) + '...' : clean
}

/** Detect image format from the first few magic bytes. */
export function detectImageFormat(bytes: Uint8Array): 'png' | 'jpeg' | 'webp' | 'unknown' {
  if (bytes.length < 12) return 'unknown'
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4E && bytes[3] === 0x47) return 'png'
  if (bytes[0] === 0xFF && bytes[1] === 0xD8 && bytes[2] === 0xFF) return 'jpeg'
  if (bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 &&
      bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50) return 'webp'
  return 'unknown'
}

// ─── main ───────────────────────────────────────────────────────────────────

export async function generateInvoicePdf(data: InvoiceData): Promise<Uint8Array> {
  const doc = await PDFDocument.create()
  const helvetica = await doc.embedFont(StandardFonts.Helvetica)
  const helveticaBold = await doc.embedFont(StandardFonts.HelveticaBold)

  const fxRate = data.fxRate || DEFAULT_FX_RATE

  // Sanitize all dynamic text fields once
  const safe = {
    customerName: normalizePdfText(data.customerName),
    customerEmail: normalizePdfText(data.customerEmail),
    customerPhone: normalizePdfText(data.customerPhone || ''),
    shippingZone: normalizePdfText(data.shippingZone || ''),
    shippingAddress: normalizePdfText(data.shippingAddress || ''),
    paymentReference: normalizePdfText(data.paymentReference || ''),
    orderNumber: normalizePdfText(data.orderNumber),
  }

  let page = doc.addPage([A4_W, A4_H])
  let y = A4_H - MARGIN

  // ─── header ──────────────────────────────────────────────────────

  let logoDrawn = false
  if (data.logoBytes && data.logoBytes.length > 100) {
    try {
      const fmt = detectImageFormat(data.logoBytes)
      let logoImg: PDFImage
      if (fmt === 'png') {
        logoImg = await doc.embedPng(data.logoBytes)
      } else if (fmt === 'jpeg') {
        logoImg = await doc.embedJpg(data.logoBytes)
      } else {
        // Try PNG then JPEG as last resort
        try { logoImg = await doc.embedPng(data.logoBytes) }
        catch { logoImg = await doc.embedJpg(data.logoBytes) }
      }
      const logoH = 40
      const logoW = Math.min(logoH * (logoImg.width / logoImg.height), 160)
      page.drawImage(logoImg, { x: MARGIN, y: y - logoH, width: logoW, height: logoH })
      logoDrawn = true
    } catch (e) {
      console.warn('[invoice-pdf] Logo embed failed:', (e as Error).message)
    }
  }

  if (!logoDrawn) {
    // Styled brand box as fallback
    const boxW = 170
    const boxH = 32
    page.drawRectangle({ x: MARGIN, y: y - boxH, width: boxW, height: boxH, color: BRAND_DARK })
    const brandText = 'SMELL & WEAR'
    const brandW = helveticaBold.widthOfTextAtSize(brandText, 16)
    page.drawText(brandText, {
      x: MARGIN + (boxW - brandW) / 2,
      y: y - boxH + 10,
      size: 16,
      font: helveticaBold,
      color: WHITE,
    })
  }

  // Invoice title (right-aligned)
  const invoiceTitle = 'FACTURE'
  const titleW = helveticaBold.widthOfTextAtSize(invoiceTitle, 20)
  page.drawText(invoiceTitle, { x: A4_W - MARGIN - titleW, y: y - 14, size: 20, font: helveticaBold, color: TEXT_COLOR })

  y -= 30

  // Order number + date (right-aligned)
  const rightX = A4_W - MARGIN
  const headerLines = [
    safe.orderNumber || data.orderId.slice(0, 8),
    fmtDate(data.orderDate),
    `Ref: ${safe.paymentReference || '\u2014'}`,
  ]
  for (const label of headerLines) {
    y -= 14
    const w = helvetica.widthOfTextAtSize(label, 9)
    page.drawText(label, { x: rightX - w, y, size: 9, font: helvetica, color: MUTED_COLOR })
  }

  y -= 20
  drawLine(page, MARGIN, y, CONTENT_W)
  y -= 20

  // ─── customer + shipping info ────────────────────────────────────

  const colW = CONTENT_W / 2 - 10

  // Left: customer info
  const custStartY = y
  page.drawText('CLIENT', { x: MARGIN, y, size: 8, font: helveticaBold, color: MUTED_COLOR })
  y -= 16
  page.drawText(safe.customerName, { x: MARGIN, y, size: 10, font: helveticaBold, color: TEXT_COLOR })
  y -= 14
  page.drawText(safe.customerEmail, { x: MARGIN, y, size: 9, font: helvetica, color: TEXT_COLOR })
  if (safe.customerPhone) {
    y -= 14
    page.drawText(safe.customerPhone, { x: MARGIN, y, size: 9, font: helvetica, color: TEXT_COLOR })
  }

  // Right: shipping info
  let yRight = custStartY
  const shipX = MARGIN + colW + 20
  page.drawText('LIVRAISON', { x: shipX, y: yRight, size: 8, font: helveticaBold, color: MUTED_COLOR })
  yRight -= 16
  const localeLabel = data.locale === 'FR' ? 'France' : "Cote d'Ivoire"
  page.drawText(localeLabel, { x: shipX, y: yRight, size: 10, font: helveticaBold, color: TEXT_COLOR })
  if (safe.shippingZone) {
    yRight -= 14
    page.drawText(`Zone: ${safe.shippingZone}`, { x: shipX, y: yRight, size: 9, font: helvetica, color: TEXT_COLOR })
  }
  if (safe.shippingAddress) {
    yRight -= 14
    page.drawText(truncate(safe.shippingAddress, 50), { x: shipX, y: yRight, size: 9, font: helvetica, color: TEXT_COLOR })
  }
  if (data.expressDelivery) {
    yRight -= 14
    page.drawText('Livraison Express', { x: shipX, y: yRight, size: 9, font: helveticaBold, color: BRAND_COLOR })
  }

  y = Math.min(y, yRight) - 25
  drawLine(page, MARGIN, y, CONTENT_W)
  y -= 8

  // ─── items table ─────────────────────────────────────────────────

  const col = {
    thumb: MARGIN,
    name: MARGIN + 45,
    variant: MARGIN + 250,
    qty: MARGIN + 340,
    price: MARGIN + 390,
    total: A4_W - MARGIN,
  }

  // Header row
  y -= 14
  page.drawRectangle({ x: MARGIN, y: y - 4, width: CONTENT_W, height: 18, color: BG_LIGHT })
  const hdrSize = 8
  page.drawText('ARTICLE', { x: col.name, y, size: hdrSize, font: helveticaBold, color: MUTED_COLOR })
  page.drawText('VARIANTE', { x: col.variant, y, size: hdrSize, font: helveticaBold, color: MUTED_COLOR })
  page.drawText('QTE', { x: col.qty, y, size: hdrSize, font: helveticaBold, color: MUTED_COLOR })
  page.drawText('P.U.', { x: col.price, y, size: hdrSize, font: helveticaBold, color: MUTED_COLOR })
  const totHdr = 'TOTAL'
  const totHdrW = helveticaBold.widthOfTextAtSize(totHdr, hdrSize)
  page.drawText(totHdr, { x: col.total - totHdrW, y, size: hdrSize, font: helveticaBold, color: MUTED_COLOR })

  y -= 18

  // Item rows
  for (const item of data.items) {
    if (y < 180) {
      page = doc.addPage([A4_W, A4_H])
      y = A4_H - MARGIN
    }

    const rowH = 36
    const rowY = y - rowH
    const textY = rowY + 18
    const thumbSize = 30

    // Thumbnail or placeholder
    let thumbnailEmbedded = false
    if (item.imageBytes && item.imageBytes.length > 100) {
      try {
        let img: PDFImage
        if (item.imageFormat === 'jpeg') {
          img = await doc.embedJpg(item.imageBytes)
        } else {
          img = await doc.embedPng(item.imageBytes)
        }
        page.drawImage(img, { x: col.thumb, y: rowY + 3, width: thumbSize, height: thumbSize })
        thumbnailEmbedded = true
      } catch (e) {
        console.warn(`[invoice-pdf] Thumbnail embed failed for "${item.name}":`, (e as Error).message)
      }
    }

    if (!thumbnailEmbedded) {
      // Gray placeholder box
      page.drawRectangle({
        x: col.thumb, y: rowY + 3,
        width: thumbSize, height: thumbSize,
        color: PLACEHOLDER_BG,
        borderColor: PLACEHOLDER_BORDER,
        borderWidth: 0.5,
      })
      // Small icon-like dash in center
      const cx = col.thumb + thumbSize / 2
      const cy = rowY + 3 + thumbSize / 2
      page.drawLine({ start: { x: cx - 5, y: cy }, end: { x: cx + 5, y: cy }, thickness: 1, color: PLACEHOLDER_BORDER })
    }

    // Product name
    page.drawText(truncate(item.name, 35), { x: col.name, y: textY, size: 9, font: helveticaBold, color: TEXT_COLOR })

    // Variant
    const variantParts: string[] = []
    if (item.taille) variantParts.push(normalizePdfText(item.taille))
    if (item.couleur) variantParts.push(normalizePdfText(item.couleur))
    if (variantParts.length > 0) {
      page.drawText(variantParts.join(' / '), { x: col.variant, y: textY, size: 8, font: helvetica, color: MUTED_COLOR })
    }

    // Qty
    page.drawText(String(item.qty), { x: col.qty + 8, y: textY, size: 9, font: helvetica, color: TEXT_COLOR })

    // Unit price
    page.drawText(fmtCurrency(item.unitPrice, data.currency), { x: col.price, y: textY, size: 9, font: helvetica, color: TEXT_COLOR })

    // Line total (right-aligned)
    const ltStr = fmtCurrency(item.lineTotal, data.currency)
    const ltW = helveticaBold.widthOfTextAtSize(ltStr, 9)
    page.drawText(ltStr, { x: col.total - ltW, y: textY, size: 9, font: helveticaBold, color: TEXT_COLOR })

    drawLine(page, MARGIN, rowY, CONTENT_W)
    y = rowY - 4
  }

  // ─── totals ──────────────────────────────────────────────────────

  y -= 10

  const totalsX = A4_W - MARGIN - 200
  const valX = A4_W - MARGIN

  const drawTotalRow = (label: string, amount: number, bold = false) => {
    y -= 16
    const font = bold ? helveticaBold : helvetica
    const sz = bold ? 11 : 9
    page.drawText(label, { x: totalsX, y, size: sz, font, color: bold ? TEXT_COLOR : MUTED_COLOR })
    const valStr = fmtCurrency(amount, data.currency)
    const valW = font.widthOfTextAtSize(valStr, sz)
    page.drawText(valStr, { x: valX - valW, y, size: sz, font, color: TEXT_COLOR })
  }

  drawTotalRow('Sous-total', data.subtotal)
  if (data.shippingCost > 0) drawTotalRow('Livraison', data.shippingCost)
  if (data.expressCost > 0) drawTotalRow('Express', data.expressCost)

  y -= 4
  drawLine(page, totalsX, y, 200)
  drawTotalRow('TOTAL PAYE', data.total, true)

  // ─── currency equivalence box ────────────────────────────────────

  y -= 16
  if (y < 140) {
    page = doc.addPage([A4_W, A4_H])
    y = A4_H - MARGIN
  }

  const eqBoxX = totalsX
  const eqBoxW = 200
  const eqBoxH = 42
  const eqBoxY = y - eqBoxH

  page.drawRectangle({
    x: eqBoxX, y: eqBoxY,
    width: eqBoxW, height: eqBoxH,
    color: BG_LIGHT,
    borderColor: LINE_COLOR,
    borderWidth: 0.5,
  })

  page.drawText('Equivalence', {
    x: eqBoxX + 8, y: eqBoxY + eqBoxH - 13,
    size: 7, font: helveticaBold, color: MUTED_COLOR,
  })

  // Compute equivalents
  let eurAmount: number
  let xofAmount: number
  if (data.currency === 'XOF') {
    xofAmount = data.total
    eurAmount = data.total / fxRate
  } else {
    eurAmount = data.total
    xofAmount = data.total * fxRate
  }

  const eurStr = fmtEur(eurAmount)
  const xofStr = fmtXof(xofAmount)

  page.drawText(`EUR: ${eurStr}`, {
    x: eqBoxX + 8, y: eqBoxY + eqBoxH - 26,
    size: 8, font: helvetica, color: TEXT_COLOR,
  })
  page.drawText(`XOF: ${xofStr}`, {
    x: eqBoxX + 8, y: eqBoxY + eqBoxH - 38,
    size: 8, font: helvetica, color: TEXT_COLOR,
  })

  // FX rate note (right-aligned inside box)
  const rateNote = `1 EUR = ${fxRate.toFixed(3)} XOF`
  const rateNoteW = helvetica.widthOfTextAtSize(rateNote, 6)
  page.drawText(rateNote, {
    x: eqBoxX + eqBoxW - rateNoteW - 6,
    y: eqBoxY + 4,
    size: 6, font: helvetica, color: MUTED_COLOR,
  })

  y = eqBoxY - 10

  // ─── payment info ────────────────────────────────────────────────

  y -= 14
  if (y < 80) {
    page = doc.addPage([A4_W, A4_H])
    y = A4_H - MARGIN
  }

  page.drawText('Paiement', { x: MARGIN, y, size: 8, font: helveticaBold, color: MUTED_COLOR })
  y -= 14
  page.drawText(`Via Paystack \u2014 Ref: ${safe.paymentReference || '\u2014'}`, { x: MARGIN, y, size: 9, font: helvetica, color: TEXT_COLOR })

  // ─── footer ──────────────────────────────────────────────────────

  const footerY = 55
  drawLine(page, MARGIN, footerY + 10, CONTENT_W)

  const footerLines = [
    'Smell & Wear \u2014 www.smellandwear.com',
    'contact@smellandwear.com',
    'Merci pour votre achat !',
  ]
  let fy = footerY
  for (const line of footerLines) {
    const w = helvetica.widthOfTextAtSize(line, 8)
    page.drawText(line, { x: (A4_W - w) / 2, y: fy, size: 8, font: helvetica, color: MUTED_COLOR })
    fy -= 12
  }

  return await doc.save()
}
