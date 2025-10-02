import express from 'express';
import nodemailer from 'nodemailer';
import cors from 'cors';
import dotenv from 'dotenv';
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Create transporter for sending emails using AWS SES SMTP credentials
const createTransporter = () => {
  const smtpHost = process.env.SMTP_HOST || 'email-smtp.ap-southeast-1.amazonaws.com';
  const smtpPort = Number(process.env.SMTP_PORT || 587);
  const smtpUser = process.env.SMTP_USER;
  const smtpPass = process.env.SMTP_PASS;

  if (!smtpUser || !smtpPass) {
    throw new Error('SMTP credentials missing. Please set SMTP_USER and SMTP_PASS in .env');
  }

  return nodemailer.createTransport({
    host: smtpHost,
    port: smtpPort,
    secure: smtpPort === 465, // true for 465, false for other ports
    auth: {
      user: smtpUser,
      pass: smtpPass,
    },
  });
};

// Email sending endpoint
app.post('/api/send-email', async (req, res) => {
  try {
    const { fullName, company, lookingFor, quantity, email, phone, message } = req.body;

    // Validate required fields
    if (!fullName || !email) {
      return res.status(400).json({ 
        success: false, 
        message: 'Full name and email are required' 
      });
    }

    // Create transporter
    const transporter = createTransporter();

    // Determine recipient and sender from env
    const contactEmail = process.env.CONTACT_EMAIL_TO || 'feliciteemnl@gmail.com';
    const fromAddress = process.env.CONTACT_EMAIL_FROM || 'feliciteemnl@gmail.com';

    // Email content
    const mailOptions = {
      from: fromAddress,
      to: contactEmail,
      replyTo: email,
      subject: `Felicitee: Contact Form from ${fullName}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #1a365d; border-bottom: 2px solid #b08d41; padding-bottom: 10px;">
            New Contact Form Submission
          </h2>
          
          <div style="background-color: #f7fafc; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3 style="color: #2d3748; margin-top: 0;">Contact Information</h3>
            <p><strong>Full Name:</strong> ${fullName}</p>
            <p><strong>Company:</strong> ${company || 'Not provided'}</p>
            <p><strong>Email:</strong> ${email}</p>
            <p><strong>Phone:</strong> ${phone || 'Not provided'}</p>
          </div>

          <div style="background-color: #f7fafc; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3 style="color: #2d3748; margin-top: 0;">Project Details</h3>
            <p><strong>Looking For:</strong> ${lookingFor || 'Not specified'}</p>
            <p><strong>Quantity Needed:</strong> ${quantity || 'Not specified'}</p>
          </div>

          ${message ? `
          <div style="background-color: #f7fafc; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3 style="color: #2d3748; margin-top: 0;">Message</h3>
            <p style="white-space: pre-wrap;">${message}</p>
          </div>
          ` : ''}

          <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e2e8f0; color: #718096; font-size: 14px;">
            <p>This email was sent from the Felicitee website contact form.</p>
            <p>Submitted on: ${new Date().toLocaleString()}</p>
          </div>
        </div>
      `
    };

    // Send email
    await transporter.sendMail(mailOptions);

    res.json({ 
      success: true, 
      message: 'Email sent successfully!' 
    });

  } catch (error) {
    console.error('Error sending email:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to send email. Please try again later.' 
    });
  }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'Server is running!' });
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/api/health`);
  if (process.env.SMTP_USER && process.env.SMTP_PASS) {
    console.log('Email transport: AWS SES SMTP configured');
    console.log(`SMTP host: ${process.env.SMTP_HOST || 'email-smtp.ap-southeast-1.amazonaws.com'}`);
  } else {
    console.warn('Email transport NOT configured. Set SMTP_USER/SMTP_PASS in .env');
  }
});