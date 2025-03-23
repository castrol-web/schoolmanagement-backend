import express from "express";
import { getMessages, getUsersForSidebar, sendMessage } from "../controllers/message.controller.js";
import authMiddleware from "../middleware/auth.js";
const router = express.Router();



router.get("/get-messages/:id",authMiddleware, getMessages);
router.post("/send/:id",authMiddleware, sendMessage);
router.get("/",authMiddleware, getUsersForSidebar);

export default router;