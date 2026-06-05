const PDFDocument = require('pdfkit');
const path        = require('path');

/**
 * Generate a professional invoice PDF as a Buffer.
 *
 * @param {object} data
 * @param {object} data.reservation  — populated Reservation doc
 * @param {object} data.payment      — Payment doc
 * @param {object} data.customer     — { name, email, phone }
 * @param {string} data.roomLabel    — "Presidential Suite — Floor 4" or "Grand Ballroom"
 * @returns {Promise<Buffer>}
 */
const generateInvoicePDF = (data) => {
  return new Promise((resolve, reject) => {
    try {
      const { reservation, payment, customer, roomLabel } = data;

      const doc = new PDFDocument({
        size:    'A4',
        margins: { top: 50, bottom: 50, left: 60, right: 60 },
      });

      const chunks = [];
      doc.on('data',  (chunk) => chunks.push(chunk));
      doc.on('end',   ()      => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      // ── Color palette ────────────────────────────────────────────────────
      const PRIMARY   = '#0F5B4F';
      const GOLD      = '#F2B705';
      const LIGHT_BG  = '#F9FAFB';
      const BORDER    = '#E5E7EB';
      const TEXT_DARK = '#111827';
      const TEXT_GREY = '#6B7280';

      const pageW  = doc.page.width  - 120; // usable width
      const startX = 60;

      // ── Header band ──────────────────────────────────────────────────────
      doc.rect(0, 0, doc.page.width, 90).fill(PRIMARY);

      doc
        .fillColor(GOLD)
        .fontSize(26)
        .font('Helvetica-Bold')
        .text('LUXSTAY', startX, 25);

      doc
        .fillColor('#FFFFFF')
        .fontSize(10)
        .font('Helvetica')
        .text('HOTELS & RESORTS', startX, 55)
        .text('Addis Ababa, Ethiopia  ·  +251 11 000 0000  ·  info@luxstay.com', startX, 68);

      // INVOICE label on the right
      doc
        .fillColor(GOLD)
        .fontSize(22)
        .font('Helvetica-Bold')
        .text('INVOICE', 0, 30, { align: 'right', width: doc.page.width - 60 });

      doc
        .fillColor('#FFFFFF')
        .fontSize(9)
        .font('Helvetica')
        .text(`#${payment?.paymentNumber || reservation?.reservationNumber || 'N/A'}`, 0, 57, {
          align: 'right', width: doc.page.width - 60,
        });

      // ── Meta block ───────────────────────────────────────────────────────
      doc.moveDown(0.5);
      const metaY = 110;

      // Left: Bill To
      doc
        .fillColor(TEXT_GREY)
        .fontSize(8)
        .font('Helvetica-Bold')
        .text('BILL TO', startX, metaY);

      doc
        .fillColor(TEXT_DARK)
        .fontSize(11)
        .font('Helvetica-Bold')
        .text(customer?.name || 'Guest', startX, metaY + 14);

      doc
        .fillColor(TEXT_GREY)
        .fontSize(9)
        .font('Helvetica')
        .text(customer?.email || '', startX, metaY + 28)
        .text(customer?.phone || '', startX, metaY + 41);

      // Right: Invoice details
      const rightX = startX + pageW - 160;

      const metaRows = [
        ['Invoice Date',   new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })],
        ['Reservation',    reservation?.reservationNumber || 'N/A'],
        ['Payment Method', payment?.paymentMethod || 'N/A'],
        ['Status',         payment?.status || 'N/A'],
      ];

      metaRows.forEach(([label, value], i) => {
        const y = metaY + i * 15;
        doc.fillColor(TEXT_GREY).fontSize(8).font('Helvetica').text(label, rightX, y);
        doc.fillColor(TEXT_DARK).fontSize(8).font('Helvetica-Bold').text(value, rightX + 95, y);
      });

      // ── Divider ──────────────────────────────────────────────────────────
      doc.moveTo(startX, 175).lineTo(startX + pageW, 175).strokeColor(BORDER).lineWidth(1).stroke();

      // ── Booking details table ─────────────────────────────────────────────
      const tableY = 185;

      // Table header
      doc.rect(startX, tableY, pageW, 22).fill(PRIMARY);

      doc.fillColor('#FFFFFF').fontSize(9).font('Helvetica-Bold');
      doc.text('DESCRIPTION',     startX + 8,           tableY + 7);
      doc.text('CHECK-IN',        startX + pageW * 0.45, tableY + 7);
      doc.text('CHECK-OUT',       startX + pageW * 0.62, tableY + 7);
      doc.text('AMOUNT',          startX + pageW * 0.82, tableY + 7);

      // Table row
      const rowY = tableY + 22;
      doc.rect(startX, rowY, pageW, 35).fill(LIGHT_BG);

      const checkIn  = reservation?.checkInDate  ? new Date(reservation.checkInDate).toLocaleDateString()  : 'N/A';
      const checkOut = reservation?.checkOutDate ? new Date(reservation.checkOutDate).toLocaleDateString() : 'N/A';
      const amount   = payment?.amount || reservation?.totalPrice || 0;

      doc.fillColor(TEXT_DARK).fontSize(10).font('Helvetica-Bold')
        .text(roomLabel || 'Room / Hall',       startX + 8,            rowY + 6);
      doc.fillColor(TEXT_GREY).fontSize(8).font('Helvetica')
        .text(`${reservation?.numberOfGuests || 1} guest(s)`, startX + 8, rowY + 20);

      doc.fillColor(TEXT_DARK).fontSize(9).font('Helvetica')
        .text(checkIn,  startX + pageW * 0.45, rowY + 12)
        .text(checkOut, startX + pageW * 0.62, rowY + 12)
        .font('Helvetica-Bold')
        .text(`ETB ${amount.toLocaleString()}`, startX + pageW * 0.82, rowY + 12);

      // ── Totals block ─────────────────────────────────────────────────────
      const totalsY = rowY + 55;
      const totalsX = startX + pageW - 220;

      const totalsRows = [
        ['Subtotal',  `ETB ${amount.toLocaleString()}`],
        ['Tax (0%)',  'ETB 0'],
        ['Discount',  'ETB 0'],
      ];

      totalsRows.forEach(([label, val], i) => {
        const y = totalsY + i * 18;
        doc.fillColor(TEXT_GREY).fontSize(9).font('Helvetica').text(label, totalsX, y);
        doc.fillColor(TEXT_DARK).fontSize(9).font('Helvetica').text(val, totalsX + 120, y, { width: 100, align: 'right' });
      });

      // Total due band
      const totalBandY = totalsY + totalsRows.length * 18 + 8;
      doc.rect(totalsX - 10, totalBandY, 230, 28).fill(PRIMARY);
      doc.fillColor('#FFFFFF').fontSize(10).font('Helvetica-Bold')
        .text('TOTAL DUE', totalsX, totalBandY + 9)
        .text(`ETB ${amount.toLocaleString()}`, totalsX - 10, totalBandY + 9, { width: 220, align: 'right' });

      // ── Payment status banner ─────────────────────────────────────────────
      const paidBannerY = totalBandY + 40;
      const isPaid = ['PAID', 'COMPLETED'].includes(payment?.status);

      doc
        .rect(startX, paidBannerY, pageW, 28)
        .fill(isPaid ? '#DCFCE7' : '#FEF9C3');

      doc
        .fillColor(isPaid ? '#166534' : '#854D0E')
        .fontSize(10)
        .font('Helvetica-Bold')
        .text(
          isPaid
            ? `✓ PAID on ${payment?.paidAt ? new Date(payment.paidAt).toLocaleDateString() : 'N/A'}`
            : '⏳ PAYMENT PENDING',
          startX + 10,
          paidBannerY + 9
        );

      // ── Special requests ─────────────────────────────────────────────────
      if (reservation?.specialRequests) {
        const reqY = paidBannerY + 48;
        doc.fillColor(TEXT_GREY).fontSize(8).font('Helvetica-Bold').text('SPECIAL REQUESTS', startX, reqY);
        doc.fillColor(TEXT_DARK).fontSize(9).font('Helvetica')
          .text(reservation.specialRequests, startX, reqY + 12, { width: pageW });
      }

      // ── Policy box ───────────────────────────────────────────────────────
      const policyY = doc.y + 20;
      doc.rect(startX, policyY, pageW, 58).fillAndStroke('#EFF6FF', '#BFDBFE');

      doc.fillColor('#1E40AF').fontSize(8).font('Helvetica-Bold').text('CHECK-IN POLICY', startX + 8, policyY + 8);
      doc.fillColor('#374151').fontSize(8).font('Helvetica')
        .text('• Check-in from 2:00 PM  ·  Check-out by 12:00 PM noon', startX + 8, policyY + 20)
        .text('• Valid government-issued ID required at check-in', startX + 8, policyY + 32)
        .text('• Full payment required prior to check-in', startX + 8, policyY + 44);

      // ── Footer ───────────────────────────────────────────────────────────
      doc.rect(0, doc.page.height - 45, doc.page.width, 45).fill(PRIMARY);

      doc
        .fillColor(GOLD)
        .fontSize(9)
        .font('Helvetica-Bold')
        .text('Thank you for choosing LuxStay Hotels', 0, doc.page.height - 30, {
          align: 'center',
          width: doc.page.width,
        });

      doc
        .fillColor('#FFFFFF')
        .fontSize(7)
        .font('Helvetica')
        .text('This is a computer-generated invoice and does not require a signature.', 0, doc.page.height - 18, {
          align: 'center',
          width: doc.page.width,
        });

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
};

module.exports = { generateInvoicePDF };