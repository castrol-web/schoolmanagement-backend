import nodemailer from "nodemailer";
import dotenv from "dotenv"
dotenv.config();

//mail credentials
const user = process.env.USER;
const port = process.env.EMAIL_PORT;
const pass = process.env.PASS;
const host = process.env.HOST;
const secure = Boolean(process.env.SECURE)

function sendVerificationEmail(User, Token) {
    const transporter = nodemailer.createTransport({
        host,
        service: 'gmail',
        port,
        secure,
        auth: {
            user,
            pass,
        }
    });

    //mail options
    const mailOptions = {
        to: User.email,
        subject: 'Verify your email',
        text: `Please verify your email by clicking the following link: http://localhost:8050/api/auth/verify-email?token=${Token}`,
    };
    transporter.sendMail(mailOptions, (err, info) => {
        if (err) {
            console.error('Error sending email', err);
        } else {
            console.log('Email sent: ' + info.response);
        }
    });
}

export default sendVerificationEmail;