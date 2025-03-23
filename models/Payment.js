import mongoose from "mongoose";

const paymentSchema = new mongoose.Schema({
    studentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Student",
      required: true,
    },
    invoiceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Invoice",
      required: false, // It can be empty if it's a prepayment
    },
    creditBalanceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "CreditBalance", // New reference field for prepayments
      required: false, // Only applicable for prepayments
    },
    amount: {
      type: Number,
      required: true,
    },
    paymentDate: {
      type: Date,
      required:true,
      default: Date.now,
    },
    paymentMethod: {
      type: String,
      enum: ["Cash", "Bank Transfer", "Credit", "Mobile Money"],
      required: true,
    },
    reference: {
      type: String,
      default: "",
    },
  });
  
  export default mongoose.model("Payment", paymentSchema);
  