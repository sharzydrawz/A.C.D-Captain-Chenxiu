const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { formatTime } = require('../../utils/utils');

const autocompleteMap = new Map();
const AUTOCOMPLETE_CACHE_TTL = 30000; // 30 seconds cache
const AUTOCOMPLETE_TIMEOUT = 2500; // 2.5 seconds max for autocomplete
const MAX_CACHE_SIZE = 100; // Maximum number of cached entries

// Clean up old cache entries periodically
setInterval(() => {
  const now = Date.now();
  for (const [key, value] of autocompleteMap.entries()) {
    if (now - value.timestamp > AUTOCOMPLETE_CACHE_TTL) {
      autocompleteMap.delete(key);
    }
  }

  // If cache is still too large, remove oldest entries
  if (autocompleteMap.size > MAX_CACHE_SIZE) {
    const entries = Array.from(autocompleteMap.entries());
    entries.sort((a, b) => a[1].timestamp - b[1].timestamp);
    const toRemove = entries.slice(0, autocompleteMap.size - MAX_CACHE_SIZE);
    toRemove.forEach(([key]) => autocompleteMap.delete(key));
  }
}, 60000); // Clean every minute


module.exports = {
  data: new SlashCommandBuilder()
    .setName('play')
    .setDescription('Play a song or playlist from different Sources')

    .addStringOption((option) =>
      option
        .setName('query')
        .setDescription('Song name or URL')
        .setRequired(true)
        .setAutocomplete(true)
    )
    .addStringOption((option) =>
      option
        .setName('source')
        .setDescription('The source you want to play the music from')
        .addChoices(
          { name: 'Youtube', value: 'ytsearch' },
          { name: 'Youtube Music', value: 'ytmsearch' },
          { name: 'Spotify', value: 'spsearch' },
          { name: 'Soundcloud', value: 'scsearch' },
          { name: 'Deezer', value: 'dzsearch' }
        )
    ),

  async autocomplete(interaction) {
    const startTime = Date.now();
    let responded = false;

    // Helper function to safely respond
    const safeRespond = async (options) => {
      if (responded) return;
      if (Date.now() - startTime > AUTOCOMPLETE_TIMEOUT) {
        console.warn('Autocomplete timeout - skipping response');
        return;
      }
      try {
        responded = true;
        await interaction.respond(options);
      } catch (error) {
        if (error.code !== 10062) {
          throw error;
        }
        // Silently ignore "Unknown interaction" errors
      }
    };

    try {
      const query = interaction.options.getFocused();
      const member = interaction.member;

      // Quick validation checks
      if (!member.voice.channel) {
        return await safeRespond([
          {
            name: '⚠️ Join a voice channel first!',
            value: 'join_vc',
          },
        ]);
      }

      if (!query.trim()) {
        return await safeRespond([
          {
            name: 'Start typing to search for songs...',
            value: 'start_typing',
          },
        ]);
      }

      // Check cache first
      const cacheKey = `${query.toLowerCase().trim()}`;
      const cached = autocompleteMap.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < AUTOCOMPLETE_CACHE_TTL) {
        return await safeRespond(cached.options);
      }

      const source = 'spsearch';

      // Get or create player
      let player = interaction.client.lavalink.players.get(interaction.guildId);
      if (!player) {
        player = interaction.client.lavalink.createPlayer({
          guildId: interaction.guildId,
          textChannelId: interaction.channelId,
          voiceChannelId: member.voice.channel.id,
          selfDeaf: true,
        });
      }

      // Race between search and timeout
      const searchPromise = player.search({ query, source });
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Search timeout')), AUTOCOMPLETE_TIMEOUT)
      );

      let results;
      try {
        results = await Promise.race([searchPromise, timeoutPromise]);
      } catch (timeoutError) {
        console.warn('Search timed out for autocomplete');
        return await safeRespond([
          { name: 'Search taking too long, try again...', value: 'timeout' },
        ]);
      }

      if (!results?.tracks?.length) {
        return await safeRespond([
          { name: 'No results found', value: 'no_results' },
        ]);
      }

      let options = [];

      if (results.loadType === 'playlist') {
        options = [
          {
            name: `📑 Playlist: ${results.playlist?.title || 'Unknown'} (${results.tracks.length} tracks)`.substring(0, 100),
            value: query,
          },
        ];
      } else {
        options = results.tracks.slice(0, 25).map((track) => ({
          name: `${track.info.title} - ${track.info.author}`.substring(0, 100),
          value: track.info.uri,
        }));
      }

      // Cache the results
      autocompleteMap.set(cacheKey, {
        options,
        timestamp: Date.now(),
      });

      return await safeRespond(options);
    } catch (error) {
      console.error('Autocomplete error:', error);
      // Only try to respond if we haven't already and it's not a timeout
      if (!responded && error.code !== 10062) {
        try {
          await safeRespond([
            { name: 'An error occurred', value: 'error' },
          ]);
        } catch (e) {
          // Ignore any errors from the error handler
        }
      }
    }
  },

  async execute(interaction) {
    const client = interaction.client;
    const query = interaction.options.getString('query');
    const member = interaction.member;
    const source = interaction.options.getString('source') || 'spsearch';

    if (query === 'join_vc' || query === 'start_typing' || query === 'error' || query === 'timeout') {
      return interaction.reply({
        content: '❌ Please join a voice channel and select a valid song!',
        ephemeral: true,
      });
    }

    if (query === 'no_results') {
      return interaction.reply({
        content: '❌ No results found! Try a different search term.',
        ephemeral: true,
      });
    }

    if (!member.voice.channel) {
      return interaction.reply({
        content: '❌ You need to join a voice channel first!',
        ephemeral: true,
      });
    }

    let player = client.lavalink.players.get(interaction.guild.id);
    if (!player) {
      player = client.lavalink.createPlayer({
        guildId: interaction.guild.id,
        voiceChannelId: member.voice.channel.id,
        textChannelId: interaction.channel.id,
        selfDeaf: true,
      });
    }
    await player.connect();

    await interaction.deferReply();

    let search;
    if (query.startsWith('playlist_')) {
      const actualQuery = query.replace('playlist_', '');
      search = await player.search({ query: actualQuery, source });
    } else {
      const isURL = query.startsWith('http://') || query.startsWith('https://');
      search = await player.search({ query, source });
    }

    if (!search?.tracks?.length) {
      return interaction.editReply({
        content: '❌ No results found! Try a different search term.',
        ephemeral: true,
      });
    }

    if (search.loadType === 'playlist') {
      for (const track of search.tracks) {
        track.userData = { requester: interaction.member };
        await player.queue.add(track);
      }

      const playlistEmbed = new EmbedBuilder()
        .setColor('#DDA0DD')
        .setAuthor({
          name: 'Added Playlist to Queue 📃',
          iconURL: client.user.displayAvatarURL(),
        })
        .setTitle(search.playlist?.title)
        .setThumbnail(search.tracks[0].info.artworkUrl)
        .setDescription(
          `Added \`${search.tracks.length}\` tracks from playlist\n\n` +
          `**First Track:** [${search.tracks[0].info.title}](${search.tracks[0].info.uri})\n` +
          `**Last Track:** [${search.tracks[search.tracks.length - 1].info.title}](${search.tracks[search.tracks.length - 1].info.uri})`
        )
        .addFields([
          {
            name: '👤 Playlist Author',
            value: `\`${search.tracks[0].info.author}\``,
            inline: true,
          },
          {
            name: '⌛ Total Duration',
            value: `\`${formatTime(search.tracks.reduce((acc, track) => acc + track.info.duration, 0))}\``,
            inline: true,
          },
        ])
        .setFooter({
          text: `Added by ${interaction.user.tag} • Queue position: #${player.queue.tracks.length - search.tracks.length + 1}`,
          iconURL: interaction.user.displayAvatarURL(),
        })
        .setTimestamp();

      if (!player.playing) {
        await player.play();
      }

      return interaction.editReply({ embeds: [playlistEmbed] });
    } else {
      const track = search.tracks[0];
      track.userData = { requester: interaction.member };
      await player.queue.add(track);

      const trackEmbed = new EmbedBuilder()
        .setColor('#DDA0DD')
        .setAuthor({
          name: 'Added to Queue 🎵',
          iconURL: client.user.displayAvatarURL(),
        })
        .setTitle(track.info.title)
        .setURL(track.info.uri)
        .setThumbnail(track.info.artworkUrl)
        .addFields([
          {
            name: '👤 Artist',
            value: `\`${track.info.author}\``,
            inline: true,
          },
          {
            name: '⌛ Duration',
            value: `\`${formatTime(track.info.duration)}\``,
            inline: true,
          },
          {
            name: '🎧 Position in Queue',
            value: `\`#${player.queue.tracks.length}\``,
            inline: true,
          },
        ])
        .setFooter({
          text: `Added by ${interaction.user.tag}`,
          iconURL: interaction.user.displayAvatarURL(),
        })
        .setTimestamp();

      if (!player.playing) {
        await player.play();
      }

      return interaction.editReply({ embeds: [trackEmbed] });
    }
  },
};
