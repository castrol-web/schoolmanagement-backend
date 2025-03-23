import Conversation from "../models/conversation.js";
import Message from "../models/message.js";
import Parent from "../models/Parent.js";
import Teacher from "../models/Teacher.js";

export const sendMessage = async (req, res) => {
    try {
        const { id: receiverId } = req.params; // ID of the receiver
        const { message } = req.body; // Message text from request body
        const senderId = req.user._id; // ID of the sender from authenticated user

        // Check if a conversation exists between sender and receiver
        let conversation = await Conversation.findOne({
            participants: { $all: [senderId, receiverId] },
        });

        // Create a new conversation if it doesn't exist
        if (!conversation) {
            conversation = await Conversation.create({
                participants: [senderId, receiverId],
            });
        }

        // Create and save the message
        const newMessage = await Message.create({
            senderId,
            receiverId,
            message,
        });

        // Add the message ID to the conversation's messages array
        conversation.messages.push(newMessage._id);
        //promise do all does send the conversations synchronious
        await Promise.all[conversation.save(), newMessage.save()]
        res.status(201).json({
            success: true,
            message: "Message sent successfully",
            data: newMessage,
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: "An error occurred" });
    }
};

export const getMessages = async (req, res) => {
    try {
        const { id: userToChatId } = req.params;
        const senderId = req.user._id;
        //get the conversation 
        const conversation = await Conversation.findOne({
            participants: { $all: [senderId, userToChatId] }
        }).populate('messages');
        //if there is not conversation
        if (!conversation) {
            return res.status(200).json([])
        }
        const messages = conversation.messages;
        res.status(200).json(messages);
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: "An error occurred" });
    }
}


export const getUsersForSidebar = async (req, res) => {
    try {
        // Get the currently logged-in user's ID
        const loggedInUserId = req.user._id;

        // Find parents and teachers excluding the logged-in user
        const filteredParents = await Parent.find({ _id: { $ne: loggedInUserId } }).select("-password").populate({path:'commonDetails',select:"firstName lastName"});
        const filteredTeachers = await Teacher.find({ _id: { $ne: loggedInUserId } }).select("-password").populate({path:'commonDetails',select:"firstName lastName"});

        // Combine parents and teachers into a single array
        const combinedUsers = [
            ...filteredParents.map(user => ({ ...user.toObject(), role: "parent" })),
            ...filteredTeachers.map(user => ({ ...user.toObject(), role: "teacher" }))
        ];

        // Return the combined array as JSON
        res.status(200).json(combinedUsers);
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: "An error occurred" });
    }
};
