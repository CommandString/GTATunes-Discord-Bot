import {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonInteraction,
    ButtonStyle,
    Channel,
    ContainerBuilder,
    GuildBasedChannel,
    Interaction,
    Message,
    MessageFlags,
    OmitPartialGroupDMChannel,
    SectionBuilder,
    TextChannel,
    TextDisplayBuilder,
    ThumbnailBuilder
} from 'discord.js';
import { InteractionHandler } from '../Commands/InteractionHandler';
import { Player, usePlayerManager } from './GTATunesPlayer';
import {
    fullGTATunesUrl,
    getGameStationColors,
    formatGameKey,
    useClient,
    emojiMd,
    getGameEmoji,
    createLines,
    formatTimestamp
} from './functions';
import { GTATunesEmoji } from './enums';
import EventHandler from '../Events/EventHandler';
import useGTATunesSDK from './useGTATunesSDK';
import { gtaTunesLog } from './logger';
import p from 'picocolors';

const MESSAGES_BEFORE_RESPAWN = 10;
const PROGRESS_BAR_CHECK = 5; // in seconds

/**
 * [channelId, messageId]
 */
export type MessageInformation = [string, string];

export class MessageController {
    private controllerMessages: MessageInformation[] = [];
    private lastUpdatedTimestamp = 0;
    private updateTimeout: NodeJS.Timeout | null = null;

    public constructor(public readonly player: Player) {
        this.setupEvents();
    }

    private setupEvents(): void {
        const playerEvent = this.player.on.bind(this.player);
        let updateMessagesTimeout: NodeJS.Timeout | null = null;
        const updateMessages = () => {
            if (updateMessagesTimeout) {
                clearTimeout(updateMessagesTimeout);
            }

            updateMessagesTimeout = setTimeout(async () => {
                await this.updateControllerMessages();
                updateMessagesTimeout = null;
            }, 1000);
        };

        const progressCheckInterval = setInterval(() => {
            if (!this.player.isPlaying) {
                return;
            }

            const currentTimestamp = this.player.currentTimestamp;

            if (
                currentTimestamp === null ||
                Math.abs(currentTimestamp - this.lastUpdatedTimestamp) < 5
            ) {
                return;
            }

            updateMessages();
        }, PROGRESS_BAR_CHECK * 1000);

        playerEvent('play', updateMessages);
        playerEvent('paused', updateMessages);
        playerEvent('resumed', updateMessages);
        playerEvent('destroyed', () => {
            this.destroyControllerMessages();
            clearInterval(progressCheckInterval);
        });
    }

    async destroyControllerMessages(): Promise<void> {
        if (this.controllerMessages.length === 0) {
            return;
        }

        await Promise.all(
            this.controllerMessages.map(this.deleteControllerMessage.bind(this))
        );

        this.controllerMessages = [];
    }

    async deleteControllerMessage(
        messageInfo: MessageInformation
    ): Promise<void> {
        const m = await this.getMessage(messageInfo);

        if (!m) {
            return;
        }

        this.controllerMessages = this.controllerMessages.filter(
            mi => mi[0] !== messageInfo[0]
        );
        await m.delete();
    }

    async updateControllerMessages(): Promise<void> {
        if (this.controllerMessages.length === 0) {
            return;
        }

        const container = this.createContainer();
        const timestamp = this.player.currentTimestamp;

        await Promise.all(
            this.controllerMessages.map(async messageInfo => {
                const m = await this.getMessage(messageInfo).catch(e => {
                    gtaTunesLog(
                        'WARN',
                        `Failed to get message controller ${p.magenta(messageInfo[1])} in ${p.magenta(this.player.guild.name)}.\n`,
                        e
                    );
                    this.controllerMessages = this.controllerMessages.filter(
                        mi => mi[1] !== messageInfo[1]
                    );
                    return null;
                });

                if (!m) {
                    return;
                }

                await m
                    .edit({
                        flags: MessageFlags.IsComponentsV2,
                        components: [container]
                    })
                    .catch(e => {
                        gtaTunesLog(
                            'WARN',
                            `Failed to update message controller ${p.magenta(messageInfo[1])} in ${p.magenta(this.player.guild.name)}.\n`,
                            e
                        );
                        this.controllerMessages =
                            this.controllerMessages.filter(
                                mi => mi[1] !== messageInfo[1]
                            );
                    });
            })
        );

        this.lastUpdatedTimestamp = timestamp ?? 0;
    }

    private createContainer(): ContainerBuilder {
        const container = new ContainerBuilder();

        if (!this.player.currentSong || !this.player.currentStation) {
            throw new Error(
                'Cannot create controller embed when nothing is playing.'
            );
        }

        const { currentStation: station, currentSong: song } = this.player;
        const { game_key: gameKey, key: stationKey } = station;
        const gtaTunes = useGTATunesSDK();

        const createButton = (
            action: string,
            emoji: string,
            style: ButtonStyle
        ) =>
            new ButtonBuilder()
                .setCustomId(`controller-${action}-${this.player.guild.id}`)
                .setEmoji(emoji)
                .setStyle(style);

        const buttonRow1 = new ActionRowBuilder<ButtonBuilder>().addComponents(
            createButton(
                `previous`,
                GTATunesEmoji.PREVIOUS,
                ButtonStyle.Primary
            ),
            createButton(
                `play`,
                this.player.isPlaying || this.player.isBuffering
                    ? GTATunesEmoji.PAUSE
                    : GTATunesEmoji.PLAY,
                ButtonStyle.Success
            ),
            createButton(`next`, GTATunesEmoji.NEXT, ButtonStyle.Primary)
        );

        const buttonRow2 = new ActionRowBuilder<ButtonBuilder>().addComponents(
            createButton(
                'previous_station',
                GTATunesEmoji.PREVIOUS_STATION,
                ButtonStyle.Secondary
            ),
            createButton(`stop`, GTATunesEmoji.STOP, ButtonStyle.Danger),
            createButton(
                'next_station',
                GTATunesEmoji.NEXT_STATION,
                ButtonStyle.Secondary
            )
        );

        const buttonRow3 = new ActionRowBuilder<ButtonBuilder>().addComponents(
            createButton(
                'settings',
                GTATunesEmoji.SETTINGS,
                ButtonStyle.Secondary
            ),
            createButton(
                `delete`,
                GTATunesEmoji.DELETE_CONTROLLER,
                ButtonStyle.Danger
            ),
            new ButtonBuilder({
                style: ButtonStyle.Link,
                emoji: GTATunesEmoji.GTATUNES_BG,
                url: gtaTunes.createPlayerSongLink(song)
            })
        );

        const progressLine = (): string | null => {
            let line = '';
            const duration = this.player.currentSongDuration;
            const timestamp = this.player.currentTimestamp;

            if (duration === null || timestamp === null) {
                return null;
            }

            const progress = timestamp / duration;

            const BAR_WIDTH = 10;
            let BAR_INDICATOR_POSITION = Math.round(progress * BAR_WIDTH);

            if (BAR_INDICATOR_POSITION === BAR_WIDTH) {
                BAR_INDICATOR_POSITION--;
            }

            for (let i = 1; i < BAR_WIDTH; i++) {
                line += emojiMd(
                    i <= BAR_INDICATOR_POSITION
                        ? GTATunesEmoji.PROGRESS_INDICATOR
                        : GTATunesEmoji.PROGRESS_PART
                );
            }

            return `${line}`;
        };

        const timestampLine = (): string | null => {
            const duration = this.player.currentSongDuration;
            const timestamp = this.player.currentTimestamp;

            if (duration === null || timestamp === null) {
                return null;
            }

            return `**${formatTimestamp(timestamp)}** - **${formatTimestamp(duration)}**`;
        };

        container
            .addSectionComponents(
                new SectionBuilder()
                    .addTextDisplayComponents(
                        new TextDisplayBuilder({
                            content: createLines(
                                `${emojiMd(getGameEmoji(song.game_key))} ${formatGameKey(song.game_key)}`,
                                `### ${station.name}`,
                                `**${song.name}** by **${song.artists.join(', ')}**`,
                                progressLine(),
                                timestampLine()
                            )
                        })
                    )
                    .setThumbnailAccessory(
                        new ThumbnailBuilder().setURL(
                            fullGTATunesUrl(station.icon)
                        )
                    )
            )
            .addActionRowComponents(buttonRow1, buttonRow2, buttonRow3)
            .setAccentColor(
                parseInt(
                    getGameStationColors(gameKey, stationKey)[0].replace(
                        '#',
                        ''
                    ),
                    16
                )
            );

        return container;
    }

    async create(channel: string | GuildBasedChannel): Promise<void> {
        const container = this.createContainer();

        let rChannel: GuildBasedChannel | null;

        if (typeof channel === 'string') {
            try {
                rChannel = await this.player.guild.channels.fetch(channel);
            } catch (e) {
                console.warn(`Failed to fetch channel ${channel}`, e);
                rChannel = null;
            }
        } else {
            rChannel = channel;
        }

        if (
            !rChannel ||
            !rChannel.isSendable() ||
            rChannel.guild.id !== this.player.guild.id
        ) {
            throw new Error(
                'Cannot create controllers in guilds outside the one the player is present in.'
            );
        }

        const existingControllerMessage = this.controllerMessages.find(
            i => i[0] === rChannel.id
        );

        if (existingControllerMessage) {
            try {
                await this.deleteControllerMessage(existingControllerMessage);
            } catch {
                console.warn(
                    `Failed to delete existing controller message ${existingControllerMessage[1]} in channel ${existingControllerMessage[0]}`
                );
            }
        }

        const message = await rChannel.send({
            flags: MessageFlags.IsComponentsV2,
            components: [container]
        });

        this.addMessage(message);
    }

    hasMessage(message: Message<true> | string): boolean {
        message = typeof message === 'string' ? message : message.id;

        return this.messageIds.includes(message);
    }

    hasChannel(channel: Channel | string): boolean {
        channel = typeof channel === 'string' ? channel : channel.id;

        return this.channelIds.includes(channel);
    }

    /**
     * @returns {boolean} if the message was added successfully
     */
    addMessage(message: Message<true>): boolean {
        const messageChannel = message.channel;

        if (
            !messageChannel ||
            !messageChannel.isSendable() ||
            messageChannel.guild.id !== this.player.guild.id
        ) {
            throw new Error(
                'Cannot create controllers in guilds outside the one the player is present in.'
            );
        }

        if (this.controllerMessages.find(i => i[0] === message.channel.id)) {
            return false;
        }

        this.controllerMessages.push([message.channelId, message.id]);
        return true;
    }

    getMessageInformation(
        message: Message<true> | string
    ): MessageInformation | null {
        message = typeof message === 'string' ? message : message.id;
        const messageInformation = this.controllerMessages.find(
            i => i[1] === message
        );

        return messageInformation ? [...messageInformation] : null;
    }

    get messageIds(): string[] {
        return this.controllerMessages.map(i => i[1]);
    }

    get channelIds(): string[] {
        return [...new Set(this.controllerMessages.map(i => i[0]))];
    }

    getAllMessageInformation(): MessageInformation[] {
        return [...this.controllerMessages];
    }

    async getMessage([
        channelId,
        messageId
    ]: MessageInformation): Promise<Message<true> | null> {
        const client = useClient();
        const channel = (await client.channels.fetch(channelId)) as TextChannel;

        if (!channel) {
            this.controllerMessages = this.controllerMessages.filter(
                ([c]) => c !== channelId
            );
            return null;
        }

        try {
            return await channel.messages.fetch({
                message: messageId,
                force: true
            });
        } catch {
            this.controllerMessages = this.controllerMessages.filter(
                m => m[1] !== messageId
            );
            return null;
        }
    }
}

export class MessageControllerInteractionHandler extends InteractionHandler {
    shouldHandle(interaction: Interaction): boolean {
        return (
            interaction.isButton() &&
            interaction.inGuild() &&
            interaction.customId.startsWith('controller-')
        );
    }

    async handle(interaction: ButtonInteraction): Promise<void> {
        const [action, guildId] = interaction.customId.split('-').slice(1);

        const playerManager = usePlayerManager();
        const player = playerManager.getPlayer(guildId);

        if (!player) {
            await interaction.reply({
                content: 'This player is no longer active.',
                flags: MessageFlags.Ephemeral
            });

            if (!interaction.message.flags.has(MessageFlags.Ephemeral)) {
                await interaction.message.delete();
            }

            return;
        }

        if (
            !player.messageController.hasMessage(interaction.message.id) &&
            !player.messageController.addMessage(
                interaction.message as Message<true>
            ) &&
            action !== 'create'
        ) {
            await interaction.message.delete();
        }

        const actionHandlerMap: Record<string, () => Promise<void>> = {
            play: async () => {
                if (player.isPaused) {
                    player.resume();
                } else {
                    player.pause();
                }
            },
            previous: async () => {
                if (
                    player.currentTimestamp !== null &&
                    player.currentTimestamp > 5000
                ) {
                    return await player.seek(0);
                }

                await player.playSong('previous');
            },
            next: () => player.playSong('next'),
            stop: async () => player.destroy(),
            next_station: () => player.playStation('next'),
            previous_station: () => player.playStation('previous'),
            create: async () => {
                if (!interaction.channel) {
                    return;
                }

                await player.messageController.create(interaction.channel.id);
            },
            settings: async () => {
                const modal = player.settings.createModal();

                await interaction.showModal(modal);
            },
            delete: async () => {
                if (!interaction.isMessageComponent()) {
                    return;
                }

                const messageController = player.messageController;
                const messageInformation =
                    messageController.getMessageInformation(
                        interaction.message.id
                    );

                if (!messageInformation) {
                    return;
                }

                await messageController.deleteControllerMessage(
                    messageInformation
                );
            }
        };

        const actionHandler = actionHandlerMap[action] ?? null;

        if (!actionHandler) {
            await interaction.reply({
                content: 'Invalid player controller action.',
                flags: MessageFlags.Ephemeral
            });

            return;
        }

        await actionHandler.bind(this)();

        if (!interaction.replied) {
            await interaction.deferUpdate();
        }
    }
}

type ChannelMessageCounters = Record<string, number>;

export class MessageControllerChannelMessageTracker extends EventHandler<'messageCreate'> {
    readonly event = 'messageCreate';

    private channelMessageCounters: ChannelMessageCounters = {};

    async handle(message: OmitPartialGroupDMChannel<Message>): Promise<void> {
        const playerManager = usePlayerManager();

        if (!message.inGuild()) {
            return;
        }

        const player = playerManager.getPlayer(message.guild.id);

        if (!player || !player.messageController.hasChannel(message.channel)) {
            return;
        }

        const messageCount = this.incrementChannelMessageCounter(
            message.channel.id
        );

        if (messageCount > MESSAGES_BEFORE_RESPAWN) {
            try {
                this.channelMessageCounters[message.channel.id] = 0;
                await player.messageController.create(message.channel.id);
            } catch {
                console.warn(
                    `Failed to respawn message controller in channel ${message.channel.id}`
                );
            }
        }
    }

    private getChannelMessageCounter(id: string): number {
        let counter: number | null = this.channelMessageCounters[id] ?? null;

        if (counter === null) {
            this.channelMessageCounters[id] = counter = 0;
        }

        return counter;
    }

    private incrementChannelMessageCounter(id: string): number {
        return (this.channelMessageCounters[id] =
            this.getChannelMessageCounter(id) + 1);
    }
}
