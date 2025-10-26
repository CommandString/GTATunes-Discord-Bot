import EventHandler from './EventHandler';
import { Interaction } from 'discord.js';
import { INTERACTION_HANDLERS } from '../bot';

export default class InteractionCreate extends EventHandler<'interactionCreate'> {
    readonly event = 'interactionCreate';

    async handle(interaction: Interaction): Promise<void> {
        for (const handler of INTERACTION_HANDLERS) {
            if (handler.shouldHandle(interaction)) {
                await handler.handle(interaction);
            }
        }
    }
}
