import type { Api } from './api';
import { stringify as qs } from 'qs';
import { gtaTunesLog, LevelFormatter } from './logger';
import p from 'picocolors';

function stringifyBoolean(value: boolean): '1' | '0' {
    return value ? '1' : '0';
}

export type PlaySongOptions = {
    sa: {
        intro?: number | 'random';
        outro?: number | 'random';
    };
    iii: never;
    vc: never;
    iv: never;
};

/**
 * @throws {Response|Error} When the fetch fails or the response is not ok
 */
export default class GTATunesSDK {
    constructor(public baseUri: string = 'https://gtatunes.net') {}

    buildUrl(path: string, query?: object, withBase: boolean = true): string {
        return `${withBase ? this.baseUri : ''}${path}${query ? `?${qs(query)}` : ''}`;
    }

    async fetch(
        uri: string,
        query?: object,
        init?: RequestInit
    ): Promise<Response> {
        const loggedUrl = `${uri}?${qs(query)}`;
        gtaTunesLog('GTAT', `[${p.dim('...')}] ${loggedUrl}`);

        let res: Response;

        try {
            res = await fetch(this.buildUrl(uri, query), init);
        } catch (e) {
            gtaTunesLog('FAIL', `Failed to fetch ${loggedUrl}`, e);
            throw e;
        }

        const statusColor: LevelFormatter | null =
            {
                2: p.green,
                3: p.gray,
                4: p.yellow,
                5: p.red
            }[Math.floor(res.status / 100)] ?? p.green;

        gtaTunesLog(
            'GTAT',
            `[${statusColor(res.status.toString())}] ${loggedUrl}`
        );

        if (!res.ok) {
            throw res;
        }

        return res;
    }

    protected async fetchJson<T>(path: string, query?: object): Promise<T> {
        return (await this.fetch(path, query)).json();
    }

    getAllStations<
        WithSongs extends boolean = false,
        WithSegments extends boolean = false
    >(
        withSongs: WithSongs = false as WithSongs,
        withSegments: WithSegments = false as WithSegments
    ): Promise<Api.Stations<Api.GameKey, WithSongs, WithSegments>> {
        return this.fetchJson('/api/stations', {
            with_songs: stringifyBoolean(withSongs),
            with_segments: stringifyBoolean(withSegments)
        });
    }

    getGameStations<
        Game extends Api.GameKey,
        WithSongs extends boolean = true,
        WithSegments extends boolean = true
    >(
        game: Game,
        withSongs: WithSongs = true as WithSongs,
        withSegments: WithSegments = true as WithSegments
    ): Promise<Api.Station<Game, WithSongs, WithSegments>[]> {
        return this.fetchJson(`/api/stations/${game}`, {
            with_songs: stringifyBoolean(withSongs),
            with_segments: stringifyBoolean(withSegments)
        });
    }

    getStation<
        Game extends Api.GameKey,
        StationKey extends Api.StationKeys[Game],
        WithSongs extends boolean = true,
        WithSegments extends boolean = true
    >(
        game: Game,
        station: StationKey,
        withSongs: WithSongs = true as WithSongs,
        withSegments: WithSegments = true as WithSegments
    ): Promise<Api.Station<Game, WithSongs, WithSegments>> {
        return this.fetchJson(`/api/stations/${game}/${station}`, {
            with_songs: stringifyBoolean(withSongs),
            with_segments: stringifyBoolean(withSegments)
        });
    }

    createAudioUrl<
        GameKey extends Api.GameKey,
        StationKey extends Api.StationKeys[GameKey] = Api.StationKeys[GameKey]
    >(
        game: GameKey,
        station: StationKey,
        song: Api.Song<GameKey>,
        options?: PlaySongOptions[GameKey],
        withBase: boolean = false
    ) {
        if (options?.intro === 'random' && song.game_key === 'sa') {
            options.intro = Math.min(
                Math.max(
                    1,
                    Math.floor(
                        Math.random() * (song as Api.Song<'sa'>).intro_count
                    )
                ),
                (song as Api.Song<'sa'>).intro_count
            );
        }

        if (options?.outro === 'random' && song.game_key === 'sa') {
            options.outro = Math.min(
                Math.max(
                    1,
                    Math.floor(
                        Math.random() * (song as Api.Song<'sa'>).outro_count
                    )
                ),
                (song as Api.Song<'sa'>).intro_count
            );
        }

        return this.buildUrl(
            `/api/stations/${game}/${station}/play`,
            {
                song: song.name,
                intro: options?.intro ?? 0,
                outro: options?.outro ?? 0
            },
            withBase
        );
    }

    createStationIconUrl(
        game: Api.GameKey,
        station: Api.StationKeys[Api.GameKey],
        size: Api.StationIconSize = 'medium'
    ) {
        return this.buildUrl(`/api/stations/${game}/${station}/icon`, { size });
    }

    async getVersion(): Promise<Api.Version> {
        return await this.fetchJson<Api.Version>('/api/version');
    }

    async getGithubVersions(): Promise<Api.Github.Version[]> {
        return await this.fetchJson<Api.Github.Version[]>(
            '/api/github/versions'
        );
    }

    async getAdverts<Game extends 'sa' | 'iv'>(
        game: Game
    ): Promise<
        Game extends 'sa'
            ? Api.SASegment<'advert', Api.SAStationKey>[]
            : Api.IVSegment<'advert', Api.IVStationKey>[]
    > {
        type APIReturn = Game extends 'sa'
            ? Api.SASegment<'advert', Api.SAStationKey>[]
            : Api.IVSegment<'advert', Api.IVStationKey>[];
        const segments = await this.fetchJson<APIReturn>(
            `/api/segments/${game}`
        );

        return segments.filter(s => s.type === 'advert') as APIReturn;
    }

    createPlayerSongLink(song: Api.Song<Api.GameKey>): string {
        return this.buildUrl(`/player`, {
            game: song.game_key,
            station: song.station_key,
            song: song.name
        });
    }
}
