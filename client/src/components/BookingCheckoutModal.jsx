import React, { useState } from "react";
import { Modal, Button, Form, Spinner, Alert } from "react-bootstrap";
import CheckoutButton from "./CheckoutButton";

/**
 * BookingCheckoutModal Component
 * Modal that displays booking summary and triggers Stripe Checkout
 * Usage: <BookingCheckoutModal show={true} booking={bookingData} onHide={() => setShow(false)} />
 */
export const BookingCheckoutModal = ({ show, booking, onHide, onSuccess }) => {
  const [step, setStep] = useState("review"); // "review" or "confirm"
  const [agreedToTerms, setAgreedToTerms] = useState(false);

  if (!booking) {
    return null;
  }

  const handleConfirmClick = () => {
    if (!agreedToTerms) {
      alert("Please agree to the terms and conditions");
      return;
    }
    setStep("confirm");
  };

  return (
    <Modal show={show} onHide={onHide} size="lg" centered>
      <Modal.Header closeButton>
        <Modal.Title>🎫 Booking Confirmation & Payment</Modal.Title>
      </Modal.Header>

      <Modal.Body>
        {step === "review" ? (
          <div>
            {/* Booking Summary */}
            <div className="card mb-4" style={{ backgroundColor: "#f8f9fa" }}>
              <div className="card-body">
                <h5 className="card-title mb-3">📋 Booking Summary</h5>

                <div className="row mb-3">
                  <div className="col-md-6">
                    <p className="mb-2">
                      <strong>Car:</strong> {booking.car?.name || "N/A"}
                    </p>
                    <p className="mb-2">
                      <strong>Pickup Location:</strong> {booking.pickupLocation}
                    </p>
                    <p className="mb-0">
                      <strong>Drop Location:</strong> {booking.dropLocation}
                    </p>
                  </div>
                  <div className="col-md-6">
                    <p className="mb-2">
                      <strong>Start Date:</strong>{" "}
                      {new Date(booking.startDate).toLocaleDateString("en-IN")}
                    </p>
                    <p className="mb-2">
                      <strong>End Date:</strong>{" "}
                      {new Date(booking.endDate).toLocaleDateString("en-IN")}
                    </p>
                    <p className="mb-0">
                      <strong>Days:</strong>{" "}
                      {Math.ceil(
                        (new Date(booking.endDate) - new Date(booking.startDate)) /
                          (1000 * 60 * 60 * 24)
                      )}{" "}
                      days
                    </p>
                  </div>
                </div>

                <hr />

                {/* Price Breakdown */}
                <div className="row">
                  <div className="col-md-6">
                    <p className="mb-2">
                      <strong>Daily Rate:</strong> ₹{booking.car?.pricePerDay || 0}
                    </p>
                  </div>
                  <div className="col-md-6">
                    <p className="mb-2">
                      <strong>Total Amount:</strong>{" "}
                      <span
                        style={{
                          fontSize: "20px",
                          color: "#28a745",
                          fontWeight: "700",
                        }}
                      >
                        ₹{booking.totalPrice?.toLocaleString() || 0}
                      </span>
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Payment Method Info */}
            <Alert variant="info" className="mb-4">
              <Alert.Heading>💳 Payment Method</Alert.Heading>
              <p className="mb-0">
                You will be redirected to Stripe's secure checkout page where you can enter your
                card details. We accept all major credit and debit cards.
              </p>
            </Alert>

            {/* Terms & Conditions */}
            <Form.Group className="mb-4">
              <Form.Check
                type="checkbox"
                label={
                  <>
                    I agree to the{" "}
                    <a href="/terms" target="_blank" rel="noopener noreferrer">
                      Terms & Conditions
                    </a>{" "}
                    and confirm that the booking details are correct.
                  </>
                }
                checked={agreedToTerms}
                onChange={(e) => setAgreedToTerms(e.target.checked)}
                id="agreeTerms"
              />
            </Form.Group>

            {/* Security Note */}
            <div
              className="p-3 mb-4"
              style={{
                backgroundColor: "#e8f5e9",
                borderLeft: "4px solid #28a745",
                borderRadius: "4px",
              }}
            >
              <small>
                <strong>🔒 Secure Payment:</strong> Your payment is processed securely by Stripe.
                We never store your full card details.
              </small>
            </div>
          </div>
        ) : (
          <div className="text-center py-4">
            <h5 className="mb-4">Proceed to Stripe Checkout</h5>
            <CheckoutButton
              bookingId={booking._id}
              totalPrice={booking.totalPrice}
              disabled={false}
            />
            <p className="text-muted mt-4 small">
              You will be redirected to Stripe's secure payment page.
            </p>
          </div>
        )}
      </Modal.Body>

      <Modal.Footer>
        {step === "review" && (
          <>
            <Button variant="secondary" onClick={onHide}>
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={handleConfirmClick}
              disabled={!agreedToTerms}
              style={{
                backgroundColor: "#625b5f",
                borderColor: "#625b5f",
              }}
            >
              Proceed to Payment
            </Button>
          </>
        )}
        {step === "confirm" && (
          <>
            <Button
              variant="outline-secondary"
              onClick={() => setStep("review")}
            >
              Back
            </Button>
          </>
        )}
      </Modal.Footer>
    </Modal>
  );
};

export default BookingCheckoutModal;
