import express from "express";
import mongoose from "mongoose";
import { createServer } from "http";
import { Server } from "socket.io";
import dotenv from "dotenv";
dotenv.config();
import cors from "cors";
import bodyParser from "body-parser";
import adminRoutes from "./routes/admin.js";
import authRoutes from "./routes/auth.js";
import teacherRoutes from "./routes/teacher.js";
import parentRoutes from "./routes/parent.js";
import messageRoutes from "./routes/message.js";
import userRoutes from "./routes/user.js";

const app = express();
const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: ["http://localhost:3001"],
    methods: ['GET', 'PUT', 'DELETE', 'POST'],
  }
})

//store connected clients
const connectedClients = new Map();

io.on("connection", (socket) => {
  console.log("A user connected:", socket.id);

  // Store socket ID for a user
  socket.on("register", (userId) => {
    connectedClients.set(userId, socket.id);
  });

  socket.on("disconnect", () => {
    console.log("User disconnected:", socket.id);
    connectedClients.delete(socket.id);
  });
});

//cross origin middleware 
app.use(cors({
  origin: ["http://localhost:3001","https://schoolmanagement-frontend-25p7.onrender.com"],
  methods: ['GET', 'PUT', 'DELETE', 'POST'],
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(bodyParser.json());

const mongooseUrl = process.env.MONGOOSE_CONNECTION;
//Database connection
try {
  await mongoose.connect(mongooseUrl);
  console.log("DB connection successful");
} catch (error) {
  console.error("Error connecting to database:", error);
  process.exit(1);
}


app.use("/api/admin", adminRoutes(io)); //pass io instance
app.use("/api/auth", authRoutes);
app.use("/api/teacher", teacherRoutes);
app.use("/api/parent", parentRoutes);
app.use("/api/messages", messageRoutes);
app.use("/api/users", userRoutes)

const port = process.env.PORT || 8050

// Example endpoint
const FLASK_API_URL = 'http://127.0.0.1:5000/predict';

//machine learning prediction api
app.post('/predict', async (req, res) => {
  try {

    console.log("Received Data:", req.body);  // Log the data received by backend
    // Send the request to Flask API
    const response = await axios.post(FLASK_API_URL, req.body);

    // Send the prediction result back to the frontend
    res.json(response.data);
  } catch (error) {
    console.error(error);
    res.status(500).send('Error processing the request');
  }
});

//listening port 
app.listen(port, "0.0.0.0", (err) => {
  if (err) {
    console.error("Error starting server:", err);
    process.exit(1);
  }
  console.log(`listening on localhost:${port}`);
})



