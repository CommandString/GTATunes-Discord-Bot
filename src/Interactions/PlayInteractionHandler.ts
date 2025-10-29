import { ButtonInteraction, Interaction, MessageFlags } from 'discord.js';
import { InteractionHandler } from '../Commands/InteractionHandler';
import { Player, usePlayerManager } from '../Core/GTATunesPlayer';
import useGTATunesSDK from '../Core/useGTATunesSDK';
import { Api } from '../Core/api';
import { randomArrayItem } from '../Core/functions';
import { gtaTunesLog } from '../Core/logger';

export default class PlayInteractionHandler extends InteractionHandler {
    shouldHandle(interaction: Interaction): boolean {
        return (
            interaction.isButton() &&
            interaction.customId.startsWith('play-') &&
            interaction.guild !== null
        );
    }

    async handle(interaction: ButtonInteraction): Promise<void> {
        const playerManager = usePlayerManager();
        const player =
            playerManager.getPlayer(interaction.guild!) ??
            (await Player.createFromInteraction(interaction));

        if (!player) {
            return;
        }

        try {
            await player.lock(async () => {
                const gtaTunes = useGTATunesSDK();
                const playParts = interaction.customId.split('-').slice(1);
                const type = playParts.shift();

                const playStation: Api.Station<
                    Api.GameKey,
                    true,
                    false
                > | null = null;
                const playSong: Api.Song<Api.GameKey> | null = null;

                if (type === 'game') {
                    const game = playParts.shift() as Api.GameKey;
                    const stations = await gtaTunes.getGameStations(
                        game,
                        true,
                        false
                    );
                    const randomStation = randomArrayItem(stations);

                    await player.playStation(randomStation);
                    await interaction.deferUpdate();
                    return;
                }

                if (type === 'station') {
                    const game = playParts.shift() as Api.GameKey;
                    const stationKey =
                        playParts.shift() as Api.StationKeys[typeof game];
                    const station = await gtaTunes.getStation(
                        game,
                        stationKey,
                        true,
                        false
                    );

                    await player.playStation(station);
                    await interaction.deferUpdate();
                    return;
                }

                if (!playStation || !playSong) {
                    await interaction.reply({
                        content: 'Unable to find song to play.',
                        flags: MessageFlags.Ephemeral
                    });
                }
            }, interaction);
        } catch (e) {
            gtaTunesLog(
                'PLAYER',
                `Failed to handle play interaction in ${player.guild.name} (${player.guild.id})`,
                e
            );
            await interaction.reply({
                content:
                    'Failed to play requested item. Please try again later.',
                flags: MessageFlags.Ephemeral
            });
        }
    }
}
