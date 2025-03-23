import mongoose from "mongoose";

const teacherSchema = new mongoose.Schema({
    commonDetails: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    isVerified: { type: Boolean, default: false },
    verificationToken: {
        type: String,
        required: function () {
            return !this.isVerified; //only required if not verified user
        }
    },
    position: { type: String, required: true }, // e.g., headteacher, deputy, discipline master
},
    {
        timestamps: {
            createdAt: 'created_at',
            updatedAt: 'updated_at'
        }
    });

export default mongoose.model('Teacher', teacherSchema);