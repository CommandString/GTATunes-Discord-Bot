import {
    ActionRowBuilder,
    ApplicationCommand,
    ApplicationCommandOptionType,
    AutocompleteInteraction,
    ButtonBuilder,
    ButtonStyle,
    ChatInputCommandInteraction,
    Interaction,
    MessageFlags
} from 'discord.js';
import {
    ApplicationCommandHandler,
    InteractionHandler
} from './InteractionHandler';
import useGTATunesSDK from '../Core/useGTATunesSDK';
import { Api } from '../Core/api';
import { Player, usePlayerManager } from '../Core/GTATunesPlayer';
import { randomArrayItem } from '../Core/functions';

/** @ts-ignore */
export const PlayConfig: ApplicationCommand = {
    name: 'play',
    description: 'Play any radio station from the GTA Universe',
    options: [
        {
            name: 'game',
            description: 'The game the station belongs to',
            required: true,
            type: ApplicationCommandOptionType.String,
            /** @ts-ignore */
            choices: [
                {
                    name: 'GTA III',
                    value: 'iii'
                },
                {
                    name: 'GTA Vice City',
                    value: 'vc'
                },
                {
                    name: 'GTA San Andreas',
                    value: 'sa'
                },
                {
                    name: 'GTA IV',
                    value: 'iv'
                }
            ]
        },
        {
            name: 'station',
            description: 'The station to play the song from',
            autocomplete: true,
            type: ApplicationCommandOptionType.String
        },
        {
            name: 'song',
            description: 'The song to play',
            autocomplete: true,
            type: ApplicationCommandOptionType.String
        }
    ]
};

export class PlayCommand extends ApplicationCommandHandler {
    commandName = PlayConfig.name;

    async handle(interaction: ChatInputCommandInteraction): Promise<void> {
        if (!interaction.guild) {
            await interaction.reply({
                content: 'This command can only be used in a server',
                flags: MessageFlags.Ephemeral
            });

            return;
        }

        const playerManager = usePlayerManager();
        let player = playerManager.getPlayer(interaction.guild);
        const created = false;

        let gameKey = interaction.options.get('game', true)
            .value as Api.GameKey;
        let stationKey =
            interaction.options.get('station', false)?.value ?? null;
        const songValue = interaction.options.get('song', false)?.value ?? null;
        let songIndex: number | null = null;

        if (songValue && typeof songValue === 'string') {
            type SongParts<T extends Api.GameKey = Api.GameKey> = [
                T,
                Api.StationKeys[T],
                string
            ];
            const parts = songValue.split('-') as SongParts;

            [gameKey, stationKey] = parts;
            songIndex = parseInt(parts[2]);
        }

        const gtaTunes = useGTATunesSDK();

        const stations = await gtaTunes.getGameStations(gameKey, true, false);
        let station = stationKey
            ? stations.find(s => s.key === stationKey)
            : null;

        if (!stationKey) {
            station =
                player?.currentStation?.game_key === gameKey
                    ? player.currentStation
                    : randomArrayItem(stations);
        }

        if (!station) {
            await interaction.reply({
                content: 'Invalid radio station',
                flags: MessageFlags.Ephemeral
            });

            return;
        }

        const song = songIndex !== null ? station.songs[songIndex] : null;

        if (songIndex !== null && !song) {
            await interaction.reply({
                content: 'Invalid song',
                flags: MessageFlags.Ephemeral
            });

            return;
        }

        if (!player) {
            player = await Player.createFromInteraction(interaction);

            if (!player) {
                return;
            }
        }

        interaction
            .reply({
                content: created
                    ? `Started GTATunes player in <#${player.voiceChannel.id}>.`
                    : 'Changing song...',
                flags: MessageFlags.Ephemeral,
                components:
                    player.messageController.messageIds.length === 0
                        ? [
                              new ActionRowBuilder<ButtonBuilder>({
                                  components: [
                                      new ButtonBuilder({
                                          label: 'Create Controller',
                                          style: ButtonStyle.Primary,
                                          customId: `controller-create-${interaction.guildId!}`
                                      })
                                  ]
                              })
                          ]
                        : []
            })
            .catch(e => console.error('Failed to respond to interaction.', e));

        await (song
            ? player.playSong(song, station)
            : player.playStation(station));
    }
}

export class PlayCommandStationAutocomplete extends InteractionHandler {
    shouldHandle(interaction: Interaction): boolean {
        return (
            interaction.isAutocomplete() &&
            interaction.commandName === PlayConfig.name &&
            ['sa', 'vc', 'iii', 'iv'].includes(
                (interaction.options.get('game')?.value ?? '') as string
            ) &&
            interaction.options.getFocused(true).name === 'station'
        );
    }

    async handle(interaction: AutocompleteInteraction): Promise<void> {
        const game = interaction.options.get('game', true).value as Api.GameKey;
        const stationName = interaction.options.get('station', false)?.value as
            | string
            | null;

        const gtaTunes = useGTATunesSDK();

        let stations = await gtaTunes.getGameStations(game, false, false);

        if (stationName && stationName.length > 0) {
            stations = stations.filter(s =>
                s.name.toLowerCase().startsWith(stationName.toLowerCase())
            );
        }

        await interaction.respond(
            Object.values(stations).map(s => ({
                name: s.name,
                value: s.key
            }))
        );
    }
}

export class PlayCommandSongAutocomplete extends InteractionHandler {
    shouldHandle(interaction: Interaction): boolean {
        return (
            interaction.isAutocomplete() &&
            interaction.commandName === PlayConfig.name &&
            ['sa', 'vc', 'iii', 'iv'].includes(
                (interaction.options.get('game')?.value ?? '') as string
            ) &&
            interaction.options.getFocused(true).name === 'song'
        );
    }

    async handle(interaction: AutocompleteInteraction): Promise<void> {
        if (!interaction.inGuild()) {
            return;
        }

        const playerManager = usePlayerManager();
        const player = playerManager.getPlayer(interaction.guild!.id);
        const game = interaction.options.get('game', true).value as Api.GameKey;
        const stationKey =
            interaction.options.get('station', false)?.value ??
            ((player?.currentStation?.game_key === game
                ? player?.currentStation?.key
                : null) as string | null);
        const song = interaction.options.get('song', false)?.value as
            | string
            | null;

        const gtaTunes = useGTATunesSDK();

        const stations = await gtaTunes.getGameStations(game, true, false);
        const station = stationKey
            ? (stations.find(s => s.key === stationKey) ?? null)
            : randomArrayItem(stations);

        if (!station) {
            return;
        }

        type IndexedSongs = (Api.Song<Api.GameKey> & { index?: number })[];

        let songs: IndexedSongs = [];

        if (song && song.trim().length > 0) {
            for (const i of station.songs.keys()) {
                const s = (station.songs as IndexedSongs)[i];

                if (!s.name.toLocaleLowerCase().includes(song.toLowerCase())) {
                    continue;
                }

                s.index = i;

                songs.push(s);
            }
        } else {
            songs = station.songs.slice(0, 25);
        }

        await interaction.respond(
            Object.values(songs).map((s, i) => ({
                name: `${s.name} - ${s.artists.join(', ')} (${s.year})`,
                value: `${s.game_key}-${s.station_key}-${s?.index ?? i}`
            }))
        );
    }
}
