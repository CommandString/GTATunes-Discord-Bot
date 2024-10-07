import {AudioResource, createAudioResource} from "@discordjs/voice";
import {Readable} from "node:stream";


export namespace GTATunes {
    let cachedStations: {
        iii?: Station[],
        sa?: Station[]
    } = {};

    export const HOST = 'https://gtatunes.net';

    export type Song = {
        name: string,
        artists: string[],
        year: number
    }

    export type Station = {
        name: string,
        icon: string,
        songs: Song[]
    };

    export async function fetchStations(game: 'sa'|'iii'): Promise<Station[]> {
        if (cachedStations[game]) {
            return cachedStations[game];
        }

        let res = await fetch(`${HOST}/api/${game}/stations`);

        return cachedStations[game] = await res.json() as Station[];
    }

    export async function convertSongToAudioResource(game: 'sa'|'iii', station: Station, song: Song): Promise<AudioResource> {
        let params = new URLSearchParams({
            station: station.name,
            song: song.name,
            stream: '1'
        });

        let res = await fetch(`${HOST}/api/${game}/play?${params}`);

        if (!res.ok) {
            console.log(await res.json(), res.status, `${HOST}/api/${game}/play?station=${station.name}&song=${song.name}&stream=1`);
            throw new Error('Failed to fetch audio stream');
        }

        const reader = res.body!.getReader();
        const readableStream = new Readable({
            async read() {
                while (true) {
                    const {done, value} = await reader.read();
                    if (done) break;
                    this.push(value);
                }

                this.push(null);
            }
        });

        return createAudioResource(readableStream, {
            inlineVolume: true
        });
    }
}