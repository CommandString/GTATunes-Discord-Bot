import {
    ApplicationCommand,
    ApplicationCommandOptionType,
    AutocompleteInteraction,
    ChatInputCommandInteraction,
    Interaction
} from "discord.js";
import {ApplicationCommandHandler, InteractionHandler} from "./InteractionHandler";
import {GTATunes} from "../Core/GTATunes";
import {createAudioPlayer, getVoiceConnection, joinVoiceChannel, VoiceConnectionStatus} from "@discordjs/voice";

/** @ts-ignore */
export const PlayConfig: ApplicationCommand = {
    name: 'play',
    description: 'Play any radio station from the GTA 3D Universe',
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
                    name: 'GTA San Andreas',
                    value: 'sa'
                }
            ],
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
}

export class PlayCommand extends ApplicationCommandHandler {
    commandName = PlayConfig.name;

    async handle(interaction: ChatInputCommandInteraction): Promise<void> {
        if (!interaction.guild) {
            await interaction.reply({
                content: 'This command can only be used in a server',
                ephemeral: true
            });

            return;
        }

        let stationIndex = interaction.options.get('station', true).value as string;
        let songIndex = interaction.options.get('song', true).value as string;
        let game = interaction.options.get('game', true).value as 'sa'|'iii';

        let stations = await GTATunes.fetchStations(game);
        let station = stations[parseInt(stationIndex)];
        let song = station.songs[parseInt(songIndex)];

        if (!station) {
            await interaction.reply({
                content: 'Invalid radio station',
                ephemeral: true
            });

            return;
        }

        if (!song) {
            await interaction.reply({
                content: 'Invalid song',
                ephemeral: true
            });

            return;
        }

        let member = await interaction.guild.members.fetch(interaction.member!.user.id)

        if (!member) {
            await interaction.reply({
                content: 'Failed to fetch voice channel',
                ephemeral: true
            });

            return;
        }

        if (!member.voice.channel) {
            await interaction.reply({
                content: 'You must be in a voice channel to use this command',
                ephemeral: true
            });

            return;
        }

        await interaction.reply({
            content: 'Starting playback...',
            ephemeral: true
        });

        let connection = getVoiceConnection(interaction.guild.id);

        if (!connection) {
            connection = joinVoiceChannel({
                channelId: member.voice.channel.id,
                guildId: interaction.guild.id,
                adapterCreator: interaction.guild.voiceAdapterCreator
            });

            connection.on(VoiceConnectionStatus.Ready, async () => {
                let player = createAudioPlayer();

                connection!.subscribe(player);

                player.play(await GTATunes.convertSongToAudioResource(game, station, song));
            });

            return;
        }

        let player = createAudioPlayer();
        connection.subscribe(player);
        let resource = await GTATunes.convertSongToAudioResource(game, station, song);
        player.play(resource);
    }
}

export class PlayCommandStationAutocomplete extends InteractionHandler {
    shouldHandle(interaction: Interaction): boolean {
        return interaction.isAutocomplete() &&
            interaction.commandName === PlayConfig.name &&
            (interaction.options.get('game')?.value === 'sa' || interaction.options.get('game')?.value === 'iii') &&
            interaction.options.getFocused(true).name === 'station';
    }

    async handle(interaction: AutocompleteInteraction): Promise<void> {
        let game = interaction.options.get('game', true).value as 'sa'|'iii';
        let station = interaction.options.get('station', false)?.value as string|null;

        let stations = await GTATunes.fetchStations(game);

        if (station && station.length > 0) {
            stations = stations.filter(s => s.name.toLowerCase().startsWith(station.toLowerCase()));
        }

        await interaction.respond(Object.entries(stations).map(([k, s]) => ({
            name: s.name,
            value: k
        })));
    }
}

export class PlayCommandSongAutocomplete extends InteractionHandler {
    shouldHandle(interaction: Interaction): boolean {
        return interaction.isAutocomplete() &&
            interaction.commandName === PlayConfig.name &&
            (interaction.options.get('game')?.value === 'sa' || interaction.options.get('game')?.value === 'iii') &&
            interaction.options.getFocused(true).name === 'song';
    }

    async handle(interaction: AutocompleteInteraction): Promise<void> {
        let game = interaction.options.get('game', true).value as 'sa'|'iii';
        let stationIndex = interaction.options.get('station')?.value as string|null;
        let song = interaction.options.get('song', false)?.value as string|null;

        if (!stationIndex) {
            return;
        }

        let stations = await GTATunes.fetchStations(game);
        let station = stations[parseInt(stationIndex)] ?? null;

        if (!station) {
            return;
        }

        if (song && song.length > 0) {
            station.songs = station.songs.filter(s => s.name.toLowerCase().startsWith(song.toLowerCase()));
        }

        await interaction.respond(Object.entries(station.songs).map(([k, s]) => ({
            name: `${s.name} - ${s.artists.join(', ')} (${s.year})`,
            value: k.toString()
        })).slice(0, 25));
    }
}
