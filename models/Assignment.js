import mongoose from "mongoose";

const AssignmentSchema = new mongoose.Schema({
    title: String,
    description: String,
    content: {
        type: String, // Store content in HTML or Rich Text format
    },
    dueDate: Date,
    createdAt: {
        type: Date,
        default: Date.now,
    },
    teacherId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    classId: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Class' }],
    maxPoints: Number,
});

export default mongoose.model('Assignment', AssignmentSchema);

