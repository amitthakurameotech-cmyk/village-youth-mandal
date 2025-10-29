import { Feed } from "../model/feedmodel.js";

export const createFeed = async (req, res) => {
    try {
        const { title, description,createdBy } = req.body;

        // Validate required fields
        if (!title || !description || !createdBy) {
            return res.status(400).json({ success: false, message: "Please provide title, content, and createdBy." });
        }   
        // const feedData = {
        //     title,
        //     description,
        //     category,
        //     image: req.file ? req.file.path : req.body.image || "",
        //     createdBy,
        // };

        const feed = await Feed.create({
            ...req.body,
            image: req.file ? req.file.path : req.body.image || "",
            createdBy,
        });

        if (!feed) {
            return res.status(400).json({ success: false, message: "Feed creation failed." });
        }
        return res.status(201).json({
            success: true,
            message: "Feed successfully created.",
            feedId: feed._id,
            data: feed,
        }); 

    } catch (error) {
        console.log(error);
        res.status(500).json({ success: false, message: "Internal server error", error: error.message });
    }
};

export const getFeeds = async (req, res) => {
    try {
        const feeds =  await Feed.find().populate("createdBy");
        res.status(200).json({ success: true, data: feeds });

    } catch (error) {
        console.log(error);
        res.status(500).json({ success: false, message: "Internal server error", error: error.message });
    }
}