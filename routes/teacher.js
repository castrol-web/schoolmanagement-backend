import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import authMiddleware from "../middleware/auth.js";
import Class from "../models/Class.js";
import Student from "../models/Student.js";
import Marks from "../models/Marks.js";
import Timetable from "../models/Timetable.js";
import Assignment from "../models/Assignment.js";
import Activity from "../models/Activity.js";

const router = express.Router();
router.use(cors());
dotenv.config();

//fetch classes
router.get("/get-classes", authMiddleware, async (req, res) => {
    try {
        if (req.user.role !== "teacher") {
            return res.status(403).json({ message: 'Access denied' })
        }
        const classes = await Class.find().populate('subjects').populate('students');
        if (!classes) {
            return res.status(404).json({ message: "no classes found!" })
        }
        return res.status(201).json(classes);
    } catch (error) {
        res.status(500).json({ error: 'Failed to retrieve classes' });
    }

})

//Get subjects for a specific class
router.get('/get-class/:classId/subjects', authMiddleware, async (req, res) => {
    try {
        if (req.user.role !== "teacher") {
            return res.status(403).json({ message: 'Access denied' })
        }
        const { classId } = req.params;
        const classData = await Class.findById(classId).populate('subjects');
        return res.status(201).json(classData.subjects);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch subjects for the class.' });
    }
});

//Get students for a specific class
router.get('/:classId/students', authMiddleware, async (req, res) => {
    try {
        if (req.user.role !== "teacher") {
            return res.status(403).json({ message: 'Access denied' })
        }
        const { classId } = req.params;
        const students = await Student.find({ currentClass: classId });
        return res.status(201).json(students);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch students for the class.' });
    }
});
// Submit marks for students
router.post('/submit-marks', authMiddleware, async (req, res) => {
    const { classId, subjectId, marksData, term, year, examType } = req.body;

    try {
        // Check if the user is a teacher
        if (req.user.role !== "teacher") {
            return res.status(403).json({ message: 'Access denied' });
        }

        // Ensure all fields are provided
        if (!classId || !subjectId || !marksData || !term || !year || !examType) {
            return res.status(400).json({ message: "All fields are required" });
        }

        // Loop through each student's marks entry
        for (const entry of marksData) {
            // Check if marks already exist for the student, subject, class, term, year, and examType
            const existingMarks = await Marks.findOne({
                student: entry.studentId,
                subject: subjectId,
                class: classId,
                term,
                year,
                examType
            });

            if (existingMarks) {
                return res.status(400).json({ message: `Marks for student ${entry.studentId} in this subject, term, and exam type already exist.` });
            }

            // Create a new Marks entry
            const newMarks = new Marks({
                student: entry.studentId,
                subject: subjectId,
                marks: entry.marks,
                class: classId,
                term,
                year,
                examType
            });

            // Save the marks entry
            await newMarks.save();
        }

        return res.status(201).json({ message: 'Marks submitted successfully.' });

    } catch (error) {
        res.status(500).json({ error: 'Failed to submit marks.' });
        console.error(`An error occurred: ${error}`);
    }
});



// Fetch marks for the selected class, examType, and term
router.get("/get-marks/:classId", authMiddleware, async (req, res) => {
    try {
        if (req.user.role !== "teacher") {
            return res.status(403).json({ message: 'Access denied' })
        }
        const { classId } = req.params;
        const { term, examType } = req.query;
        if (!term || !examType || !classId) {
            return res.status(400).json({ message: "all fields are required" })
        }
        //fetching subject marks for specified students in that class
        const marks = await Marks.find({
            class: classId,
            examType,
            term
        }).populate('student').populate('subject');
        return res.status(200).json(marks)
    } catch (error) {
        console.error('Failed to fetch marks:', error);
        res.status(500).json({ error: 'Failed to fetch marks' });
    }
});

//generating reports
router.get('/generate-report/:studentId/:term/:examType/:classId', authMiddleware, async (req, res) => {
    const { studentId, examType, term, classId } = req.params;

    try {
        // Ensure only teachers can generate the report
        if (req.user.role !== "teacher") {
            return res.status(403).json({ message: 'Access denied' });
        }

        // Validate request parameters
        if (!examType || !term || !classId) {
            return res.status(403).json({ message: 'Invalid details provided' });
        }
        if (examType !== 'Final' && examType !== 'Midterm') {
            return res.status(400).json({ message: `Oops!, Cannot generate report for ${examType}, it should be mid or end of term.` });
        }

        // Fetch student's marks for the specified term, exam type, and class
        const studentMarks = await Marks.find({
            student: studentId,
            term,
            examType,
            class: classId
        }).populate('subject');

        if (studentMarks.length === 0) {
            return res.status(404).json({ message: 'No marks found for this student.' });
        }

        // Fetch marks for all students in the class to calculate ranking
        const allStudentMarks = await Marks.find({
            term,
            examType,
            class: classId
        }).populate('student');

        // Calculate total marks and grade for the student
        let totalMarks = 0;
        const reportData = studentMarks.map(mark => {
            totalMarks += mark.marks;
            const grade = calculateGrade(mark.marks);
            return {
                subject: mark.subject.name,
                marks: mark.marks,
                grade: grade,
                remarks: generateRemarks(grade)
            };
        });

        //fetch students details
        const studentDetails = await Student.findById(studentId)
        if (!studentDetails) {
            return res.status(404).json({ message: "no student found" })
        }

        // Calculate position in class based on total marks
        const studentRankings = calculateRankings(allStudentMarks);
        const studentPosition = studentRankings.findIndex(rank => rank.student.toString() === studentId) + 1;

        // Generate the report data to send back
        const report = {
            student: studentMarks[0].student,
            class: studentMarks[0].class,
            term,
            details: studentDetails,
            examType,
            totalMarks,
            grade: calculateGrade(totalMarks / studentMarks.length),  // Average grade
            position: studentPosition,
            subjects: reportData
        };

        res.status(200).json(report);

    } catch (error) {
        console.error('Failed to generate report:', error);
        res.status(500).json({ error: 'Failed to generate report' });
    }
});

// Function to calculate grade based on marks
function calculateGrade(marks) {
    if (marks >= 80) return 'A';
    if (marks >= 70) return 'B';
    if (marks >= 60) return 'C';
    if (marks >= 50) return 'D';
    return 'E';
}

// Function to generate remarks based on grade
function generateRemarks(grade) {
    switch (grade) {
        case 'A': return 'Excellent work! Keep it up!';
        case 'B': return 'Great job!';
        case 'C': return 'Good effort! Aim for even higher';
        case 'D': return 'Fair, but you need to work harder.';
        case 'E': return 'Needs significant improvement. Keep pushing!';
        default: return 'No remarks available.';
    }
}

// Function to calculate rankings based on total marks for the class
function calculateRankings(allStudentMarks) {
    // Group students by their total marks
    const studentTotals = {};

    allStudentMarks.forEach(mark => {
        const studentId = mark.student._id.toString();
        if (!studentTotals[studentId]) {
            studentTotals[studentId] = { student: mark.student._id, totalMarks: 0 };
        }
        studentTotals[studentId].totalMarks += mark.marks;
    });

    // Convert object to array and sort by total marks
    const rankings = Object.values(studentTotals).sort((a, b) => b.totalMarks - a.totalMarks);

    return rankings;
}

// Route to fetch marks for specific criteria
router.get('/:classId/marks', authMiddleware, async (req, res) => {
    try {
        if (req.user.role !== "teacher") {
            return res.status(403).json({ message: 'Access denied' })
        }
        const { classId } = req.params;
        const { subjectId, term, year, examType } = req.query;

        const marks = await Marks.find({
            class: classId,
            subject: subjectId,
            term,
            year,
            examType
        });

        res.json(marks);
    } catch (error) {
        console.error('Failed to fetch marks', error);
        res.status(500).json({ error: 'Failed to fetch marks' });
    }
});


// Timetable creation by the headteacher
router.post('/create', authMiddleware, async (req, res) => {
    try {
        //to be added below for teacher 
        // || req.user.position !== 'headteacher'
        // Checking for authorized headteacher
        if (req.user.role !== 'teacher') {
            return res.status(403).json({ message: 'Access denied' });
        }

        const { term, week, teacherId, day, timeSlot, subject, room, classes, activityType } = req.body;

        // Validate input
        if (!term || !week || !activityType || !day || !timeSlot) {
            return res.status(400).json({ message: 'Missing required fields' });
        }

        // Check for lessons specifically
        if (activityType === 'Lesson') {
            if (!teacherId || !subject || !classes) {
                return res.status(400).json({ message: 'Missing lesson-specific fields.' });
            }

            // Check if the teacher is already assigned at the same time
            const existingEntry = await Timetable.findOne({
                teacherId,
                day,
                $or: [
                    { $and: [{ 'timeSlot.0': { $lt: timeSlot[1] } }, { 'timeSlot.1': { $gt: timeSlot[0] } }] }
                ]
            });

            if (existingEntry) {
                const classID = await Class.findById(existingEntry.classId);
                return res.status(400).json({
                    message: `Teacher is already assigned to ${classID?.className || 'another class'} at this time.`
                });
            }

            // Check if the class already has an activity in the time slot
            const classConflict = await Timetable.findOne({
                classId: classes,
                day,
                $or: [
                    { $and: [{ 'timeSlot.0': { $lt: timeSlot[1] } }, { 'timeSlot.1': { $gt: timeSlot[0] } }] }
                ]
            });

            if (classConflict) {
                return res.status(400).json({ message: 'Time slot overlaps with an existing activity for this class.' });
            }
        }

        // Create a new timetable entry
        const newTimetable = new Timetable({
            term,
            week,
            classId: classes || null, // Optional for non-lesson activities
            activityType,
            teacherId: teacherId || null, // Optional for non-lesson activities
            day,
            timeSlot,
            subject: subject || null, // Optional for non-lesson activities
            room: room || null // Optional
        });

        // Save to the database
        await newTimetable.save();

        res.status(201).json({ message: 'Timetable created successfully.' });
    } catch (error) {
        console.error('Error creating timetable:', error);
        res.status(500).json({ error: 'Failed to create timetable' });
    }
});


// Create a new assignment (Teacher only)
router.post('/create-assignment', authMiddleware, async (req, res) => {
    const { title, description, content, dueDate, maxPoints, classId } = req.body;
    if (req.user.role !== 'teacher') {
        return res.status(403).json({ message: 'Access denied' });
    }
    try {
        const newAssignment = new Assignment({
            title,
            description,
            content,
            dueDate,
            teacherId: req.user._id,
            classId,
            maxPoints,
        });

        await newAssignment.save();
        res.status(201).json(newAssignment);
    } catch (error) {
        res.status(400).json({ message: 'Error creating assignment', error });
        console.error(error)
    }
});

//fetching timetable
router.get('/timetable', authMiddleware, async (req, res) => {
    if (req.user.role !== 'teacher') {
        return res.status(403).json({ message: "Access denied" })
    }
    try {
        //polutating class names and teacher names
        const timetable = await Timetable.find().populate('classId', 'className').populate({
            path: 'teacherId', // Populate teacher details
            populate: {
                path: 'commonDetails', // Populate user's common details
                select: 'firstName lastName', // Only fetch firstName and lastName
            },
        });
        if (!timetable || timetable.length === 0) {
            return res.status(404).json({ message: 'no timetable found' })
        }
        return res.status(201).json(timetable)
    } catch (error) {
        res.status(500).json({ error: 'server error' })
        console.error(error)
    }
})

// Create a new activity
router.post('/activities', authMiddleware, async (req, res) => {
    if (req.user.role !== 'teacher') {
        return res.status(403).json({ message: "Access denied" })
    }
    try {
        const newActivity = new Activity(req.body);
        await newActivity.save();
        res.status(201).json(newActivity);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
});

// Get all activities
router.get('/activities', authMiddleware, async (req, res) => {
    if (req.user.role !== 'teacher' && req.user.role !== 'parent') {
        return res.status(403).json({ message: "Access denied" })
    }
    try {
        const activities = await Activity.find().populate({path:'instructor',select:'firstName lastName'});
        res.status(201).json(activities);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// student marks data for analytics
router.get('/students-analytics', authMiddleware, async (req, res) => {
    if (req.user.role !== 'teacher') {
        return res.status(403).json({ message: "Access denied" });
    }

    try {
        const students = await Marks.find()
            .populate({
                path: 'student',  // Path to populate
                select: 'firstName lastName'  // Select the fields you need
            })
            .populate({
                path: 'subject',  // Path to populate
                select: 'name'  // Select the fields you need
            })
            .populate({
                path: 'class',  // Path to populate
                select: 'className'  // Select the fields you need
            });

        res.status(201).json(students);
    } catch (error) {
        console.error('Error fetching student data:', error);
        res.status(500).json({ error: 'Failed to fetch student data' });
    }
});




export default router;







