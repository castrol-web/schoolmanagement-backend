import jwt from "jsonwebtoken";
import User from "../models/User.js";

const authMiddleware = async (req, res, next) => {
    const token = req.headers['x-access-token'] || req.headers["authorization"]?.split(" ")[1];;
    if (!token) {
        return res.status(401).json({ message: 'Access denied. No token provided' });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_PRIVATE_KEY);
        const { _id} = decoded;
        //checking if the user's id exists in the database
        const user = await User.findById(_id);
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        // Attach the user object and token details  to the request
        req.user = user; 
        req.token = token;
        next();
    } catch (error) {
        // Handle specific JWT errors
        if (error.name === "TokenExpiredError") {
            return res.status(401).json({ message: "Session expired. Please log in again." });
        } else if (error.name === "JsonWebTokenError") {
            return res.status(400).json({ message: "Invalid token. Access denied." });
        }

        // Generic error response
        return res.status(500).json({ message: "An error occurred during authentication." });
    }
};

export default authMiddleware;