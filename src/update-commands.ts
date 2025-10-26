import { REST, Routes } from 'discord.js';
import { PlayConfig } from './Commands/Play';
import { StationsConfig } from './Commands/Stations';
import { VersionConfig } from './Commands/Version';
import useEnv from './env';
import { setGTATunesSDK } from './Core/useGTATunesSDK';
import GTATunesSDK from './Core/GTATunesSDK';
import { PlayerConfig } from './Commands/Player';
import { InfoConfig } from './Commands/Info';
import { figletText, gtaTunesLog } from './Core/logger';
import p from 'picocolors';

const env = useEnv();

const rest = new REST({ version: '10' }).setToken(env.TOKEN);

(async () => {
    console.log(p.red(await figletText('GTATunes Bot', { font: 'Speed' })));
    console.log(p.dim('Updating discord commands...'));
    setGTATunesSDK(new GTATunesSDK());

    const commands = [
        PlayConfig,
        await StationsConfig(),
        VersionConfig,
        PlayerConfig,
        InfoConfig
    ];

    try {
        gtaTunesLog('INFO', 'Started refreshing application slash commands.');

        await rest.put(Routes.applicationCommands(env.ID), { body: commands });

        gtaTunesLog(
            'INFO',
            p.green('Successfully reloaded application slash commands.')
        );
        gtaTunesLog(
            'INFO',
            `${commands.map(command => p.green(command.name)).join(', ')}`
        );
    } catch (e) {
        gtaTunesLog('CRIT', e);
    }
})();
