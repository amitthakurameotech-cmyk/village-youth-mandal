import React, { useEffect, useState } from "react";
import { Table, Spinner, Container, Alert, Badge } from "react-bootstrap";

/**
 * PaymentHistory Component
 * Displays all payments made by the authenticated user (with masked card data)
 */
export const PaymentHistory = ({ userId }) => {
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchPaymentHistory = async () => {
      if (!userId) {
        setError("User ID is required");
        setLoading(false);
        return;
      }

      try {
        const token = localStorage.getItem("authToken");
        const response = await fetch(
          `${process.env.REACT_APP_API_URL || "http://localhost:8080"}/payments/user/${userId}`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        if (!response.ok) {
          throw new Error("Failed to fetch payment history");
        }

        const data = await response.json();
        setPayments(data.payments || []);
      } catch (err) {
        console.error("Error fetching payment history:", err);
        setError(err.message || "Failed to load payment history");
      } finally {
        setLoading(false);
      }
    };

    fetchPaymentHistory();
  }, [userId]);

  const getStatusBadge = (status) => {
    const variants = {
      succeeded: "success",
      created: "warning",
      failed: "danger",
    };
    return variants[status] || "secondary";
  };

  const getCardBrandIcon = (brand) => {
    const icons = {
      visa: "💳",
      mastercard: "💳",
      amex: "💳",
      discover: "💳",
    };
    return icons[brand?.toLowerCase()] || "💳";
  };

  const formatCardDisplay = (payment) => {
    if (!payment.cardLast4) return "Card not saved";
    return `${getCardBrandIcon(payment.cardBrand)} ${payment.cardBrand?.toUpperCase()} •••• ${payment.cardLast4}`;
  };

  const formatFunding = (funding) => {
    if (!funding || funding === "unknown") return "-";
    return funding.charAt(0).toUpperCase() + funding.slice(1);
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString("en-IN", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  if (loading) {
    return (
      <Container className="text-center py-5">
        <Spinner animation="border" role="status" className="mb-3" />
        <p>Loading payment history...</p>
      </Container>
    );
  }

  if (error) {
    return (
      <Container className="py-5">
        <Alert variant="danger">
          <Alert.Heading>❌ Error</Alert.Heading>
          <p>{error}</p>
        </Alert>
      </Container>
    );
  }

  if (payments.length === 0) {
    return (
      <Container className="py-5">
        <Alert variant="info">
          <Alert.Heading>📋 No Payments Yet</Alert.Heading>
          <p>You haven't made any payments yet. Start by booking a car!</p>
        </Alert>
      </Container>
    );
  }

  return (
    <Container className="py-5">
      <h2 className="mb-4">💳 Payment History</h2>

      <div className="table-responsive">
        <Table striped hover className="align-middle">
          <thead style={{ backgroundColor: "#f8f9fa" }}>
            <tr>
              <th>Date</th>
              <th>Amount</th>
              <th>Card Details</th>
              <th>Card Type</th>
              <th>Expiry</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {payments.map((payment) => (
              <tr key={payment._id}>
                <td>
                  <small className="text-muted">{formatDate(payment.createdAt)}</small>
                </td>
                <td>
                  <strong>₹{payment.amount?.toLocaleString()}</strong>
                </td>
                <td>
                  <code style={{ fontSize: "12px" }}>{formatCardDisplay(payment)}</code>
                </td>
                <td>
                  <small>{formatFunding(payment.cardFunding)}</small>
                </td>
                <td>
                  {payment.cardExpMonth && payment.cardExpYear ? (
                    <small>
                      {String(payment.cardExpMonth).padStart(2, "0")}/{payment.cardExpYear}
                    </small>
                  ) : (
                    <small className="text-muted">-</small>
                  )}
                </td>
                <td>
                  <Badge bg={getStatusBadge(payment.status)}>
                    {payment.status?.charAt(0).toUpperCase() + payment.status?.slice(1)}
                  </Badge>
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
      </div>

      {/* Summary Card */}
      <div
        className="p-4 mt-4"
        style={{
          backgroundColor: "#f8f9fa",
          borderRadius: "8px",
          border: "1px solid #dee2e6",
        }}
      >
        <h5>📊 Summary</h5>
        <p className="mb-0">
          <strong>Total Transactions:</strong> {payments.length}
        </p>
        <p className="mb-0">
          <strong>Successful Payments:</strong>{" "}
          <span className="badge bg-success">
            {payments.filter((p) => p.status === "succeeded").length}
          </span>
        </p>
        <p className="mb-0">
          <strong>Failed Payments:</strong>{" "}
          <span className="badge bg-danger">
            {payments.filter((p) => p.status === "failed").length}
          </span>
        </p>
      </div>

      {/* Security Notice */}
      <div
        className="alert alert-info mt-4"
        style={{
          borderLeft: "4px solid #0d6efd",
        }}
      >
        <small>
          <strong>🔒 Security Notice:</strong> Your card details are masked for your security.
          Only the last 4 digits, card brand, and expiry date are displayed.
          Your full card information is securely stored with Stripe.
        </small>
      </div>
    </Container>
  );
};

export default PaymentHistory;
