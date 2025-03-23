import mongoose from "mongoose";

const messageSchema = new mongoose.Schema(
    {
        message: {
            type: String,
            required: true
        }, // Message text
        senderId: {
                type: mongoose.Schema.Types.ObjectId,
                required: true
            }, // Reference to Teacher or Parent
        receiverId: {
                type: mongoose.Schema.Types.ObjectId,
                required: true
            }, // Reference to Teacher or Parent
        isRead: { type: Boolean, default: false }, // Track if the message has been read
    },
    { timestamps: true } // Auto-generate createdAt and updatedAt fields
);

export default mongoose.model("Message", messageSchema);
