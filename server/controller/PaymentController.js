import Booking from "../model/Bookingmodel.js";
import Payment from "../model/Paymentmodel.js";
import stripePackage from "stripe";

// Initialize Stripe lazily to avoid dotenv timing issues (index.js loads env before handling requests)
function getStripe() {
  const stripeSecret = process.env.STRIPE_SECRET_KEY || process.env.secret_key || process.env.SECRET_KEY;
  if (!stripeSecret) return null;
  return stripePackage(stripeSecret);
}

// Create a PaymentIntent for an existing booking
export const createPaymentIntent = async (req, res) => {
  try {
    const { bookingId } = req.params;
    if (!bookingId) return res.status(400).json({ success: false, message: "bookingId is required" });

    const booking = await Booking.findById(bookingId).populate("user");
    if (!booking) return res.status(404).json({ success: false, message: "Booking not found" });

    if (booking.paymentStatus === "Paid") {
      return res.status(400).json({ success: false, message: "Booking is already paid" });
    }

    // amount in cents
    const amount = Math.round((booking.totalPrice || 0) * 100);
    const currency = process.env.STRIPE_CURRENCY || "usd";

    const stripe = getStripe();
    if (!stripe) return res.status(500).json({ success: false, message: "Stripe secret key not configured on server" });

    const paymentIntent = await stripe.paymentIntents.create({
      amount,
      currency,
      metadata: { bookingId: booking._id.toString(), userId: booking.user._id.toString() },
    });

    // store a payment record (created)
    await Payment.create({
      booking: booking._id,
      user: booking.user._id,
      stripePaymentIntentId: paymentIntent.id,
      amount: booking.totalPrice,
      currency,
      status: "created",
    });

    return res.status(201).json({ success: true, clientSecret: paymentIntent.client_secret });
  } catch (error) {
    console.error("createPaymentIntent error:", error);
    return res.status(500).json({ success: false, message: "Failed to create payment intent", error: error.message });
  }
};

// Confirm payment on the server by verifying the PaymentIntent status
export const confirmPayment = async (req, res) => {
  try {
    const { paymentIntentId, bookingId } = req.body;
    if (!paymentIntentId || !bookingId) return res.status(400).json({ success: false, message: "paymentIntentId and bookingId are required" });

    const stripe = getStripe();
    if (!stripe) return res.status(500).json({ success: false, message: "Stripe secret key not configured on server" });

    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
    if (!paymentIntent) return res.status(404).json({ success: false, message: "PaymentIntent not found" });

    // try to determine the PaymentMethod id (from client or from paymentIntent/charges)
    const pmFromBody = req.body.paymentMethodId;
    const pmFromIntent = paymentIntent.payment_method;
    const pmFromCharge = paymentIntent.charges && paymentIntent.charges.data && paymentIntent.charges.data[0] && paymentIntent.charges.data[0].payment_method;
    const paymentMethodId = pmFromBody || pmFromIntent || pmFromCharge;

    // attempt to retrieve payment method details from Stripe (safe: contains only masked card details)
    let cardInfo = {};
    if (paymentMethodId) {
      try {
        const pm = await stripe.paymentMethods.retrieve(paymentMethodId);
        if (pm && pm.card) {
          cardInfo = {
            stripePaymentMethodId: paymentMethodId,
            cardBrand: pm.card.brand,
            cardFunding: pm.card.funding || "unknown",
            cardLast4: pm.card.last4,
            cardExpMonth: pm.card.exp_month,
            cardExpYear: pm.card.exp_year,
          };
        }
      } catch (err) {
        console.warn("Could not retrieve PaymentMethod from Stripe:", err.message || err);
      }
    } else if (paymentIntent.charges && paymentIntent.charges.data && paymentIntent.charges.data[0]) {
      const cardDetails = paymentIntent.charges.data[0].payment_method_details && paymentIntent.charges.data[0].payment_method_details.card;
      if (cardDetails) {
        cardInfo = {
          stripePaymentMethodId: paymentIntent.charges.data[0].payment_method,
          cardBrand: cardDetails.brand,
          cardFunding: cardDetails.funding || "unknown",
          cardLast4: cardDetails.last4,
          cardExpMonth: cardDetails.exp_month,
          cardExpYear: cardDetails.exp_year,
        };
      }
    }

    // find payment record
    const payment = await Payment.findOne({ stripePaymentIntentId: paymentIntentId, booking: bookingId });

    // prepare update fields
    const updateFields = {
      status: paymentIntent.status === "succeeded" ? "succeeded" : "failed",
    };
    if (cardInfo && Object.keys(cardInfo).length) {
      updateFields.stripePaymentMethodId = cardInfo.stripePaymentMethodId;
      updateFields.cardBrand = cardInfo.cardBrand;
      updateFields.cardFunding = cardInfo.cardFunding;
      updateFields.cardLast4 = cardInfo.cardLast4;
      updateFields.cardExpMonth = cardInfo.cardExpMonth;
      updateFields.cardExpYear = cardInfo.cardExpYear;
    }

    if (payment) {
      Object.assign(payment, updateFields);
      await payment.save();
    } else {
      await Payment.create({
        booking: bookingId,
        user: req.user?._id,
        stripePaymentIntentId: paymentIntentId,
        amount: (paymentIntent.amount || 0) / 100,
        currency: paymentIntent.currency || "usd",
        ...updateFields,
      });
    }

    if (paymentIntent.status === "succeeded") {
      const booking = await Booking.findById(bookingId);
      if (booking) {
        booking.paymentStatus = "Paid";
        await booking.save();
      }
      return res.json({ success: true, message: "Payment succeeded and booking updated" });
    }

    return res.status(400).json({ success: false, message: `Payment not succeeded: ${paymentIntent.status}` });
  } catch (error) {
    console.error("confirmPayment error:", error);
    return res.status(500).json({ success: false, message: "Payment confirmation failed", error: error.message });
  }
};
