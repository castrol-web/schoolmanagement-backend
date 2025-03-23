import express from 'express';
import { Login, Logout } from '../controllers/auth.controller.js';
const router = express.Router();

//logging in 
router.post('/login', Login)

//logout router
router.post('/logout', Logout)

export default router;