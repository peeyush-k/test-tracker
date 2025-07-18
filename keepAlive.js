const axios = require('axios');
const cron = require('node-cron');

const RENDER_URL = "https://test-tracker-for-peeyush.onrender.com"; // Your Render URL
const PING_INTERVAL = "*/12 * * * *"; // Every 12 minutes (under 15-min threshold)

// Function to ping your Render app
const pingRender = async () => {
  try {
    const response = await axios.get(RENDER_URL);
    console.log(`[${new Date().toISOString()}] Keep-alive ping successful`);
  } catch (error) {
    console.error(`[${new Date().toISOString()}] Ping failed:`, error.message);
  }
};

// Schedule the cron job
cron.schedule(PING_INTERVAL, pingRender);

console.log(`Pinging every 12 minutes...`);