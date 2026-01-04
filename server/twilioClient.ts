import twilio from 'twilio';

let connectionSettings: any;

async function getCredentials() {
  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
  const xReplitToken = process.env.REPL_IDENTITY 
    ? 'repl ' + process.env.REPL_IDENTITY 
    : process.env.WEB_REPL_RENEWAL 
    ? 'depl ' + process.env.WEB_REPL_RENEWAL 
    : null;

  if (!xReplitToken) {
    throw new Error('X_REPLIT_TOKEN not found for repl/depl');
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
    throw new Error('Twilio not connected');
  }
  return {
    accountSid: connectionSettings.settings.account_sid,
    apiKey: connectionSettings.settings.api_key,
    apiKeySecret: connectionSettings.settings.api_key_secret,
    phoneNumber: connectionSettings.settings.phone_number,
    authToken: connectionSettings.settings.auth_token,
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
