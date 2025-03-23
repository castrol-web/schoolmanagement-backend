import mongoose from "mongoose";

const tokenSchema = new mongoose.Schema({
    token: { type: String, required: true },
    expiresAt: { type: Date, required: true },
});

export default mongoose.model("BlacklistedToken", tokenSchema);
