import mongoose from 'mongoose';

const marksSchema = new mongoose.Schema({
    student: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Student',
        required: true
    },
    subject: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Subject',
        required: true
    },
    class: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Class',
        required: true
    },
    examType: {
        type: String,
        required: true,
        enum: ['Midterm', 'Final', 'Quiz', 'Assignment'], // You can customize the exam types
    },
    marks: {
        type: Number,
        required: true,
        min: 0,
        max: 100 //marks are out of 100
    },
    term: {
        type: String,
        required: true
    },
    year: {
        type: Number,
        required: true
    }
},
{
    timestamps:{
        createdAt:'created_at',
        updatedAt:'updated_at'
    }
});

export default mongoose.model('Marks', marksSchema);
