import EventHandler, {ClientEventName} from "./EventHandler";
import {Interaction} from "discord.js";
import {INTERACTION_HANDLERS} from "../bot";

export default class InteractionCreate extends EventHandler {
    readonly event: ClientEventName = 'interactionCreate';

    async handle(interaction: Interaction): Promise<void> {
        for (let handler of INTERACTION_HANDLERS) {
            if (handler.shouldHandle(interaction)) {
                // console.log('Calling', handler.constructor.name);

                await handler.handle(interaction);
            }
        }
    }
}