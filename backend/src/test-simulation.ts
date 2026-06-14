import express from 'express';
import { channelWebhookQueue } from './queue';

// Test configuration
const TEST_PORT = 9876;
const CALLBACK_URL = `http://localhost:${TEST_PORT}/webhook-test`;
const testMessageId = 'test_msg_12345';

console.log('==================================================');
console.log('RUNNING SYSTEM DIAGNOSTIC: QUEUE & WEBHOOK RETRIES');
console.log('==================================================');
console.log(`1. Target callback URL: ${CALLBACK_URL}`);
console.log('   (Note: Port 9876 is currently offline. Webhook will fail.)');

let attemptsCount = 0;
let testPassed = false;
let tempServer: any = null;

// Add a test webhook job to the queue
channelWebhookQueue.add({
  id: `${testMessageId}_test_status`,
  maxAttempts: 4,
  run: async (job) => {
    attemptsCount = job.attempts;
    console.log(`[Queue Runner] Dispatching webhook (Attempt ${job.attempts}/4)...`);
    
    const response = await fetch(CALLBACK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messageId: testMessageId, status: 'delivered' })
    });

    if (!response.ok) {
      throw new Error(`Server returned error ${response.status}`);
    }
  },
  onSuccess: () => {
    console.log('\n✅ SUCCESS: Webhook successfully delivered to CRM receipt API!');
    console.log(`   Total attempts: ${attemptsCount}`);
    testPassed = true;
    cleanupAndExit(0);
  },
  onRetry: (err, delayMs) => {
    console.log(`❌ Attempt ${attemptsCount} failed: ${err.message}`);
    console.log(`   [Exponential Backoff] Scheduling next retry in ${delayMs / 1000} seconds...`);

    // If we have failed twice, let's spin up the server to simulate network recovery!
    if (attemptsCount === 2 && !tempServer) {
      console.log('\n🔧 SIMULATING NETWORK RECOVERY: Spinning up CRM Callback Listener on port 9876...');
      startTempServer();
    }
  },
  onFailure: (err) => {
    console.log(`\n❌ CRITICAL: Webhook permanently failed after max attempts: ${err.message}`);
    cleanupAndExit(1);
  }
});

function startTempServer() {
  const app = express();
  app.use(express.json());

  app.post('/webhook-test', (req, res) => {
    const { messageId, status } = req.body;
    console.log(`[Temp CRM Server] Webhook received! Msg ID: ${messageId}, Status: ${status}`);
    res.status(200).json({ received: true });
  });

  tempServer = app.listen(TEST_PORT, () => {
    console.log(`[Temp CRM Server] Listening on http://localhost:${TEST_PORT}. Network is online!`);
  });
}

function cleanupAndExit(code: number) {
  if (tempServer) {
    tempServer.close(() => {
      console.log('[Temp CRM Server] Stopped listener.');
      finish(code);
    });
  } else {
    finish(code);
  }
}

function finish(code: number) {
  console.log('==================================================');
  if (testPassed && code === 0) {
    console.log('SYSTEM TEST PASSED: Eventual consistency achieved via retries!');
  } else {
    console.log('SYSTEM TEST FAILED.');
  }
  console.log('==================================================');
  process.exit(code);
}

// Timeout failsafe after 30 seconds
setTimeout(() => {
  console.log('\n❌ TIMEOUT: Test did not finish in 30 seconds.');
  cleanupAndExit(1);
}, 30000);
