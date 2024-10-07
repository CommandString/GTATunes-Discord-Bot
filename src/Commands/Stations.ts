import {ApplicationCommand, ApplicationCommandOptionType, ChatInputCommandInteraction} from "discord.js";
import {ApplicationCommandHandler} from "./InteractionHandler";
import {GTATunes} from "../Core/GTATunes";

/** @ts-ignore */
export const StationsConfig: () => Promise<ApplicationCommand> = async () => {
    let stations = {
        iii: await GTATunes.fetchStations('iii'),
        sa: await GTATunes.fetchStations('sa')
    }

    return {
        name: 'stations',
        description: 'Get information about the stations',
        options: ['iii', 'sa'].map((game) => ({
            name: game,
            description: `Search through the GTA ${game.toUpperCase()} stations`,
            type: ApplicationCommandOptionType.Subcommand,
            options: [
                {
                    name: 'station',
                    description: 'The station to view',
                    choices: Object.entries(stations[game as 'iii'|'sa']).map(([i, s]) => ({
                        name: s.name,
                        value: i.toString()
                    }))
                }
            ]
        }))
    }
}

export default class StationsCommand extends ApplicationCommandHandler {
    commandName = StationsConfig.name;

    async handle(interaction: ChatInputCommandInteraction): Promise<void> {
        await interaction.reply({
            content: 'Pong!',
            ephemeral: true
        });
    }
}