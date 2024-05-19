const { Client, IntentsBitField, Events, Collection  } = require("discord.js");
const path = require('path');
const fs = require('fs');
const { logInfo, logError, executeQuery } = require('./util');

const botIntents = new IntentsBitField();
botIntents.add(
    IntentsBitField.Flags.Guilds,
    IntentsBitField.Flags.GuildMessages,
);
const client = new Client({ intents: [botIntents] });

client.once(Events.ClientReady, async () => {
    logInfo(`${client.user.tag} successfully started.`);
});

client.commands = new Collection();
const commandsPath = path.join(__dirname, 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));
for (const file of commandFiles) {
    const filePath = path.join(commandsPath, file);
    const command = require(filePath);
    
    if ('data' in command && 'execute' in command) {
        client.commands.set(command.data.name, command);
    } else {
        logError(`The command at ${filePath} is missing a required "data" or "execute" property.`);
    }
}

client.on(Events.InteractionCreate, async interaction => {
	if (!interaction.isChatInputCommand()) return;

	const command = interaction.client.commands.get(interaction.commandName);

	if (!command) {
		logError(`No command matching ${interaction.commandName} was found.`);
		return;
	}

	try {
		await command.execute(interaction);
	} catch (error) {
		logError(error);
		if (interaction.replied || interaction.deferred) {
			await interaction.followUp({ content: 'There was an error while executing this command!', ephemeral: true });
		} else {
			await interaction.reply({ content: 'There was an error while executing this command!', ephemeral: true });
		}
	}
});

const yappingChannels = ["1241029518467141784"] // TODO: Make this configurable via command
client.on(Events.MessageCreate, async (message) => {
    if (message.author.bot) return;
    if (!yappingChannels.includes(message.channel.id)) return;

    const query = 'INSERT INTO messages(userId, serverId, channelId, timestamp) VALUES($1, $2, $3, $4)';
    const values = [message.author.id, message.guild.id, message.channel.id, new Date(message.createdTimestamp)];

    try {
        await executeQuery(query, values);
        logInfo(`Message from ${message.author.tag} in ${message.guild.name}:${message.channel.name} logged.`);
    } catch (err) {
        logError("Error inserting message: ", err.stack);
    }
});

if (!process.env.TOKEN) {
    console.error("Missing TOKEN environment variable, unable to continue");
    process.exit(1)
}

client.login(process.env.TOKEN);