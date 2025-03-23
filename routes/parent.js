import express from "express";
import axios from "axios";
import cors from "cors";
import authMiddleware from "../middleware/auth.js";
import Parent from "../models/Parent.js";
import Invoice from "../models/Invoice.js";
import Assignment from "../models/Assignment.js";
import Class from "../models/Class.js";
import dotenv from "dotenv";
import User from "../models/User.js";
import Activity from "../models/Activity.js";
const router = express.Router();
dotenv.config();
router.use(cors());

//paystack secret key
const payStackSecretKey = process.env.PAYSTACK_SECRET_KEY;

//fetching specific parent
router.get('/parent/:id', authMiddleware, async (req, res) => {
    try {
        if (req.user.role !== 'parent') {
            return res.status(403).json({ mdssage: "Access Denied!" })
        }
        const parentId = req.params.id;
        //fetching parent with the corresponding id
        const parent = await Parent.findOne({ commonDetails: parentId }).populate({ path: 'commonDetails', select: 'firstName lastName email phone profilePic role', });
        if (!parent) {
            res.status(404).json({ message: "parent with the provided id is not found" })
        }
        res.status(201).json(parent)
    } catch (error) {
        res.status(500).json({ error: "server error" })
        console.error(error)
    }
});

// Get all invoices for a student
router.get('/:studentId', authMiddleware, async (req, res) => {
    try {
        if (req.user.role !== 'parent') {
            return res.status(403).json({ message: "Access Denied!" })
        }
        const { studentId } = req.params;

        const invoices = await Invoice.find({ studentId }).sort({ term: 1 });

        res.status(201).json(invoices);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error fetching statement' });
    }
});

//getting total balance
router.get('/balance/:id', authMiddleware, async (req, res) => {
    try {
        if (req.user.role !== 'parent') {
            return res.status(403).json({ message: "Access Denied!" })
        }
        const id = req.params.id;
        const parent = await Parent.findOne({ commonDetails: id });
        if (!parent) {
            return res.status(404).json({ message: "no parent with corresponding id" })
        }
        const studentId = parent.childId
        //fetching invoice depending on student id
        const invoices = await Invoice.find({ studentId })
        if (!invoices || invoices.length === 0) {
            return
        }

        // Calculate total outstanding balance
        const totalBalance = invoices.reduce((acc, invoice) => acc + invoice.outstandingBalance, 0);

        res.status(200).json({ balance: totalBalance })
    } catch (error) {
        console.error('Error fetching balance:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Paystack payment verification
router.post("/paystack/verify", authMiddleware, async (req, res) => {
    if (req.user.role !== 'parent') {
        return res.status(403).json({ message: "Access Denied" });
    }

    try {
        const { reference } = req.body;
        if (!reference) {
            return res.status(400).json({ message: 'Reference is required' });
        }

        // Verify transaction with Paystack
        const response = await axios.get(
            `https://api.paystack.co/transaction/verify/${reference}`,
            {
                headers: {
                    Authorization: `Bearer ${payStackSecretKey}`,
                    'Content-Type': 'application/json'
                },
            }
        );

        const transaction = response.data.data;

        if (transaction.status !== 'success') {
            return res.status(400).json({ message: 'Transaction verification failed' });
        }

        // Get parent info based on email from transaction
        const email = transaction.customer.email;
        const amountPaid = transaction.amount / 100; // Convert from kobo to KES

        const user = await User.findOne({ email });
        if (!user) {
            return res.status(400).json({ message: 'User with given email not found' });
        }

        const parent = await Parent.findOne({ commonDetails: user._id });
        if (!parent || !parent.childId || parent.childId.length === 0) {
            return res.status(400).json({ message: 'No associated students found for this parent' });
        }

        // Find invoices for all the parent's children
        const invoices = await Invoice.find({ studentId: { $in: parent.childId } });

        if (!invoices || invoices.length === 0) {
            return res.status(404).json({ message: "No invoices found for this parent" });
        }

        let remainingAmount = amountPaid;

        for (const invoice of invoices) {
            if (remainingAmount <= 0) break;

            // Determine how much to deduct from the current invoice
            const amountToDeduct = Math.min(invoice.outstandingBalance, remainingAmount);

            // Push the payment with both reference and amount together
            invoice.payments.push({
                amount: amountToDeduct,
                reference: reference, // Ensure both required fields are provided
            });

            invoice.outstandingBalance -= amountToDeduct;
            remainingAmount -= amountToDeduct;

            await invoice.save();
        }

        if (remainingAmount > 0) {
            return res.status(200).json({ message: 'Payment applied, excess funds remain', excessAmount: remainingAmount });
        }

        res.status(201).json({ message: 'Payment verified and invoices updated successfully' });

    } catch (error) {
        console.error("Error verifying payment:", error);
        res.status(500).json({ message: "Error verifying payment" });
    }
});


//fetching assignments
router.get('/assignments/:id', authMiddleware, async (req, res) => {
    if (req.user.role !== 'parent') {
        return res.status(403).json({ message: "Access Denied" });
    }
    try {
        //fetching parent id from the url
        const parentId = req.params.id;
        //checking existance of the parent
        const parent = await Parent.findOne({ commonDetails: parentId });
        if (!parent) {
            return res.status(404).json({ message: "parent with given id not found!" })
        }
        //getting student id from the found parent
        const student = parent.childId;
        if (!student) {
            return res.status(404).json({ message: 'not student found for the parent' })
        }
        //fetching relevant class for the student
        const classId = await Class.findOne({ students: student })
        if (!classId) {
            return res.status(404).json({ message: 'no class found related to this student' })
        }
        ///fetching the assignment
        const assignment = await Assignment.find({ classId: classId });
        if (!assignment) {
            return res.status(404).json({ message: 'no assignment found!' })
        }

        res.status(201).json(assignment)

    } catch (error) {
        console.error("Error fetching assignment:", error);
        res.status(500).json({ message: "Error fetching assignment" });
    }
})


//fetching activities for specific student
router.get('/activities/:id', authMiddleware, async (req, res) => {
    if (req.user.role !== 'parent') {
        return res.status(403).json({ message: "Access denied" })
    }
    try {
        const userId = req.params.id;
        const parent = await Parent.findOne({ commonDetails: userId });
        if (!parent) {
            res.status(404).json({ message: "no parent with given id found" })
        }
        const studentId = parent.childId;
        const activity = await Activity.find({ students: studentId })
        if (!activity) {
            res.status(404).json({ message: "no activity found" })
        }
        res.status(201).json(activity)
    } catch (error) {
        res.status(500).json({ error: "server error" })
        console.error(error)
    }
})


// Enroll a student in an activity
router.put('/activity/:id/enroll', authMiddleware, async (req, res) => {
    if (req.user.role !== 'parent') {
        return res.status(403).json({ message: "Access denied" });
    }

    try {
        const activityId = req.params.id;
        const userId = req.user._id;

        // Ensure Parent model correctly references user
        const parent = await Parent.findOne({commonDetails: userId });

        if (!parent) {
            return res.status(404).json({ message: "No parent found!" });
        }

        // Ensure parent has a child assigned
        if (!parent.childId || parent.childId.length === 0) {
            return res.status(400).json({ message: "Parent has no linked children" });
        }

        const studentId = parent.childId.toString(); // Convert to string for safety

        // Check if the student is already enrolled
        const activity = await Activity.findById(activityId);
        if (!activity) {
            return res.status(404).json({ message: "Activity not found!" });
        }

        if (activity.students.includes(studentId)) {
            return res.status(400).json({ message: "Student is already enrolled in this activity" });
        }

        // Enroll the student
        const updatedActivity = await Activity.findByIdAndUpdate(
            activityId,
            { $addToSet: { students: studentId } }, // Prevent duplicate entries
            { new: true }
        );

        res.status(201).json({ message: "Student enrolled successfully", activity: updatedActivity });
    } catch (error) {
        console.error("Enrollment error:", error);
        res.status(500).json({ message: "Server error" });
    }
});


export default router;