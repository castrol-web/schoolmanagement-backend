import Class from "../models/Class.js";
import Student from "../models/Student.js";

export const registerStudent = async (req, res) => {
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json({ message: 'Access denied' });
        }

        const { firstName, lastName, middleName, currentClass, gender, age } = req.body;
        // if (!firstName || !lastName || !middleName || !currentClass || !gender || !age) {
        //     return res.status(400).json({ message: "All fields are required" });
        // }

        // Check for existing class
        const classObj = await Class.findById(currentClass);
        if (!classObj) {
            return res.status(404).json({ error: 'Class not found' });
        }

        // Generate unique regNo (student ID)
        const regNo = await generateStudentID();

        // Create the new student
        const newStudent = new Student({
            firstName,
            lastName,
            middleName,
            currentClass,
            regNo, // Use the generated regNo
            gender,
            age,
            role: "student"
        });

        // Save the student
        await newStudent.save();

        // Add the student to the class and save
        classObj.students.push(newStudent._id);
        await classObj.save();

        return res.status(201).json({ message: "Student registered successfully", regNo });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
};

// Function to generate unique student ID
async function generateStudentID() {
    const currentYear = new Date().getFullYear().toString().slice(-2); // Get last two digits of the year (e.g., '24')
    const prefix = 'SCH' + currentYear;

    // Find the last registered student ID
    const lastStudent = await Student.findOne().sort({ regNo: -1 }); // Sort by regNo in descending order

    let nextNumber = 1;
    if (lastStudent && lastStudent.regNo) {
        const lastId = lastStudent.regNo.replace(prefix, ''); // Remove the prefix (e.g., 'SCH24')
        nextNumber = parseInt(lastId, 10) + 1; // Increment the last number part
    }

    const regNo = `${prefix}${String(nextNumber).padStart(4, '0')}`; // Format as SCHYY#### (e.g., SCH240001)
    return regNo;
}
