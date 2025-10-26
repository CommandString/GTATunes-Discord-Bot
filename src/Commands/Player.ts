import {
    ApplicationCommand,
    ApplicationCommandOptionType,
    ChatInputCommandInteraction,
    GuildBasedChannel,
    MessageFlags
} from 'discord.js';
import { ApplicationCommandHandler } from './InteractionHandler';
import { Player } from '../Core/GTATunesPlayer';
import { PossiblyAsync, requireActivePlayer } from '../Core/functions';

/** @ts-ignore */
export const PlayerConfig: ApplicationCommand = {
    name: 'player',
    description: 'Control the player.',
    options: [
        {
            name: 'resume',
            description: 'Resume current playback.',
            type: ApplicationCommandOptionType.Subcommand
        },
        {
            name: 'pause',
            description: 'Pause current playback.',
            type: ApplicationCommandOptionType.Subcommand
        },
        {
            name: 'next',
            description: 'Skips to next song.',
            type: ApplicationCommandOptionType.Subcommand
        },
        {
            name: 'previous',
            description: 'Skips to previous song.',
            type: ApplicationCommandOptionType.Subcommand
        },
        {
            name: 'stop',
            description: 'Stops the current playback and disconnects the bot.',
            type: ApplicationCommandOptionType.Subcommand
        },
        {
            name: 'settings',
            description: 'Show player settings modal',
            type: ApplicationCommandOptionType.Subcommand
        },
        {
            name: 'seek',
            description:
                'Seek forward or backward or seek to a specific timestamp.',
            type: ApplicationCommandOptionType.Subcommand,
            options: [
                {
                    name: 'timestamp',
                    description: 'The timestamp to seek to (e.g. 1:25).',
                    type: ApplicationCommandOptionType.String,
                    required: true
                }
            ]
        },
        // {
        //     name: 'give-access',
        //     description: 'Give another user access to control the player.',
        //     type: ApplicationCommandOptionType.Subcommand,
        //     options: [
        //         {
        //             name: 'user',
        //             description: 'The user to give access to.',
        //             type: ApplicationCommandOptionType.User,
        //             required: true
        //         }
        //     ]
        // },
        {
            name: 'controller',
            description: 'Creates a controller for the player',
            type: ApplicationCommandOptionType.Subcommand
        }
    ]
};

export class PlayerCommand extends ApplicationCommandHandler {
    commandName = PlayerConfig.name;

    async handle(interaction: ChatInputCommandInteraction): Promise<void> {
        const player = await requireActivePlayer(interaction);

        if (!player) {
            return;
        }

        const subCommand = interaction.options.getSubcommand(false);

        if (!subCommand) {
            await interaction.reply({
                content: 'No subcommand found.',
                flags: MessageFlags.Ephemeral
            });

            return;
        }

        const subCommandHandlerMap: Record<
            string,
            (
                interaction: ChatInputCommandInteraction,
                player: Player
            ) => PossiblyAsync<void>
        > = {
            resume: async (interaction, player) => {
                if (!player.isPaused) {
                    await interaction.reply({
                        content: "The playback isn't currently paused.",
                        flags: MessageFlags.Ephemeral
                    });

                    return;
                }

                await interaction.reply({
                    content: player.resume()
                        ? 'Playback resumed.'
                        : 'Failed to resume playback.',
                    flags: MessageFlags.Ephemeral
                });
            },
            pause: async (interaction, player) => {
                if (!player.isPlaying) {
                    await interaction.reply({
                        content: "The playback isn't currently playing.",
                        flags: MessageFlags.Ephemeral
                    });

                    return;
                }

                await interaction.reply({
                    content: player.pause()
                        ? 'Playback paused.'
                        : 'Failed to pause playback.',
                    flags: MessageFlags.Ephemeral
                });
            },
            next: async (interaction, player) => {
                if (!player.currentSong || !player.currentStation) {
                    await interaction.reply({
                        content: 'A song must be playing to use this command.',
                        flags: MessageFlags.Ephemeral
                    });

                    return;
                }

                await player.playSong('next');
                await interaction.reply({
                    content: 'Playing next song...',
                    flags: MessageFlags.Ephemeral
                });
            },
            previous: async (interaction, player) => {
                if (!player.currentSong || !player.currentStation) {
                    await interaction.reply({
                        content: 'A song must be playing to use this command.',
                        flags: MessageFlags.Ephemeral
                    });

                    return;
                }

                await player.playSong('previous');
                await interaction.reply({
                    content: 'Playing previous song...',
                    flags: MessageFlags.Ephemeral
                });
            },
            seek: async (interaction, player) => {
                const timestamp = interaction.options.getString(
                    'timestamp',
                    true
                );

                let seconds: number = 0;
                let minutes: number = 0;
                const parts = timestamp.split(':');

                if (parts.length === 0 || parts.length > 2) {
                    await interaction.reply({
                        content:
                            'Invalid timestamp provided. (e.g. 1:25 or 10)',
                        flags: MessageFlags.Ephemeral
                    });

                    return;
                }

                if (parts.length === 1) {
                    seconds = parseInt(parts[0]);
                } else {
                    minutes = parseInt(parts[0]);
                    seconds = parseInt(parts[1]);
                }

                if (Number.isNaN(seconds) || Number.isNaN(minutes)) {
                    await interaction.reply({
                        content:
                            'Invalid timestamp provided. (e.g. 1:25 or 10)',
                        flags: MessageFlags.Ephemeral
                    });

                    return;
                }

                await player.seek(minutes * 60 + seconds);

                await interaction.reply({
                    content: 'Seeked playback.',
                    flags: MessageFlags.Ephemeral
                });
            },
            stop: async (interaction, player) => {
                player.destroy();

                await interaction.reply({
                    content:
                        'Player stopped and disconnected from voice channel.',
                    flags: MessageFlags.Ephemeral
                });
            },
            controller: async (interaction, player) => {
                if (!player.currentSong || !player.currentStation) {
                    await interaction.reply({
                        content:
                            'You must be playing something to use this command.'
                    });

                    return;
                }

                await player.messageController.create(
                    interaction.channel as GuildBasedChannel
                );

                await interaction.reply({
                    content: 'Created controller.',
                    flags: MessageFlags.Ephemeral
                });
            },
            settings: async () => {
                await interaction.showModal(player.settings.createModal());
            }
        };

        const subCommandHandler = subCommandHandlerMap[subCommand];

        if (!subCommandHandler) {
            await interaction.reply({
                content: 'This subcommand has not been implemented yet.',
                flags: MessageFlags.Ephemeral
            });

            return;
        }

        try {
            await subCommandHandler(interaction, player);
        } catch (e) {
            console.error(
                `Failed to handle player subcommand for | Guild: ${player.guild.id} | Channel: ${player.voiceChannel.id} | Reason: `,
                e
            );

            await interaction.reply({
                content: 'Failed to handle action, please try again later.',
                flags: MessageFlags.Ephemeral
            });
        }
    }
}
