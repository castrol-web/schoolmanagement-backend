import mongoose from "mongoose";

const conversationSchema = new mongoose.Schema(
    {
        participants: [
            {
                type: mongoose.Schema.Types.ObjectId,
                required: true
            }, // Reference to Parent or Teacher
        ],
        messages: [
            {
                type: mongoose.Schema.Types.ObjectId,
                ref: "Message", // Reference to Message model
                default: [],
            }],

        updatedAt: { type: Date, default: Date.now }, // Update timestamp when new messages arrive
    },
    { timestamps: true } // Automatically generate createdAt and updatedAt fields
);

export default mongoose.model("Conversation", conversationSchema);
