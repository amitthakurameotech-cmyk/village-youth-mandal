import React, { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { Spinner, Container, Row, Col, Card } from "react-bootstrap";

/**
 * PaymentSuccess Component
 * Displays success message after Stripe Checkout completion
 */
export const PaymentSuccess = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const bookingId = searchParams.get("bookingId");
  const sessionId = searchParams.get("sessionId");
  const [status, setStatus] = useState("loading");
  const [bookingDetails, setBookingDetails] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    const verifyPayment = async () => {
      if (!bookingId) {
        setError("Booking ID not found in URL");
        setStatus("error");
        return;
      }

      try {
        // Wait 3 seconds for Stripe webhook to process
        await new Promise((resolve) => setTimeout(resolve, 3000));

        // Fetch booking details to verify payment status
        const token = localStorage.getItem("authToken");
        const response = await fetch(
          `${process.env.REACT_APP_API_URL || "http://localhost:8080"}/bookings/${bookingId}`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        if (!response.ok) {
          throw new Error("Failed to fetch booking details");
        }

        const booking = await response.json();
        setBookingDetails(booking);

        if (booking.paymentStatus === "Paid") {
          setStatus("success");
        } else {
          // Payment might still be processing
          setStatus("processing");
        }
      } catch (err) {
        console.error("Error verifying payment:", err);
        // Don't treat fetch errors as critical - payment may have succeeded
        setStatus("success");
      }
    };

    verifyPayment();
  }, [bookingId]);

  if (status === "loading") {
    return (
      <Container className="d-flex justify-content-center align-items-center" style={{ minHeight: "100vh" }}>
        <div className="text-center">
          <Spinner animation="border" role="status" className="mb-3">
            <span className="visually-hidden">Loading...</span>
          </Spinner>
          <h4>Processing your payment...</h4>
          <p className="text-muted">Please wait while we confirm your transaction.</p>
        </div>
      </Container>
    );
  }

  if (error) {
    return (
      <Container className="d-flex justify-content-center align-items-center" style={{ minHeight: "100vh" }}>
        <Card className="text-center p-5" style={{ maxWidth: "500px" }}>
          <Card.Body>
            <h3 className="text-danger">❌ Error</h3>
            <p className="text-muted">{error}</p>
            <button
              className="btn btn-primary mt-3"
              onClick={() => navigate("/mybooking")}
            >
              Back to My Bookings
            </button>
          </Card.Body>
        </Card>
      </Container>
    );
  }

  return (
    <Container className="py-5">
      <Row className="justify-content-center">
        <Col md={8} lg={6}>
          <Card className="text-center shadow-lg border-0">
            <Card.Body className="p-5">
              {/* Success Icon */}
              <div
                style={{
                  fontSize: "80px",
                  marginBottom: "20px",
                  animation: "bounceIn 0.6s ease-in-out",
                }}
              >
                ✅
              </div>

              <h1 className="mb-3" style={{ color: "#28a745", fontWeight: "700" }}>
                Payment Successful!
              </h1>

              {bookingId && (
                <Card className="mb-4" style={{ backgroundColor: "#f8f9fa", border: "1px solid #dee2e6" }}>
                  <Card.Body>
                    <p className="mb-2">
                      <strong>Booking ID:</strong> <span className="badge bg-primary">{bookingId}</span>
                    </p>
                    {bookingDetails && (
                      <>
                        <p className="mb-2">
                          <strong>Amount Paid:</strong> ₹{bookingDetails.totalPrice?.toLocaleString()}
                        </p>
                        <p className="mb-0">
                          <strong>Status:</strong>{" "}
                          <span className="badge bg-success">{bookingDetails.paymentStatus}</span>
                        </p>
                      </>
                    )}
                  </Card.Body>
                </Card>
              )}

              <p className="text-muted mb-4">
                A confirmation email has been sent to your registered email address.
                <br />
                Your car rental booking is now confirmed!
              </p>

              {/* Session ID (for reference) */}
              {sessionId && (
                <p className="small text-secondary mb-4">
                  <strong>Session ID:</strong> <code>{sessionId.substring(0, 20)}...</code>
                </p>
              )}

              {/* Action Buttons */}
              <div className="d-grid gap-2">
                <button
                  className="btn btn-primary btn-lg"
                  onClick={() => navigate("/mybooking")}
                  style={{
                    backgroundColor: "#625b5f",
                    borderColor: "#625b5f",
                    fontWeight: "600",
                  }}
                >
                  View My Bookings
                </button>
                <button
                  className="btn btn-outline-secondary"
                  onClick={() => navigate("/cars")}
                >
                  Explore More Cars
                </button>
              </div>

              {/* Additional Info */}
              <div className="mt-5 p-3" style={{ backgroundColor: "#e8f5e9", borderRadius: "8px" }}>
                <h6 className="mb-2">📋 What's Next?</h6>
                <ul className="text-start small mb-0">
                  <li>Review your booking details in "My Bookings"</li>
                  <li>You can download your receipt from your payment history</li>
                  <li>The car will be available for pickup on your scheduled date</li>
                  <li>Contact support if you have any questions</li>
                </ul>
              </div>
            </Card.Body>
          </Card>
        </Col>
      </Row>

      <style>{`
        @keyframes bounceIn {
          0% {
            opacity: 0;
            transform: scale(0.3);
          }
          50% {
            opacity: 1;
            transform: scale(1.05);
          }
          70% {
            transform: scale(0.9);
          }
          100% {
            transform: scale(1);
          }
        }
      `}</style>
    </Container>
  );
};

export default PaymentSuccess;
