import {
    ActionRowBuilder,
    ApplicationCommand,
    ApplicationCommandOptionType,
    ButtonBuilder,
    ButtonStyle,
    ChatInputCommandInteraction,
    ContainerBuilder,
    MessageFlags,
    SectionBuilder,
    TextDisplayBuilder,
    ThumbnailBuilder
} from 'discord.js';
import { ApplicationCommandHandler } from './InteractionHandler';
import useGTATunesSDK from '../Core/useGTATunesSDK';
import { Api } from '../Core/api';
import {
    fullGTATunesUrl,
    formatGameKey as formatGameKey,
    createLines,
    getGameEmoji,
    emojiMd,
    getStationEmoji
} from '../Core/functions';

/** @ts-ignore */
export const StationsConfig: () => Promise<ApplicationCommand> = async () => {
    const gtaTunes = useGTATunesSDK();

    const stations = {
        iii: await gtaTunes.getGameStations('iii'),
        sa: await gtaTunes.getGameStations('sa'),
        vc: await gtaTunes.getGameStations('vc'),
        iv: await gtaTunes.getGameStations('iv')
    };

    return {
        name: 'stations',
        description: 'Get information about the stations',
        options: ['iii', 'sa', 'vc', 'iv'].map(game => ({
            name: game,
            description: `Search through the GTA ${game.toUpperCase()} stations`,
            type: ApplicationCommandOptionType.Subcommand,
            options: [
                {
                    name: 'station',
                    type: ApplicationCommandOptionType.String,
                    description: 'The station to view',
                    choices: Object.values(stations[game as Api.GameKey]).map(
                        s => ({
                            name: s.name,
                            value: s.key
                        })
                    )
                }
            ]
        }))
    };
};

export default class StationsCommand extends ApplicationCommandHandler {
    commandName = 'stations';

    private async generateGameContainer(
        game: Api.GameKey
    ): Promise<ContainerBuilder> {
        const gtaTunes = useGTATunesSDK();
        const stations = await gtaTunes.getGameStations(game, true, false);
        const songCount = stations.reduce<number>(
            (sum, station) => sum + (station.songs?.length ?? 0),
            0
        );

        const info = new SectionBuilder()
            .addTextDisplayComponents(
                new TextDisplayBuilder({
                    content: createLines(
                        `## ${formatGameKey(game)}`,
                        `**${stations.length}** stations.`,
                        `**${songCount}** songs.`
                    )
                })
            )
            .setThumbnailAccessory(
                new ThumbnailBuilder({
                    media: {
                        url: gtaTunes.buildUrl(`/${game}.png`)
                    }
                })
            );

        const STATIONS_PER_ROW = 3;
        const stationActionRows: ActionRowBuilder<ButtonBuilder>[] = [];

        for (let i = 0; i < stations.length; i += STATIONS_PER_ROW) {
            const row = stations.slice(i, i + STATIONS_PER_ROW);

            stationActionRows.push(
                new ActionRowBuilder<ButtonBuilder>({
                    components: row.map(s =>
                        new ButtonBuilder({
                            style: ButtonStyle.Secondary,
                            customId: `play-station-${s.game_key}-${s.key}`
                        }).setEmoji(getStationEmoji(s.game_key, s.key))
                    )
                })
            );
        }

        return new ContainerBuilder()
            .addSectionComponents(info)
            .addActionRowComponents(
                ...stationActionRows,
                new ActionRowBuilder<ButtonBuilder>({
                    components: [
                        new ButtonBuilder({
                            label: `Play Random Station`,
                            style: ButtonStyle.Primary,
                            customId: `play-game-${game}`
                        })
                    ]
                })
            );
    }

    private generateStationSection(
        station: Api.Station<Api.GameKey, boolean, boolean>,
        hideGame: boolean = false
    ): SectionBuilder {
        return new SectionBuilder()
            .addTextDisplayComponents(
                new TextDisplayBuilder({
                    content: createLines(
                        !hideGame
                            ? `${emojiMd(getGameEmoji(station.game_key))} ${formatGameKey(station.game_key)}`
                            : null,
                        `### ${station.name}`,
                        ...(station.songs
                            ? station.songs.map((s, i) =>
                                  createLines(
                                      `${(i + 1).toString().padStart(2, '0')}. **${s.name}**`,
                                      `${' '.repeat(4)}${s.artists.join(', ')}`
                                  )
                              )
                            : [])
                    )
                })
            )
            .setThumbnailAccessory(
                new ThumbnailBuilder({
                    media: {
                        url: fullGTATunesUrl(station.icon)
                    }
                })
            );
    }

    private generateStationContainer(
        station: Api.Station<Api.GameKey, boolean, boolean>
    ): ContainerBuilder {
        return new ContainerBuilder()
            .addSectionComponents(this.generateStationSection(station))
            .addActionRowComponents(
                new ActionRowBuilder<ButtonBuilder>({
                    components: [
                        new ButtonBuilder({
                            label: `Play ${station.name}`,
                            style: ButtonStyle.Primary,
                            customId: `play-station-${station.game_key}-${station.key}`
                        })
                    ]
                })
            );
    }

    async handle(interaction: ChatInputCommandInteraction): Promise<void> {
        const gtaTunes = useGTATunesSDK();

        const game = interaction.options.getSubcommand() as Api.GameKey;
        const stationKey = interaction.options.getString('station') as
            | Api.StationKeys[Api.GameKey]
            | null;

        if (!stationKey) {
            await interaction.reply({
                components: [await this.generateGameContainer(game)],
                flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral
            });
            return;
        }

        const station = await gtaTunes.getStation(
            game,
            stationKey,
            true,
            false
        );

        await interaction.reply({
            components: [this.generateStationContainer(station)],
            flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral
        });
    }
}
