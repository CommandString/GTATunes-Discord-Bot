import {
    ApplicationCommand,
    ChatInputCommandInteraction,
    EmbedBuilder,
    MessageFlags
} from 'discord.js';
import { ApplicationCommandHandler } from './InteractionHandler';
import useGTATunesSDK from '../Core/useGTATunesSDK';
import { Api } from '../Core/api';

/** @ts-ignore */
export const VersionConfig: ApplicationCommand = {
    name: 'version',
    description: 'View the current GTATunes version.'
};

export class VersionCommand extends ApplicationCommandHandler {
    commandName = VersionConfig.name;

    async handle(interaction: ChatInputCommandInteraction): Promise<void> {
        const gtaTunes = useGTATunesSDK();

        let version: Api.Version;
        let versions: Api.Github.Version[];
        let githubVersion: Api.Github.Version;

        try {
            version = await gtaTunes.getVersion();
            versions = await gtaTunes.getGithubVersions();
            githubVersion = versions.find(
                v => v.formatted.version === version.formatted
            )!;
        } catch {
            await interaction.reply(
                'Unable to retrieve GTATunes versions. Please try again later.'
            );
            return;
        }

        const embed = new EmbedBuilder();

        const totalFilesChanged = githubVersion.commits.reduce(
            (f, c) => f + c.edits.files_changed,
            0
        );
        const totalAdditions = githubVersion.commits.reduce(
            (l, c) => l + c.edits.additions,
            0
        );
        const totalDeletions = githubVersion.commits.reduce(
            (l, c) => l + c.edits.deletions,
            0
        );

        embed.setTitle(`GTATunes ${version.formatted}`);
        embed.setURL(githubVersion.github_url);
        embed.addFields(
            {
                name: 'Additions',
                value: totalAdditions.toString()
            },
            {
                name: 'Deletions',
                value: totalDeletions.toString()
            },
            {
                name: 'Files changed',
                value: totalFilesChanged.toString()
            }
        );

        await interaction.reply({
            flags: MessageFlags.Ephemeral,
            embeds: [embed]
        });
    }
}
