const nodemailer = require('nodemailer');
const { generateInvoicePDF } = require('./invoiceService');

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD,
  },
});

// ── Email templates ───────────────────────────────────────────────────────────
const emailTemplates = {
  bookingConfirmation: (data) => ({
    subject: `🎉 Booking Confirmed — ${data.reservation?.reservationNumber}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff;">
        <div style="background: linear-gradient(135deg, #0F5B4F, #1a7a6b); padding: 32px; text-align: center; border-radius: 8px 8px 0 0;">
          <h1 style="color: #F2B705; margin: 0; font-size: 28px;">LUXSTAY</h1>
          <p style="color: #ffffff; margin: 8px 0 0 0; opacity: 0.9;">Your reservation is confirmed</p>
        </div>

        <div style="padding: 32px; background: #f9fafb; border: 1px solid #e5e7eb;">
          <h2 style="color: #111827; margin-top: 0;">Hello, ${data.customer?.name || 'Guest'}</h2>
          <p style="color: #6b7280;">Your booking has been successfully received and is pending final confirmation.</p>

          <div style="background: #ffffff; border: 1px solid #d1fae5; border-left: 4px solid #10b981; border-radius: 8px; padding: 20px; margin: 24px 0;">
            <h3 style="color: #065f46; margin-top: 0;">Reservation Details</h3>
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 6px 0; color: #6b7280; width: 40%;">Reservation ID</td>
                <td style="padding: 6px 0; font-weight: bold; color: #111827; font-family: monospace;">${data.reservation?.reservationNumber}</td>
              </tr>
              <tr>
                <td style="padding: 6px 0; color: #6b7280;">Room / Hall</td>
                <td style="padding: 6px 0; font-weight: bold; color: #111827;">${data.roomLabel || 'To be assigned'}</td>
              </tr>
              <tr>
                <td style="padding: 6px 0; color: #6b7280;">Floor</td>
                <td style="padding: 6px 0; color: #111827;">${data.floorLevel || 'N/A'}</td>
              </tr>
              <tr>
                <td style="padding: 6px 0; color: #6b7280;">Check-in</td>
                <td style="padding: 6px 0; color: #111827;">${new Date(data.reservation?.checkInDate).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</td>
              </tr>
              <tr>
                <td style="padding: 6px 0; color: #6b7280;">Check-out</td>
                <td style="padding: 6px 0; color: #111827;">${new Date(data.reservation?.checkOutDate).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</td>
              </tr>
              <tr>
                <td style="padding: 6px 0; color: #6b7280;">Guests</td>
                <td style="padding: 6px 0; color: #111827;">${data.reservation?.numberOfGuests}</td>
              </tr>
              <tr style="border-top: 2px solid #e5e7eb;">
                <td style="padding: 12px 0 6px; font-weight: bold; color: #111827;">Total Amount</td>
                <td style="padding: 12px 0 6px; font-weight: bold; color: #0F5B4F; font-size: 18px;">ETB ${(data.reservation?.totalPrice || 0).toLocaleString()}</td>
              </tr>
            </table>
          </div>

          <div style="background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 8px; padding: 16px; margin: 16px 0;">
            <h4 style="color: #1e40af; margin-top: 0;">Check-in Policy</h4>
            <ul style="color: #374151; margin: 0; padding-left: 20px; line-height: 1.8;">
              <li>Check-in from 2:00 PM · Check-out by 12:00 PM</li>
              <li>Please bring valid government-issued ID</li>
              <li>Complete payment before check-in</li>
              <li>Contact us 24h in advance for special requests</li>
            </ul>
          </div>

          <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 14px; margin: 16px 0;">
            <p style="color: #166534; margin: 0; font-size: 13px;">
              📎 Your invoice PDF is attached to this email for your records.
            </p>
          </div>

          <p style="color: #6b7280; font-size: 13px; text-align: center; margin-top: 24px; border-top: 1px solid #e5e7eb; padding-top: 16px;">
            Questions? Contact us at <a href="mailto:info@luxstay.com" style="color: #0F5B4F;">info@luxstay.com</a> or call +251 11 XXX XXXX<br>
            Thank you for choosing LuxStay Hotels.
          </p>
        </div>
      </div>
    `,
  }),

  paymentConfirmation: (data) => ({
    subject: `💰 Payment Received — ${data.payment?.paymentNumber || 'N/A'}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #0F5B4F, #1a7a6b); padding: 28px; text-align: center; border-radius: 8px 8px 0 0;">
          <h2 style="color: #F2B705; margin: 0; font-size: 24px;">LUXSTAY</h2>
          <p style="color: #ffffff; margin: 6px 0 0 0; opacity: 0.9;">Payment Confirmed</p>
        </div>

        <div style="padding: 32px; background: #f9fafb; border: 1px solid #e5e7eb;">
          <h3 style="color: #111827; margin-top: 0;">Payment Successfully Processed</h3>

          <div style="background: #ffffff; border: 1px solid #d1fae5; border-left: 4px solid #10b981; border-radius: 8px; padding: 20px; margin: 20px 0;">
            <h4 style="color: #065f46; margin-top: 0;">Payment Details</h4>
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 5px 0; color: #6b7280; width: 40%;">Payment Number</td>
                <td style="padding: 5px 0; font-weight: bold; font-family: monospace; color: #111827;">${data.payment?.paymentNumber || 'N/A'}</td>
              </tr>
              <tr>
                <td style="padding: 5px 0; color: #6b7280;">Reservation</td>
                <td style="padding: 5px 0; font-family: monospace; color: #111827;">${data.reservation?.reservationNumber || 'N/A'}</td>
              </tr>
              <tr>
                <td style="padding: 5px 0; color: #6b7280;">Amount</td>
                <td style="padding: 5px 0; font-weight: bold; color: #0F5B4F; font-size: 16px;">ETB ${(data.payment?.amount || 0).toLocaleString()}</td>
              </tr>
              <tr>
                <td style="padding: 5px 0; color: #6b7280;">Method</td>
                <td style="padding: 5px 0; color: #111827;">${data.payment?.paymentMethod || 'N/A'}</td>
              </tr>
              <tr>
                <td style="padding: 5px 0; color: #6b7280;">Date</td>
                <td style="padding: 5px 0; color: #111827;">${data.payment?.paidAt ? new Date(data.payment.paidAt).toLocaleString() : 'N/A'}</td>
              </tr>
              <tr>
                <td style="padding: 5px 0; color: #6b7280;">Status</td>
                <td style="padding: 5px 0; color: #10b981; font-weight: bold;">✅ PAID</td>
              </tr>
            </table>
          </div>

          <div style="background: #ecfdf5; padding: 15px; border-radius: 8px; margin: 16px 0; border-left: 4px solid #10b981;">
            <h4 style="margin-top: 0; color: #065f46;">Your room is now reserved!</h4>
            <p style="color: #374151; margin: 0;">You're all set for your stay. Please keep this email for your records.</p>
          </div>

          <p style="color: #6b7280; font-size: 12px; text-align: center; margin-top: 24px; border-top: 1px solid #e5e7eb; padding-top: 16px;">
            Thank you for choosing LuxStay Hotels.
          </p>
        </div>
      </div>
    `,
  }),

  checkoutConfirmation: (data) => ({
    subject: `👋 Thank You for Your Stay — ${data.reservation?.reservationNumber}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #0F5B4F, #1a7a6b); padding: 28px; text-align: center; border-radius: 8px 8px 0 0;">
          <h2 style="color: #F2B705; margin: 0; font-size: 24px;">LUXSTAY</h2>
          <p style="color: #ffffff; margin: 6px 0 0 0; opacity: 0.9;">Thank You for Staying With Us</p>
        </div>

        <div style="padding: 32px; background: #f9fafb; border: 1px solid #e5e7eb;">
          <h3 style="color: #111827; margin-top: 0;">We hope you had a wonderful stay!</h3>

          <div style="background: #ffffff; border-radius: 8px; border: 1px solid #e5e7eb; padding: 20px; margin: 20px 0;">
            <p style="margin: 0 0 8px 0;"><strong>Reservation:</strong> ${data.reservation?.reservationNumber}</p>
            <p style="margin: 0 0 8px 0;"><strong>Check-out Date:</strong> ${data.reservation?.checkOutDate ? new Date(data.reservation.checkOutDate).toLocaleDateString() : 'N/A'}</p>
            <p style="margin: 0;"><strong>Duration:</strong> ${
              data.reservation?.checkInDate && data.reservation?.checkOutDate
                ? Math.ceil((new Date(data.reservation.checkOutDate) - new Date(data.reservation.checkInDate)) / (1000 * 60 * 60 * 24))
                : '—'
            } night(s)</p>
          </div>

          <div style="background: #fef9c3; padding: 15px; border-radius: 8px; margin: 16px 0; border-left: 4px solid #f59e0b;">
            <h4 style="margin-top: 0; color: #92400e;">We'd love your feedback!</h4>
            <p style="color: #374151; margin: 0 0 12px 0;">Please take a moment to rate your experience and help us serve you better.</p>
            <a href="${process.env.CLIENT_URL}/complaints"
               style="display: inline-block; padding: 10px 20px; background-color: #f59e0b; color: white; text-decoration: none; border-radius: 6px; font-weight: bold;">
              Leave Feedback
            </a>
          </div>

          <div style="background: #dbeafe; padding: 15px; border-radius: 8px; margin: 16px 0; border-left: 4px solid #3b82f6;">
            <h4 style="margin-top: 0; color: #1e40af;">Book Again Soon!</h4>
            <p style="color: #374151; margin: 0;">We'd be delighted to welcome you back to LuxStay.</p>
          </div>

          <p style="color: #6b7280; font-size: 12px; text-align: center; margin-top: 24px; border-top: 1px solid #e5e7eb; padding-top: 16px;">
            Have a safe journey! 🚗✈️<br>
            Thank you for choosing LuxStay Hotels.
          </p>
        </div>
      </div>
    `,
  }),

  checkInReminder: (data) => ({
    subject: `🔓 Check-in Today — ${data.reservation?.reservationNumber}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #0F5B4F, #1a7a6b); padding: 28px; text-align: center; border-radius: 8px 8px 0 0;">
          <h2 style="color: #F2B705; margin: 0; font-size: 24px;">LUXSTAY</h2>
          <p style="color: #ffffff; margin: 6px 0 0 0; opacity: 0.9;">Your Check-in is Today</p>
        </div>

        <div style="padding: 32px; background: #f9fafb; border: 1px solid #e5e7eb;">
          <h3 style="color: #111827; margin-top: 0;">Welcome! Your Room is Ready 🎉</h3>

          <div style="background: #fef9c3; padding: 16px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #f59e0b;">
            <h4 style="margin-top: 0; color: #92400e;">Check-in Information</h4>
            <p style="margin: 0 0 6px 0;"><strong>Today's Date:</strong> ${new Date().toLocaleDateString()}</p>
            <p style="margin: 0 0 6px 0;"><strong>Check-in Time:</strong> 2:00 PM – 11:00 PM</p>
            <p style="margin: 0 0 6px 0;"><strong>Reservation:</strong> ${data.reservation?.reservationNumber}</p>
            <p style="margin: 0;"><strong>Remember to bring:</strong> Valid ID and booking confirmation</p>
          </div>

          <p style="color: #6b7280; font-size: 12px; text-align: center; margin-top: 24px; border-top: 1px solid #e5e7eb; padding-top: 16px;">
            See you soon! 👋 — LuxStay Hotels
          </p>
        </div>
      </div>
    `,
  }),

  cancellationConfirmation: (data) => ({
    subject: `📅 Booking Cancelled — ${data.reservation?.reservationNumber}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #0F5B4F, #1a7a6b); padding: 28px; text-align: center; border-radius: 8px 8px 0 0;">
          <h2 style="color: #F2B705; margin: 0; font-size: 24px;">LUXSTAY</h2>
          <p style="color: #ffffff; margin: 6px 0 0 0; opacity: 0.9;">Cancellation Confirmed</p>
        </div>

        <div style="padding: 32px; background: #f9fafb; border: 1px solid #e5e7eb;">
          <h3 style="color: #111827; margin-top: 0;">Your Booking Has Been Cancelled</h3>

          <div style="background: #ffffff; border-radius: 8px; border: 1px solid #e5e7eb; padding: 20px; margin: 20px 0;">
            <p style="margin: 0 0 8px 0;"><strong>Reservation Number:</strong> ${data.reservation?.reservationNumber}</p>
            <p style="margin: 0 0 8px 0;"><strong>Original Dates:</strong> ${
              data.reservation?.checkInDate && data.reservation?.checkOutDate
                ? `${new Date(data.reservation.checkInDate).toLocaleDateString()} – ${new Date(data.reservation.checkOutDate).toLocaleDateString()}`
                : 'N/A'
            }</p>
            <p style="margin: 0;"><strong>Cancellation Date:</strong> ${new Date().toLocaleDateString()}</p>
          </div>

          <div style="background: #ecfdf5; padding: 15px; border-radius: 8px; margin: 16px 0; border-left: 4px solid #10b981;">
            <h4 style="margin-top: 0; color: #065f46;">Refund Information</h4>
            <p style="color: #374151; margin: 0;">Your refund has been initiated and will be processed within 5–7 business days.</p>
          </div>

          <p style="color: #6b7280; font-size: 12px; text-align: center; margin-top: 24px; border-top: 1px solid #e5e7eb; padding-top: 16px;">
            We hope to see you again soon! — LuxStay Hotels
          </p>
        </div>
      </div>
    `,
  }),

  passwordReset: (data) => ({
    subject: `🔒 Reset Your Password — LUXSTAY`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff;">
        <div style="background: linear-gradient(135deg, #0F5B4F, #1a7a6b); padding: 32px; text-align: center; border-radius: 8px 8px 0 0;">
          <h1 style="color: #F2B705; margin: 0; font-size: 28px;">LUXSTAY</h1>
          <p style="color: #ffffff; margin: 8px 0 0 0; opacity: 0.9;">Password Reset Request</p>
        </div>

        <div style="padding: 32px; background: #f9fafb; border: 1px solid #e5e7eb;">
          <h2 style="color: #111827; margin-top: 0;">Hello, ${data.name || 'User'}</h2>
          <p style="color: #6b7280; line-height: 1.6;">You are receiving this email because you (or someone else) requested a password reset for your account.</p>
          
          <p style="color: #6b7280; line-height: 1.6;">Please click the button below or copy and paste the URL into your browser to complete the process. This link is valid for 1 hour.</p>

          <div style="text-align: center; margin: 32px 0;">
            <a href="${data.resetUrl}"
               style="display: inline-block; padding: 12px 24px; background-color: #0F5B4F; color: #ffffff; text-decoration: none; border-radius: 6px; font-weight: bold;">
              Reset Password
            </a>
          </div>

          <p style="color: #6b7280; font-size: 13px; word-break: break-all;">
            If you did not request this, please ignore this email and your password will remain unchanged.
          </p>

          <p style="color: #6b7280; font-size: 13px; text-align: center; margin-top: 24px; border-top: 1px solid #e5e7eb; padding-top: 16px;">
            LuxStay Hotels Management
          </p>
        </div>
      </div>
    `,
  }),
};

// ── sendEmail ─────────────────────────────────────────────────────────────────
// templateName: key of emailTemplates
// data:         object passed to the template function
// attachments:  optional nodemailer attachments array
const sendEmail = async (to, templateName, data, attachments = []) => {
  try {
    const templateFn = emailTemplates[templateName];
    if (!templateFn) {
      console.warn(`[Email] Unknown template: ${templateName}`);
      return false;
    }

    const { subject, html } = templateFn(data);

    // ── Auto-attach PDF invoice for bookingConfirmation ───────────────────
    if (templateName === 'bookingConfirmation' && data.reservation && data.payment) {
      try {
        const pdfBuffer = await generateInvoicePDF({
          reservation: data.reservation,
          payment:     data.payment,
          customer:    data.customer,
          roomLabel:   data.roomLabel || 'Room / Hall',
        });
        attachments = [
          ...attachments,
          {
            filename:    `LuxStay_Invoice_${data.reservation.reservationNumber || 'Booking'}.pdf`,
            content:     pdfBuffer,
            contentType: 'application/pdf',
          },
        ];
      } catch (pdfErr) {
        // Non-blocking — email still sends without the attachment
        console.warn('[Email] PDF attachment failed:', pdfErr.message);
      }
    }

    // ── Auto-attach PDF for paymentConfirmation ───────────────────────────
    if (templateName === 'paymentConfirmation' && data.payment && data.reservation) {
      try {
        const pdfBuffer = await generateInvoicePDF({
          reservation: data.reservation,
          payment:     data.payment,
          customer:    data.customer || {
            name:  data.payment.customerName  || 'Guest',
            email: data.payment.customerEmail || to,
            phone: data.payment.customerPhone || '',
          },
          roomLabel: data.roomLabel || 'Room / Hall',
        });
        attachments = [
          ...attachments,
          {
            filename:    `LuxStay_Invoice_${data.payment.paymentNumber || data.reservation.reservationNumber}.pdf`,
            content:     pdfBuffer,
            contentType: 'application/pdf',
          },
        ];
      } catch (pdfErr) {
        console.warn('[Email] PDF attachment failed:', pdfErr.message);
      }
    }

    await transporter.sendMail({
      from:        `"LuxStay Hotels" <${process.env.EMAIL_FROM || process.env.EMAIL_USER || 'noreply@luxstay.com'}>`,
      to,
      subject,
      html,
      attachments,
    });

    return true;
  } catch (error) {
    console.error('[Email] Send error:', error.message);
    return false;
  }
};

module.exports = { sendEmail, emailTemplates };