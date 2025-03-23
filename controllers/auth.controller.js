import Parent from "../models/Parent.js";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import jwt from 'jsonwebtoken';
import sendVerificationEmail from "../nodemailer.js";
import dotenv from "dotenv";
import BlacklistedToken from "../models/BlacklistedToken.js";
import Student from "../models/Student.js";
import User from "../models/User.js";
dotenv.config();

const secretKey = process.env.JWT_PRIVATE_KEY;

export const registerParent = async (req, res) => {
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json({ message: 'Access denied' });
        }
        const { firstName, lastName, password, confirmPassword, email, phone, role, regNo } = req.body;

        if (password !== confirmPassword) {
            return res.status(400).json({ message: "passwords don't match" })
        }
        // Validate if child exists
        const child = await Student.findOne({regNo});
        if (!child) {
            return res.status(400).json({ message: 'Invalid Student Id' });
        }
        //hashing password 
        const hashedPassword = await bcrypt.hash(password, 10);
        //generating token
        const token = crypto.randomBytes(32).toString('hex');
        //checking if email is existing
        const user = await User.findOne({ email });
        if (user) {
            return res.status(400).json({ message: "User with same email already exists" })
        }
        //creating new parent
        const newUser = new User({
            firstName,
            lastName,
            password: hashedPassword,
            email,
            role,
            phone
        });
        //saving to the db
        await newUser.save();
        //creating new parent document
        const newParent = new Parent({
            commonDetails: newUser._id,
            childId: child._id,
            verificationToken: token,
        });
        await newParent.save();
        //sending verification email
        sendVerificationEmail(newUser, token);
        return res.status(201).json({
            _id: newParent._id,
            message: "user created successfully,check email to verify",
        })
    } catch (error) {
        res.status(500).json({ message: "internal server Error" });
        console.error(error);
    }
}

// Login
export const Login = async (req, res) => {
    try {
        const { email, password } = req.body;
        const user = await User.findOne({ email });
        if (!user) {
            return res.status(400).send('Invalid credentials');
        }
        //validate password
        const validPassword = await bcrypt.compare(password, user.password);
        if (!validPassword) {
            return res.status(400).json({ message: 'Invalid credentials' });
        }
        const token = jwt.sign({ _id: user._id, role: user.role,}, secretKey,{expiresIn: "7d"});
        return res.status(201).json({ token });

    } catch (error) {
        res.status(500).json({ message: "an error occured" })
        console.log(error)
    }
};

//logout function 
export const Logout = async (req, res) => {
    try {
        const token = req.headers['x-access-token'];
        if (!token) {
            return res.status(400).json({ message: "No token provided" })
        }
        //decode token to get expiration time 
        const decoded = jwt.decode(token);
        if(!decoded || !decoded.exp){
            return res.status(400).json({ message: "Invalid token" });
        }
        const expiresAt = decoded.exp * 1000; // Convert to milliseconds
        //add token to blacklist
        await BlacklistedToken.create({ token, expiresAt });
        return res.status(200).json({ message: "Logout successful" })
    } catch (error) {
        console.error(error);
        return res.status(500).json({ message: "An error occurred during logout" });
    }
}
