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

    console.log(`✅ Checkout session created: ${session.id} for booking ${bookingId}`);

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

// ============================================
// Stripe Webhook Handler
// ============================================
export const handleWebhook = async (req, res) => {
  const stripe = getStripe();
  if (!stripe) {
    return res.status(500).json({ success: false, message: "Stripe not configured" });
  }

  const sig = req.headers["stripe-signature"];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!webhookSecret) {
    console.warn("⚠️ STRIPE_WEBHOOK_SECRET not configured. Webhook signature verification skipped.");
    // In production, always verify signatures
  }

  // Helpful debug info
  try {
    console.log("ℹ️ Received webhook, headers:", { signature: !!sig, length: req.headers["content-length"] });
  } catch (e) {}

  let event;
  try {
    // When using express.raw the `req.body` is a Buffer which must be passed directly to constructEvent
    if (webhookSecret) {
      event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
    } else {
      // Fallback for local testing when no webhook secret is configured
      const text = req.body && req.body.toString ? req.body.toString() : "";
      event = JSON.parse(text || "{}");
    }
  } catch (err) {
    console.error("❌ Webhook signature verification failed or invalid payload:", err && err.stack ? err.stack : err, "sig:", sig);
    return res.status(400).json({ success: false, message: "Webhook signature verification failed or invalid payload" });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object;
        console.log(`✅ Payment Successful! Checkout session completed: ${session.id}`);

        // Log full payment details in the console
        console.log("Full Payment Details:", JSON.stringify(session, null, 2));

        await handleCheckoutSessionCompleted(session);
        break;
      }

      case "payment_intent.succeeded": {
        const paymentIntent = event.data.object;
        console.log(`✅ Payment Successful! Payment intent succeeded: ${paymentIntent.id}`);
        await handlePaymentIntentSucceeded(paymentIntent);
        break;
      }

      case "payment_intent.payment_failed": {
        const paymentIntent = event.data.object;
        console.log(`❌ Payment intent failed: ${paymentIntent.id}`);
        await handlePaymentIntentFailed(paymentIntent);
        break;
      }

      case "charge.succeeded": {
        const charge = event.data.object;
        console.log(`✅ Payment Successful! Charge succeeded: ${charge.id}`);
        await handleChargeSucceeded(charge);
        break;
      }

      default:
        console.log(`⚠️ Unhandled event type: ${event.type}`);
    }

    return res.json({ received: true });
  } catch (error) {
    console.error("❌ Webhook handler error:", error.message);
    return res.status(500).json({ success: false, message: "Webhook processing failed" });
  }
};

// Handle checkout session completion
async function handleCheckoutSessionCompleted(session) {
  const { bookingId, userId } = session.metadata || {};

  if (!bookingId) {
    console.warn("⚠️ No bookingId in session metadata");
    return;
  }

  try {
    let booking;
    try {
      booking = await Booking.findById(bookingId);
    } catch (dbErr) {
      console.error(`❌ DB error fetching booking ${bookingId}:`, dbErr && dbErr.stack ? dbErr.stack : dbErr);
      return;
    }
    if (!booking) {
      console.warn(`⚠️ Booking not found: ${bookingId}`);
      return;
    }

    // Fetch session details to get payment info
    const stripe = getStripe();
    const fullSession = await stripe.checkout.sessions.retrieve(session.id);

    // Find payment record by payment_intent OR by checkout session id
    let payment;
    try {
      payment = await Payment.findOne({
        $or: [
          { stripePaymentIntentId: fullSession.payment_intent },
          { stripeCheckoutSessionId: fullSession.id },
        ],
      });
    } catch (dbErr) {
      console.error(`❌ DB error finding payment for booking ${bookingId}, session ${fullSession.id}:`, dbErr && dbErr.stack ? dbErr.stack : dbErr);
      return;
    }

    if (!payment) {
      // Create payment record if not exists. Use payment_intent when present otherwise store checkout session id.
      const paymentData = {
        booking: booking._id,
        user: booking.user || userId,
        amount: booking.totalPrice,
        currency: fullSession.currency || "inr",
        status: "pending",
      };
      if (fullSession.payment_intent) paymentData.stripePaymentIntentId = fullSession.payment_intent;
      else paymentData.stripeCheckoutSessionId = fullSession.id;

      try {
        payment = await Payment.create(paymentData);
        console.log(`✅ Payment record created for booking ${bookingId}, session ${fullSession.id} (status: pending)`);
      } catch (createErr) {
        console.error(`❌ DB error creating payment for booking ${bookingId}, session ${fullSession.id}:`, createErr && createErr.stack ? createErr.stack : createErr, "input:", paymentData);
        return;
      }
    } else {
      payment.status = "pending";
      // Ensure we store checkout session id if it was missing
      if (!payment.stripeCheckoutSessionId && fullSession.id) payment.stripeCheckoutSessionId = fullSession.id;
      try {
        await payment.save();
        console.log(`ℹ️ Payment record updated for booking ${bookingId}, session ${fullSession.id} (status set to pending)`);
      } catch (saveErr) {
        console.error(`❌ DB error saving payment for booking ${bookingId}, session ${fullSession.id}:`, saveErr && saveErr.stack ? saveErr.stack : saveErr);
      }
    }

    console.log(`✅ Checkout session processed for booking ${bookingId}`);
  } catch (error) {
    console.error("❌ Error in handleCheckoutSessionCompleted:", error && error.stack ? error.stack : error);
  }
}

// Handle payment intent succeeded
async function handlePaymentIntentSucceeded(paymentIntent) {
  const { bookingId, userId } = paymentIntent.metadata || {};

  if (!bookingId) {
    console.warn("⚠️ No bookingId in payment intent metadata");
    return;
  }

  try {
    let booking;
    try {
      booking = await Booking.findById(bookingId);
    } catch (dbErr) {
      console.error(`❌ DB error fetching booking ${bookingId}:`, dbErr && dbErr.stack ? dbErr.stack : dbErr);
      return;
    }
    if (!booking) {
      console.warn(`⚠️ Booking not found: ${bookingId}`);
      return;
    }

    // Get card info from payment intent charges
    let cardInfo = {};
    if (paymentIntent.charges && paymentIntent.charges.data && paymentIntent.charges.data[0]) {
      const charge = paymentIntent.charges.data[0];
      const cardDetails = charge.payment_method_details?.card;

      if (cardDetails) {
        cardInfo = {
          stripePaymentMethodId: charge.payment_method,
          cardBrand: cardDetails.brand || "unknown",
          cardFunding: cardDetails.funding || "unknown",
          cardLast4: cardDetails.last4,
          cardExpMonth: cardDetails.exp_month,
          cardExpYear: cardDetails.exp_year,
        };
      }
    }

    // Update or create payment record. Try to find by intent id OR by checkout session id stored on payment.
    let payment;
    try {
      // possible metadata keys that might contain session id
      const sessionIdsToCheck = [
        paymentIntent.metadata?.sessionId,
        paymentIntent.metadata?.session_id,
        paymentIntent.metadata?.checkout_session_id,
        paymentIntent.metadata?.checkoutSessionId,
      ].filter(Boolean);

      const orClauses = [{ stripePaymentIntentId: paymentIntent.id }];
      sessionIdsToCheck.forEach((sId) => orClauses.push({ stripeCheckoutSessionId: sId }));

      payment = await Payment.findOne({ $or: orClauses });
    } catch (dbErr) {
      console.error(`❌ DB error finding payment for booking ${bookingId}, intent ${paymentIntent.id}:`, dbErr && dbErr.stack ? dbErr.stack : dbErr);
    }

    if (payment) {
      payment.status = "confirmed";
      if (cardInfo && Object.keys(cardInfo).length > 0) {
        Object.assign(payment, cardInfo);
      }
      // ensure we persist the intent id
      if (!payment.stripePaymentIntentId) payment.stripePaymentIntentId = paymentIntent.id;
      try {
        await payment.save();
        console.log(`✅ Payment record updated to confirmed for booking ${bookingId}, intent ${paymentIntent.id}`);
      } catch (saveErr) {
        console.error(`❌ DB error saving payment for booking ${bookingId}, intent ${paymentIntent.id}:`, saveErr && saveErr.stack ? saveErr.stack : saveErr);
      }
    } else {
      const createData = {
        booking: booking._id,
        user: booking.user || userId,
        stripePaymentIntentId: paymentIntent.id,
        amount: (paymentIntent.amount || 0) / 100,
        currency: paymentIntent.currency || "inr",
        status: "confirmed",
        ...cardInfo,
      };
      try {
        await Payment.create(createData);
        console.log(`✅ Payment record created for booking ${bookingId}, intent ${paymentIntent.id} (status: confirmed)`);
      } catch (createErr) {
        console.error(`❌ DB error creating payment for booking ${bookingId}, intent ${paymentIntent.id}:`, createErr && createErr.stack ? createErr.stack : createErr, "input:", createData);
      }
    }

    // Update booking payment status
    booking.paymentStatus = "Paid";
    await booking.save();
    console.log(`✅ Booking ${bookingId} paymentStatus updated to Paid`);

    console.log(`✅ Payment succeeded and booking ${bookingId} marked as Paid`);
  } catch (error) {
    console.error("❌ Error in handlePaymentIntentSucceeded:", error && error.stack ? error.stack : error);
  }
}

// Handle payment intent failed
async function handlePaymentIntentFailed(paymentIntent) {
  const { bookingId } = paymentIntent.metadata || {};

  if (!bookingId) return;

  try {
    let payment = await Payment.findOne({ stripePaymentIntentId: paymentIntent.id });

    if (payment) {
      payment.status = "failed";
      await payment.save();
      console.log(`❌ Payment record updated to failed for booking ${bookingId}, intent ${paymentIntent.id}`);
    } else {
      console.log(`❌ No payment record found to update for failed payment, booking ${bookingId}, intent ${paymentIntent.id}`);
    }

    console.log(`❌ Payment failed for booking ${bookingId}`);
  } catch (error) {
    console.error("❌ Error in handlePaymentIntentFailed:", error && error.stack ? error.stack : error);
  }
}

// Handle charge succeeded (additional safety check)
async function handleChargeSucceeded(charge) {
  const { bookingId, userId } = charge.metadata || {};

  if (!bookingId) return;

  try {
    const booking = await Booking.findById(bookingId);
    if (booking && booking.paymentStatus !== "Paid") {
      // Double-check: ensure payment intent also succeeded
      const stripe = getStripe();
      if (charge.payment_intent) {
        const pi = await stripe.paymentIntents.retrieve(charge.payment_intent);
        if (pi.status === "succeeded") {
          booking.paymentStatus = "Paid";
          await booking.save();
          console.log(`✅ Charge verified and booking marked as Paid: ${bookingId}`);
        }
      }
    }
  } catch (error) {
    console.error("❌ Error in handleChargeSucceeded:", error && error.stack ? error.stack : error);
  }
}

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
// https://localhost:44308/Payment/Success?cartId=15&sessionId=cs_test_a1lxHsAeBbVawbjvwNZ289H532TgKjUbt7ed1BuKxgnoTGnBRyccdVNzhY
// http://localhost:3000/payment-success?bookingId=691ecf37e1c8454fb58f0f05&sessionId=cs_test_a1H4NAbTNBDTT8gfv9JYDDJrLONtTgDmRrhRPLXhPvvV758jsooMgkEsNM