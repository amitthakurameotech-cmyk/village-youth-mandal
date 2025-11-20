import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Spinner } from "react-bootstrap";

/**
 * CheckoutButton Component
 * Handles Stripe Checkout Session creation and redirect to Stripe hosted checkout page
 */
export const CheckoutButton = ({ bookingId, totalPrice, disabled = false }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  const handleCheckout = async () => {
    if (!bookingId) {
      setError("Booking ID is missing");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const token = localStorage.getItem("authToken"); // JWT token from login
      
      if (!token) {
        setError("Please login to proceed with payment");
        navigate("/login");
        return;
      }

      const response = await fetch(
        `${process.env.REACT_APP_API_URL || "http://localhost:8080"}/payments/checkout/${bookingId}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const data = await response.json();

      if (!response.ok || !data.success) {
        setError(data.message || "Failed to create checkout session");
        setLoading(false);
        return;
      }

      if (data.sessionUrl) {
        // Redirect to Stripe Checkout hosted page
        console.log("🔗 Redirecting to Stripe Checkout:", data.sessionUrl);
        window.location.href = data.sessionUrl;
      } else {
        setError("No checkout URL received from server");
        setLoading(false);
      }
    } catch (err) {
      console.error("❌ Checkout error:", err);
      setError("An error occurred. Please try again.");
      setLoading(false);
    }
  };

  return (
    <div className="checkout-button-container">
      {error && (
        <div className="alert alert-danger alert-dismissible fade show" role="alert">
          {error}
          <button
            type="button"
            className="btn-close"
            onClick={() => setError(null)}
            aria-label="Close"
          />
        </div>
      )}

      <button
        onClick={handleCheckout}
        disabled={loading || disabled}
        className="btn btn-primary btn-lg w-100"
        style={{
          backgroundColor: "#625b5f",
          borderColor: "#625b5f",
          fontWeight: "600",
          padding: "12px 24px",
          fontSize: "16px",
        }}
      >
        {loading ? (
          <>
            <Spinner
              as="span"
              animation="border"
              size="sm"
              role="status"
              aria-hidden="true"
              className="me-2"
            />
            Processing...
          </>
        ) : (
          <>
            🔒 Proceed to Stripe Checkout
          </>
        )}
      </button>

      {totalPrice && (
        <div className="text-center mt-2 text-muted">
          <small>Total Amount: ₹{totalPrice.toLocaleString()}</small>
        </div>
      )}
    </div>
  );
};

export default CheckoutButton;
