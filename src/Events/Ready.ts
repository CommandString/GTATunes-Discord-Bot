import EventHandler, {ClientEventName} from "./EventHandler";
import {Client} from "discord.js";

export default class Ready extends EventHandler {
    readonly event: ClientEventName = 'ready';

    async handle(client: Client<true>): Promise<void> {
        console.log(`Logged in as ${client.user?.username}!`);
    }
}
