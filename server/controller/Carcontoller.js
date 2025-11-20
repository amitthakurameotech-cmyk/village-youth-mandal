
import mongoose from "mongoose";
import { getFileUrl } from "../utils/fileHelper.js";
import Carmodel from "../model/Carmodel.js";

// ✅ Create a new car
export const createCar = async (req, res) => {
  try {
    const { name, brand, type, pricePerDay, fuelType, transmission } = req.body;

    // Step 1: Validate required fields
    if (!name || !brand || !type || !pricePerDay || !fuelType || !transmission) {
      return res.status(400).json({
        success: false,
        message: "Please provide all required fields: name, brand, type, pricePerDay, fuelType, transmission",
      });
    }

    // Step 2: Prepare car data
    const carData = {
      name,
      brand,
      type,
      pricePerDay,
      fuelType,
      transmission,
      available: req.body.available !== undefined ? req.body.available : true,
      image: req.file.path
    };

    // Step 3: Save to database
    const newCar = await Carmodel.create(carData);

    if (!newCar) {
      return res.status(400).json({ success: false, message: "Car creation failed" });
    }

    // Step 4: Return success
    return res.status(201).json({
      success: true,
      message: "Car created successfully",
      data: newCar,
    });
  } catch (error) {
    console.error("❌ Error creating car:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

// ✅ Update car
export const updateCar = async (req, res) => {
  try {
    const { id } = req.params;

    // Step 1: Validate ID
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid car ID format",
      });
    }

    // Step 2: Prepare update data
    const updates = req.body;
    if (req.file) {
      updates.image = getFileUrl(req, req.file.path);
    }

    // Step 3: Update in DB
    const updatedCar = await Carmodel.findByIdAndUpdate(id, { $set: updates }, { new: true, runValidators: true });

    if (!updatedCar) {
      return res.status(404).json({ success: false, message: "Car not found" });
    }

    return res.status(200).json({
      success: true,
      message: "Car updated successfully",
      data: updatedCar,
    });
  } catch (error) {
    console.error("❌ Error updating car:", error);
    return res.status(500).json({
      success: false,
      message: "Error updating car",
      error: error.message,
    });
  }
};

// ✅ Delete car
export const deleteCar = async (req, res) => {
  try {
    const { id } = req.params;

    const deletedCar = await Carmodel.findByIdAndDelete(id);
    if (!deletedCar) {
      return res.status(404).json({ success: false, message: "Car not found" });
    }

    return res.status(200).json({
      success: true,
      message: "Car deleted successfully",
    });
  } catch (error) {
    console.error("❌ Error deleting car:", error);
    return res.status(500).json({
      success: false,
      message: "Error deleting car",
      error: error.message,
    });
  }
};

// ✅ Get all cars
export const getCars = async (req, res) => {
  try {
    const cars = await Carmodel.find({});
    return res.status(200).json({
      success: true,
      data: cars,
    });
  } catch (error) {
    console.error("❌ Error fetching cars:", error);
    return res.status(500).json({
      success: false,
      message: "Error fetching cars",
      error: error.message,
    });
  }
};

// ✅ Get car details by id
export const getCarDataById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: "Invalid or missing car ID" });
    }

    const car = await Carmodel.findById(id);
    if (!car) {
      return res.status(404).json({ success: false, message: "Car not found" });
    }

    return res.status(200).json({ success: true, data: car });
  } catch (error) {
    console.error("❌ Error fetching car details:", error);
    return res.status(500).json({ success: false, message: "Error fetching car details", error: error.message });
  }
};
