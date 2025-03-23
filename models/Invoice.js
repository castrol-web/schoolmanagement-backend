import mongoose from "mongoose";

const invoiceSchema = new mongoose.Schema({
  studentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Student",
    required: true,
  },
  term: {
    type: String,
    required: true,
  },
  year: {
    type: Number,
    required: true,
  },
  items: [
    {
      name: String,
      amount: {
        type: Number,
        required: true,
      },
    },
  ],
  totalFees: {
    type: Number,
    required: true,
  },
  outstandingBalance: {
    type: Number,
    required: true,
  },
  payments: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Payment", // Links to the Payment model
    },
  ],
  status: {
    type: String,
    enum: ["Unpaid", "Partially Paid", "Paid"],
    default: "Unpaid",
  },
  issuedDate: {
    type: Date,
    required:true,
    default: Date.now,
  },
});

// Automatically update the status based on outstandingBalance
invoiceSchema.pre("save", function (next) {
  if (this.outstandingBalance === 0) {
    this.status = "Paid";
  } else if (this.outstandingBalance < this.totalFees) {
    this.status = "Partially Paid";
  } else {
    this.status = "Unpaid";
  }
  next();
});

export default mongoose.model("Invoice", invoiceSchema);
