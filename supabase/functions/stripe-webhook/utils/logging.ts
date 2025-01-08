export const logWebhookEvent = (eventType: string, details: any) => {
  console.log(`🎯 Processing webhook event: ${eventType}`);
  console.log('Event details:', JSON.stringify(details, null, 2));
};

export const logError = (context: string, error: any) => {
  console.error(`❌ Error in ${context}:`, {
    message: error.message,
    stack: error.stack,
    details: error
  });
};

export const logSuccess = (context: string, details?: any) => {
  console.log(`✅ Success: ${context}`, details ? JSON.stringify(details, null, 2) : '');
};

export const logRequest = (req: Request) => {
  console.log('🚀 Webhook request received');
  console.log('Method:', req.method);
  console.log('URL:', req.url);
  console.log('Headers:', Object.fromEntries(req.headers.entries()));
};