import {ClientEvents} from "discord.js";

export type ClientEventName = keyof ClientEvents;

export default abstract class EventHandler {
    abstract readonly event: ClientEventName;

    abstract handle(...args: ClientEvents[ClientEventName]): Promise<void>;
}