const express = require('express');
const router = express.Router();
const Payment = require('../../models/Payment');
const Reservation = require('../../models/Reservation');
const authMiddleware = require('../../middlewares/auth');
const { generateInvoicePDF } = require('../../services/invoiceService');

router.use(authMiddleware);

// ── GET /api/invoices/:paymentId — stream PDF inline ─────────────────────────
router.get('/:paymentId', async (req, res) => {
    try {
        const { paymentId } = req.params;
        const { download } = req.query; // ?download=true → attachment, else inline

        // Load payment
        const payment = await Payment.findById(paymentId).populate('reservation');
        if (!payment) {
            return res.status(404).json({ message: 'Payment not found' });
        }

        // Ownership check — customers can only download their own invoices
        const isStaff = ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'ACCOUNTANT', 'STAFF'].includes(req.user.role);

        if (!isStaff) {
            const reservation = await Reservation.findById(
                payment.reservation?._id || payment.reservation
            );
            if (!reservation) {
                return res.status(404).json({ message: 'Reservation not found' });
            }
            const ownerId = reservation.customerId?.toString();
            if (ownerId && ownerId !== req.user._id.toString()) {
                return res.status(403).json({ message: 'Access denied' });
            }
        }

        // Load full reservation with all populated fields
        const reservation = await Reservation.findById(
            payment.reservation?._id || payment.reservation
        )
            .populate('customerId', 'firstName lastName email phone')
            .populate('roomId', 'roomNumber floor', null, { populate: { path: 'roomTypeId', select: 'name' } })
            .populate('hallId', 'hallName floor', null, { populate: { path: 'hallTypeId', select: 'name' } })
            .populate('roomTypeId', 'name basePricePerNight')
            .populate('hallTypeId', 'name basePricePerHour');

        // Build customer info
        const customer = reservation?.customerId
            ? {
                name: `${reservation.customerId.firstName || ''} ${reservation.customerId.lastName || ''}`.trim(),
                email: reservation.customerId.email || payment.customerEmail || '',
                phone: reservation.customerId.phone || payment.customerPhone || '',
            }
            : {
                name: payment.customerName || reservation?.guestName || 'Guest',
                email: payment.customerEmail || reservation?.guestEmail || '',
                phone: payment.customerPhone || reservation?.guestPhone || '',
            };

        // Build room label
        const room = reservation?.roomId;
        const hall = reservation?.hallId;
        const rt = reservation?.roomTypeId;
        const ht = reservation?.hallTypeId;

        let roomLabel = 'N/A';
        if (room?.roomNumber) {
            roomLabel = `${rt?.name || room.type || 'Room'} — Room ${room.roomNumber}, Floor ${room.floor || 'N/A'}`;
        } else if (hall?.hallName) {
            roomLabel = `${ht?.name || hall.hallName}${hall.floor ? `, Floor ${hall.floor}` : ''}`;
        }

        // Generate PDF
        const pdfBuffer = await generateInvoicePDF({
            reservation,
            payment,
            customer,
            roomLabel,
        });

        const filename = `LuxStay_Invoice_${payment.paymentNumber || paymentId}.pdf`;

        res.set({
            'Content-Type': 'application/pdf',
            'Content-Length': pdfBuffer.length,
            'Content-Disposition': download === 'true'
                ? `attachment; filename="${filename}"`
                : `inline; filename="${filename}"`,
        });

        res.send(pdfBuffer);
    } catch (err) {
        if (!res.headersSent) {
            res.status(500).json({ message: 'Failed to generate invoice', error: err.message });
        }
    }
});

// ── GET /api/invoices/reservation/:reservationId — get invoice by reservation ─
router.get('/reservation/:reservationId', async (req, res) => {
    try {
        const payment = await Payment.findOne({
            reservation: req.params.reservationId,
            status: { $in: ['PAID', 'PENDING'] },
        }).sort({ createdAt: -1 });

        if (!payment) {
            return res.status(404).json({ message: 'No payment found for this reservation' });
        }

        // Redirect to the payment invoice endpoint
        res.redirect(`/api/invoices/${payment._id}${req.query.download === 'true' ? '?download=true' : ''}`);
    } catch (err) {
        res.status(500).json({ message: 'Failed to find invoice', error: err.message });
    }
});

module.exports = router;