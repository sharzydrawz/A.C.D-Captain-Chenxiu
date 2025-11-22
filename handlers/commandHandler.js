const fs = require('fs');
const path = require('path');
module.exports = (client) => {
  client.commands = new Map();

  const commandsPath = path.join(__dirname, '../commands');
  let commandCount = 0;
  let categoryCount = 0;

  const categories = fs.readdirSync(commandsPath);
  categoryCount = categories.length;

  categories.forEach((category) => {
    const categoryPath = path.join(commandsPath, category);

    // Check if it's a directory
    if (!fs.statSync(categoryPath).isDirectory()) {
      return;
    }

    const commandFiles = fs
      .readdirSync(categoryPath)
      .filter((file) => file.endsWith('.js'));

    for (const file of commandFiles) {
      try {
        const command = require(path.join(categoryPath, file));

        // Validate command structure
        if (!command.data || !command.execute) {
          console.warn(
            global.styles.warningColor(
              `⚠️  Command ${file} is missing required 'data' or 'execute' property`
            )
          );
          continue;
        }

        client.commands.set(command.data.name, { ...command, category });
        commandCount++;
      } catch (error) {
        console.error(
          global.styles.errorColor(
            `❌ Error loading command ${file}: ${error.message}`
          )
        );
      }
    }
  });

  console.log(
    global.styles.successColor(
      `✅ Loaded ${commandCount} commands across ${categoryCount} categories.`
    )
  );
};

