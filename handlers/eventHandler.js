const fs = require('fs');
const path = require('path');

module.exports = (client) => {
  const eventsPath = path.join(__dirname, '../events');
  let count = 0;

  const loadEvents = (dir) => {
    const files = fs.readdirSync(dir);

    files.forEach((file) => {
      const filePath = path.join(dir, file);
      const stat = fs.lstatSync(filePath);

      if (stat.isDirectory()) {
        if (file === 'lavalink') {
          const lavalinkFiles = fs.readdirSync(filePath);
          lavalinkFiles.forEach((lavalinkFile) => {
            if (lavalinkFile.endsWith('.js')) {
              try {
                const event = require(path.join(filePath, lavalinkFile));

                if (!event.name) {
                  console.warn(
                    global.styles.warningColor(
                      `⚠️  Lavalink event ${lavalinkFile} is missing 'name' property`
                    )
                  );
                  return;
                }

                if (event.isNodeEvent) {
                  client.lavalink.nodeManager.on(event.name, (...args) =>
                    event.execute(client, ...args)
                  );
                } else {
                  client.lavalink.on(event.name, (...args) =>
                    event.execute(client, ...args)
                  );
                }
                count++;
              } catch (error) {
                console.error(
                  global.styles.errorColor(
                    `❌ Error loading lavalink event ${lavalinkFile}: ${error.message}`
                  )
                );
              }
            }
          });
        } else {
          loadEvents(filePath);
        }
      } else if (file.endsWith('.js')) {
        try {
          const event = require(filePath);

          if (!event.name) {
            console.warn(
              global.styles.warningColor(
                `⚠️  Event ${file} is missing 'name' property`
              )
            );
            return;
          }

          if (event.once) {
            client.once(event.name, (...args) => event.execute(...args));
          } else {
            client.on(event.name, (...args) => event.execute(...args));
          }
          count++;
        } catch (error) {
          console.error(
            global.styles.errorColor(
              `❌ Error loading event ${file}: ${error.message}`
            )
          );
        }
      }
    });
  };

  loadEvents(eventsPath);

  console.log(
    global.styles.successColor(`✅ Successfully loaded ${count} events`)
  );
};
