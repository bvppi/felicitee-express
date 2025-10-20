import express from 'express';
import nodemailer from 'nodemailer';
import cors from 'cors';
import dotenv from 'dotenv';
import * as XLSX from 'xlsx';
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;
// Add Google Form Web App URL (override with env if desired)
const GOOGLE_FORM_WEBAPP_URL = process.env.GOOGLE_FORM_WEBAPP_URL || 'https://script.google.com/macros/s/AKfycbw9sVlPw0U8z3QPt-hdb2DbMmJe_Em7sU9fShA8eKCgldHbgGhuMP2i9zBaeL7JLF_t/exec';
const RECAPTCHA_SECRET_KEY = process.env.RECAPTCHA_SECRET_KEY || '6LfKVPArAAAAAEFFIWNo7f9TmT1jojntSCs-mqCM';

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

// Helper: forward contact fields to Google Form Web App
const submitToGoogleForm = async (data) => {
  if (!GOOGLE_FORM_WEBAPP_URL) return;
  try {
    const params = new URLSearchParams();

    // Map to exact Google Sheet column headers
    const mapped = {
      'Full Name': data.fullName,
      'Company': data.company,
      'Looking For': data.lookingFor,
      'Quantity': data.quantity,
      'Email': data.email,
      'Phone': data.phone,
      'Message': data.message,
      'Created Date': new Date().toLocaleString(),
    };

    Object.entries(mapped).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        params.append(key, String(value));
      }
    });
    params.append('submittedAt', new Date().toISOString());

    const resp = await fetch(GOOGLE_FORM_WEBAPP_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    });

    if (!resp.ok) {
      const text = await resp.text().catch(() => '');
      throw new Error(`Google Form submission failed: ${resp.status} ${text}`);
    }
  } catch (err) {
    // Log and continue; don't fail the main request on Google sync errors
    console.error('submitToGoogleForm error:', err);
  }
};

// Email sending endpoint
app.post('/api/send-email', async (req, res) => {
  try {
    const { fullName, company, lookingFor, quantity, email, phone, message, recaptchaToken } = req.body;

    // Validate required fields
    if (!fullName || !email) {
      return res.status(400).json({ 
        success: false, 
        message: 'Full name and email are required' 
      });
    }

    // Verify reCAPTCHA
    if (!recaptchaToken) {
      return res.status(400).json({ success: false, message: 'reCAPTCHA verification required' });
    }

    try {
      const verifyResp = await fetch('https://www.google.com/recaptcha/api/siteverify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ secret: RECAPTCHA_SECRET_KEY, response: recaptchaToken }).toString(),
      });
      const verifyData = await verifyResp.json();
      if (!verifyData.success) {
        return res.status(400).json({ success: false, message: 'Failed reCAPTCHA validation' });
      }
    } catch (e) {
      console.error('reCAPTCHA verify error:', e);
      return res.status(500).json({ success: false, message: 'reCAPTCHA verification failed' });
    }

    // Create transporter
    const transporter = createTransporter();

    // Determine recipient and sender from env
    const contactEmail = process.env.CONTACT_EMAIL_TO || 'gifts@felicitee.com';
    const fromAddress = process.env.CONTACT_EMAIL_FROM || 'gifts@felicitee.com';

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

    // Forward to Google Form Web App (best-effort)
    await submitToGoogleForm({ fullName, company, lookingFor, quantity, email, phone, message });

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
app.get('/api/health_check', (req, res) => {
  res.json({ status: 'Server is running!' });
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/api/health_check`);
  if (process.env.SMTP_USER && process.env.SMTP_PASS) {
    console.log('Email transport: AWS SES SMTP configured');
    console.log(`SMTP host: ${process.env.SMTP_HOST || 'email-smtp.ap-southeast-1.amazonaws.com'}`);
  } else {
    console.warn('Email transport NOT configured. Set SMTP_USER/SMTP_PASS in .env');
  }
});