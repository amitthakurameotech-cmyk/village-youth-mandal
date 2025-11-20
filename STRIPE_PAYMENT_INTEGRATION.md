# Stripe Payment Integration Guide

## 📋 Overview

This guide covers the complete Stripe Checkout Session integration for the Car Rental application. Users can:
- View booking details
- Proceed to Stripe's hosted checkout page
- Pay securely with any major card
- View payment history with masked card details

## 🔧 Backend Setup

### 1. Environment Variables (server/.env)

```env
# Stripe Keys (get from https://dashboard.stripe.com/apikeys)
STRIPE_SECRET_KEY=sk_test_51RY4AxPVTaanfxbkWLFcRFSZlxGW559DRpzDG9ku8QEN0ZlyVdQDSJKVW0SxJKoat95OuO0pJwK2DQa9iezUeYZp005QkCyOri
STRIPE_PUBLISHABLE_KEY=pk_test_51RY4AxPVTaanfxbkmRzdavqDMZQ4V3MhHaTSeIpTJ7GtoM9UNAn3a6y3oj6wsvVreqNYw3xLJTrMANCJnMlx9UGr00J8qWGL7f

# Webhook Signing Secret (get from Stripe Dashboard > Developers > Webhooks)
STRIPE_WEBHOOK_SECRET=whsec_test_...

# Application URLs
FRONTEND_URL=http://localhost:3000
NODE_ENV=development

# Currency (INR for India)
STRIPE_CURRENCY=inr
```

### 2. Backend Files Updated

**`server/controller/PaymentController.js`**
- ✅ `createCheckoutSession(req, res)` - Creates Stripe Checkout Session
- ✅ `handleWebhook(req, res)` - Processes Stripe webhook events
- ✅ `getPaymentHistory(req, res)` - Retrieves user's payment history

**`server/model/Paymentmodel.js`**
- ✅ Fields for masked card data (last4, brand, funding, expiry)
- ✅ Stripe PaymentMethodId & PaymentIntentId storage
- ✅ Payment status tracking

**`server/index.js`**
- ✅ Routes registered:
  - `POST /payments/checkout/:bookingId` - Create checkout session
  - `GET /payments/user/:userId` - Get payment history
  - `POST /payments/webhook` - Stripe webhook (no auth required)

### 3. Install Dependencies

```powershell
cd "E:\Amit\Car Rental\server"
npm install stripe
npm install
```

### 4. Start Backend Server

```powershell
npm run start
```

Server will run on `http://localhost:8080` (or port from `.env`)

---

## 💻 Frontend Setup

### 1. Environment Variables (client/.env)

```env
REACT_APP_API_URL=http://localhost:8080
REACT_APP_STRIPE_PUBLISHABLE_KEY=pk_test_51RY4AxPVTaanfxbkmRzdavqDMZQ4V3MhHaTSeIpTJ7GtoM9UNAn3a6y3oj6wsvVreqNYw3xLJTrMANCJnMlx9UGr00J8qWGL7f
```

### 2. Frontend Components Created

**`client/src/components/CheckoutButton.jsx`**
```javascript
import { CheckoutButton } from "./CheckoutButton";

<CheckoutButton bookingId={booking._id} totalPrice={booking.totalPrice} />
```

**`client/src/pages/PaymentSuccess.jsx`**
```javascript
import PaymentSuccess from "./pages/PaymentSuccess";

// Automatically shown after Stripe redirects user back
```

**`client/src/components/PaymentHistory.jsx`**
```javascript
import PaymentHistory from "./components/PaymentHistory";

<PaymentHistory userId={user._id} />
```

**`client/src/components/BookingCheckoutModal.jsx`**
```javascript
import BookingCheckoutModal from "./components/BookingCheckoutModal";

<BookingCheckoutModal 
  show={showModal} 
  booking={selectedBooking} 
  onHide={() => setShowModal(false)} 
/>
```

### 3. Update Your Routes (client/src/App.jsx or routing file)

```javascript
import { BrowserRouter, Routes, Route } from "react-router-dom";
import PaymentSuccess from "./pages/PaymentSuccess";
import CheckoutButton from "./components/CheckoutButton";
import PaymentHistory from "./components/PaymentHistory";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* ... existing routes ... */}
        
        {/* Payment Routes */}
        <Route path="/payment-success" element={<PaymentSuccess />} />
        <Route path="/payments/history" element={<PaymentHistory userId={currentUser?._id} />} />
        
        {/* ... other routes ... */}
      </Routes>
    </BrowserRouter>
  );
}

export default App;
```

### 4. Example: Add Checkout Button to MyBookings

```javascript
// MyBookings.jsx or BookingCard.jsx
import CheckoutButton from "../components/CheckoutButton";

function BookingCard({ booking }) {
  return (
    <div className="booking-card">
      <h3>{booking.car?.name}</h3>
      <p>Total: ₹{booking.totalPrice}</p>
      <p>Status: {booking.paymentStatus}</p>

      {booking.paymentStatus === "Pending" ? (
        <CheckoutButton bookingId={booking._id} totalPrice={booking.totalPrice} />
      ) : (
        <span className="badge bg-success">✅ Paid</span>
      )}
    </div>
  );
}
```

---

## 🔐 Stripe Webhook Setup (Important!)

### For Local Development (Stripe CLI)

1. **Install Stripe CLI**
   ```powershell
   choco install stripe-cli
   ```

2. **Login to Stripe**
   ```powershell
   stripe login
   ```

3. **Forward webhook events to local server**
   ```powershell
   stripe listen --forward-to localhost:8080/payments/webhook
   ```
   This will output your webhook signing secret. Copy it and add to `.env`:
   ```env
   STRIPE_WEBHOOK_SECRET=whsec_test_...
   ```

### For Production Deployment

1. Go to **Stripe Dashboard** > **Developers** > **Webhooks**
2. Click **Add an endpoint**
3. Enter endpoint URL: `https://your-production-domain.com/payments/webhook`
4. Select events:
   - ✅ `checkout.session.completed`
   - ✅ `payment_intent.succeeded`
   - ✅ `payment_intent.payment_failed`
   - ✅ `charge.succeeded`
5. Copy the signing secret and add to production `.env`

---

## 🧪 Testing Payment Flow

### Test Cards

Use these Stripe test cards:

| Card Type | Number | Status |
|-----------|--------|--------|
| Visa | `4242 4242 4242 4242` | ✅ Success |
| Mastercard | `5555 5555 5555 4444` | ✅ Success |
| Decline | `4000 0000 0000 0002` | ❌ Decline |
| 3D Secure | `4000 0025 0000 3155` | 🔐 Auth Required |

**For all test cards:**
- **Expiry:** Any future date (e.g., 12/25)
- **CVC:** Any 3 digits (e.g., 123)
- **Name:** Any name
- **Email:** Any email

### Step-by-Step Test

1. **Create a Booking**
   - Go to Cars page
   - Select a car and create a booking
   - Booking status should be "Pending"
   - Payment status should be "Pending"

2. **View Booking in My Bookings**
   - Click "My Bookings"
   - See the pending booking with "Proceed to Stripe Checkout" button

3. **Click Checkout Button**
   - Button redirects to Stripe's hosted checkout page
   - You'll see booking details and total amount

4. **Enter Card Details**
   - Use test card `4242 4242 4242 4242`
   - Enter any future expiry and any CVC
   - Fill in email and billing address
   - Click "Pay"

5. **Confirm Payment Success**
   - Redirected to `payment-success` page
   - See "✅ Payment Successful" message
   - Backend webhook updates booking to "Paid"

6. **Verify in Backend**
   - Check Payment collection in MongoDB
   - Should see: `status: "succeeded"`, masked card data (last4, brand)
   - Booking's `paymentStatus` should be "Paid"

7. **View Payment History**
   - Go to "Payment History" or user dashboard
   - See all payments with masked card info (last4, brand, type)
   - Never shows full card numbers (PCI-DSS compliant)

---

## 📊 Data Flow Diagram

```
User in Frontend
       ↓
[Click "Proceed to Checkout"]
       ↓
POST /payments/checkout/:bookingId (with auth token)
       ↓
Backend creates Stripe Checkout Session
       ↓
Returns sessionUrl (like https://checkout.stripe.com/c/pay/cs_test_...)
       ↓
Frontend redirects to Stripe
       ↓
User enters card details on Stripe's page
       ↓
User clicks "Pay"
       ↓
Stripe processes payment
       ↓
Stripe redirects to frontend: /payment-success?bookingId=...&sessionId=...
       ↓
Frontend shows success page
       ↓
Stripe sends webhook: POST /payments/webhook
       ↓
Backend receives webhook event (payment_intent.succeeded)
       ↓
Backend updates:
  - Payment collection (status: "succeeded", masked card data)
  - Booking collection (paymentStatus: "Paid")
       ↓
User can view payment history with masked card details
```

---

## 🔒 Security Features

✅ **Card Data Never Touches Your Server**
- Card details entered on Stripe's hosted page
- Your server only receives masked data (last4, brand, funding)
- Stripe PaymentMethodId stored for future reference

✅ **Webhook Signature Verification**
- Backend verifies all webhook events with `STRIPE_WEBHOOK_SECRET`
- Prevents fake/spoofed webhook events

✅ **Authentication Required**
- All payment endpoints require valid JWT token
- Users can only see their own payment history

✅ **Idempotent Webhook Handling**
- Webhook handler checks if payment already processed
- Won't double-charge on retry

✅ **PCI-DSS Compliant**
- No full card numbers stored
- No sensitive card data in logs
- All data encrypted in transit (HTTPS in production)

---

## 🛠️ Troubleshooting

### Issue: "Stripe secret key not configured"
**Solution:** 
- Ensure `STRIPE_SECRET_KEY` or `secret_key` is in `.env`
- Restart server: `npm run start`

### Issue: Webhook not receiving events
**Solution:**
- Make sure Stripe CLI is running: `stripe listen --forward-to localhost:8080/payments/webhook`
- Check webhook signing secret is correct in `.env`
- Check server logs for webhook errors

### Issue: Payment succeeded but booking not updated
**Solution:**
- Webhook may be delayed (up to 30 seconds)
- Check MongoDB Payment and Booking collections
- Check server logs for webhook errors
- Restart server if needed

### Issue: Card details showing but not saving
**Solution:**
- Ensure PaymentMethod is included in webhook event
- Check `handlePaymentIntentSucceeded` logs for card retrieval errors
- Verify Stripe SDK version: `npm list stripe`

### Issue: "Cannot read property 'card' of undefined"
**Solution:**
- Ensure payment has a charge associated
- Check if charge has `payment_method_details`
- Some card types may not have full details available

---

## 📱 Frontend Integration Examples

### In React Component

```javascript
import { useState } from "react";
import CheckoutButton from "./CheckoutButton";

function MyBookings() {
  const [bookings, setBookings] = useState([]);

  return (
    <div>
      {bookings.map(booking => (
        <div key={booking._id}>
          <h3>{booking.car.name}</h3>
          <p>Amount: ₹{booking.totalPrice}</p>
          
          {booking.paymentStatus === "Pending" ? (
            <CheckoutButton 
              bookingId={booking._id} 
              totalPrice={booking.totalPrice}
            />
          ) : (
            <span className="badge bg-success">Paid ✅</span>
          )}
        </div>
      ))}
    </div>
  );
}
```

### In Modal

```javascript
import BookingCheckoutModal from "./BookingCheckoutModal";

function App() {
  const [showModal, setShowModal] = useState(false);
  const [selectedBooking, setSelectedBooking] = useState(null);

  return (
    <>
      <button onClick={() => {
        setSelectedBooking(booking);
        setShowModal(true);
      }}>
        Checkout
      </button>

      <BookingCheckoutModal 
        show={showModal}
        booking={selectedBooking}
        onHide={() => setShowModal(false)}
      />
    </>
  );
}
```

---

## 📞 API Reference

### Create Checkout Session

**Endpoint:** `POST /payments/checkout/:bookingId`

**Headers:**
```
Authorization: Bearer <JWT_TOKEN>
Content-Type: application/json
```

**Response:**
```json
{
  "success": true,
  "sessionUrl": "https://checkout.stripe.com/c/pay/cs_test_...",
  "sessionId": "cs_test_..."
}
```

### Get Payment History

**Endpoint:** `GET /payments/user/:userId`

**Headers:**
```
Authorization: Bearer <JWT_TOKEN>
```

**Response:**
```json
{
  "success": true,
  "payments": [
    {
      "_id": "64f...",
      "booking": {...},
      "amount": 5000,
      "currency": "inr",
      "status": "succeeded",
      "cardBrand": "visa",
      "cardFunding": "credit",
      "cardLast4": "4242",
      "cardExpMonth": 12,
      "cardExpYear": 2025,
      "createdAt": "2024-11-20T10:30:00Z"
    }
  ],
  "count": 1
}
```

### Webhook Event

**Endpoint:** `POST /payments/webhook`

**Headers:**
```
stripe-signature: <STRIPE_SIGNATURE>
Content-Type: application/json
```

**Events Handled:**
- `checkout.session.completed`
- `payment_intent.succeeded`
- `payment_intent.payment_failed`
- `charge.succeeded`

---

## 🚀 Production Checklist

- [ ] Add real Stripe API keys (not test keys)
- [ ] Set `NODE_ENV=production` in `.env`
- [ ] Configure webhook secret for production in Stripe Dashboard
- [ ] Ensure HTTPS is enabled
- [ ] Set correct FRONTEND_URL for production
- [ ] Test with real cards (or ask Stripe to enable)
- [ ] Set up monitoring/alerting for payment failures
- [ ] Enable logging for audit trail
- [ ] Configure email receipts on successful payment
- [ ] Set up refund policy and process
- [ ] Test all error scenarios

---

## 📚 Additional Resources

- [Stripe Checkout Documentation](https://stripe.com/docs/payments/checkout)
- [Stripe Webhook Events](https://stripe.com/docs/api/events)
- [Stripe Test Cards](https://stripe.com/docs/testing)
- [Stripe CLI Reference](https://stripe.com/docs/stripe-cli)

---

**Last Updated:** November 20, 2025
**Version:** 1.0.0
