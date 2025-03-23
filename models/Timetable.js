import mongoose from "mongoose";

const timetableSchema = new mongoose.Schema({
    term: {
        type: String,
        required: true,
    },
    week: {
        type: String,
        required: true,
    },
    day: {
        type: String,
        required: true,
        enum: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'], // You can adjust based on your school week
    },
    timeSlot: {
        type: [String], // Example: ["08:00", "09:00"]
        required: true,
        validate: {
            validator: function (value) {
                return value.length === 2 && value[0] < value[1]; // Ensure time range is valid
            },
            message: 'Invalid time range',
        },
    },
    activityType: {
        type: String,
        required: true,
        enum: ['Lesson', 'Break', 'Lunch', 'Games'], // Add other activity types if needed
    },
    teacherId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Teacher', // Referencing the Teacher model
        default: null, // Optional for non-lesson activities
    },
    subject: {
        type: String, // Subject code or name
        default: null, // Optional for non-lesson activities
    },
    classId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Class', // Referencing the Class model
        default: null, // Optional for non-lesson activities
    },
    room: {
        type: String,
        default: null, // Optional
    },
    createdAt: {
        type: Date,
        default: Date.now,
    },
});

export default mongoose.model('Timetable', timetableSchema);
