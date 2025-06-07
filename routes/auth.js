import express from "express";
import Teacher from "../models/Teacher.js";

const router = express.Router();

// Email verification endpoint
router.get('/verify-email', async (req, res) => {
    try {
      const { token } = req.query;
      const user = await Teacher.findOne({ verificationToken: token });
      if (!user) {
        return res.status(400).send('Invalid token');
      }
      user.isVerified = true;
      user.verificationToken = null;
      await user.save();
      return res.status(201).json({ message: 'Email verified successfully' });
    } catch (error) {
      console.error(error)
    }
  });





export default router;