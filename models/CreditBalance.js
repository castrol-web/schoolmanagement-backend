import mongoose from "mongoose";

const CreditBalanceSchema = new mongoose.Schema({
  studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true },
  amount: { type: Number, required: true, default: 0 }, // Credit balance
  lastUpdated: { type: Date, default: Date.now },
});

export default mongoose.model('CreditBalance', CreditBalanceSchema);
