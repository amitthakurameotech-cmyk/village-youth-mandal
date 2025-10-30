import Media from "../model/mediamodel.js";
import { getFileUrl } from '../utils/fileHelper.js';
export const createMedia = async (req, res) => {
    try {
        const data = await Media.create({
            ...req.body,
            photoOrVideo: req.file ? getFileUrl(req, req.file.path) : req.body.photoOrVideo || "",
        });
        if (data)
            res.status(201).json({
                success: true,
                message: "Media successfully created.",
                mediaId: data._id,
                data: data,
            });
        else {
            res.status(404).json({
                success: false,
                message: "Unable to create Media.",
            });
        }

    } catch (error) {
        console.log(error);
        res.status(500).json({ success: false, message: "Internal server error", error: error.message });
    }
}

export const getMedia = async (req, res) => {
    try {
        const media = await Media.find();
        res.status(200).json({ success: true, data: media });       
    } catch (error) {
        console.log(error);
        res.status(500).json({ success: false, message: "Internal server error", error: error.message });
    }
}

export const deleteMedia = async (req, res) => {
    try {
        const { id } = req.params;
        const media = await Media.findByIdAndDelete(id);
        if (!media) {
            return res.status(404).json({ success: false, message: "Media not found" });
        }
        res.status(200).json({ success: true, message: "Media deleted successfully" });
    } catch (error) {
        res.status(500).json({ success: false, message: "Internal server error", error: error.message });
    }
}
