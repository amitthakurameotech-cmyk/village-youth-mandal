import Event from '../model/Eventmodel.js';
import mongoose from 'mongoose';
import { getFileUrl } from '../utils/fileHelper.js';


export const createEvent = async (req, res) => {
  try {
    const { title, date, time, location, category, description } = req.body;

    // ✅ Step 1: Validate required fields
    if (!title || !date || !time || !location || !category ) {
      return res.status(400).send({
        success: false,
        message: "Please provide all required fields: title, date, time, location, category, and createdBy.",
      });
    }

    // ✅ Step 2: Prepare data for insertion
    const eventData = {
      title,
      date,
      time,
      location,
      category,
      description,
      coverImage: req.file ? getFileUrl(req, req.file.path) : req.body.coverImage || "",
      
    };

    // ✅ Step 3: Save event
    const data = await Event.create(eventData);

    if (!data) {
      return res.status(400).send({ message: "Event creation failed", success: false });
    }

    // ✅ Step 4: Success response
    return res.status(201).send({
      message: "Event successfully created",
      eventId: data._id,
      success: true,
      data,
    });

  } catch (error) {
    console.error("❌ Fail to submit data:", error);
    return res.status(500).send({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};
// Update an event by ID


export const updateEvent = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    // ✅ Step 1: Validate event ID
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid event ID format",
      });
    }

    // ✅ Step 2: Optional — Handle cover image update (if using multer)
    if (req.file) {
      updates.coverImage = req.file.path;
    }

    // ✅ Step 3: Find and update the event
    const updatedEvent = await Event.findByIdAndUpdate(
      id,
      { $set: updates },
      { new: true, runValidators: true }
    );

    // ✅ Step 4: Handle missing event
    if (!updatedEvent) {
      return res.status(404).json({
        success: false,
        message: "Event not found",
      });
    }

    // ✅ Step 5: Success response
    return res.status(200).json({
      success: true,
      message: "Event updated successfully",
      data: updatedEvent,
    });

  } catch (error) {
    console.error("❌ Error updating event:", error);
    return res.status(500).json({
      success: false,
      message: "Error updating event",
      error: error.message,
    });
  }
};

// Delete an event by ID
export const deleteEvent = async (req, res) => {
    try {
        const eventId = req.params.id;
        const deletedEvent = await Event.findByIdAndDelete(eventId);

        if (!deletedEvent) {
            return res.status(404).json({
                success: false,
                message: 'Event not found'
            });
        }

        res.status(200).json({
            success: true,
            message: 'Event deleted successfully'
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error deleting event',
            error: error.message
        });
    }
};
export const getEvents = async (req, res) => {
    try {
        const events = await Event.find().populate('createdBy');
        res.status(200).json({
            success: true,
            data: events
        });
    }
    catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error fetching events',   
            error: error.message
        });
    }   
};