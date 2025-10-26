export namespace Api {
    type Song<Game extends Api.GameKey> = {
        name: string;
        artists: string[];
        year: number;
        station_key: Api.StationKeys[Game];
        game_key: Game;
    } & (Game extends 'sa'
        ? {
              intro_count: number;
              outro_count: number;
          }
        : Record<never, never>);

    type Station<
        Game extends GameKey,
        WithSongs extends boolean,
        WithSegments extends boolean = false
    > = {
        key: Api.StationKeys[Game];
        game_key: Game;
        name: string;
        icon: string;
        songs: WithSongs extends true ? Song<Game>[] : undefined;
        segments: WithSegments extends true
            ? Game extends 'sa'
                ? Api.SAStationSegments
                : undefined
            : undefined;
    };

    type Stations<
        Game extends GameKey,
        WithSongs extends boolean,
        WithSegments extends boolean = false
    > = {
        [key in GameKey]: Station<Game, WithSongs, WithSegments>[];
    };

    type StationIconSize = 'mini' | 'small' | 'medium' | 'large' | 'big';

    type GameKey = 'sa' | 'iii' | 'vc' | 'iv';

    type SAStationKey =
        | 'bounce_fm'
        | 'csr'
        | 'k_dst'
        | 'k_jah'
        | 'k_rose'
        | 'master_sounds'
        | 'playback_fm'
        | 'radio_x'
        | 'sfur'
        | 'radio_los_santos'
        | 'wctr';

    type IIIStationKey =
        | 'flashback_fm'
        | 'head_radio'
        | 'double_clef_fm'
        | 'k_jah'
        | 'rise_fm'
        | 'msx_fm'
        | 'lips_106'
        | 'game_radio_fm';

    type VCStationKey =
        | 'wildstyle'
        | 'flash_fm'
        | 'fever_105'
        | 'v_rock'
        | 'espantoso'
        | 'emotion'
        | 'wave';

    type IVStationKey =
        | 'the_beat_102_7'
        | 'san_juan_sounds'
        | 'the_classics_104_1'
        | 'electro_choc'
        | 'fusion_fm'
        | 'international_funk_99'
        | 'independence_fm'
        | 'integrity_2_0'
        | 'jazz_nation_radio'
        | 'the_journey'
        | 'k109_the_studio'
        | 'liberty_city_hardcore'
        | 'liberty_rock'
        | 'massive_b'
        | 'public_liberty_radio'
        | 'radio_broker'
        | 'ramjam_fm'
        | 'san_juan_sounds'
        | 'self_actualization_fm'
        | 'tuff_gong'
        | 'the_vibe_98_8'
        | 'vice_city_fm'
        | 'vladivostok_fm'
        | 'wktt_radio';

    type StationKeys = {
        sa: SAStationKey;
        iii: IIIStationKey;
        vc: VCStationKey;
        iv: IVStationKey;
    };

    type SASegmentType =
        | 'advert'
        | 'station_jingle'
        | 'caller'
        | 'weather'
        | 'bridge_announcement'
        | 'dj_talk'
        | 'story';
    type SAWeatherType =
        | 'morning'
        | 'evening'
        | 'night'
        | 'rain'
        | 'sunny'
        | 'fog';
    type SASegment<
        Type extends SASegmentType,
        Station extends SAStationKey
    > = Segment<'sa', Type, Station>;
    type SAStationSegmentType = Exclude<SASegmentType, 'advert'>;
    type SAStationSegments<Station extends SAStationKey = any> = {
        station_jingle: SASegment<'station_jingle', Station>[];
        caller: SASegment<'caller', Station>[];
        weather: SASegment<'weather', Station>[];
        bridge_announcement: SASegment<'bridge_announcement', Station>[];
        dj_talk: SASegment<'dj_talk', Station>[];
        story: SASegment<'story', Station>[];
    };

    type IVSegmentType =
        | 'station_jingle'
        | 'dj_talk'
        | 'advert'
        | 'weather'
        | 'news';
    type IVWeatherType = 'sun' | 'rain' | 'fog' | 'cloud' | 'wind';
    type IVSegment<
        Type extends IVSegmentType,
        Station extends IVStationKey
    > = Segment<'iv', Type, Station>;
    type IVStationSegments<Station extends IVStationKey = IVStationKey> = {
        station_jingle: Segment<'iv', 'station_jingle', Station>[];
        dj_talk: Segment<'iv', 'dj_talk', Station>[];
    };

    type Segment<
        Game extends 'sa' | 'iv',
        Type extends Game extends 'sa'
            ? SASegmentType
            : Game extends 'iv'
              ? IVSegmentType
              : never,
        Station extends Game extends 'sa'
            ? SAStationKey
            : Game extends 'iv'
              ? IVStationKey
              : never
    > = {
        name: string;
        type: Type;
        audio: string;
        weather_type: Type extends 'weather'
            ? Game extends 'sa'
                ? SAWeatherType
                : Game extends 'iv'
                  ? IVWeatherType
                  : undefined
            : undefined;
        station_key: Type extends 'advert' ? undefined : Station;
        formatted: {
            type: string;
        };
    };

    type SegmentType<Game extends 'sa' | 'iv'> = {
        sa: SASegmentType;
        iv: IVSegmentType;
    }[Game];

    type Version = {
        major: number;
        minor: number;
        patch: number;
        formatted: string;
    };

    namespace Github {
        type Version = {
            github_url: string;
            diff_url: string;
            version: Api.Version;
            date: number;
            commits: Commit[];
            formatted: {
                date: string;
                version: string;
            };
        };

        type Author = {
            github_url: string;
            name: string;
            avatar: string;
        };

        type Commit = {
            github_url: string;
            hash: string;
            message: string;
            author: Author;
            date: number;
            edits: {
                additions: number;
                deletions: number;
                total: number;
                files_changed: number;
            };
            files: File[];
            formatted: {
                date: string;
            };
        };

        type FileStatus =
            | 'added'
            | 'removed'
            | 'modified'
            | 'renamed'
            | 'copied'
            | 'changed'
            | 'unchanged';

        type File = {
            additions: number;
            deletions: number;
            changes: number;
            status: FileStatus;
            extension?: string;
            path: {
                full: string;
                name: string;
            };
        };
    }
}

export namespace Pages {
    type Globals = {
        version: Api.Version;
    };

    type Base = {
        globals: Globals;
    };

    type MdDocs = Base & {
        md: string;
        html: string;
        path: string;
    };

    type Versions = Base & {
        versions: Api.Github.Version[];
    };

    type Player = Base & {
        seo?: {
            title: string;
            description: string;
            image: string;
            url: string;
        };
    };
}

export type LazyLoadable<T> = T | (() => Promise<T>);
