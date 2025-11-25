import Booking from "../model/Bookingmodel.js";
// import Carmodel from "../model/Carmodel.js";
import Payment from "../model/Paymentmodel.js";
import stripePackage from "stripe";

// Initialize Stripe lazily to avoid dotenv timing issues (index.js loads env before handling requests)
function getStripe() {
  const stripeSecret = process.env.STRIPE_SECRET_KEY || process.env.secret_key || process.env.SECRET_KEY;
  if (!stripeSecret) return null;
  return stripePackage(stripeSecret);
}

// ============================================
// Create Stripe Checkout Session for booking
// ============================================
export const createCheckoutSession = async (req, res) => {
  try {
    const { bookingId } = req.params;
    if (!bookingId) {
      return res.status(400).json({ success: false, message: "bookingId is required" });
    }

    let booking;
    try {
      booking = await Booking.findById(bookingId).populate("user").populate("car");
    } catch (dbErr) {
      console.error(`❌ DB error fetching booking ${bookingId}:`, dbErr && dbErr.stack ? dbErr.stack : dbErr);
      return res.status(500).json({ success: false, message: "Failed to fetch booking", error: dbErr && dbErr.message ? dbErr.message : String(dbErr) });
    }
    if (!booking) {
      return res.status(404).json({ success: false, message: "Booking not found" });
    }

    if (booking.paymentStatus === "Paid") {
      return res.status(400).json({ success: false, message: "Booking is already paid" });
    }

    const stripe = getStripe();
    if (!stripe) {
      return res.status(500).json({ success: false, message: "Stripe secret key not configured on server" });
    }

    const amount = Math.round((booking.totalPrice || 0) * 100); // Convert to paise (for INR)
    const currency = process.env.STRIPE_CURRENCY || "inr";
    const frontendUrl = process.env.FRONTEND_URL || "http://localhost:5173";

    // Create line items for checkout session
    const lineItems = [
      {
        price_data: {
          currency,
          product_data: {
            name: `Car Rental: ${booking.car?.name || "Car"}`,
            description: `Booking ID: ${bookingId}\nPickup: ${booking.pickupLocation}\nDrop: ${booking.dropLocation}`,
            images: booking.car?.image ? [booking.car.image] : [],
          },
          unit_amount: amount,
        },
        quantity: 1,
      },
    ];

    // Create Checkout Session
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      line_items: lineItems,
      mode: "payment",
      success_url: `${frontendUrl}/payment-success?bookingId=${bookingId}&sessionId={CHECKOUT_SESSION_ID}`,
      cancel_url: `${frontendUrl}/mybooking?cancelled=true`,
      customer_email: booking.user?.email,
      metadata: {
        bookingId: booking._id.toString(),
        userId: booking.user?._id.toString(),
      },
    });

    // console.log(`✅ Checkout session created: ${session.id} for booking ${bookingId}`);

    return res.status(201).json({
      success: true,
      sessionUrl: session.url,
      sessionId: session.id,
    });
  } catch (error) {
    console.error("❌ createCheckoutSession error:", error && error.stack ? error.stack : error);
    return res.status(500).json({
      success: false,
      message: "Failed to create checkout session",
      error: error.message,
    });
  }
};

// Webhooks removed: this project uses frontend-driven save endpoints instead of Stripe webhooks.

// ============================================
// Get Payment History for User
// ============================================
export const getPaymentHistory = async (req, res) => {
  try {
    const { userId } = req.params;

    if (!userId) {
      return res.status(400).json({ success: false, message: "userId is required" });
    }

    const payments = await Payment.find({ user: userId })
      .populate("booking", "pickupLocation dropLocation startDate endDate totalPrice bookingStatus")
      .populate("user", "email name")
      .sort({ createdAt: -1 });

    // Return only masked card data (no sensitive info)
    const maskedPayments = payments.map((payment) => ({
      _id: payment._id,
      booking: payment.booking,
      amount: payment.amount,
      currency: payment.currency,
      status: payment.status,
      cardBrand: payment.cardBrand,
      cardFunding: payment.cardFunding,
      cardLast4: payment.cardLast4,
      cardExpMonth: payment.cardExpMonth,
      cardExpYear: payment.cardExpYear,
      createdAt: payment.createdAt,
      updatedAt: payment.updatedAt,
    }));

    return res.json({
      success: true,
      payments: maskedPayments,
      count: maskedPayments.length,
    });
  } catch (error) {
    console.error("❌ getPaymentHistory error:", error && error.stack ? error.stack : error);
    return res.status(500).json({
      success: false,
      message: "Failed to retrieve payment history",
      error: error.message,
    });
  }
};
  // ============================================
  // Get Stripe Payment Session and Booking Details
  // ============================================
  export const getPaymentSession = async (req, res) => {
    try {
      const stripe = getStripe();
      if (!stripe) {
        return res.status(500).json({ success: false, message: "Stripe not configured" });
      }
      const { sessionId } = req.params;
      const { bookingId } = req.query;
      if (!sessionId) {
        return res.status(400).json({ success: false, message: "sessionId is required" });
      }
      // Fetch Stripe session details
      let session;
      try {
        session = await stripe.checkout.sessions.retrieve(sessionId);
      } catch (err) {
        return res.status(404).json({ success: false, message: "Stripe session not found", error: err.message });
      }
      // Fetch booking details from DB
      let booking = null;
      if (bookingId) {
        try {
          booking = await Booking.findById(bookingId).populate("user").populate("car");
        } catch (err) {
          // Ignore booking error, just return null
        }
      }
      return res.json({ success: true, session, booking });
    } catch (error) {
        console.error("❌ getPaymentSession error:", error && error.stack ? error.stack : error);
        return res.status(500).json({ success: false, message: "Failed to fetch payment session", error: error.message });
    }
  };
  //==================================================
  // Save session & booking sent from frontend
  // POST /payments/save-frontend  { session, booking }
  // This accepts the Stripe `session` object (as returned by the frontend) and
  // the booking object, then creates/updates a Payment record and marks booking Paid when appropriate.
  //==================================================
  export const saveFrontendSession = async (req, res) => {
    try {
      const { session, booking: bookingFromClient } = req.body || {};

      if (!session && !bookingFromClient) {
        return res.status(400).json({ success: false, message: 'session or booking required in body' });
      }

      // Determine bookingId from session metadata or booking object
      const bookingId = (session && session.metadata && session.metadata.bookingId) || (bookingFromClient && bookingFromClient._id);
      if (!bookingId) return res.status(400).json({ success: false, message: 'bookingId missing in session metadata or booking object' });

      // Fetch booking from DB
      let booking;
      try {
        booking = await Booking.findById(bookingId).populate('user').populate('car');
      } catch (dbErr) {
        console.error(`❌ DB error fetching booking ${bookingId} in saveFrontendSession:`, dbErr && dbErr.stack ? dbErr.stack : dbErr);
        return res.status(500).json({ success: false, message: 'Failed to fetch booking', error: dbErr && dbErr.message ? dbErr.message : String(dbErr) });
      }
      if (!booking) return res.status(404).json({ success: false, message: 'Booking not found' });

      const stripe = getStripe();

      // normalize values
      const sessionId = session?.id || session?.sessionId || null;
      const paymentIntentId = session?.payment_intent || null;
      const amountMajor = session?.amount_total ? (session.amount_total / 100) : (booking.totalPrice || 0);
      const currency = session?.currency || process.env.STRIPE_CURRENCY || 'inr';
      const userRef = booking.user && booking.user._id ? booking.user._id : (session?.metadata?.userId || bookingFromClient?.user?._id);
      const status = (session?.payment_status === 'paid' || session?.status === 'complete') ? 'confirmed' : 'pending';

      // Find existing payment by payment_intent or session id
      let payment;
      try {
        payment = await Payment.findOne({
          $or: [
            { stripePaymentIntentId: paymentIntentId },
            { stripeCheckoutSessionId: sessionId },
          ],
        });
      } catch (dbErr) {
        console.error(`❌ DB error finding payment for booking ${bookingId} in saveFrontendSession:`, dbErr && dbErr.stack ? dbErr.stack : dbErr);
        return res.status(500).json({ success: false, message: 'DB lookup failed', error: dbErr && dbErr.message ? dbErr.message : String(dbErr) });
      }

      // Prepare data to save
      const paymentData = {
        booking: booking._id,
        user: userRef,
        amount: amountMajor,
        currency,
        status,
        stripeCheckoutSessionId: sessionId || undefined,
        stripePaymentIntentId: paymentIntentId || undefined,
        stripeRaw: session || bookingFromClient || {},
      };

      // copy simple fields from session or client payload if present
      const copyIfPresent = (field, targetName = field) => {
        if (session && session[field] !== undefined) paymentData[targetName] = session[field];
        else if (bookingFromClient && bookingFromClient[field] !== undefined) paymentData[targetName] = bookingFromClient[field];
      };

      copyIfPresent('cardFunding');
      copyIfPresent('cardBrand');
      copyIfPresent('cardLast4');
      copyIfPresent('cardExpMonth');
      copyIfPresent('cardExpYear');
      copyIfPresent('stripePaymentMethodId');
      copyIfPresent('stripeChargeId');

      // allow frontend to pass created/updated timestamps (ISO string or epoch seconds)
      const parseMaybeDate = (v) => {
        if (!v) return undefined;
        if (typeof v === 'number') return new Date(v);
        const parsed = new Date(v);
        return isNaN(parsed.getTime()) ? undefined : parsed;
      };
      const createdFrom = session?.createdAt || session?.created || bookingFromClient?.createdAt;
      const updatedFrom = session?.updatedAt || session?.updated || bookingFromClient?.updatedAt;
      const createdAtVal = parseMaybeDate(createdFrom);
      const updatedAtVal = parseMaybeDate(updatedFrom);
      if (createdAtVal) paymentData.createdAt = createdAtVal;
      if (updatedAtVal) paymentData.updatedAt = updatedAtVal;

      // If we have a payment intent and stripe client, attempt to attach charge/card info
      if (stripe && paymentIntentId) {
        try {
          const pi = await stripe.paymentIntents.retrieve(paymentIntentId);
          const charge = pi.charges?.data?.[0];
          if (charge) {
            paymentData.stripeChargeId = charge.id;
            paymentData.stripePaymentMethodId = charge.payment_method || paymentData.stripePaymentMethodId;
            if (charge.payment_method_details?.card) {
              paymentData.cardBrand = charge.payment_method_details.card.brand || paymentData.cardBrand;
              paymentData.cardLast4 = charge.payment_method_details.card.last4 || paymentData.cardLast4;
              paymentData.cardExpMonth = charge.payment_method_details.card.exp_month || paymentData.cardExpMonth;
              paymentData.cardExpYear = charge.payment_method_details.card.exp_year || paymentData.cardExpYear;
            }
          }
        } catch (piErr) {
          console.error(`ℹ️ Could not retrieve PaymentIntent ${paymentIntentId} in saveFrontendSession:`, piErr && piErr.stack ? piErr.stack : piErr);
        }
      }

      // Create or update
      if (!payment) {
        try {
          payment = await Payment.create(paymentData);
          console.log(`✅ Saved payment from frontend for booking ${bookingId}, session ${sessionId || '<none>'}`);
        } catch (createErr) {
          console.error(`❌ DB error creating payment from frontend for booking ${bookingId}:`, createErr && createErr.stack ? createErr.stack : createErr, 'input:', paymentData);
          return res.status(500).json({ success: false, message: 'Failed to create payment', error: createErr.message });
        }
      } else {
        // update existing
        try {
          // merge and overwrite fields from paymentData
          Object.keys(paymentData).forEach((k) => {
            payment[k] = paymentData[k];
          });
          // ensure mongoose updatedAt gets updated when we save
          if (updatedAtVal) payment.updatedAt = updatedAtVal;
          await payment.save();
          console.log(`ℹ️ Updated existing payment from frontend for booking ${bookingId}, session ${sessionId || '<none>'}`);
        } catch (saveErr) {
          console.error(`❌ DB error saving payment from frontend for booking ${bookingId}:`, saveErr && saveErr.stack ? saveErr.stack : saveErr);
          return res.status(500).json({ success: false, message: 'Failed to update payment', error: saveErr.message });
        }
      }

      // If payment confirmed, update booking
      if (status === 'confirmed') {
        try {
          booking.paymentStatus = 'Paid';
          await booking.save();
          console.log(`✔ Booking ${bookingId} marked Paid by frontend save`);
        } catch (bkErr) {
          console.error(`❌ DB error updating booking ${bookingId} after frontend save:`, bkErr && bkErr.stack ? bkErr.stack : bkErr);
        }
      }

      return res.json({ success: true, payment, booking });
    } catch (err) {
      console.error('❌ saveFrontendSession error:', err && err.stack ? err.stack : err);
      return res.status(500).json({ success: false, message: 'saveFrontendSession failed', error: err.message || String(err) });
    }
  };
// https://localhost:44308/Payment/Success?cartId=15&sessionId=cs_test_a1lxHsAeBbVawbjvwNZ289H532TgKjUbt7ed1BuKxgnoTGnBRyccdVNzhY
// http://localhost:3000/payment-success?bookingId=691ecf37e1c8454fb58f0f05&sessionId=cs_test_a1H4NAbTNBDTT8gfv9JYDDJrLONtTgDmRrhRPLXhPvvV758jsooMgkEsNM