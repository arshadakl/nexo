import { Hono } from 'hono';

export const privacyRoutes = new Hono();

/**
 * Public Privacy Policy page (Required for Meta Developer App Review & GDPR/CCPA compliance)
 */
privacyRoutes.get('/privacy-policy', (c) => {
  return c.html(`
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Privacy Policy - Nexo CRM</title>
  <style>
    :root {
      --bg: #090d16;
      --card: #111827;
      --border: #1f2937;
      --text: #f3f4f6;
      --muted: #9ca3af;
      --primary: #6366f1;
    }
    body {
      margin: 0;
      padding: 0;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      background-color: var(--bg);
      color: var(--text);
      line-height: 1.6;
    }
    .container {
      max-width: 800px;
      margin: 40px auto;
      padding: 32px;
      background: var(--card);
      border: 1px solid var(--border);
      border-radius: 12px;
      box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.5);
    }
    h1 {
      font-size: 28px;
      color: #fff;
      margin-bottom: 8px;
      border-bottom: 1px solid var(--border);
      padding-bottom: 16px;
    }
    h2 {
      font-size: 18px;
      color: #e0e7ff;
      margin-top: 24px;
      margin-bottom: 8px;
    }
    p, li {
      color: var(--muted);
      font-size: 14px;
    }
    ul {
      padding-left: 20px;
    }
    .badge {
      display: inline-block;
      padding: 4px 10px;
      background: rgba(99, 102, 241, 0.15);
      color: #818cf8;
      border-radius: 9999px;
      font-size: 12px;
      font-weight: 600;
      margin-bottom: 16px;
    }
    .footer {
      margin-top: 32px;
      padding-top: 16px;
      border-top: 1px solid var(--border);
      font-size: 12px;
      color: var(--muted);
      text-align: center;
    }
  </style>
</head>
<body>
  <div class="container">
    <span class="badge">Official Legal Document</span>
    <h1>Privacy Policy</h1>
    <p>Last updated: October 19, 2026</p>

    <p>This Privacy Policy describes how <strong>Nexo</strong> ("we", "us", or "our") collects, uses, and safeguards information when you connect your Instagram and WhatsApp accounts or interact with our services.</p>

    <h2>1. Information We Collect</h2>
    <p>When you use Nexo or connect integrations via Meta Platforms, Inc. (Instagram and WhatsApp), we may collect:</p>
    <ul>
      <li><strong>Direct Messages & Customer Conversations:</strong> Inbound messages sent by customers to your business accounts to provide CRM inbox and AI qualification assistance.</li>
      <li><strong>Account & Profile Information:</strong> Usernames, business phone numbers, and display names necessary to route responses.</li>
      <li><strong>Technical Tokens:</strong> Encrypted authentication tokens stored strictly using AES-256-GCM encryption with zero plaintext exposure.</li>
    </ul>

    <h2>2. How We Use Information</h2>
    <p>We process data solely for:</p>
    <ul>
      <li>Displaying and organizing customer inquiries inside your agency's CRM inbox.</li>
      <li>Assisting qualified customer support using automated AI drafts.</li>
      <li>Sending customer service notifications that you explicitly authorize.</li>
    </ul>

    <h2>3. Data Protection & Security</h2>
    <p>All message processing is performed on Cloudflare's secure Edge infrastructure. Authentication credentials and customer tokens are protected with AES-256-GCM encryption. We do not sell, rent, or monetize your customer data.</p>

    <h2>4. Data Retention and Deletion</h2>
    <p>Customers can request deletion of their conversation data at any time through our settings or by disconnecting their integration. Disconnecting your Instagram or WhatsApp account immediately purges all associated encrypted access credentials.</p>

    <h2>5. Contact Us</h2>
    <p>If you have questions regarding this Privacy Policy or your data, please contact: <code>privacy@fadeflow.in</code></p>

    <div class="footer">
      &copy; 2026 Nexo CRM. All rights reserved.
    </div>
  </div>
</body>
</html>
  `);
});

/**
 * Public Terms of Service page (Also required by Meta Developer App)
 */
privacyRoutes.get('/terms', (c) => {
  return c.html(`
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Terms of Service - Nexo CRM</title>
  <style>
    :root {
      --bg: #090d16;
      --card: #111827;
      --border: #1f2937;
      --text: #f3f4f6;
      --muted: #9ca3af;
    }
    body {
      margin: 0;
      padding: 0;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      background-color: var(--bg);
      color: var(--text);
      line-height: 1.6;
    }
    .container {
      max-width: 800px;
      margin: 40px auto;
      padding: 32px;
      background: var(--card);
      border: 1px solid var(--border);
      border-radius: 12px;
    }
    h1 { font-size: 26px; color: #fff; border-bottom: 1px solid var(--border); padding-bottom: 16px; }
    h2 { font-size: 18px; color: #e0e7ff; margin-top: 24px; }
    p, li { color: var(--muted); font-size: 14px; }
  </style>
</head>
<body>
  <div class="container">
    <h1>Terms of Service</h1>
    <p>Last updated: October 19, 2026</p>
    <h2>1. Acceptance of Terms</h2>
    <p>By using Nexo CRM, you agree to comply with these terms, applicable local laws, and Meta's Platform Terms.</p>
    <h2>2. Acceptable Use</h2>
    <p>You agree not to use Nexo to send unsolicited commercial spam or distribute content in violation of Meta policies.</p>
    <h2>3. Termination</h2>
    <p>You can disconnect your services at any time by revoking access or disconnecting via the Nexo workspace.</p>
  </div>
</body>
</html>
  `);
});
