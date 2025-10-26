import type { Api } from './api';

type GameColors<Game extends Api.GameKey> = Record<
    Api.StationKeys[Game],
    string[]
>;

type Colors = {
    [K in Api.GameKey]: GameColors<K>;
};

const GTA_COLORS: Colors = {
    sa: {
        bounce_fm: ['#0877BB', '#000000', '#029CF9', '#217CB0', '#073155'],
        csr: ['#890152', '#000000', '#EB018B', '#770046', '#3A0723'],
        k_dst: ['#E1A41E', '#710000', '#3D0000', '#000000', '#000000'],
        k_rose: ['#C02E26', '#FFEB00', '#457B39', '#C02E26', '#C02E26'],
        master_sounds: ['#9D3F01', '#FD7503', '#232526', '#414345', '#5F1906'],
        playback_fm: ['#3AA849', '#B61C24', '#000000', '#3AA84B', '#000000'],
        radio_los_santos: [
            '#4DC334',
            '#C48C32',
            '#000000',
            '#7C6022',
            '#7C6022'
        ],
        radio_x: ['#004e92', '#000428', '#000428', '#004e92', '#000428'],
        sfur: ['#02A4EC', '#90181A', '#000000', '#02A4EC', '#DB2424'],
        k_jah: ['#F9A501', '#D20406', '#D1FD02', '#EF7201', '#D20406'],
        wctr: ['#D001F9', '#4E0066', '#85059F', '#D001F9', '#000000']
    },
    vc: {
        emotion: ['#B81F2C', '#f857a6', '#333333', '#f857a6', '#151315'],
        flash_fm: ['#FCB912', '#060305', '#888888', '#816724', '#E9AB11'],
        fever_105: ['#FD0505', '#685050', '#180001', '#F10B07', '#681619'],
        espantoso: ['#56ab2f', '#a8e063', '#EC3128', '#a8e063', '#56ab2f'],
        v_rock: ['#EC3128', '#1967A3', '#5F3B20', '#784924', '#5F3B20'],
        wave: ['#32BCA0', '#EE3C2F', '#0E0E0E', '#2A110F', '#D3D1D3'],
        wildstyle: ['#FCF102', '#000000', '#3E4237', '#D8D224', '#D8D224']
        // k_chat: {
        //     "bg-top": "#232526",
        //     "bg-bottom": "#414345",
        //     "wave-1": "#ffb347",
        //     "wave-2": "#ffcc33",
        //     "wave-3": "#ffb347"
        // }
    },
    iii: {
        head_radio: ['#7996BF', '#5480B4', '#96C2BF', '#000000', '#D6E4EF'],
        lips_106: ['#C4261C', '#4564B7', '#111111', '#111111', '#111111'],
        rise_fm: ['#09070E', '#7B7D81', '#E9EBEB', '#C5C5C5', '#83878A'],
        msx_fm: ['#151515', '#222222', '#000000', '#243555', '#000000'],
        // chatterbox: {
        //     "bg-top": "#232526",
        //     "bg-bottom": "#414345",
        //     "wave-1": "#ffb347",
        //     "wave-2": "#ffcc33",
        //     "wave-3": "#ffb347"
        // },
        game_radio_fm: ['#1F3D38', '#00775E', '#87B5AD', '#00775E', '#000000'],
        double_clef_fm: ['#2E5D6E', '#2F7074', '#000000', '#000000', '#000000'],
        flashback_fm: ['#FCC200', '#D61E1C', '#0F2D6C', '#11275A', '#ffcc33'],
        k_jah: ['#F9A501', '#D20406', '#D1FD02', '#EF7201', '#D20406']
    },
    iv: {
        electro_choc: ['#776347', '#DF3B94', '#010101', '#776347', '#DF3B94'],
        fusion_fm: ['#89C750', '#8ACFA8', '#FF5657', '#FAAA4B', '#61C8F1'],
        independence_fm: [
            '#FFDE40',
            '#000000',
            '#ffffff',
            '#FFDE40',
            '#000000'
        ],
        integrity_2_0: ['#000000', '#111111', '#00518C', '#BE2026', '#FEBF10'],
        international_funk_99: [
            '#000000',
            '#F57E20',
            '#000000',
            '#F57E20',
            '#111111'
        ],
        jazz_nation_radio: [
            '#000000',
            '#111111',
            '#0FA44A',
            '#0FB0D9',
            '#F57E20'
        ],
        k109_the_studio: [
            '#C1912F',
            '#EDCF6F',
            '#C1912F',
            '#F3E09B',
            '#EDCF6F'
        ],
        liberty_city_hardcore: [
            '#8F1A1D',
            '#000000',
            '#111111',
            '#8F1A1D',
            '#000000'
        ],
        liberty_rock: ['#000000', '#111111', '#8C2125', '#BE2327', '#8C2125'],
        the_journey: ['#010101', '#FCE64C', '#222222', '#FCE64C', '#565656'],
        the_vibe_98_8: ['#D4CA97', '#896840', '#DED7A3', '#9D8257', '#815D37'],
        tuff_gong: ['#068C45', '#ED1E24', '#068C45', '#FFF200', '#ED1E24'],
        vice_city_fm: ['#86BCE6', '#4483C3', '#AA2423', '#D16F33', '#E7913E'],
        massive_b: ['#010101', '#F7E018', '#FAC811', '#FBCE11', '#B9970C'],
        self_actualization_fm: [
            '#000000',
            '#111111',
            '#222222',
            '#333333',
            '#111111'
        ],
        public_liberty_radio: [
            '#be2026',
            '#111111',
            '#1a62af',
            '#be2026',
            '#1a62af'
        ],
        radio_broker: ['#ef4823', '#2a3375', '#ef4822', '#2a3375', '#ef4822'],
        ramjam_fm: ['#27b34b', '#ba2926', '#27b34b', '#f4db0a', '#ba2926'],
        san_juan_sounds: [
            '#405eab',
            '#ea262a',
            '#405eab',
            '#ea262a',
            '#ea262a'
        ],
        the_beat_102_7: ['#be2025', '#fcc00c', '#fcc00c', '#be2025', '#111111'],
        the_classics_104_1: [
            '#cc3933',
            '#f5d8d7',
            '#cc3933',
            '#df8581',
            '#f5d8d7'
        ],
        vladivostok_fm: ['#f57e20', '#293375', '#293375', '#f57e20', '#293375'],
        wktt_radio: ['#1d62ae', '#be2327', '#be2327', '#1d62ae', '#1e71c9']
    }
};

export default GTA_COLORS;
