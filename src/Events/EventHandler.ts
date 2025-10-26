import { ClientEvents } from 'discord.js';

export type ClientEventName = keyof ClientEvents;

export default abstract class EventHandler<Event extends ClientEventName> {
    abstract readonly event: Event;

    abstract handle(...args: ClientEvents[Event]): Promise<void>;
}
