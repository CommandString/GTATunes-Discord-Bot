import {ChatInputCommandInteraction, Interaction} from "discord.js";

export abstract class InteractionHandler {
    abstract shouldHandle(interaction: Interaction): boolean;
    abstract handle(interaction: Interaction): Promise<void>;
}

export abstract class ApplicationCommandHandler extends InteractionHandler {
    readonly abstract commandName: string;

    shouldHandle(interaction: Interaction): boolean {
        return interaction.isCommand() && interaction.commandName === this.commandName;
    }

    abstract handle(interaction: ChatInputCommandInteraction): Promise<void>;
}

