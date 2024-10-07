import {PingConfig} from "./Commands/Ping";
import { REST, Routes } from 'discord.js';
import dotenv from "dotenv";
import {PlayConfig} from "./Commands/Play";
import {StationsConfig} from "./Commands/Stations";

dotenv.config({
    'path': './.env'
});

const rest = new REST({ version: '10' }).setToken(process.env.TOKEN!);

(async () => {
    const commands = [PingConfig, PlayConfig, await StationsConfig()];

    try {
        console.log('Started refreshing application (/) commands.');

        await rest.put(Routes.applicationCommands(process.env.ID!), { body: commands });

        console.log('Successfully reloaded application (/) commands.');
        console.log('Commands registered:', commands.map(command => command.name).join(', '))
    } catch (error) {
        console.error(error);
    }
})();
