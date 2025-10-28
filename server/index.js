import dotenv from "dotenv";
import cors from "cors";
import express from "express";
import { connectDB } from "./config/db.js";
import { register } from "./controller/Usercontoller.js";


const PORT = process.env.PORT || 8080;
const app = express();
dotenv.config();
app.use(express.json());
app.use(cors());


app.post("/register",register)

app.listen(PORT, () => {
    connectDB();
    console.log("server is running on PORT:" + PORT);

});