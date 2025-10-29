import {
    AudioPlayer,
    AudioPlayerStatus,
    AudioResource,
    createAudioPlayer,
    createAudioResource,
    getVoiceConnection,
    joinVoiceChannel,
    StreamType,
    VoiceConnection,
    VoiceConnectionStatus
} from '@discordjs/voice';
import EventEmitter from './EventEmitter';
import {
    convertSongToAudioResource,
    PossiblyAsync,
    randomArrayItem,
    randomNumber,
    registerDiscordEvent,
    requireActivePlayer,
    songToOpus
} from './functions';
import {
    ComponentType,
    Guild,
    Interaction,
    InteractionReplyOptions,
    LabelBuilder,
    Message,
    MessageCreateOptions,
    MessageFlags,
    MessagePayload,
    ModalBuilder,
    ModalData,
    ModalSubmitInteraction,
    User,
    VoiceBasedChannel
} from 'discord.js';
import { Api } from './api';
import useGTATunesSDK from './useGTATunesSDK';
import { Readable } from 'stream';
import {
    MessageController,
    MessageInformation
} from './GTATunesMessageControllers';
import { InteractionHandler } from '../Commands/InteractionHandler';
import { gtaTunesLog } from './logger';
import p from 'picocolors';

export type PlayerEventMap = {
    resumed: () => PossiblyAsync<void>;
    paused: () => PossiblyAsync<void>;
    play: <Game extends Api.GameKey>(
        station: Api.Station<Game, true, false>,
        song: Api.Song<Game>
    ) => PossiblyAsync<void>;
    ended: () => PossiblyAsync<void>;
    destroyed: () => PossiblyAsync<void>;
    seeked: (timestamp: number) => PossiblyAsync<void>;
};

export type PlayerManagerEventMap = {
    create: (player: Player) => PossiblyAsync<void>;
    destroy: (player: Player) => PossiblyAsync<void>;
};

let playerManager: PlayerManager | null = null;

export function usePlayerManager(): PlayerManager {
    playerManager ??= new PlayerManager();

    return playerManager;
}

export class PlayerManager extends EventEmitter<PlayerManagerEventMap> {
    protected players: Player[] = [];

    getPlayer(guild: Guild | string): Player | null {
        guild = typeof guild === 'string' ? guild : guild.id;

        return this.players.find(p => p.guild.id === guild) ?? null;
    }

    addPlayer(player: Player): void {
        const existingGuildPlayer = this.getPlayer(player.guild);

        if (existingGuildPlayer) {
            existingGuildPlayer.destroy();
            this.players = this.players.filter(
                p => p.guild.id !== player.guild.id
            );
        }

        player.on('destroyed', () => {
            const playerIndex = this.players.findIndex(p => p === player);

            if (!playerIndex) {
                console.warn('Player already removed?');
            }

            this.players = this.players.filter(
                p => p.guild.id !== player.guild.id
            );
            this.emit('destroy', player);
        });

        this.players.push(player);
    }

    getPlayers(): Player[] {
        return [...this.players];
    }

    get runningGuilds(): string[] {
        return this.players.map(p => p.guild.id);
    }
}

export class Player extends EventEmitter<PlayerEventMap> {
    public readonly settings: PlayerSettings;
    public readonly messageController: MessageController;
    private _currentStation: Api.Station<Api.GameKey, true, false> | null =
        null;
    private _currentSong: Api.Song<Api.GameKey> | null = null;
    private _currentSongUrl: string | null = null;
    private _currentSongDuration: number | null = null;
    private _currentSeeked: number = 0;
    private destroying: boolean = false;
    private locked: boolean = false;
    private autoplay: boolean = false;

    constructor(
        protected connection: VoiceConnection,
        protected readonly player: AudioPlayer,
        public readonly guild: Guild,
        public readonly voiceChannel: VoiceBasedChannel,
        public readonly owner: User
    ) {
        super();

        this.settings = new PlayerSettings();
        this.messageController = new MessageController(this);
        this.setupEvents();

        const c = p.magenta;

        gtaTunesLog(
            'PLAYER',
            `Created in ${c(guild.name)} [${c(guild.id)}, ${c(voiceChannel.id)}]`
        );
    }

    protected get resource(): AudioResource | null {
        const status = this.player.state.status;

        if (status === AudioPlayerStatus.Idle) {
            return null;
        }

        return this.player.state.resource ?? null;
    }

    private setupEvents(): void {
        const handleEventError = (eventName: string) => (e: any) =>
            console.error(
                `Failed to handle GTATunes player "${eventName}" event.`,
                e
            );

        let emptyTimeout: NodeJS.Timeout | null = null;
        let emptyWarnings: Message<true>[] = [];
        const deleteWarnings = () => {
            if (emptyWarnings.length === 0) {
                return;
            }

            Promise.all(emptyWarnings.map(m => m.delete().catch(() => {})));
            emptyWarnings = [];
        };
        const EMPTY_TTL = 60; // in seconds;

        const discordEventListeners = [
            registerDiscordEvent('channelDelete', async channel => {
                if (!this.alive || channel.id !== this.voiceChannel.id) {
                    return;
                }

                if (emptyTimeout) {
                    clearTimeout(emptyTimeout);
                }

                this.destroy();
            }),
            registerDiscordEvent(
                'voiceStateUpdate',
                async (oldState, newState) => {
                    if (!this.alive) {
                        return;
                    }

                    const leftChannel = oldState.channel;
                    const joinedChannel = newState.channel;

                    if (
                        leftChannel?.id !== this.voiceChannel.id &&
                        joinedChannel?.id !== this.voiceChannel.id
                    )
                        return;

                    const channel = this.voiceChannel;
                    const nonBotMembers = channel.members.filter(
                        m => !m.user.bot
                    );

                    if (nonBotMembers.size === 0) {
                        if (emptyTimeout) return; // already waiting

                        gtaTunesLog(
                            'PLAYER',
                            `Voice channel ${p.magenta(channel.id)} is empty — ${p.yellow(`waiting ${EMPTY_TTL}s before destroying`)}.`
                        );

                        emptyTimeout = setTimeout(() => {
                            gtaTunesLog(
                                'PLAYER',
                                `No users rejoined ${p.magenta(channel.id)} within ${EMPTY_TTL}s — ${p.red('destroying player')}.`
                            );
                            this.destroy();
                            emptyTimeout = null;
                            deleteWarnings();
                        }, EMPTY_TTL * 1000);

                        const warningMessage = await this.voiceChannel
                            .send({
                                content: `<#${this.voiceChannel.id}> is empty, if no one joins within **${EMPTY_TTL} seconds** the player will be destroyed.`
                            })
                            .catch(e => {
                                gtaTunesLog(
                                    'WARN',
                                    `Failed to send empty voice channel warning message in ${p.magenta(this.guild.name)} (${p.bold(this.guild.id)})\n`,
                                    e
                                );
                                return null;
                            });

                        if (warningMessage !== null) {
                            emptyWarnings.push(warningMessage);
                        }
                    } else if (emptyTimeout) {
                        clearTimeout(emptyTimeout);
                        emptyTimeout = null;
                        gtaTunesLog(
                            'PLAYER',
                            `User rejoined ${p.magenta(channel.id)} — ${p.green('canceling destroy timeout')}.`
                        );
                        deleteWarnings();
                    }
                }
            )
        ];

        this.on('destroyed', () => {
            for (const removeEventListener of discordEventListeners) {
                removeEventListener();
            }
        });

        this.player.on('stateChange', (oldState, newState) => {
            if (
                oldState.status === AudioPlayerStatus.Playing &&
                newState.status === AudioPlayerStatus.Idle
            ) {
                this.emit('ended').catch(handleEventError('ended'));
            }
        });

        this.connection.on('stateChange', (oldState, newState) => {
            if (
                newState.status === VoiceConnectionStatus.Disconnected &&
                this.alive
            ) {
                this.destroy();
            }
        });

        this.on('ended', async () => {
            if (!this.currentStation || !this.autoplay) {
                return;
            }

            await this.playSong('next');
        });

        this.on('play', () => {
            this.autoplay = true;
        });
    }

    protected emit<K extends keyof PlayerEventMap>(
        event: K,
        ...args: Parameters<PlayerEventMap[K]>
    ): Promise<ReturnType<PlayerEventMap[K]>[]> {
        gtaTunesLog(
            'PLAYER',
            `${p.magenta(event.toUpperCase())} event emitted in ${p.magenta(this.guild.name)} (${p.magenta(this.guild.id)}).`
        );

        return super.emit(event, ...args);
    }

    get alive(): boolean {
        return (
            this.connection.state.status !== VoiceConnectionStatus.Destroyed &&
            !this.destroying
        );
    }

    get isLocked(): boolean {
        return this.locked;
    }

    get currentGame(): Api.GameKey | null {
        return this.currentStation?.game_key ?? null;
    }

    destroy(): void {
        if (!this.alive) {
            return;
        }

        this.destroying = true;
        this.stop(true);
        this.connection.destroy();
        this.emit('destroyed').catch(e =>
            gtaTunesLog(
                'FAIL',
                'Failed to emit GTATunes player destroyed event.',
                e
            )
        );
    }

    stop(reset: boolean = false): void {
        if (reset) {
            this._currentSong =
                this._currentSongDuration =
                this._currentStation =
                this._currentSongUrl =
                    null;
            this._currentSeeked = 0;
        }

        this.autoplay = false;
        this.player.stop();
    }

    pause(): boolean {
        const success = this.player.pause(true);

        if (success) {
            this.emit('paused').catch(e =>
                console.error(
                    'Failed to handle GTATunes player paused event.',
                    e
                )
            );
        }

        return success;
    }

    resume(): boolean {
        const success = this.player.unpause();

        if (success) {
            this.emit('resumed').catch(e =>
                console.error(
                    'Failed to handle GTATunes player resumed event.',
                    e
                )
            );
        }

        return success;
    }

    async playSong<Game extends Api.GameKey>(
        song: Api.Song<Game> | 'next' | 'previous',
        station?: Api.Station<Game, true, false>
    ): Promise<void> {
        if (this.resource) {
            this.stop();
        }

        if (
            typeof song !== 'string' &&
            (!station || !songBelongToStation(song, station)) &&
            (!this.currentStation ||
                !songBelongToStation(song, this.currentStation))
        ) {
            station = await useGTATunesSDK().getStation<
                Game,
                Api.StationKeys[Game],
                true,
                false
            >(song.game_key, song.station_key, true, false);
        }

        if (typeof song === 'string') {
            if (!this.currentStation) {
                throw new Error(
                    'There is must be a station playing to use next or previous.'
                );
            }

            const maxSongIndex = this.currentStation.songs.length - 1;
            const currentSongIndex = this.currentStation.songs.findIndex(
                s => s.name === this.currentSong!.name
            );
            let newSongIndex =
                song === 'next' ? currentSongIndex + 1 : currentSongIndex - 1;

            if (newSongIndex < 0) {
                newSongIndex = maxSongIndex;
            } else if (newSongIndex > maxSongIndex) {
                newSongIndex = 0;
            }

            song = this.currentStation.songs[newSongIndex] as Api.Song<Game>;
        }

        if (station) {
            this._currentStation = station;
        } else {
            station ??= this.currentStation as Api.Station<Game, true, false>;
        }

        const [resource, audioUrl, duration] = await convertSongToAudioResource(
            this,
            station,
            song
        );

        this.player.play(resource);

        this._currentSong = song;
        this._currentSongUrl = audioUrl;
        this._currentSongDuration = duration;
        this._currentSeeked = 0;

        await this.emit('play', station, song);
    }

    async playStation(
        station: Api.Station<Api.GameKey, true, boolean> | 'next' | 'previous'
    ): Promise<void> {
        if (typeof station === 'string') {
            if (!this.currentStation) {
                throw new Error(
                    'You cannot play the next or previous radio station when there is no radio station currently playing.'
                );
            }

            const gtaTunes = useGTATunesSDK();
            const gameStations = await gtaTunes.getGameStations(
                this.currentStation.game_key,
                true,
                false
            );
            const gameStationCount = gameStations.length - 1;

            const direction = station === 'next' ? 1 : -1;
            const currentStationIndex =
                gameStations.findIndex(
                    s => s.name === this.currentStation?.name
                ) ?? randomNumber(1, gameStationCount - 1);
            let newStationIndex = currentStationIndex + direction;

            if (newStationIndex < 0) {
                newStationIndex = gameStationCount;
            } else if (newStationIndex > gameStationCount) {
                newStationIndex = 0;
            }

            station = gameStations[newStationIndex];
        }

        await this.playSong(randomArrayItem(station.songs));
    }

    playStream(
        stream: Readable,
        type: StreamType = StreamType.Arbitrary
    ): void {
        if (this.player.state.status !== AudioPlayerStatus.Idle) {
            this.stop();
        }

        const newResource = createAudioResource(stream, {
            inputType: type
        });

        this.player.play(newResource);
    }

    sendMessage(
        options: string | MessagePayload | MessageCreateOptions
    ): Promise<Message<true>> {
        if (!this.voiceChannel.isSendable()) {
            throw new Error('This voice channel is not sendable.');
        }

        return this.voiceChannel.send(options);
    }

    async seek(timestamp: number): Promise<void> {
        if (this.player.state.status === AudioPlayerStatus.Idle) {
            throw new Error('The player is not in a seekable state.');
        }

        if (this.currentSongUrl === null) {
            throw new Error('No song is currently playing');
        }

        this._currentSeeked = timestamp;
        this.playStream(
            await songToOpus(this.currentSongUrl, timestamp),
            StreamType.Opus
        );
        this.autoplay = true;
        this.emit('seeked', timestamp).catch(e => () => {
            gtaTunesLog('FAIL', 'Failed to emit player seeked event', e);
        });
    }

    get isPaused(): boolean {
        return this.player.state.status === AudioPlayerStatus.Paused;
    }

    get isPlaying(): boolean {
        return this.player.state.status === AudioPlayerStatus.Playing;
    }

    get isBuffering(): boolean {
        return this.player.state.status === AudioPlayerStatus.Buffering;
    }

    get currentSongUrl(): string | null {
        return this._currentSongUrl;
    }

    get currentSongDuration(): number | null {
        return this._currentSongDuration;
    }

    get isPlayingSong(): boolean {
        return this.currentSongUrl !== null;
    }

    get currentStation(): Api.Station<Api.GameKey, true, false> | null {
        if (!this._currentStation) {
            return null;
        }

        return { ...this._currentStation };
    }

    get currentSong(): Api.Song<Api.GameKey> | null {
        if (!this._currentSong) {
            return null;
        }

        return { ...this._currentSong };
    }

    /**
     * @returns timestamp in seconds
     */
    get currentTimestamp(): number | null {
        const timestamp = this.resource?.playbackDuration ?? null;

        if (timestamp === null) {
            return null;
        }

        return timestamp / 1000 + this._currentSeeked;
    }

    static create(
        guild: Guild,
        voiceChannel: VoiceBasedChannel,
        owner: User
    ): Promise<Player> {
        return new Promise((resolve, reject) => {
            const playerManager = usePlayerManager();
            const existingPlayerForGuild = playerManager.getPlayer(guild);

            if (existingPlayerForGuild) {
                return resolve(existingPlayerForGuild);
            }

            let connection = getVoiceConnection(guild.id);

            if (!connection) {
                connection = joinVoiceChannel({
                    channelId: voiceChannel.id,
                    guildId: guild.id,
                    adapterCreator: guild.voiceAdapterCreator
                });

                connection.on(VoiceConnectionStatus.Ready, async () => {
                    if (!connection) {
                        return reject('Connection no longer exists.');
                    }

                    const audioPlayer = createAudioPlayer();

                    connection.subscribe(audioPlayer);

                    const player = new Player(
                        connection,
                        audioPlayer,
                        guild,
                        voiceChannel,
                        owner
                    );

                    playerManager.addPlayer(player);

                    resolve(player);
                });

                return;
            }

            const audioPlayer = createAudioPlayer();
            connection.subscribe(audioPlayer);

            const player = new Player(
                connection,
                audioPlayer,
                guild,
                voiceChannel,
                owner
            );

            playerManager.addPlayer(player);

            resolve(player);
        });
    }

    static async createFromInteraction(
        interaction: Interaction
    ): Promise<Player | null> {
        const reply = (options: InteractionReplyOptions) => {
            if (!interaction.isRepliable()) {
                return;
            }

            return interaction.reply(options);
        };

        if (!interaction.guild) {
            return null;
        }

        const member = await interaction.guild.members.fetch(
            interaction.member!.user.id
        );

        if (!member) {
            await reply({
                content: 'Failed to fetch voice channel',
                flags: MessageFlags.Ephemeral
            });

            return null;
        }

        if (!member.voice.channel) {
            await reply({
                content: 'You must be in a voice channel to use this command',
                flags: MessageFlags.Ephemeral
            });

            return null;
        }

        return await Player.create(
            interaction.guild,
            member.voice.channel,
            member.user
        );
    }

    getState(): PlayerAutosaveState {
        return {
            guild: this.guild.id,
            voiceChannel: this.voiceChannel.id,
            owner: this.owner.id,
            authorized_users: [],
            messageControllers:
                this.messageController.getAllMessageInformation(),
            playback: this.currentSong
                ? {
                      song: this.currentSong,
                      timestamp: this.currentTimestamp ?? 0,
                      paused: this.isPaused
                  }
                : undefined,
            settings: this.settings.getAll()
        };
    }

    /**
     * Locks the player and executes the given action.
     *
     * @param action The action to execute while the player is locked.
     * @param interaction Optional Discord interaction for error handling.
     * @throws {LockedPlayerError} if the player is already locked and no interaction is provided.
     * @returns The result of the action or null if handled via interaction.
     */
    async lock(action: () => PossiblyAsync<void>, interaction?: Interaction): Promise<boolean> {
        if (this.locked) {
            gtaTunesLog('PLAYER', `Player in guild ${p.magenta(this.guild.name)} (${p.magenta(this.guild.id)}) is already locked.`);

            if (interaction) {
                await LockedPlayerError.handleInteraction(this, interaction);
                return false;
            }

            throw new LockedPlayerError(this);
        }

        gtaTunesLog('PLAYER', `Locking player in ${p.magenta(this.guild.name)} (${p.magenta(this.guild.id)}).`);
        this.locked = true;

        try {
            await action();
        } catch (e) {
            gtaTunesLog('PLAYER', `Unlocking player in ${p.magenta(this.guild.name)} (${p.magenta(this.guild.id)}).`);
            this.locked = false;
            throw e;
        }

        gtaTunesLog('PLAYER', `Unlocking player in ${p.magenta(this.guild.name)} (${p.magenta(this.guild.id)}).`);
        this.locked = false;

        return true;
    }
}

export class LockedPlayerError extends Error {
    constructor(player: Player) {
        super(
            `Player in guild ${player.guild.name} (${player.guild.id}) is currently locked.`
        );
    }

    static async handleInteraction(player: Player, interaction: Interaction): Promise<void> {
        if (!interaction.isRepliable()) {
            return;
        }

        await interaction.reply({
            content: 'The player is currently busy processing another action.',
            flags: MessageFlags.Ephemeral
        }).catch((e) => {
            gtaTunesLog('FAIL', `Failed to reply to interaction about locked player in ${p.magenta(player.guild.name)} (${p.magenta(player.guild.id)}).`, e);
        });
    }
}

export type Settings = {
    enableDjs: boolean;
    enableAdverts: boolean;
};

const DEFAULT_SETTINGS: Settings = {
    enableDjs: true,
    enableAdverts: true
};

type SettingsEventMap = {
    update: <K extends keyof Settings>(
        name: K,
        newValue: Settings[K],
        oldValue: Settings[K]
    ) => PossiblyAsync<void>;
    'bulk-update': (
        newOptions: Settings,
        oldOptions: Settings
    ) => PossiblyAsync<void>;
};

export class PlayerSettings extends EventEmitter<SettingsEventMap> {
    private options: Settings = { ...DEFAULT_SETTINGS };

    setOption<K extends keyof Settings>(key: K, value: Settings[K]): void {
        const oldValue = this.getOption(key);
        this.options[key] = value;
        this.emit('update', key, value, oldValue).catch(e =>
            console.error('Failed to emit update event in Options.', e)
        );
    }

    getOption<K extends keyof Settings>(key: K): Settings[K] {
        return this.options[key];
    }

    setAll(newOptions: Settings): void {
        const oldOptions = this.getAll();
        this.options = { ...newOptions };
        this.emit('bulk-update', this.getAll(), oldOptions).catch(e =>
            console.error('Failed to emit bulk-update event in Options.', e)
        );
    }

    getAll(): Settings {
        return { ...this.options };
    }

    createModal(): ModalBuilder {
        const createBooleanInput = (
            key: keyof Settings,
            label: string,
            description: string
        ): LabelBuilder => {
            const value = this.getOption(key);

            return new LabelBuilder({
                label,
                description,
                component: {
                    type: ComponentType.StringSelect,
                    placeholder: label,
                    custom_id: `${key}-boolean`,
                    required: true,
                    options: [
                        {
                            label: 'Enable',
                            value: '1',
                            default: value
                        },
                        {
                            label: 'Disable',
                            value: '0',
                            default: !value
                        }
                    ]
                }
            });
        };

        return new ModalBuilder({
            title: 'Player Settings',
            customId: 'modal-settings',
            components: [
                createBooleanInput(
                    'enableDjs',
                    'Toggle DJs',
                    'Control DJ intros, outros, and segments'
                ),
                createBooleanInput(
                    'enableAdverts',
                    'Toggle Advertisements',
                    'Control station advertisements.'
                )
            ]
        });
    }
}

export class SettingsModalHandler extends InteractionHandler {
    shouldHandle(interaction: Interaction): boolean {
        return (
            interaction.isModalSubmit() &&
            interaction.customId === 'modal-settings'
        );
    }

    async handle(interaction: ModalSubmitInteraction): Promise<void> {
        const player = await requireActivePlayer(interaction);

        if (!player) {
            return;
        }

        const keys = Object.keys(DEFAULT_SETTINGS) as (keyof Settings)[];
        const typeHandlers: Record<
            string,
            (key: keyof Settings, data: ModalData) => PossiblyAsync<void>
        > = {
            boolean: (key, data) => {
                if (data.type !== ComponentType.StringSelect) {
                    return;
                }

                const isTrue = data.values[0] === '1';

                player.settings.setOption(key, isTrue);
            }
        };

        for (const key of keys) {
            const field = interaction.fields.fields.find(f =>
                f.customId.startsWith(`${key}-`)
            );

            if (!field) {
                continue;
            }

            const type = field.customId.split('-')[1];
            const typeHandler = typeHandlers[type];

            if (!typeHandler) {
                continue;
            }

            await typeHandler(key, field);
        }

        await interaction.reply({
            content: 'Updated player settings.',
            flags: MessageFlags.Ephemeral
        });
    }
}

function songBelongToStation(
    song: Api.Song<Api.GameKey>,
    station: Api.Station<Api.GameKey, true, boolean>
): boolean {
    return (
        song.game_key === station.game_key && song.station_key === station.key
    );
}

export type PlayerAutosaveState = {
    guild: string;
    voiceChannel: string;
    owner: string;
    authorized_users: string[];
    playback?: {
        song: Api.Song<Api.GameKey>;
        timestamp: number;
        paused: boolean;
    };
    settings: Settings;
    messageControllers: MessageInformation[];
};
