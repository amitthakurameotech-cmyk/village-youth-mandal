import Bookingmodel from "../model/Bookingmodel.js";

import mongoose from "mongoose";
import Carmodel from "../model/Carmodel.js";

// ✅ Create booking
export const createBooking = async (req, res) => {
  try {
    const { user, car, pickupLocation, dropLocation, startDate, endDate, totalPrice } = req.body;

    // Step 1: Validate fields
    if (!user || !car || !pickupLocation || !dropLocation || !startDate || !endDate || !totalPrice) {
      return res.status(400).json({
        success: false,
        message: "Please provide all required booking fields.",
      });
    }

    // Step 2: Check car availability
    const carData = await Carmodel.findById(car);
    if (!carData) {
      return res.status(404).json({ success: false, message: "Car not found" });
    }
    // if (!carData.available) {
    //   return res.status(400).json({ success: false, message: "Car not available for booking" });
    // }

    // Step 3: Create booking
    const bookingData = {
      user,
      car,
      pickupLocation,
      dropLocation,
      startDate,
      endDate,
      totalPrice,
      paymentStatus: "Pending",
      bookingStatus: "Pending",
    };

    const newBooking = await Bookingmodel.create(bookingData);

    // Step 4: Mark car unavailable
    carData.available = false;
    await carData.save();

    return res.status(201).json({
      success: true,
      message: "Booking created successfully",
      data: newBooking,
    });
  } catch (error) {
    console.error("❌ Error creating booking:", error);
    return res.status(500).json({
      success: false,
      message: "Error creating booking",
      error: error.message,
    });
  }
};

// ✅ Update booking
export const updateBooking = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid booking ID format",
      });
    }

    const updates = req.body;
    const updatedBooking = await Bookingmodel.findByIdAndUpdate(id, { $set: updates }, { new: true, runValidators: true });

    if (!updatedBooking) {
      return res.status(404).json({ success: false, message: "Booking not found" });
    }

    return res.status(200).json({
      success: true,
      message: "Booking updated successfully",
      data: updatedBooking,
    });
  } catch (error) {
    console.error("❌ Error updating booking:", error);
    return res.status(500).json({
      success: false,
      message: "Error updating booking",
      error: error.message,
    });
  }
};

// ✅ Delete booking
export const deleteBooking = async (req, res) => {
  try {
    const { id } = req.params;

    const deletedBooking = await Bookingmodel.findByIdAndDelete(id);
    if (!deletedBooking) {
      return res.status(404).json({ success: false, message: "Booking not found" });
    }

    // Make car available again
    await Carmodel.findByIdAndUpdate(deletedBooking.car, { available: true });

    return res.status(200).json({
      success: true,
      message: "Booking deleted successfully",
    });
  } catch (error) {
    console.error("❌ Error deleting booking:", error);
    return res.status(500).json({
      success: false,
      message: "Error deleting booking",
      error: error.message,
    });
  }
};




export const approveCancelRequest = async (req, res) => {
  try {
    const { id } = req.params;
    const action = (req.query.action || req.body.action || '').toString().toLowerCase();

    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: 'Invalid or missing booking ID' });
    }

    if (!action || !['approve', 'cancel'].includes(action)) {
      return res.status(400).json({ success: false, message: "Invalid or missing action. Use 'approve' or 'cancel'" });
    }

    const booking = await Bookingmodel.findById(id).populate('car user');
    if (!booking) {
      return res.status(404).json({ success: false, message: 'Booking not found' });
    }

    if (action === 'approve') {
      if (booking.bookingStatus !== 'Pending') {
        return res.status(400).json({ success: false, message: `Only bookings with status 'Pending' can be confirmed. Current status: ${booking.bookingStatus}` });
      }

      booking.bookingStatus = 'Confirm';
      // keep paymentStatus same
      await booking.save();

      // mark car unavailable
      if (booking.car) {
        await Carmodel.findByIdAndUpdate(booking.car._id || booking.car, { available: false });
      }

      return res.status(200).json({ success: true, message: 'Booking confirmed', data: booking });
    }

    // action === 'cancel'
    if (booking.bookingStatus === 'Cancelled') {
      return res.status(400).json({ success: false, message: 'Booking is already cancelled' });
    }

    booking.bookingStatus = 'Cancelled';
    booking.paymentStatus = booking.paymentStatus === 'Paid' ? booking.paymentStatus : 'Cancelled';
    await booking.save();

    // free car
    if (booking.car) {
      await Carmodel.findByIdAndUpdate(booking.car._id || booking.car, { available: true });
    }

    return res.status(200).json({ success: true, message: 'Booking cancelled', data: booking });
  } catch (error) {
    console.error('❌ Error processing approve/cancel request:', error);
    return res.status(500).json({ success: false, message: 'Error processing request', error: error.message });
  }
};

// ✅ Get all bookings
export const getBookings = async (req, res) => {
  try {
    const bookings = await Bookingmodel.find().populate("user car");
    return res.status(200).json({
      success: true,
      data: bookings,
    });
  } catch (error) {
    console.error("❌ Error fetching bookings:", error);
    return res.status(500).json({
      success: false,
      message: "Error fetching bookings",
      error: error.message,
    });
  }
};

// ✅ Get bookings by user id
export const getBookingDataByUserId = async (req, res) => {
  try {
    const { userId } = req.params;

    if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ success: false, message: "Invalid or missing user ID" });
    }

    const bookings = await Bookingmodel.find({ user: userId }).populate("user car").sort({ startDate: -1 });

    if (!bookings || bookings.length === 0) {
      return res.status(404).json({ success: false, message: "No bookings found for this user" });
    }

    return res.status(200).json({ success: true, data: bookings });
  } catch (error) {
    console.error("❌ Error fetching bookings for user:", error);
    return res.status(500).json({ success: false, message: "Error fetching user bookings", error: error.message });
  }
};
