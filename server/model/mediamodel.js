import mongoose from "mongoose";

const mediaSchema = new mongoose.Schema({
  photoOrVideo: {
    type: String, // store file path or URL
  },
  title: {
    type: String,
  },
  eventName: {
    type: String,
  },
  category: {
    type: String,
    required: true, // only this field is required
  },
}, { timestamps: true });

export const Media = mongoose.model("Media", mediaSchema);
export default Media;