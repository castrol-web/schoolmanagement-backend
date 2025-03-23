import mongoose from "mongoose";

const parentSchema = new mongoose.Schema({
    commonDetails:{
        type:mongoose.Schema.Types.ObjectId,
        ref:'User',
        required:true
    },
    childId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Student',
        required: true
    },
    isVerified: { type: Boolean, default: false },
    verificationToken: {
        type: String,
        required: function () {
            return !this.isVerified; //only required if not verified
        }
    }
});

export default mongoose.model('Parent', parentSchema);