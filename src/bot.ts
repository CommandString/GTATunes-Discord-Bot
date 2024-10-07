import {Client, GatewayIntentBits} from 'discord.js';
import dotenv from "dotenv";
import EventHandler from "./Events/EventHandler";
import InteractionCreate from "./Events/InteractionCreate";
import Ready from "./Events/Ready";
import {InteractionHandler} from "./Commands/InteractionHandler";
import PingCommand from "./Commands/Ping";
import {PlayCommand, PlayCommandSongAutocomplete, PlayCommandStationAutocomplete} from "./Commands/Play";

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildVoiceStates] });

dotenv.config({
    'path': './.env'
});

const EVENT_HANDLERS: EventHandler[] = [
    new InteractionCreate,
    new Ready
];

export const INTERACTION_HANDLERS: InteractionHandler[] = [
    new PingCommand,
    new PlayCommand,
    new PlayCommandStationAutocomplete,
    new PlayCommandSongAutocomplete
];

for (let handler of EVENT_HANDLERS) {
    client.on(handler.event, async (...args) => {
        try {
            await handler.handle(...args)
        } catch (e) {
            console.error(e);
        }
    });
}

client.login(process.env.TOKEN!).catch(() => {
    console.error('Failed to login');
    process.exit(1);
});

export default client;
