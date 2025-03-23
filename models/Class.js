import mongoose from 'mongoose';

const classSchema = new mongoose.Schema({
    className: {
        type: String,
        required: true
    },
    subjects: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Subject'
    }],// Array of subject IDs
    students: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Student'
    }], // Reference to Student model
},
{
    timestamps:{
        createdAt:'created_at',
        updatedAt:'updated_at'
    }
});

export default mongoose.model('Class', classSchema);
