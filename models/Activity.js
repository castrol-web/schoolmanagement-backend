import mongoose from 'mongoose';

const activitySchema = new mongoose.Schema({
  name: { type: String, required: true },
  description: String,
  category: { type: String, enum: ['Sports', 'Music', 'Arts', 'Academics'], required: true },
  schedule: {
    day: { type: String, required: true },
    time: { type: String, required: true }
  },
  students: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Student' }],
  instructor: { type: mongoose.Schema.Types.ObjectId, ref: 'Teacher' },
  createdAt: { type: Date, default: Date.now },
});

export default mongoose.model('Activity', activitySchema);
