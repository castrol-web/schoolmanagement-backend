import mongoose from 'mongoose';

const subjectSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true }, // e.g., "Mathematics", "English", etc.
  code: { type: String, required: true, unique: true } // e.g., "MAT101", "ENG102"
},
{
    timestamps:{
        createdAt:'created_at',
        updatedAt:'updated_at'
    }
});

export default mongoose.model('Subject', subjectSchema);
