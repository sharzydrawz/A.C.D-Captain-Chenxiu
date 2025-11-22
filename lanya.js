require('dotenv').config();
const express = require('express');
const { Client, GatewayIntentBits } = require('discord.js');
const { LavalinkManager } = require('lavalink-client');
const fs = require('fs');
const path = require('path');
const chalk = require('chalk');
const { autoPlayFunction } = require('./functions/autoPlay');

// Validate required environment variables
const requiredEnvVars = [
  'DISCORD_TOKEN',
  'DISCORD_CLIENT_ID',
  'MONGODB_URI',
  'LL_HOST',
  'LL_PORT',
  'LL_PASSWORD',
];

const missingEnvVars = requiredEnvVars.filter((varName) => !process.env[varName]);

if (missingEnvVars.length > 0) {
  console.error(chalk.red('❌ Missing required environment variables:'));
  missingEnvVars.forEach((varName) => {
    console.error(chalk.red(`   - ${varName}`));
  });
  console.error(chalk.yellow('\n⚠️  Please check your .env file and ensure all required variables are set.'));
  console.error(chalk.yellow('   Refer to .env.example for the required variables.\n'));
  process.exit(1);
}


const app = express();

app.get('/', (req, res) => {
  res.send('Everything is up!');
});

const server = app.listen(10000, () => {
  console.log('✅ Express server running on http://localhost:10000');
});

// Handle Express server errors
server.on('error', (error) => {
  console.error(chalk.red('❌ Express server error:'), error);
});

// Store server reference for graceful shutdown
global.expressServer = server;


const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildPresences,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildVoiceStates,
  ],
});

client.lavalink = new LavalinkManager({
  nodes: [
    {
      authorization: process.env.LL_PASSWORD,
      host: process.env.LL_HOST,
      port: parseInt(process.env.LL_PORT, 10),
      secure: process.env.LL_SECURE === 'true',
      id: process.env.LL_NAME,
    },
  ],
  sendToShard: (guildId, payload) =>
    client.guilds.cache.get(guildId)?.shard?.send(payload),
  autoSkip: true,
  client: {
    id: process.env.DISCORD_CLIENT_ID,
    username: 'Lanya',
  },
  playerOptions: {
    onEmptyQueue: {
      destroyAfterMs: 30_000,
      autoPlayFunction: autoPlayFunction,
    },
  },
});

const styles = {
  successColor: chalk.bold.green,
  warningColor: chalk.bold.yellow,
  infoColor: chalk.bold.blue,
  commandColor: chalk.bold.cyan,
  userColor: chalk.bold.magenta,
  errorColor: chalk.red,
  highlightColor: chalk.bold.hex('#FFA500'),
  accentColor: chalk.bold.hex('#00FF7F'),
  secondaryColor: chalk.hex('#ADD8E6'),
  primaryColor: chalk.bold.hex('#FF1493'),
  dividerColor: chalk.hex('#FFD700'),
};

global.styles = styles;

const handlerFiles = fs
  .readdirSync(path.join(__dirname, 'handlers'))
  .filter((file) => file.endsWith('.js'));
let counter = 0;
for (const file of handlerFiles) {
  counter += 1;
  const handler = require(`./handlers/${file}`);
  if (typeof handler === 'function') {
    handler(client);
  }
}
console.log(
  global.styles.successColor(`✅ Successfully loaded ${counter} handlers`)
);
process.on('SIGINT', async () => {
  console.log(global.styles.warningColor('⚠️ Received SIGINT, shutting down...'));
  try {
    if (global.expressServer) await global.expressServer.close();
    await client.destroy();
    if (client.lavalink) await client.lavalink.destroy();
    console.log(global.styles.successColor('✅ Graceful shutdown complete.'));
    process.exit(0);
  } catch (err) {
    console.error(global.styles.errorColor('❌ Error during shutdown:'), err);
    process.exit(1);
  }
});

process.on('SIGTERM', async () => {
  console.log(global.styles.warningColor('⚠️ Received SIGTERM, shutting down...'));
  try {
    if (global.expressServer) await global.expressServer.close();
    await client.destroy();
    if (client.lavalink) await client.lavalink.destroy();
    console.log(global.styles.successColor('✅ Graceful shutdown complete.'));
    process.exit(0);
  } catch (err) {
    console.error(global.styles.errorColor('❌ Error during shutdown:'), err);
    process.exit(1);
  }
});
