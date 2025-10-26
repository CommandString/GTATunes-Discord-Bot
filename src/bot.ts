import { Client, GatewayIntentBits } from 'discord.js';
import EventHandler, { ClientEventName } from './Events/EventHandler';
import InteractionCreate from './Events/InteractionCreate';
import Ready from './Events/Ready';
import { InteractionHandler } from './Commands/InteractionHandler';
import {
    PlayCommand,
    PlayCommandSongAutocomplete,
    PlayCommandStationAutocomplete
} from './Commands/Play';
import useEnv from './env';
import { setGTATunesSDK } from './Core/useGTATunesSDK';
import GTATunesSDK from './Core/GTATunesSDK';
import { VersionCommand } from './Commands/Version';
import { PlayerCommand } from './Commands/Player';
import StationsCommand from './Commands/Stations';
import { InfoCommand } from './Commands/Info';
import {
    MessageControllerInteractionHandler,
    MessageControllerChannelMessageTracker
} from './Core/GTATunesMessageControllers';
import { SettingsModalHandler } from './Core/GTATunesPlayer';
import { figletText } from './Core/logger';
import p from 'picocolors';
import { runningInDevMode } from './Core/functions';
import { gtaTunesLog } from './Core/logger';
import PlayInteractionHandler from './Interactions/PlayInteractionHandler';

const { dim, red, green, yellow } = p;

export const INTERACTION_HANDLERS: InteractionHandler[] = [
    new PlayCommand(),
    new PlayCommandStationAutocomplete(),
    new PlayCommandSongAutocomplete(),
    new VersionCommand(),
    new PlayerCommand(),
    new StationsCommand(),
    new InfoCommand(),
    new MessageControllerInteractionHandler(),
    new SettingsModalHandler(),
    new PlayInteractionHandler()
];

const EVENT_HANDLERS: EventHandler<ClientEventName>[] = [
    new InteractionCreate(),
    new Ready(),
    new MessageControllerChannelMessageTracker()
];

(async () => {
    console.log(red(await figletText('GTATunes Bot', { font: 'Speed' })));
    console.log(
        `${dim(`v1.0.0`)} - ${runningInDevMode() ? yellow('DEV') : green('PROD')}`
    );

    const client = new Client({
        intents: [
            GatewayIntentBits.Guilds,
            GatewayIntentBits.GuildVoiceStates,
            GatewayIntentBits.GuildMessages
        ]
    });
    const env = useEnv();

    for (const handler of EVENT_HANDLERS) {
        gtaTunesLog(
            'DISCORD',
            `${p.dim(`Listening for`)} ${p.green(handler.event)} ${p.dim('event.')}`
        );
        client.on(handler.event, async (...args) => {
            try {
                await handler.handle(...args);
            } catch (e) {
                gtaTunesLog(
                    'FAIL',
                    `Failed to handle discord event, ${p.magenta(handler.event)}.\n`,
                    e
                );
            }
        });
    }

    setGTATunesSDK(new GTATunesSDK(env.GTATUNES_HOST));

    client.login(env.TOKEN).catch(e => {
        gtaTunesLog('CRIT', 'Failed to login', e);
    });
})().catch(e => {
    gtaTunesLog('CRIT', 'Failed to run startup...\n', e);
});

process.addListener('unhandledRejection', (e, origin) => {
    gtaTunesLog('FAIL', origin, e);
});

process.addListener('uncaughtException', (e, origin) => {
    gtaTunesLog('FAIL', origin, e);
});
