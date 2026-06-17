import { jsPDF } from 'jspdf';
import { AppSettings, Language } from '../types';

interface PDFItem {
  name: string;
  note?: string;
  amount: number;
}

interface GeneratePDFParams {
  shopName: string;
  shopPhone?: string;
  shopGst?: string;
  shopLogo?: string;
  invoiceNo: string;
  customerName?: string;
  customerPhone?: string;
  dateStr: string;
  timeStr: string;
  items: PDFItem[];
  subtotal: number;
  discountLabel?: string;
  discountAmount?: number;
  taxLabel?: string;
  taxAmount?: number;
  grandTotal: number;
  preferredCurrency: string;
  lang: Language;
}

/**
 * Clean sanitization helper to replace Devnagari or special characters with safe English transliterations for PDF output.
 * Since standard PDF Helvetica font does not support Devnagari character sets, sanitization prevents "?" rendering.
 */
function sanitizeText(text: string, fallback: string): string {
  if (!text) return fallback;
  
  // Quick map of common Hindi phrases used in application to English equivalents
  const hindiToEnglishMap: { [key: string]: string } = {
    'तराजू मापन': 'Weighment Scale',
    'इन्वॉइस ड्राफ्ट': 'Invoice Draft',
    'तराजू': 'Weighment',
    'बिल प्रिंट पूर्वदर्शन': 'Invoice Print Preview',
    'रसीद': 'Receipt',
    'विवरण': 'Particulars',
    'कुल': 'Total',
    'उपकुल योग': 'Subtotal',
    'छूट': 'Discount',
    'जीएसटीआईएन': 'GSTIN',
    'ग्राहक': 'Customer',
    'दूरभाष': 'Phone',
    'तिथि': 'Date',
    'समय': 'Time',
    'कुल देय राशि': 'GRAND TOTAL',
    'खरीदारी और गणना के लिए धन्यवाद!': 'Thank you for your business!',
    'तराज़ू स्मार्ट एप्प': 'Tarazu Smart App',
    'नकद ग्राहक': 'Cash Customer',
    'स्मार्ट तराजू की दुकान': 'Smart Weigh Store',
  };

  let sanitized = text;
  Object.entries(hindiToEnglishMap).forEach(([hi, en]) => {
    sanitized = sanitized.split(hi).join(en);
  });

  // Remove any remaining Devanagari characters to prevent PDF compiler failure/gibberish
  // \u0900-\u097F represents Devanagari range
  sanitized = sanitized.replace(/[\u0900-\u097F]/g, '');

  // Trim and fallback if empty
  const trimmed = sanitized.trim();
  return trimmed.length > 0 ? trimmed : fallback;
}

export function generateInvoicePDF(params: GeneratePDFParams): void {
  const {
    shopName,
    shopPhone,
    shopGst,
    shopLogo,
    invoiceNo,
    customerName,
    customerPhone,
    dateStr,
    timeStr,
    items,
    subtotal,
    discountLabel,
    discountAmount = 0,
    taxLabel,
    taxAmount = 0,
    grandTotal,
    preferredCurrency,
    lang,
  } = params;

  // Initialize jsPDF document (A4 page format)
  // Dimensions of A4: 210mm x 297mm
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  // Safe names and texts
  const safeShopName = sanitizeText(shopName, lang === 'hi' ? 'Smart Weigh Store' : 'Smart Weigh Store');
  const safeCustomerName = sanitizeText(customerName || '', lang === 'hi' ? 'Cash Customer' : 'Cash Customer');
  const safeCustomerPhone = customerPhone || '';
  const safeShopPhone = shopPhone || '';
  const safeShopGst = shopGst || '';
  
  const displayCurrency = preferredCurrency === '₹' ? 'INR' : preferredCurrency;

  // Draw Top Accent Stripe (Emerald Theme)
  doc.setFillColor(16, 185, 129); // #10b981 (emerald-500)
  doc.rect(0, 0, 210, 5, 'F');

  // --- BRAND LOGO / EMBLAM ---
  let logoY = 15;
  let textStartX = 20;

  if (shopLogo) {
    if (shopLogo.startsWith('data:image/')) {
      try {
        // Render custom base64 image logo
        doc.addImage(shopLogo, 'PNG', 20, 15, 20, 20);
        textStartX = 46; // Indent text block
      } catch (e) {
        console.error('Failed to render base64 logo in PDF', e);
        // Fallback: draw circular emblem
        drawPlaceholderEmblem(doc, safeShopName, 20, 15);
        textStartX = 46;
      }
    } else {
      // It is likely a standard preset emoji
      drawPlaceholderEmblem(doc, safeShopName, 20, 15, shopLogo);
      textStartX = 46;
    }
  } else {
    // Elegant left-aligned text starts directly at margin
    textStartX = 20;
  }

  // --- SHOP INFORMATION ---
  doc.setTextColor(17, 24, 39); // deep slate/black
  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(18);
  doc.text(safeShopName, textStartX, 21);

  doc.setFont('Helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(75, 85, 99); // gray-500

  let infoLineY = 25;
  if (safeShopPhone) {
    doc.text(`Phone: ${safeShopPhone}`, textStartX, infoLineY);
    infoLineY += 4.5;
  }
  if (safeShopGst) {
    const rawGst = sanitizeText(safeShopGst, '');
    if (rawGst) {
      doc.text(`GSTIN: ${rawGst}`, textStartX, infoLineY);
    }
  }

  // --- INVOICE INFO BLOCK (Top Right) ---
  doc.setTextColor(17, 24, 39);
  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(14);
  doc.text('INVOICE', 190, 21, { align: 'right' });

  doc.setFont('Helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(75, 85, 99);
  doc.text(`Bill No: ${invoiceNo}`, 190, 26, { align: 'right' });
  doc.text(`Date: ${sanitizeText(dateStr, dateStr)}`, 190, 30.5, { align: 'right' });
  doc.text(`Time: ${sanitizeText(timeStr, timeStr)}`, 190, 35, { align: 'right' });

  // Draw Horizontal Separator Line below header
  doc.setDrawColor(229, 231, 235); // gray-200
  doc.setLineWidth(0.5);
  doc.line(20, 42, 190, 42);

  // --- CUSTOMER DETAILS ---
  doc.setTextColor(75, 85, 99);
  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(9);
  doc.text('BILLED TO:', 20, 49);

  doc.setTextColor(17, 24, 39);
  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(11);
  doc.text(safeCustomerName, 20, 54.5);

  if (safeCustomerPhone) {
    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(9.5);
    doc.setTextColor(75, 85, 99);
    doc.text(`Mob: ${safeCustomerPhone}`, 20, 59.5);
  }

  // --- TABLE HEADERS ---
  const tableStartY = 67;
  doc.setFillColor(31, 41, 55); // charcoal-800
  doc.rect(20, tableStartY, 170, 7.5, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(9);
  doc.text('#', 24, tableStartY + 5);
  doc.text('Particulars', 36, tableStartY + 5);
  doc.text(`Amount (${displayCurrency})`, 186, tableStartY + 5, { align: 'right' });

  // --- TABLE ROWS ---
  let currentY = tableStartY + 7.5;
  doc.setFont('Helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.setTextColor(17, 24, 39);

  items.forEach((item, index) => {
    // Alternating rows bg
    if (index % 2 === 1) {
      doc.setFillColor(249, 250, 251); // gray-50
      doc.rect(20, currentY, 170, 8.5, 'F');
    }

    doc.setFont('Helvetica', 'bold');
    doc.text((index + 1).toString(), 24, currentY + 5.5);

    // Particular name
    const safeParticular = sanitizeText(item.name, `Item ${index + 1}`);
    doc.text(safeParticular, 36, currentY + 5.5);

    // Render note if present
    if (item.note) {
      doc.setFont('Helvetica', 'oblique');
      doc.setFontSize(8);
      doc.setTextColor(107, 114, 128); // gray-400
      const safeNote = sanitizeText(item.note, '');
      if (safeNote) {
        doc.text(`Note: ${safeNote}`, 36, currentY + 9.5);
      }
    }

    // Price
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(17, 24, 39);
    doc.text(item.amount.toFixed(2), 186, currentY + 5.5, { align: 'right' });

    // Draw bottom border line
    doc.setDrawColor(243, 244, 246);
    doc.setLineWidth(0.3);
    doc.line(20, currentY + (item.note ? 11.5 : 8.5), 190, currentY + (item.note ? 11.5 : 8.5));

    currentY += item.note ? 11.5 : 8.5;
  });

  // --- TOTALS SECTION ---
  currentY += 4;
  doc.setFont('Helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.setTextColor(75, 85, 99);

  // Subtotal
  doc.text('Subtotal (items):', 130, currentY);
  doc.text(`${displayCurrency} ${subtotal.toFixed(2)}`, 186, currentY, { align: 'right' });
  currentY += 5;

  // Discount (if any)
  if (discountAmount > 0) {
    const safeDiscLabel = sanitizeText(discountLabel || 'Discount', 'Discount');
    doc.setTextColor(185, 28, 28); // red-700
    doc.text(`${safeDiscLabel}:`, 130, currentY);
    doc.text(`-${displayCurrency} ${discountAmount.toFixed(2)}`, 186, currentY, { align: 'right' });
    currentY += 5;
    doc.setTextColor(75, 85, 99); // reset
  }

  // Tax (if any)
  if (taxAmount > 0) {
    const safeTaxLabel = sanitizeText(taxLabel || 'Tax/VAT/GST', 'Tax');
    doc.text(`${safeTaxLabel}:`, 130, currentY);
    doc.text(`+${displayCurrency} ${taxAmount.toFixed(2)}`, 186, currentY, { align: 'right' });
    currentY += 5;
  }

  // Grand Total Separator
  doc.setDrawColor(31, 41, 55);
  doc.setLineWidth(0.5);
  doc.line(125, currentY - 1, 190, currentY - 1);
  currentY += 2.5;

  // Grand Total Highlight
  doc.setTextColor(17, 24, 39);
  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('GRAND TOTAL:', 130, currentY);
  doc.text(`${displayCurrency} ${grandTotal.toFixed(2)}`, 186, currentY, { align: 'right' });

  // --- FOOTER SECTION ---
  doc.setDrawColor(229, 231, 235);
  doc.setLineWidth(0.3);
  doc.line(20, 260, 190, 260);

  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(17, 24, 39);
  doc.text('Thank you for your business!', 105, 267, { align: 'center' });

  doc.setFont('Helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(156, 163, 175); // gray-400
  doc.text('Invoice generated electronically via Tarazu-Smart Weighing Application.', 105, 272, { align: 'center' });

  // Trigger download in browser
  doc.save(`${invoiceNo}_invoice.pdf`);
}

/**
 * Draws a beautiful minimalist placeholder circle emblem with standard letters if base64 fails or preset emoji is selected
 */
function drawPlaceholderEmblem(doc: jsPDF, shopName: string, x: number, y: number, text?: string): void {
  // Draw primary filled circle
  doc.setFillColor(5, 150, 105); // emerald-600
  doc.circle(x + 10, y + 10, 10, 'F');
  
  // Outer subtle border
  doc.setDrawColor(16, 185, 129); // emerald-500
  doc.setLineWidth(0.4);
  doc.circle(x + 10, y + 10, 11, 'S');

  // Text inside
  doc.setTextColor(255, 255, 255);
  if (text) {
    // Render the preset letter emblem natively
    doc.setFontSize(11);
    doc.setFont('Helvetica', 'bold');
    // Map standard presets to clean letters for maximum safety across standard Helvetica rendering
    const emojiMapping: { [key: string]: string } = {
      '🏬': 'STORE',
      '⚖️': 'SCALE',
      '🛒': 'CART',
      '🛍️': 'BAG',
      '📦': 'BOX',
      '🌾': 'RASHN',
      '🏷️': 'TAG',
      '⭐': 'STAR',
    };
    const abbrev = emojiMapping[text] || text || 'SHOP';
    doc.text(abbrev.slice(0, 4), x + 10, y + 11.2, { align: 'center' });
  } else {
    // Render first Letter of Shop name
    doc.setFontSize(12);
    doc.setFont('Helvetica', 'bold');
    const firstLetter = shopName ? shopName.trim().charAt(0).toUpperCase() : 'S';
    doc.text(firstLetter, x + 10, y + 11.5, { align: 'center' });
  }
}
