import {
    resolveProjectFile,
    runningInDevMode,
    setClient,
    unix,
    useClient
} from '../Core/functions';
import {
    Player,
    PlayerAutosaveState,
    usePlayerManager
} from '../Core/GTATunesPlayer';
import { gtaTunesLog } from '../Core/logger';
import EventHandler from './EventHandler';
import { ActivityType, Client } from 'discord.js';
import { writeFile, readFile, rm } from 'fs/promises';
import p from 'picocolors';

const PLAYER_AUTOSAVE_INTERVAL = 10; // in seconds
const PLAYER_AUTOSAVE_TTL = 5; // in minutes
const PLAYER_AUTOSAVE_FILEPATH = resolveProjectFile('player-states.json');

export type PlayerAutosaveFile = {
    states: PlayerAutosaveState[];
    saved_at: number;
};

export default class Ready extends EventHandler<'clientReady'> {
    readonly event = 'clientReady';

    async handle(client: Client<true>): Promise<void> {
        setClient(client);

        gtaTunesLog('INFO', p.green('READY'));

        client.user.setPresence({
            activities: [
                {
                    type: ActivityType.Listening,
                    name: 'GTATunes',
                    url: 'https://gtatunes.net'
                }
            ]
        });

        await this.attemptToRestoreAutosave();
        this.startPlayerAutosave();
    }

    private async attemptToRestoreAutosave(): Promise<void> {
        const playerAutosavesContents = await readFile(
            PLAYER_AUTOSAVE_FILEPATH,
            {
                encoding: 'utf-8'
            }
        ).catch(() => null);

        if (playerAutosavesContents === null) {
            return;
        }

        gtaTunesLog('INFO', 'Found autosave...attempting to parse.');
        await rm(PLAYER_AUTOSAVE_FILEPATH).catch(() => null);

        let playerAutosaves: PlayerAutosaveFile;

        try {
            playerAutosaves = JSON.parse(playerAutosavesContents);
        } catch (e) {
            gtaTunesLog('FAIL', 'Failed to parse player autosaves file.', e);
            return;
        }

        if (unix() - playerAutosaves.saved_at > PLAYER_AUTOSAVE_TTL * 60000) {
            gtaTunesLog('INFO', 'Player autosaves are too old.');
            return;
        }

        await this.restorePlayerStates(playerAutosaves.states);
    }

    private async restorePlayerStates(
        states: PlayerAutosaveState[]
    ): Promise<void> {
        const client = useClient();

        for (const state of states) {
            const guild = await client.guilds
                .fetch(state.guild)
                .catch(() => null);

            if (!guild) {
                continue;
            }

            const voiceChannel = await guild.channels
                .fetch(state.voiceChannel)
                .catch(() => null);

            if (
                !voiceChannel ||
                !voiceChannel.isVoiceBased() ||
                voiceChannel.members.filter(m => !m.user.bot).size === 0
            ) {
                continue;
            }

            const owner = await guild.members
                .fetch(state.owner)
                .catch(() => null);

            if (!owner) {
                continue;
            }

            const player = await Player.create(
                guild,
                voiceChannel,
                state.owner
            );

            if (!state.playback) {
                return;
            }

            await player.playSong(state.playback.song);

            if (state.playback.timestamp > 10) {
                await player.seek(state.playback.timestamp / 1000);
            }

            if (state.playback.paused) {
                setTimeout(() => {
                    try {
                        player.pause();
                    } catch (e) {
                        gtaTunesLog(
                            'PLAYER',
                            `Failed to pause restored player`,
                            e
                        );
                    }
                }, 2000);
            }

            if (state.messageControllers.length > 0) {
                for (const [channelId, messageId] of state.messageControllers) {
                    const channel = await guild.channels
                        .fetch(channelId)
                        .catch(() => null);

                    if (!channel || !channel.isSendable()) {
                        continue;
                    }

                    const message = await channel.messages
                        .fetch(messageId)
                        .catch(() => null);

                    if (!message) {
                        return;
                    }

                    player.messageController.addMessage(message);
                }
            }
        }
    }

    private startPlayerAutosave(): void {
        let cacheFileExists = false;

        setInterval(async () => {
            const playerManager = usePlayerManager();
            const players = playerManager.getPlayers();

            if (players.length === 0) {
                if (cacheFileExists) {
                    await rm(PLAYER_AUTOSAVE_FILEPATH).catch(null);
                    cacheFileExists = false;
                }

                return;
            }

            const states: PlayerAutosaveFile = {
                states: players.map(p => p.getState()),
                saved_at: unix()
            };

            await writeFile(
                PLAYER_AUTOSAVE_FILEPATH,
                JSON.stringify(states, null, runningInDevMode() ? 4 : undefined)
            )
                .then(() => {
                    cacheFileExists = true;
                })
                .catch(e => {
                    gtaTunesLog('FAIL', 'Failed to autosave players', e);
                });
        }, PLAYER_AUTOSAVE_INTERVAL * 1000);
    }
}
