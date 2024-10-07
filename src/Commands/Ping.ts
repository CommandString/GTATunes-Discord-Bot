import {ApplicationCommand, ChatInputCommandInteraction} from "discord.js";
import {ApplicationCommandHandler} from "./InteractionHandler";

/** @ts-ignore */
export const PingConfig: ApplicationCommand = {
    name: 'ping',
    description: 'Replies with Pong!',
}

export default class PingCommand extends ApplicationCommandHandler {
    commandName = PingConfig.name;

    async handle(interaction: ChatInputCommandInteraction): Promise<void> {
        await interaction.reply({
            content: 'Pong!',
            ephemeral: true
        });
    }
}
