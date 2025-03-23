import mongoose from "mongoose";

const userSchema = mongoose.Schema({
    firstName: { type: String, required: true },
    lastName: { type: String, required: true },
    profilePic: { type: String, default: null },
    email: { type: String, required: true, unique: true, match: /.+\@.+\..+/ },
    phone: { type: String, match: /^\d{10}$/ },
    password: { type: String, required: true, minlength: 8 },
    role: { type: String, required: true, enum: ['admin', 'teacher', 'parent', 'student'] },
}, {
    timestamps: {
        createdAt: 'created_at',
        updatedAt: 'updated_at'
    }
});
export default mongoose.model('User', userSchema);