require('dotenv').config();
const mongoose = require('mongoose');

module.exports = async () => {
  const maxRetries = 3;
  let retryCount = 0;

  const connect = async () => {
    try {
      if (!process.env.MONGODB_URI) {
        throw new Error('MONGODB_URI is not defined in environment variables');
      }

      await mongoose.connect(process.env.MONGODB_URI, {
        serverSelectionTimeoutMS: 5000,
      });

      console.log(global.styles.infoColor('✅ Connected to MongoDB'));
    } catch (error) {
      retryCount++;
      console.error(
        global.styles.errorColor(
          `❌ Failed to connect to MongoDB (Attempt ${retryCount}/${maxRetries}): ${error.message}`
        )
      );

      if (retryCount < maxRetries) {
        console.log(
          global.styles.warningColor(
            `⏳ Retrying connection in 5 seconds...`
          )
        );
        setTimeout(connect, 5000);
      } else {
        console.error(
          global.styles.errorColor(
            '❌ Max retries reached. Bot will continue without database functionality.'
          )
        );
      }
    }
  };

  // Handle connection events
  mongoose.connection.on('disconnected', () => {
    console.warn(
      global.styles.warningColor('⚠️  MongoDB disconnected. Attempting to reconnect...')
    );
  });

  mongoose.connection.on('error', (err) => {
    console.error(
      global.styles.errorColor(`❌ MongoDB connection error: ${err.message}`)
    );
  });

  await connect();
};
