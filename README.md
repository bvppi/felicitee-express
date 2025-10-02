# Felicitee Backend

An Express-based backend that powers the Felicitee contact form. It accepts form submissions, sends emails via AWS SES SMTP using Nodemailer, and exposes a simple health check.

## Prerequisites
- Node.js 18+ and npm
- AWS SES SMTP credentials (user and password)

## Getting Started
1. Install dependencies:
   
   ```bash
   npm install
   ```

2. Create a `.env` file in the project root with the following variables:
   
   ```env
   # Server
   PORT=3001

   # AWS SES SMTP
   SMTP_HOST=email-smtp.ap-southeast-1.amazonaws.com
   SMTP_PORT=587
   SMTP_USER=your_ses_smtp_username
   SMTP_PASS=your_ses_smtp_password

   # Email routing
   CONTACT_EMAIL_TO=feliciteemnl@gmail.com
   CONTACT_EMAIL_FROM=feliciteemnl@gmail.com
   ```

   Notes:
   - `SMTP_PORT=465` enables TLS (secure) automatically; otherwise 587 is used with STARTTLS.
   - Ensure `CONTACT_EMAIL_FROM` and `CONTACT_EMAIL_TO` are verified in SES if your account is in sandbox.

3. Start the server:
   
   ```bash
   npm start
   ```

   The server logs the health URL, e.g. `http://localhost:3001/api/health`.

## API

### Health Check
- `GET /api/health`
- Response:
  
  ```json
  { "status": "Server is running!" }
  ```

### Send Email
- `POST /api/send-email`
- Content-Type: `application/json`
- Body fields:
  - `fullName` (required)
  - `email` (required)
  - `company` (optional)
  - `lookingFor` (optional)
  - `quantity` (optional)
  - `phone` (optional)
  - `message` (optional)
- Success response:
  
  ```json
  { "success": true, "message": "Email sent successfully!" }
  ```
- Error response:
  
  ```json
  { "success": false, "message": "Failed to send email. Please try again later." }
  ```

Example request:

```bash
curl -X POST http://localhost:3001/api/send-email \
  -H "Content-Type: application/json" \
  -d '{
    "fullName": "Jane Doe",
    "company": "Acme Inc",
    "lookingFor": "Custom merch",
    "quantity": "100",
    "email": "jane@example.com",
    "phone": "+1 555 000 0000",
    "message": "We need a quote."
  }'
```

## Configuration Details
- Defaults:
  - `PORT` defaults to `3001` if not set.
  - `SMTP_HOST` defaults to `email-smtp.ap-southeast-1.amazonaws.com`.
  - `SMTP_PORT` defaults to `587`.
  - If `SMTP_USER` or `SMTP_PASS` is missing, the server throws a descriptive error at runtime.
- Middleware:
  - CORS enabled for cross-origin requests.
  - JSON and URL-encoded parsers enabled.

## Troubleshooting
- Missing SMTP credentials: ensure `SMTP_USER` and `SMTP_PASS` are present in `.env`.
- SES sandbox: verify both `CONTACT_EMAIL_FROM` and `CONTACT_EMAIL_TO` in AWS SES.
- TLS issues: use `SMTP_PORT=465` for implicit TLS; `587` uses STARTTLS.
- Email not delivered: check SES sending limits, region, and suppression list.

## Scripts
- `npm start` — runs `node server.js`.

## Tech Stack
- Express 5
- Nodemailer
- AWS SES SMTP
- dotenv, cors