import Booking from "../model/Bookingmodel.js";
import Payment from "../model/Paymentmodel.js";
import stripePackage from "stripe";

// Initialize Stripe
function getStripe() {
  const stripeSecret =
    process.env.STRIPE_SECRET_KEY ||
    process.env.secret_key ||
    process.env.SECRET_KEY;

  if (!stripeSecret) return null;
  return stripePackage(stripeSecret);
}

// ============================================
// Create Stripe Checkout Session
// ============================================
export const createCheckoutSession = async (req, res) => {
  try {
    const { bookingId } = req.params;
    if (!bookingId) return res.status(400).json({ success: false, message: "bookingId is required" });

    const booking = await Booking.findById(bookingId).populate("user").populate("car");

    if (!booking) return res.status(404).json({ success: false, message: "Booking not found" });

    if (booking.paymentStatus === "Paid") {
      return res.status(400).json({ success: false, message: "Booking already paid" });
    }

    const stripe = getStripe();
    if (!stripe) return res.status(500).json({ success: false, message: "Stripe secret key missing" });

    const amount = Math.round(parseFloat(booking.totalPrice) * 100);
    const currency = process.env.STRIPE_CURRENCY || "inr";
    const frontendUrl = process.env.FRONTEND_URL || "http://localhost:5173";

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency,
            product_data: {
              name: `Car Rental: ${booking.car?.name || "Car"}`,
              description: `Booking #${bookingId}`,
              images: booking.car?.image ? [booking.car.image] : [],
            },
            unit_amount: amount,
          },
          quantity: 1,
        },
      ],
      mode: "payment",
      success_url: `${frontendUrl}/payment-success?bookingId=${bookingId}&sessionId={CHECKOUT_SESSION_ID}`,
      cancel_url: `${frontendUrl}/mybooking?cancelled=true`,
      customer_email: booking.user?.email,
      metadata: {
        bookingId: booking._id.toString(),
        userId: booking.user?._id.toString(),
      },
    });

    return res.status(201).json({
      success: true,
      sessionUrl: session.url,
      sessionId: session.id,
    });

  } catch (err) {
    console.error("❌ createCheckoutSession:", err);
    return res.status(500).json({ success: false, message: "Failed to create Stripe session" });
  }
};

// ============================================
// Get Payment History
// ============================================
export const getPaymentHistory = async (req, res) => {
  try {
    const { userId } = req.params;

    const payments = await Payment.find({ user: userId })
      .populate("booking", "pickupLocation dropLocation startDate endDate totalPrice bookingStatus")
      .populate("user", "email name")
      .sort({ createdAt: -1 });

    return res.json({
      success: true,
      payments,
      count: payments.length,
    });

  } catch (err) {
    console.error("❌ getPaymentHistory:", err);
    return res.status(500).json({ success: false, message: "Failed to retrieve payment history" });
  }
};

// ============================================
// Get Stripe Payment Session Details
// ============================================
export const getPaymentSession = async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { bookingId } = req.query;

    const stripe = getStripe();
    if (!stripe) return res.status(500).json({ success: false, message: "Stripe not configured" });

    const session = await stripe.checkout.sessions.retrieve(sessionId);

    let booking = null;
    if (bookingId) {
      booking = await Booking.findById(bookingId).populate("user").populate("car");
    }

    return res.json({ success: true, session, booking });

  } catch (err) {
    console.error("❌ getPaymentSession:", err);
    return res.status(500).json({ success: false, message: "Failed to fetch payment session" });
  }
};

// ============================================
// Save Frontend Stripe Session and Prevent Duplicates
// ============================================
export const saveFrontendSession = async (req, res) => {
  try {
    const { session, booking: bookingFromClient } = req.body || {};

    const bookingId =
      session?.metadata?.bookingId ||
      bookingFromClient?._id;

    if (!bookingId) {
      return res.status(400).json({ success: false, message: "bookingId missing" });
    }

    const booking = await Booking.findById(bookingId).populate("user").populate("car");
    if (!booking) return res.status(404).json({ success: false, message: "Booking not found" });

    const sessionId = session?.id || null;
    const paymentIntentId = session?.payment_intent || null;

    const amount = session?.amount_total ? session.amount_total / 100 : booking.totalPrice;
    const currency = session?.currency || "inr";
    const status = session?.payment_status === "paid" ? "succeeded" : "pending";
    const userId = booking.user._id;

    // Prevent duplicate creation
    const filter = {
      $or: [
        paymentIntentId ? { stripePaymentIntentId: paymentIntentId } : null,
        sessionId ? { stripeCheckoutSessionId: sessionId } : null,
        { booking: bookingId, amount }
      ].filter(Boolean)
    };

    const payment = await Payment.findOneAndUpdate(
      filter,
      {
        $set: {
          booking: bookingId,
          user: userId,
          amount,
          currency,
          status,
          stripeCheckoutSessionId: sessionId,
          stripePaymentIntentId: paymentIntentId,
          stripeRaw: session
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    if (status === "succeeded" && booking.paymentStatus !== "Paid") {
      booking.paymentStatus = "Paid";
      await booking.save();
    }

    return res.json({ success: true, payment, booking });

  } catch (err) {
    console.error("❌ saveFrontendSession:", err);
    return res.status(500).json({ success: false, message: "Failed to save session", error: err.message });
  }
};

// ============================================
// Stripe Webhook Handler
// ============================================
export const handleWebhook = async (req, res) => {
  const sig = req.headers["stripe-signature"];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!webhookSecret) {
    console.error("❌ STRIPE_WEBHOOK_SECRET not configured");
    return res.status(500).json({ success: false, message: "Webhook secret not configured" });
  }

  if (!sig) {
    console.error("❌ No Stripe signature in webhook request");
    return res.status(400).json({ success: false, message: "Missing Stripe signature" });
  }

  let event;
  const stripe = getStripe();

  try {
    // Verify signature using raw body (req.rawBody is set by express.raw() middleware)
    event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
    console.log(`✅ Webhook signature verified, event type: ${event.type}`);
  } catch (err) {
    console.error(`❌ Webhook signature verification failed: ${err.message}`);
    return res.status(400).json({ success: false, message: "Signature verification failed" });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed":
        await handleCheckoutSessionCompleted(event.data.object);
        break;

      case "payment_intent.succeeded":
        await handlePaymentIntentSucceeded(event.data.object);
        break;

      case "payment_intent.payment_failed":
        await handlePaymentIntentFailed(event.data.object);
        break;

      default:
        console.log(`ℹ️ Unhandled webhook event type: ${event.type}`);
    }

    return res.json({ success: true, received: true });
  } catch (err) {
    console.error(`❌ Error processing webhook event ${event.type}:`, err && err.stack ? err.stack : err);
    return res.status(500).json({ success: false, message: "Error processing webhook" });
  }
};

// Handle checkout.session.completed event
async function handleCheckoutSessionCompleted(session) {
  try {
    console.log(`📦 Processing checkout.session.completed: ${session.id}`);

    const bookingId = session.metadata?.bookingId;
    const userId = session.metadata?.userId;
    const paymentIntentId = session.payment_intent;

    if (!bookingId) {
      console.warn("⚠️ checkout.session.completed: no bookingId in metadata");
      return;
    }

    // Fetch booking from DB
    const booking = await Booking.findById(bookingId).populate("user");
    if (!booking) {
      console.warn(`⚠️ Booking ${bookingId} not found for checkout session ${session.id}`);
      return;
    }

    // Normalize payment data
    const amountMajor = session.amount_total ? session.amount_total / 100 : booking.totalPrice;
    const currency = session.currency || process.env.STRIPE_CURRENCY || "inr";
    const status = session.payment_status === "paid" ? "confirmed" : "pending";

    // Prepare payment data for upsert
    const paymentData = {
      booking: booking._id,
      user: booking.user?._id || userId,
      amount: amountMajor,
      currency,
      status,
      stripeCheckoutSessionId: session.id,
      stripePaymentIntentId: paymentIntentId || undefined,
      stripeRaw: session,
    };

    // Enrich with PaymentIntent data if available
    if (paymentIntentId && stripe) {
      try {
        const pi = await stripe.paymentIntents.retrieve(paymentIntentId);
        if (pi) {
          const charge = pi.charges?.data?.[0];
          if (charge) {
            paymentData.stripeChargeId = charge.id;
            paymentData.stripePaymentMethodId = charge.payment_method || pi.payment_method;
            const card = charge.payment_method_details?.card;
            if (card) {
              paymentData.cardBrand = card.brand;
              paymentData.cardLast4 = card.last4;
              paymentData.cardExpMonth = card.exp_month;
              paymentData.cardExpYear = card.exp_year;
              paymentData.cardFunding = normalizeFunding(card.funding);
            }
          }
        }
      } catch (piErr) {
        console.error(`ℹ️ Could not retrieve PaymentIntent ${paymentIntentId}:`, piErr && piErr.message ? piErr.message : piErr);
      }
    }

    // Upsert payment: use $or to find by payment intent or session id
    const filter = { $or: [{ stripePaymentIntentId: paymentIntentId }, { stripeCheckoutSessionId: session.id }] };
    const result = await Payment.findOneAndUpdate(filter, { $set: paymentData }, { upsert: true, new: true, setDefaultsOnInsert: true, rawResult: true });

    if (result && result.lastErrorObject && result.lastErrorObject.updatedExisting === false) {
      console.log(`✅ Webhook: Created new Payment record for checkout session ${session.id}`);
    } else {
      console.log(`ℹ️ Webhook: Updated existing Payment record for checkout session ${session.id}`);
    }

    // Mark booking as Paid if payment confirmed
    if (status === "confirmed") {
      booking.paymentStatus = "Paid";
      await booking.save();
      console.log(`✔ Webhook: Booking ${bookingId} marked Paid`);
    }
  } catch (err) {
    console.error("❌ handleCheckoutSessionCompleted error:", err && err.stack ? err.stack : err);
  }
}

// Handle payment_intent.succeeded event
async function handlePaymentIntentSucceeded(paymentIntent) {
  try {
    console.log(`💳 Processing payment_intent.succeeded: ${paymentIntent.id}`);

    // Try to find payment by payment intent id or by charge
    const chargeId = paymentIntent.charges?.data?.[0]?.id;
    let payment = await Payment.findOne({
      $or: [
        { stripePaymentIntentId: paymentIntent.id },
        { stripeChargeId: chargeId },
      ],
    });

    if (!payment) {
      console.warn(`⚠️ payment_intent.succeeded: Payment record not found for PI ${paymentIntent.id}`);
      return;
    }

    // Update payment status and charge details
    payment.status = "succeeded";
    payment.stripePaymentIntentId = paymentIntent.id;

    const charge = paymentIntent.charges?.data?.[0];
    if (charge) {
      payment.stripeChargeId = charge.id;
      payment.stripePaymentMethodId = charge.payment_method || paymentIntent.payment_method;
      const card = charge.payment_method_details?.card;
      if (card) {
        payment.cardBrand = card.brand;
        payment.cardLast4 = card.last4;
        payment.cardExpMonth = card.exp_month;
        payment.cardExpYear = card.exp_year;
        payment.cardFunding = normalizeFunding(card.funding);
      }
    }

    await payment.save();
    console.log(`✅ Webhook: Updated Payment ${payment._id} to succeeded status`);

    // Update booking to Paid
    if (payment.booking) {
      const booking = await Booking.findById(payment.booking);
      if (booking) {
        booking.paymentStatus = "Paid";
        await booking.save();
        console.log(`✔ Webhook: Booking ${payment.booking} marked Paid via payment_intent`);
      }
    }
  } catch (err) {
    console.error("❌ handlePaymentIntentSucceeded error:", err && err.stack ? err.stack : err);
  }
}

// Handle payment_intent.payment_failed event
async function handlePaymentIntentFailed(paymentIntent) {
  try {
    console.log(`❌ Processing payment_intent.payment_failed: ${paymentIntent.id}`);

    const payment = await Payment.findOne({ stripePaymentIntentId: paymentIntent.id });
    if (!payment) {
      console.warn(`⚠️ payment_intent.payment_failed: Payment record not found for PI ${paymentIntent.id}`);
      return;
    }

    payment.status = "failed";
    await payment.save();
    console.log(`✅ Webhook: Updated Payment ${payment._id} to failed status`);
  } catch (err) {
    console.error("❌ handlePaymentIntentFailed error:", err && err.stack ? err.stack : err);
  }
}

// Helper to normalize card funding
function normalizeFunding(f) {
  if (!f) return "unknown";
  const s = String(f).toLowerCase();
  if (["credit", "debit", "prepaid"].includes(s)) return s;
  return "unknown";
}

