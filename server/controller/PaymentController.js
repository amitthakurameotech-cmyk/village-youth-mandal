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

    const booking = await Booking.findById(bookingId)
      .populate("user")
      .populate("car");
    
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
    const frontendUrl = process.env.FRONTEND_URL || "http://localhost:3000";

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
    console.error("❌ createCheckoutSession error:", error.message);
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

  let event;
  try {
    if (webhookSecret) {
      event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
    } else {
      event = JSON.parse(req.body);
    }
  } catch (err) {
    console.error("❌ Webhook signature verification failed:", err.message);
    return res.status(400).json({ success: false, message: "Webhook signature verification failed" });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object;
        console.log(`✅ Checkout session completed: ${session.id}`);
        await handleCheckoutSessionCompleted(session);
        break;
      }

      case "payment_intent.succeeded": {
        const paymentIntent = event.data.object;
        console.log(`✅ Payment intent succeeded: ${paymentIntent.id}`);
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
        console.log(`✅ Charge succeeded: ${charge.id}`);
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
    const booking = await Booking.findById(bookingId);
    if (!booking) {
      console.warn(`⚠️ Booking not found: ${bookingId}`);
      return;
    }

    // Fetch session details to get payment info
    const stripe = getStripe();
    const fullSession = await stripe.checkout.sessions.retrieve(session.id);

    // Find payment record by session ID
    let payment = await Payment.findOne({ stripePaymentIntentId: fullSession.payment_intent });

    if (!payment) {
      // Create payment record if not exists
      payment = await Payment.create({
        booking: booking._id,
        user: booking.user || userId,
        stripePaymentIntentId: fullSession.payment_intent,
        amount: booking.totalPrice,
        currency: fullSession.currency || "inr",
        status: "created",
      });
    }

    console.log(`✅ Checkout session processed for booking ${bookingId}`);
  } catch (error) {
    console.error("❌ Error in handleCheckoutSessionCompleted:", error.message);
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
    const booking = await Booking.findById(bookingId);
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

    // Update or create payment record
    let payment = await Payment.findOne({ stripePaymentIntentId: paymentIntent.id });

    if (payment) {
      payment.status = "succeeded";
      if (cardInfo && Object.keys(cardInfo).length > 0) {
        Object.assign(payment, cardInfo);
      }
      await payment.save();
    } else {
      await Payment.create({
        booking: booking._id,
        user: booking.user || userId,
        stripePaymentIntentId: paymentIntent.id,
        amount: (paymentIntent.amount || 0) / 100,
        currency: paymentIntent.currency || "inr",
        status: "succeeded",
        ...cardInfo,
      });
    }

    // Update booking payment status
    booking.paymentStatus = "Paid";
    await booking.save();

    console.log(`✅ Payment succeeded and booking ${bookingId} marked as Paid`);
  } catch (error) {
    console.error("❌ Error in handlePaymentIntentSucceeded:", error.message);
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
    }

    console.log(`❌ Payment failed for booking ${bookingId}`);
  } catch (error) {
    console.error("❌ Error in handlePaymentIntentFailed:", error.message);
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
    console.error("❌ Error in handleChargeSucceeded:", error.message);
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
    console.error("❌ getPaymentHistory error:", error.message);
    return res.status(500).json({
      success: false,
      message: "Failed to retrieve payment history",
      error: error.message,
    });
  }
};
