import { Api } from './api';
import {
    AudioResource,
    createAudioResource,
    StreamType
} from '@discordjs/voice';
import useGTATunesSDK from './useGTATunesSDK';
import { Readable } from 'stream';
import { Player, usePlayerManager } from './GTATunesPlayer';
import { FFmpeg, opus } from 'prism-media';
import useEnv from '../env';
import GTA_COLORS from './GTAColors';
import {
    Client,
    ClientEvents,
    HexColorString,
    Interaction,
    MessageFlags
} from 'discord.js';
import { GTATunesEmoji } from './enums';
import moment from 'moment';
import { readdirSync } from 'fs';
import path from 'path';
import { ClientEventName } from '../Events/EventHandler';

export type PossiblyAsync<T> = T | Promise<T>;

export async function convertSongToAudioResource<Game extends Api.GameKey>(
    player: Player,
    station: Api.Station<Game, boolean, boolean>,
    song: Api.Song<Game>,
    options?: {
        start?: number;
    }
): Promise<[AudioResource, string, number | null]> {
    const gtaTunes = useGTATunesSDK();

    let songUrl: string;

    if (station.game_key === 'sa') {
        const djsEnabled = player.settings.getOption('enableDjs');

        songUrl = gtaTunes.createAudioUrl<'sa'>(
            station.game_key,
            station.key as Api.SAStationKey,
            song as Api.Song<'sa'>,
            {
                intro: djsEnabled ? 'random' : 0,
                outro: djsEnabled ? 'random' : 0
            }
        );
    } else {
        songUrl = gtaTunes.createAudioUrl(
            station.game_key,
            station.key,
            song,
            undefined
        );
    }

    const duration = await getSongDuration(songUrl).catch(e => {
        console.error(
            `Failed to get duration from song ${song.name} from ${song.station_key} (${songUrl})`,
            e
        );
        return null;
    });

    return [
        createAudioResource(await songToOpus(songUrl, options?.start ?? 0), {
            inputType: StreamType.Opus
        }),
        songUrl,
        duration
    ];
}

export async function songToOpus(
    songUrl: string,
    startTime: number = 0
): Promise<opus.Encoder> {
    const gtaTunes = useGTATunesSDK();
    const res = await gtaTunes.fetch(songUrl).catch(catchResponseError);

    if (!res.ok || !res.body) {
        throw new Error(`Failed to fetch GTATunes audio. ${songUrl}`);
    }

    // @ts-ignore
    const audioStream = Readable.fromWeb(res.body);

    const s16leEncoder = new FFmpeg({
        args: [
            '-analyzeduration',
            '0',
            '-loglevel',
            '0',
            '-f',
            's16le',
            '-ar',
            '48000',
            '-ac',
            '2',
            '-ss',
            startTime.toString()
        ]
    });

    audioStream.pipe(s16leEncoder);
    const opusEncoder = s16leEncoder.pipe(
        new opus.Encoder({ rate: 48000, channels: 2, frameSize: 960 })
    );

    return opusEncoder;
}

export async function getSongDuration(songUrl: string): Promise<number> {
    const gtaTunes = useGTATunesSDK();
    const res = await gtaTunes
        .fetch(songUrl, undefined, {
            headers: {
                Range: 'bytes=0-1'
            }
        })
        .catch(catchResponseError);

    if (!res.ok || !res.body) {
        throw new Error(`Failed to fetch GTATunes audio. ${songUrl}`);
    }

    const durationHeader = res.headers.get('x-duration');

    if (!durationHeader) {
        throw new Error('No x-duration header found in the response.');
    }

    const duration = parseFloat(durationHeader);

    if (isNaN(duration)) {
        throw new Error('Invalid x-duration header provided in response.');
    }

    return duration;
}

export function fullGTATunesUrl(path: string, query?: object): string {
    const gtaTunes = useGTATunesSDK();

    return gtaTunes.buildUrl(path, query, true);
}

export function chunkArray<T extends any[]>(array: T, size: number): [T] {
    return Array.from({ length: Math.ceil(array.length / size) }, (_, i) =>
        array.slice(i * size, i * size + size)
    ) as [T];
}

export function getGameStationColors<Game extends Api.GameKey>(
    game: Game,
    station: Api.StationKeys[Game]
): HexColorString[] {
    return GTA_COLORS[game][station] as HexColorString[];
}

const formattedGameNameMap: Record<Api.GameKey, string> = {
    iii: 'GTA III',
    sa: 'GTA San Andreas',
    vc: 'GTA Vice City',
    iv: 'GTA IV'
};

export function formatGameKey(game: Api.GameKey): string {
    return formattedGameNameMap[game];
}

export function randomNumber(max: number, min: number = 0) {
    return Math.floor(Math.random() * (max - min) + min);
}

export function randomArrayItem<T>(array: T[]): T {
    if (array.length === 0) {
        throw new Error('Cannot get a random item from an empty array');
    }

    return array[randomNumber(array.length - 1)];
}

let client: Client<true>;

export function setClient(c: Client<true>): void {
    client = c;
}

export function useClient(): Client<true> {
    if (!client) {
        throw new Error('Client has not been set yet.');
    }

    return client;
}

export function emojiMd(emoji: GTATunesEmoji): string {
    return `<:${getEmojiName(emoji)}:${emoji}>`;
}

export function getEmojiName(emoji: GTATunesEmoji): string {
    return Object.entries(GTATunesEmoji)
        .find(v => v[1] === emoji)![1]
        .toLowerCase();
}

export function getGameEmoji(game: Api.GameKey): GTATunesEmoji {
    const emojiMap: Record<Api.GameKey, GTATunesEmoji> = {
        iii: GTATunesEmoji.GTA_III,
        vc: GTATunesEmoji.GTA_VC,
        sa: GTATunesEmoji.GTA_SA,
        iv: GTATunesEmoji.GTA_IV
    };

    return emojiMap[game];
}

export function getStationEmoji<Game extends Api.GameKey>(
    game: Game,
    station: Api.StationKeys[Game]
): GTATunesEmoji {
    const emojiKey = `${game.toUpperCase()}_${station.toString().toUpperCase()}_ICON`;
    const emoji = GTATunesEmoji[emojiKey as keyof typeof GTATunesEmoji];

    return emoji;
}

export async function requireActivePlayer(
    interaction: Interaction
): Promise<Player | null> {
    if (!interaction.guild) {
        if (interaction.isRepliable()) {
            await interaction.reply({
                content: 'You cannot perform this action outside of a guild.',
                flags: MessageFlags.Ephemeral
            });
        }

        return null;
    }

    const playerManager = usePlayerManager();
    const player = playerManager.getPlayer(interaction.guild);

    if (!player) {
        if (interaction.isRepliable()) {
            await interaction.reply({
                content: 'No active player in this guild.',
                flags: MessageFlags.Ephemeral
            });
        }

        return null;
    }

    return player;
}

export function createLines(...lines: (string | null)[]): string {
    return lines.filter(l => l !== null).join('\n');
}

/**
 * @param timestamp in seconds
 */
export function formatTimestamp(timestamp: number): string {
    return moment
        .utc(moment.duration(timestamp, 'seconds').asMilliseconds())
        .format('mm:ss');
}

let _projectRoot: string;

export function projectRoot(paths: string[] = []): string {
    if (_projectRoot) {
        return _projectRoot;
    }

    const files = readdirSync(path.join(process.cwd(), ...paths));

    if (paths.length > 10) {
        throw new Error('Unable to find project root');
    }

    if (!files.includes('.env')) {
        return projectRoot([...paths, '..']);
    }

    return (_projectRoot = path.join(process.cwd(), ...paths));
}

export function resolveProjectFile(...paths: string[]): string {
    return path.resolve(projectRoot(), ...paths);
}

export function unix(): number {
    return moment().unix();
}

export function runningInDevMode(): boolean {
    return useEnv().DEV === '1';
}

export function catchResponseError(e: any): Response {
    if (e instanceof Response) {
        return e;
    }

    throw e;
}

export type DiscordEventHandler<Event extends ClientEventName> = (
    ...args: ClientEvents[Event]
) => any;

/**
 * @returns a function to remove the event listener
 */
export function registerDiscordEvent<Event extends ClientEventName>(
    event: Event,
    handler: DiscordEventHandler<Event>
): () => void {
    const client = useClient();

    client.on(event, handler);

    return () => {
        client.removeListener(event, handler);
    };
}
