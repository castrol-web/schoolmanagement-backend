import express from "express";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import cors from "cors";
import crypto from "crypto";
import authMiddleware from "../middleware/auth.js";
import Student from "../models/Student.js";
import dotenv from "dotenv";
import Teacher from "../models/Teacher.js";
import sendVerificationEmail from "../nodemailer.js";
import Subject from "../models/Subject.js";
import Class from "../models/Class.js";
import { registerParent } from "../controllers/auth.controller.js";
import { registerStudent } from "../controllers/admin.controller.js";
import Parent from "../models/Parent.js";
import User from "../models/User.js";
import Invoice from "../models/Invoice.js";
import CreditBalance from "../models/CreditBalance.js";
import Payment from "../models/Payment.js";

dotenv.config();

// Super admin user
const seedAdmin = async () => {
    try {
        // Check if admin already exists
        const existingAdmin = await User.findOne({ email: 'admin@example.com' });
        if (existingAdmin) {
            console.log('Admin user already exists.');
            return;
        }

        // Hash password
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash('adminpassword', salt);

        // Create new admin
        const admin = new User({
            firstName: 'Admin',
            lastName: 'User',
            email: 'admin@example.com',
            phone: '1234567890',
            role: "admin",
            password: hashedPassword,
        });

        await admin.save();
        console.log('Admin user created successfully!');
    } catch (error) {
        console.error('Error seeding admin user:', error);
    }
};

seedAdmin();

//function that accepts `io` and returns the router
const adminRoutes = (io) => {
    const router = express.Router();
    router.use(cors());

    //register a parent
    router.post('/register-parent', authMiddleware, registerParent);

    //register new student
    router.post('/register-student', authMiddleware, registerStudent);

    //register new teacher and sending verification link
    router.post('/register-teacher', authMiddleware, async (req, res) => {
        try {
            if (req.user.role !== 'admin') {
                return res.status(403).json({ message: 'Access denied' });
            }
            const { firstName, lastName, email, phone, position, gender, role, password } = req.body;
            if (!firstName || !lastName || !email || !phone || !position || !gender || !role || !password) {
                return res.status(400).json({ message: "all fields are required" })
            }
            //hashing password for security
            const hashedPassword = await bcrypt.hash(password, 10);
            //generating token
            const token = crypto.randomBytes(32).toString('hex');
            //checking if the user exists
            const user = await User.findOne({ email: email });
            if (user) {
                return res.status(400).json({ message: "User with same email already exists" })
            }
            //creating the new user
            const newUser = new User({
                firstName,
                lastName,
                email,
                phone,
                password: hashedPassword,
                gender,
                role
            });
            //saving to the db
            await newUser.save();
            //creating new teacher document
            const newTeacher = new Teacher({
                commonDetails: newUser._id,
                position,
                verificationToken: token,
            });
            //save user to db
            await newTeacher.save();
            //send verification email
            sendVerificationEmail(newUser, token)
            return res.status(201).json({ message: "User registered successfully,please verify via email" })
        } catch (error) {
            console.error(error);
            res.status(500).json({ message: 'Server error' });
        }
    });

    //adding subjects 
    router.post('/add-subject', authMiddleware, async (req, res) => {
        try {
            if (req.user.role !== "admin") {
                return res.status(403).json({ message: 'Access denied' });
            }
            const { name, code } = req.body;
            if (!name || !code) {
                return res.status(400).json({ message: "all fields are required" })
            }
            const newSubject = new Subject({
                name,
                code
            });
            //save subject to db
            await newSubject.save();
            return res.status(201).json({ message: "subject registered successfully" })
        } catch (error) {
            console.error(error);
            res.status(500).json({ message: 'Server error' });
        }
    });

    //adding classes
    router.post("/add-class", authMiddleware, async (req, res) => {
        try {
            if (req.user.role !== "admin") {
                return res.status(403).json({ message: 'Access denied' })
            }
            const { className, subjects } = req.body;
            if (!className || !subjects) {
                return res.status(400).json({ message: "all fields are required" })
            }
            const subjectIds = await Subject.find({ _id: { $in: subjects } })
            if (!subjectIds) {
                return res.status(404).json({ message: 'no subject with that id found' })
            }
            const newClass = new Class({
                className,
                subjects: subjectIds,
                students: [] // Initially, no students are assigned
            });
            await newClass.save();
            res.status(201).json({ message: "class added successfully" });

        } catch (error) {
            console.error(error);
            res.status(500).json({ message: 'Server error' });
        }
    });

    //invoice for a student
    router.post("/generate-invoice", authMiddleware, async (req, res) => {
        try {
            if (req.user.role !== "admin") {
                return res.status(403).json({ message: "Access denied!" });
            }

            const { studentId, term, items, year, issuedDate } = req.body;

            // Validate request body
            if (!studentId || !term || !items || !items.length || !year || !issuedDate) {
                return res.status(400).json({ message: "Student ID, term, year, and fee items are required!" });
            }

            // Calculate total fees (ensure each amount is converted to number)
            const totalFees = items.reduce((sum, item) => sum + parseFloat(item.amount || 0), 0);

            // Validate totalFees (should match the sum of individual items)
            if (isNaN(totalFees) || totalFees <= 0) {
                return res.status(400).json({ message: "Total fees must be a valid positive number!" });
            }

            // Check for prepayments (payments that have a reference to CreditBalance)
            const prepayments = await Payment.find({ studentId, creditBalanceId: { $ne: null } });

            let remainingCredit = prepayments.reduce((sum, payment) => sum + payment.amount, 0);
            let outstandingBalance = totalFees - remainingCredit;

            // Check if there's a credit balance available for the student
            const creditBalance = await CreditBalance.findOne({ studentId });

            // If there's a credit balance, apply it to the outstanding balance
            if (creditBalance && creditBalance.amount > 0) {
                if (creditBalance.amount >= outstandingBalance) {
                    // Credit balance is enough to cover the invoice, set the outstanding balance to 0
                    outstandingBalance = 0;
                    // Update credit balance to reflect the used amount
                    creditBalance.amount -= totalFees;
                    await creditBalance.save();
                } else {
                    // Credit balance only partially covers the outstanding balance
                    outstandingBalance -= creditBalance.amount;
                    // After applying the credit, the remaining credit balance is 0
                    creditBalance.amount = 0;
                    await creditBalance.save();
                }
            }

            // Create the invoice
            const newInvoice = new Invoice({
                studentId,
                term,
                year,
                items,  // Storing fee items instead of just total fees
                issuedDate,
                totalFees,
                outstandingBalance,
            });

            // Save the invoice first
            await newInvoice.save();

            // If there are any prepayments, create payment records and link them to the invoice
            for (const prepayment of prepayments) {
                const payment = new Payment({
                    studentId,
                    invoiceId: newInvoice._id,
                    amount: prepayment.amount,
                    paymentMethod: prepayment.paymentMethod,
                });

                await payment.save();

                // Push the payment into the invoice's payments array
                newInvoice.payments.push(payment._id);
            }

            await newInvoice.save();

            res.status(201).json({ message: "Invoice generated successfully", invoice: newInvoice });
        } catch (error) {
            console.error("Error generating invoice:", error);
            res.status(500).json({ message: "Server error, please try again." });
        }
    });

    //receive payments
    router.post("/payments", authMiddleware, async (req, res) => {
        try {
            if (req.user.role !== "admin") {
                return res.status(403).json({ message: "Access denied!" });
            }

            let { studentId, amount, paymentMethod, paymentDate } = req.body;

            if (!studentId || !amount) {
                return res.status(400).json({ message: "Student ID and amount are required!" });
            }

            studentId = new mongoose.Types.ObjectId(studentId);
            amount = parseFloat(amount);
            if (isNaN(amount)) {
                return res.status(400).json({ message: "Amount must be a valid number!" });
            }

            let remainingAmount = amount;
            let appliedPayment = 0;

            // Check for outstanding invoices
            const invoices = await Invoice.find({ studentId, outstandingBalance: { $gt: 0 } }).sort({ issuedDate: 1 });

            // Create the payment record (400,000) - full payment made
            const payment = new Payment({
                studentId,
                amount: amount,
                paymentMethod,
                paymentDate,
                reference: "Full Payment",  // Full payment entry
            });

            await payment.save();  // Save the full payment record

            for (const invoice of invoices) {
                if (remainingAmount <= 0) break;

                const appliedAmount = Math.min(remainingAmount, invoice.outstandingBalance);
                invoice.outstandingBalance -= appliedAmount;  // Update the invoice outstanding balance

                // Save the applied payment for this invoice
                const invoicePayment = new Payment({
                    studentId,
                    invoiceId: invoice._id,
                    amount: appliedAmount,
                    paymentMethod,
                    paymentDate,
                    reference: "Invoice Payment",  // Reference this as an invoice payment
                });

                await invoicePayment.save();
                invoice.payments.push(invoicePayment._id);  // Associate the payment with the invoice
                await invoice.save();

                remainingAmount -= appliedAmount;  // Decrease remaining amount
                appliedPayment += appliedAmount;  // Track applied payment
            }

            // If there's remaining payment after applying to invoices, store it in the CreditBalance model
            if (remainingAmount > 0) {
                let creditBalance = await CreditBalance.findOne({ studentId });
                if (!creditBalance) {
                    creditBalance = new CreditBalance({ studentId, amount: 0 });
                }

                creditBalance.amount += remainingAmount;  // Add remaining balance to the credit balance
                await creditBalance.save();
            }

            return res.status(200).json({ message: "Payment applied successfully" });
        } catch (error) {
            console.error("Error processing payment:", error);
            return res.status(500).json({ message: "Internal server error" });
        }
    });

    // Reverse a payment
    router.put("/payments/:id", authMiddleware, async (req, res) => {
        try {
            if (req.user.role !== "admin") {
                return res.status(403).json({ message: "Access denied!" });
            }

            const payment = await Payment.findById(req.params.id);
            if (!payment) {
                return res.status(404).json({ message: "Payment not found!" });
            }

            if (payment.invoiceId) {
                const invoice = await Invoice.findById(payment.invoiceId);
                if (invoice) {
                    invoice.outstandingBalance += payment.amount;
                    invoice.payments = invoice.payments.filter((p) => p.toString() !== payment._id.toString());
                    await invoice.save();
                }
            } else {
                const creditBalance = await CreditBalance.findOne({ studentId: payment.studentId });
                if (creditBalance) {
                    creditBalance.amount -= payment.amount;
                    await creditBalance.save();
                }
            }

            await Payment.findByIdAndDelete(req.params.id);
            return res.status(200).json({ message: "Payment reversed successfully" });
        } catch (error) {
            return res.status(500).json({ message: "Error reversing payment", error });
        }
    });


    //invoices for a whole class
    router.post("/generate-class-invoice", authMiddleware, async (req, res) => {
        try {
            if (req.user.role !== "admin") {
                return res.status(403).json({ message: "Access denied!" });
            }

            const { classId, term, year, items, issuedDate } = req.body;

            // Validate request body
            if (!classId || !term || !year || !items || !items.length) {
                return res.status(400).json({ message: "Class ID, term, year, and fee items are required!" });
            }

            // Validate the items to ensure each item has an amount
            const totalFees = items.reduce((sum, item) => sum + parseFloat(item.amount || 0), 0);
            if (isNaN(totalFees) || totalFees <= 0) {
                return res.status(400).json({ message: "Total fees must be a valid positive number!" });
            }

            // Find all students in the given class
            const studentsInClass = await Student.find({ currentClass: classId });

            if (!studentsInClass || studentsInClass.length === 0) {
                return res.status(404).json({ message: "No students found in this class!" });
            }

            // Iterate over each student to generate an invoice
            for (const student of studentsInClass) {
                // Check if the student has any prepayments or outstanding balances
                const prepayments = await Payment.find({ studentId: student._id, creditBalanceId: { $ne: null } });
                let remainingCredit = prepayments.reduce((sum, payment) => sum + payment.amount, 0);

                let outstandingBalance = totalFees - remainingCredit;

                // Check if there's a credit balance available for the student
                const creditBalance = await CreditBalance.findOne({ studentId: student._id });

                // Apply credit balance if available
                if (creditBalance && creditBalance.amount > 0) {
                    if (creditBalance.amount >= outstandingBalance) {
                        outstandingBalance = 0; // Credit balance is enough to cover the invoice
                        creditBalance.amount -= totalFees;
                    } else {
                        outstandingBalance -= creditBalance.amount; // Apply credit balance partially
                        creditBalance.amount = 0;
                    }
                    await creditBalance.save();
                }

                // Create the invoice for the student
                const newInvoice = new Invoice({
                    studentId: student._id,
                    classId,
                    term,
                    year,
                    items,
                    issuedDate,
                    totalFees,
                    outstandingBalance,
                });

                // Save the invoice first
                await newInvoice.save();

                // If there are any prepayments, create payment records and link them to the invoice
                for (const prepayment of prepayments) {
                    const payment = new Payment({
                        studentId: student._id,
                        invoiceId: newInvoice._id,
                        amount: prepayment.amount,
                        paymentMethod: prepayment.paymentMethod,
                    });

                    await payment.save();

                    // Push the payment into the invoice's payments array
                    newInvoice.payments.push(payment._id);
                }

                await newInvoice.save();
            }

            res.status(201).json({ message: "Invoices generated successfully for all students in the class" });
        } catch (error) {
            console.error("Error generating class invoices:", error);
            res.status(500).json({ message: "Server error, please try again." });
        }
    });

    //fetching customer balances
    router.get("/customer-balances", async (req, res) => {
        try {
            // Step 1: Fetch all students in one query
            const students = await Student.find().lean();

            // Step 2: Fetch all credit balances and create a lookup map
            const creditBalances = await CreditBalance.find().lean();
            const creditBalanceMap = new Map(creditBalances.map(cb => [cb.studentId.toString(), cb.amount]));

            // Step 3: Fetch all invoices with outstanding balances and create a lookup map
            const invoices = await Invoice.find({ outstandingBalance: { $gt: 0 } }).lean();
            const invoiceMap = new Map();

            invoices.forEach(invoice => {
                const studentId = invoice.studentId.toString();
                if (!invoiceMap.has(studentId)) {
                    invoiceMap.set(studentId, 0);
                }
                invoiceMap.set(studentId, invoiceMap.get(studentId) + invoice.outstandingBalance);
            });

            // Step 4: Process all students efficiently
            const balances = students.map(student => {
                const studentId = student._id.toString();
                const creditBalance = creditBalanceMap.get(studentId) || 0;
                const totalOwed = invoiceMap.get(studentId) || 0;

                return {
                    studentId: student._id,
                    studentName: student.firstName,
                    outstandingBalance: totalOwed,
                    creditBalance: creditBalance,
                    totalOwed: totalOwed - creditBalance,
                };
            });

            res.status(200).json(balances);
        } catch (error) {
            console.error("Error fetching customer balances:", error);
            res.status(500).json({ message: "Error fetching data." });
        }
    });


    // Fetching customer transactions
    router.get("/transactions/:id", authMiddleware, async (req, res) => {
        try {
            if (req.user.role !== "admin") {
                return res.status(403).json({ message: "Access denied" });
            }

            const studentId = req.params.id;
            if (!studentId) {
                return res.status(404).json({ message: "No student ID provided" });
            }

            const payments = await Payment.find({ studentId}).sort({ paymentDate: -1 });
            const invoices = await Invoice.find({ studentId }).sort({ issuedDate: -1 });
            const student = await Student.findOne({ _id: studentId });

            if (!student) {
                return res.status(404).json({ message: "Student not found" });
            }

            if (!payments.length && !invoices.length) {
                return res.status(404).json({ message: "No transactions found" });
            }

            // Combine payments and invoices for the transaction history
            const transactions = [
                {
                    type: "StudentInfo",
                    firstName: student.firstName,
                    lastName: student.lastName,
                    regNo: student.regNo,
                },
                ...payments.map((p) => ({
                    type: "Payment",
                    date: p.paymentDate,
                    amount: p.amount,  // Total payment made (e.g., 400,000)
                    reference: p.reference,
                    _id: p._id,
                })),
                ...invoices.map((i) => ({
                    type: "Invoice",
                    date: i.issuedDate,
                    amount: i.totalFees, // Total invoice amount
                    outstandingBalance: i.outstandingBalance, // Remaining balance
                    _id: i._id,
                })),
            ];

            // Sort by most recent transaction date
            const sortedTransactions = transactions.sort((a, b) => new Date(b.date) - new Date(a.date));

            res.json(sortedTransactions);
        } catch (error) {
            res.status(500).json({ message: "Error fetching transactions", error });
            console.error("Error fetching transactions", error);
        }
    });

    // Fetch specific payment by ID
    router.get("/payments/:id", authMiddleware, async (req, res) => {
        try {
            const payment = await Payment.findById(req.params.id);
            if (!payment) {
                return res.status(404).json({ message: "Payment not found" });
            }
            res.json(payment);
        } catch (error) {
            res.status(500).json({ message: "Error fetching payment", error });
        }
    });

    // Get single payment by ID
    router.get("/payments/:id", authMiddleware, async (req, res) => {
        try {
            const payment = await Payment.findById(req.params.id);
            if (!payment) return res.status(404).json({ message: "Payment not found" });
            res.json(payment);
        } catch (error) {
            res.status(500).json({ message: "Error fetching payment", error });
        }
    });

    // Update payment
    router.put("/payments/:id", authMiddleware, async (req, res) => {
        try {
            const updatedPayment = await Payment.findByIdAndUpdate(req.params.id, req.body, { new: true });
            res.json(updatedPayment);
        } catch (error) {
            res.status(500).json({ message: "Error updating payment", error });
        }
    });

    // Delete Payment (Handle multiple invoices)
    router.delete("/payments/:id", authMiddleware, async (req, res) => {
        try {
            if (req.user.role !== "admin") {
                return res.status(403).json({ message: "Access denied!" });
            }

            const payment = await Payment.findById(req.params.id);
            if (!payment) {
                return res.status(404).json({ message: "Payment not found!" });
            }

            // 1. Reverse payments applied to invoices (if the payment is applied to multiple invoices)
            if (payment.invoiceId) {
                const invoiceIds = Array.isArray(payment.invoiceId) ? payment.invoiceId : [payment.invoiceId]; // Ensure it's an array

                for (let invoiceId of invoiceIds) {
                    const invoice = await Invoice.findById(invoiceId);
                    if (invoice) {
                        // Reverse the balance for the invoice
                        invoice.outstandingBalance += payment.amount; // Restore the outstanding balance

                        // Remove payment reference from the invoice's payments array
                        invoice.payments = invoice.payments.filter(id => id.toString() !== payment._id.toString());

                        await invoice.save();
                    }
                }
            }

            // 2. Update the credit balance (if applicable)
            let creditBalance = await CreditBalance.findOne({ studentId: payment.studentId });
            if (creditBalance) {
                creditBalance.amount -= payment.amount;  // Subtract the payment amount from the credit balance
                await creditBalance.save();
            }

            // 3. Delete the payment record using deleteOne
            await Payment.deleteOne({ _id: payment._id });

            return res.status(200).json({ message: "Payment deleted successfully" });
        } catch (error) {
            console.error("Error deleting payment:", error);
            return res.status(500).json({ message: "Internal server error" });
        }
    });

    // Delete Invoice
    router.delete("/invoices/:id", authMiddleware, async (req, res) => {
        try {
            if (req.user.role !== "admin") {
                return res.status(403).json({ message: "Access denied!" });
            }

            const invoice = await Invoice.findById(req.params.id);
            if (!invoice) {
                return res.status(404).json({ message: "Invoice not found!" });
            }

            // Reverse payments applied to the invoice before deleting it
            for (let paymentId of invoice.payments) {
                const payment = await Payment.findById(paymentId);
                if (payment) {
                    // If the payment was applied to this invoice, reverse it
                    if (payment.invoiceId.toString() === invoice._id.toString()) {
                        // Reverse the balance on the invoice
                        invoice.outstandingBalance += payment.amount;

                        // Check if there is a credit balance for the student
                        let creditBalance = await CreditBalance.findOne({ studentId: invoice.studentId });
                        if (creditBalance) {
                            // Subtract the payment amount from the credit balance
                            creditBalance.amount -= payment.amount;
                            await creditBalance.save();
                        }

                        // Remove the payment reference from the invoice's payments array
                        invoice.payments = invoice.payments.filter(id => id.toString() !== payment._id.toString());
                        await invoice.save();
                    }
                }
            }

            // Now delete the invoice
            await Invoice.deleteOne({ _id: invoice._id });

            return res.status(200).json({ message: "Invoice deleted successfully" });
        } catch (error) {
            console.error("Error deleting invoice:", error);
            return res.status(500).json({ message: "Internal server error" });
        }
    });

    // Fetch specific invoice by ID
    router.get("/invoices/:id", authMiddleware, async (req, res) => {
        try {
            const invoice = await Invoice.findById(req.params.id);
            if (!invoice) {
                return res.status(404).json({ message: "Invoice not found" });
            }
            res.json(invoice);
        } catch (error) {
            res.status(500).json({ message: "Error fetching invoice", error });
        }
    });

    //delete subject
    router.delete("/delete-subject/:id", authMiddleware, async (req, res) => {
        try {
            if (req.user.role !== "admin") {
                return res.status(403).json({ message: 'Access denied' })
            }
            const subject = req.params.id;
            //finding relevant id for deletion
            const result = await Subject.findByIdAndDelete(subject);
            if (result) {
                return res.status(200).json({ message: 'Subject deleted successfully.' });
            } else {
                return res.status(404).json({ message: 'Entry not found.' });
            }
        } catch (error) {
            res.status(500).json({ message: 'Error deleting entry', error });
            console.error(error)
        }
    });

    //delete teacher
    router.delete("/delete-teacher/:id", authMiddleware, async (req, res) => {
        try {
            if (req.user.role !== "admin") {
                return res.status(403).json({ message: 'Access denied' })
            }
            const teacherId = req.params.id;
            //finding relevant id for deletion
            const teacher = await Teacher.findById(teacherId);
            if (!teacher) {
                return res.status(404).json({ message: 'Parent not found!' });
            }
            const userId = teacher.commonDetails;
            //deleting the user
            await User.findByIdAndDelete(userId);
            await Teacher.findByIdAndDelete(teacherId);
            return res.status(200).json({ message: 'Teacher deleted successfully.' });

        } catch (error) {
            res.status(500).json({ message: 'Failed to delete the Teacher user' });
            console.error(error)
        }
    });

    //delete class
    router.delete("/delete-class/:id", authMiddleware, async (req, res) => {
        try {
            if (req.user.role !== "admin") {
                return res.status(403).json({ message: 'Access denied' })
            }
            const subject = req.params.id;
            //finding relevant id for deletion
            const result = await Class.findByIdAndDelete(subject);
            if (result) {
                return res.status(200).json({ message: 'class deleted successfully.' });
            } else {
                return res.status(404).json({ message: 'Entry not found.' });
            }
        } catch (error) {
            res.status(500).json({ message: 'Error deleting entry', error });
            console.error(error)
        }
    });

    //delete student
    router.delete("/delete-student/:id", authMiddleware, async (req, res) => {
        try {
            if (req.user.role !== "admin") {
                return res.status(403).json({ message: 'Access denied' })
            }
            const studentId = req.params.id;
            //finding relevant id for deletion
            const result = await Student.findByIdAndDelete(studentId);
            if (result) {
                return res.status(200).json({ message: 'student deleted successfully.' });
            } else {
                return res.status(404).json({ message: 'Entry not found.' });
            }
        } catch (error) {
            res.status(500).json({ message: 'Error deleting entry', error });
            console.error(error)
        }
    });

    //delete parent user
    router.delete("/delete-parent/:id", authMiddleware, async (req, res) => {
        try {
            if (req.user.role !== "admin") {
                return res.status(403).json({ message: 'Access denied' })
            }
            const parentId = req.params.id;
            // Find the parent record
            const parent = await Parent.findById(parentId);
            if (!parent) {
                return res.status(404).json({ message: 'Parent not found!' });
            }

            //delete related user
            const userId = parent.commonDetails;
            await User.findByIdAndDelete(userId);
            //finding relevant parent id for deletion
            await Parent.findByIdAndDelete(parentId);
            return res.status(200).json({ message: 'Parent and associated user deleted successfully!' });
        } catch (error) {
            res.status(500).json({ message: 'Failed to delete the parent user' });
            console.error(error)
        }
    });

    //get total students and trend direction
    router.get('/student-stats', authMiddleware, async (req, res) => {
        try {
            if (req.user.role !== "admin") {
                return res.status(403).json({ message: 'Access denied' })
            }
            //counting totals
            const totalStudents = await Student.countDocuments();
            // Get the count of students from the previous month (for trend calculation)
            const oneMonthAgo = new Date();
            oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
            const previousMonthStudents = await Student.countDocuments({
                created_at: { $lt: oneMonthAgo }
            });
            // Calculate the trend direction
            let trendDirection = 'neutral';
            if (totalStudents > previousMonthStudents) {
                trendDirection = 'up';
            } else if (totalStudents < previousMonthStudents) {
                trendDirection = 'down'
            }
            //calculate percentage change
            const trendPercentage = previousMonthStudents > 0 ? ((totalStudents - previousMonthStudents) / previousMonthStudents) * 100 : 0; //avoids division by zero
            // Return the stats
            return res.status(201).json({ totalStudents, trendDirection, trendPercentage: trendPercentage.toFixed(2) });// Format to 2 decimal places
        } catch (error) {
            console.error('Error fetching student stats:', error);
            return res.status(500).json({ message: 'Error fetching student statistics' });
        }
    });


    //get total teachers and trend direction
    router.get('/teacher-stats', authMiddleware, async (req, res) => {
        try {
            if (req.user.role !== "admin") {
                return res.status(403).json({ message: 'Access denied' })
            }
            //total teachers
            const totalTeachers = await Teacher.countDocuments();
            const oneMonthAgo = new Date();
            oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
            //getting teachers from one month ago
            const previousMonthTeachers = await Teacher.countDocuments({
                created_at: { $lt: oneMonthAgo }
            });
            //setting trend direction
            let trendDirection = 'neutral';
            if (totalTeachers > previousMonthTeachers) {
                trendDirection = 'up'
            } else if (totalTeachers < previousMonthTeachers) {
                trendDirection = 'down'
            }
            //total percentage calculation
            const trendPercentage = previousMonthTeachers > 0 ? ((totalTeachers - previousMonthTeachers) / previousMonthTeachers) * 100 : 0;
            return res.status(201).json({ totalTeachers, trendDirection, trendPercentage: trendPercentage.toFixed(2) })
        } catch (error) {
            console.error('Error fetching student stats:', error);
            return res.status(500).json({ message: 'Error fetching student statistics' });
        }
    })

    //get total users and trend direction
    router.get('/total-users', authMiddleware, async (req, res) => {
        try {
            if (req.user.role !== "admin") {
                return res.status(403).json({ message: 'Access denied' })
            }
            //total teachers
            const totalTeachers = await Teacher.countDocuments();
            const totalStudents = await Student.countDocuments();
            const totalUsers = totalStudents + totalTeachers;
            const oneMonthAgo = new Date();
            oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
            //getting teachers from one month ago
            const previousMonthTeachers = await Teacher.countDocuments({
                created_at: { $lt: oneMonthAgo }
            });
            //getting students one month ago
            const previousMonthStudents = await Student.countDocuments({
                created_at: { $lt: oneMonthAgo }
            })
            //one month total users
            const previousMonthUsers = previousMonthStudents + previousMonthTeachers;
            //trend direction
            let trendDirection = 'neutral';
            if (totalUsers > previousMonthStudents) {
                trendDirection = 'up'
            } else if (totalUsers < previousMonthUsers) {
                trendDirection = 'down'
            }
            //percentage calculation
            const trendPercentage = previousMonthUsers > 0 ? ((totalUsers - previousMonthUsers) / previousMonthUsers) * 100 : 0
            return res.status(201).json({ totalUsers, trendDirection, trendPercentage: trendPercentage.toFixed(2) });
        } catch (error) {
            console.error('Error fetching student stats:', error);
            return res.status(500).json({ message: 'Error fetching student statistics' });
        }
    });

    //checking distribution in a class
    router.get('/class-distribution', authMiddleware, async (req, res) => {
        try {
            if (req.user.role !== "admin") {
                return res.status(403).json({ message: 'Access denied' })
            }
            //aggregate students by class with counts per gender and age
            const classDistribution = await Class.aggregate([
                {
                    //allows combining of data(collections join to single query)
                    $lookup: {
                        from: 'students',
                        localField: '_id',
                        foreignField: 'currentClass',
                        as: 'students', //students array
                    },
                },
                {
                    $project: {
                        className: 1,
                        total: { $size: '$students' },// Total number of students
                        maleCount: {
                            $size: {
                                $filter: {
                                    input: { $ifNull: ['$students', []] }, // Ensure input is an array
                                    as: 'student',
                                    cond: { $eq: ['$$student.gender', 'male'] },// Filter males
                                },
                            },
                        },
                        femaleCount: {
                            $size: {
                                $filter: {
                                    input: { $ifNull: ['$students', []] }, // Ensure input is an array
                                    as: 'student',
                                    cond: { $eq: ['$$student.gender', 'female'] },// Filter females
                                },
                            },
                        },
                        ages: {
                            $map: {
                                input: { $ifNull: ['$students', []] }, // Ensure input is an array
                                as: 'student',
                                in: '$$student.age',// Extract ages
                            },
                        },
                    }
                }])
            res.status(200).json(classDistribution);
        } catch (error) {
            console.error('Error fetching student stats:', error);
            res.status(500).json({ message: 'Error fetching student statistics' });
        }
    })

    //fetch subjects
    router.get("/get-subjects", authMiddleware, async (req, res) => {
        try {
            if (req.user.role !== "admin" && req.user.role !== "teacher") {
                return res.status(403).json({ message: 'Access denied' })
            }
            const subjects = await Subject.find();
            if (!subjects) {
                return res.status(404).json({ message: "no subjects found!" })
            }
            res.status(201).json(subjects);
        } catch (error) {
            console.error('Error fetching student stats:', error);
            return res.status(500).json({ message: 'Error fetching student statistics' });
        }
    })
    //fetch students
    router.get("/get-students", authMiddleware, async (req, res) => {
        try {
            if (req.user.role !== "admin") {
                return res.status(403).json({ message: 'Access denied' })
            }
            //fetch students from all classes to class
            const students = await Class.find().populate('students').populate('subjects');
            if (!students) {
                return res.status(404).json({ message: "no students found found!" })
            }
            return res.status(201).json(students);
        } catch (error) {
            res.status(500).json({ error: 'Failed to retrieve classes' });
        }
    });
    //fetch parents
    router.get("/get-parents", authMiddleware, async (req, res) => {
        try {
            if (req.user.role !== "admin") {
                return res.status(403).json({ message: 'Access denied' })
            }
            //fetch students from all classes to class
            const parents = await Parent.find().populate({ path: 'commonDetails', select: 'firstName lastName email phone profilePic role', });
            if (!parents || parents.length === 0) {
                return res.status(404).json({ message: "no parents found!" })
            }
            return res.status(201).json(parents);
        } catch (error) {
            console.error('Error fetching parents:', error);
            res.status(500).json({ error: 'Failed to generate parents' });
        }
    })

    //fetch teachers
    router.get("/get-teachers", authMiddleware, async (req, res) => {
        try {
            if (req.user.role !== "admin" && req.user.role !== 'teacher') {
                return res.status(403).json({ message: 'Access denied' })
            }
            //fetch students from all classes to class
            const teachers = await Teacher.find().populate({ path: "commonDetails", select: "firstName lastName email phone profilePic role gender" });
            if (!teachers) {
                return res.status(404).json({ message: "no teachers found found!" })
            }
            return res.status(201).json(teachers);
        } catch (error) {
            res.status(500).json({ error: 'Failed to retrieve teachers' });
        }
    })
    //fetch classes
    router.get("/get-classes", authMiddleware, async (req, res) => {
        try {
            if (req.user.role !== "admin" && req.user.role !== "teacher") {
                return res.status(403).json({ message: 'Access denied' })
            }
            const classes = await Class.find();
            if (!classes) {
                return res.status(404).json({ message: "no classes found!" })
            }
            res.status(201).json(classes);
        } catch (error) {
            res.status(500).json({ error: 'Failed to retrieve classes' });
        }

    });
    return router;
};

export default adminRoutes;