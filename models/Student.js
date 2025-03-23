import mongoose from "mongoose";

const studentSchema = new mongoose.Schema({
    firstName: { type: String, required: true },
    lastName: { type: String},
    regNo: { type: String, required: true, unique: true },
    middleName: { type: String },
    currentClass: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Class'
    },
    balance: { type: Number, default: 0 },
    gender: { type: String, enum: ['male', 'female', 'other'] },
    age: { type: Number, max: 25 },
    role: { type: String, default: 'student' },
    // Additional fields can be added as necessary
},
    {
        timestamps: {
            createdAt: 'created_at',
            updatedAt: 'updated_at'
        }
    });

export default mongoose.model('Student', studentSchema);