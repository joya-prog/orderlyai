import twilio from 'twilio';

let connectionSettings: any;
let useEnvFallback = false;

async function getCredentials() {
  // If we've already determined we need to use env fallback, skip connector attempt
  if (useEnvFallback) {
    return getEnvCredentials();
  }

  try {
    const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
    const xReplitToken = process.env.REPL_IDENTITY 
      ? 'repl ' + process.env.REPL_IDENTITY 
      : process.env.WEB_REPL_RENEWAL 
      ? 'depl ' + process.env.WEB_REPL_RENEWAL 
      : null;

    if (!xReplitToken || !hostname) {
      throw new Error('Connector not available');
    }

    connectionSettings = await fetch(
      'https://' + hostname + '/api/v2/connection?include_secrets=true&connector_names=twilio',
      {
        headers: {
          'Accept': 'application/json',
          'X_REPLIT_TOKEN': xReplitToken
        }
      }
    ).then(res => res.json()).then(data => data.items?.[0]);

    if (!connectionSettings || (!connectionSettings.settings.account_sid || !connectionSettings.settings.api_key || !connectionSettings.settings.api_key_secret)) {
      throw new Error('Twilio connector not connected');
    }
    
    return {
      accountSid: connectionSettings.settings.account_sid,
      apiKey: connectionSettings.settings.api_key,
      apiKeySecret: connectionSettings.settings.api_key_secret,
      phoneNumber: connectionSettings.settings.phone_number,
      authToken: connectionSettings.settings.auth_token,
    };
  } catch (error: any) {
    console.log('[Twilio] Connector not available, falling back to environment secrets:', error.message);
    useEnvFallback = true;
    return getEnvCredentials();
  }
}

function getEnvCredentials() {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const phoneNumber = process.env.TWILIO_PHONE_NUMBER;

  if (!accountSid || !authToken) {
    throw new Error('Twilio credentials not configured. Set TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN.');
  }

  if (!phoneNumber) {
    throw new Error('TWILIO_PHONE_NUMBER not configured. Set the sender phone number.');
  }

  console.log('[Twilio] Using environment variable credentials');

  return {
    accountSid,
    apiKey: accountSid, // Use accountSid as apiKey for auth token auth
    apiKeySecret: authToken,
    phoneNumber,
    authToken,
  };
}

export async function getTwilioClient() {
  const { accountSid, apiKey, apiKeySecret } = await getCredentials();
  return twilio(apiKey, apiKeySecret, {
    accountSid: accountSid
  });
}

export async function getTwilioFromPhoneNumber() {
  const { phoneNumber } = await getCredentials();
  return phoneNumber;
}

export async function getTwilioAccountSid() {
  const { accountSid } = await getCredentials();
  return accountSid;
}

export async function getTwilioAuthToken() {
  const { authToken, apiKeySecret } = await getCredentials();
  return authToken || apiKeySecret;
}

// SMS 2FA verification code storage (in-memory for simplicity)
const smsVerificationCodes = new Map<string, { code: string; expiresAt: number; userId: string }>();

// Clean up expired codes every 60 seconds
setInterval(() => {
  const now = Date.now();
  Array.from(smsVerificationCodes.entries()).forEach(([key, value]) => {
    if (value.expiresAt < now) {
      smsVerificationCodes.delete(key);
    }
  });
}, 60000);

export async function sendSms2FACode(phoneNumber: string, userId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const client = await getTwilioClient();
    const fromNumber = await getTwilioFromPhoneNumber();
    
    // Generate 6-digit code
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    
    // Store code with 5-minute expiry
    const key = `${userId}:${phoneNumber}`;
    smsVerificationCodes.set(key, {
      code,
      expiresAt: Date.now() + 5 * 60 * 1000,
      userId
    });
    
    // Send SMS
    await client.messages.create({
      body: `Your Orderly AI verification code is: ${code}. This code expires in 5 minutes.`,
      from: fromNumber,
      to: phoneNumber
    });
    
    return { success: true };
  } catch (error: any) {
    console.error('[SMS 2FA] Error sending code:', error.message);
    return { success: false, error: error.message };
  }
}

export function verifySms2FACode(phoneNumber: string, userId: string, code: string): boolean {
  const key = `${userId}:${phoneNumber}`;
  const stored = smsVerificationCodes.get(key);
  
  if (!stored) {
    return false;
  }
  
  if (stored.expiresAt < Date.now()) {
    smsVerificationCodes.delete(key);
    return false;
  }
  
  if (stored.code === code && stored.userId === userId) {
    smsVerificationCodes.delete(key); // One-time use
    return true;
  }
  
  return false;
}

export async function sendSignupNotification(userEmail: string, signupMethod: string): Promise<{ success: boolean; error?: string }> {
  const adminNumber = process.env.ADMIN_SMS_NUMBER;
  
  if (!adminNumber) {
    console.log('[Signup Notification] ADMIN_SMS_NUMBER not configured, skipping SMS');
    return { success: false, error: 'ADMIN_SMS_NUMBER not configured' };
  }
  
  try {
    const client = await getTwilioClient();
    const fromNumber = await getTwilioFromPhoneNumber();
    
    const message = `New Orderly AI signup!\n\nEmail: ${userEmail}\nMethod: ${signupMethod}\nTime: ${new Date().toLocaleString('en-US', { timeZone: 'America/Los_Angeles' })}`;
    
    await client.messages.create({
      body: message,
      from: fromNumber,
      to: adminNumber
    });
    
    console.log('[Signup Notification] SMS sent for new user:', userEmail);
    return { success: true };
  } catch (error: any) {
    console.error('[Signup Notification] Error sending SMS:', error.message);
    return { success: false, error: error.message };
  }
}
