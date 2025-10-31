import {
    ActionRowBuilder,
    ApplicationCommand,
    ButtonBuilder,
    ButtonStyle,
    ChatInputCommandInteraction,
    EmbedBuilder,
    MessageFlags
} from 'discord.js';
import { ApplicationCommandHandler } from './InteractionHandler';
import useGTATunesSDK from '../Core/useGTATunesSDK';
import useEnv from '../env';

/** @ts-ignore */
export const InfoConfig: ApplicationCommand = {
    name: 'info',
    description: 'View information about GTATunes.'
};

export class InfoCommand extends ApplicationCommandHandler {
    commandName = InfoConfig.name;

    async handle(interaction: ChatInputCommandInteraction): Promise<void> {
        const gtaTunes = useGTATunesSDK();

        const version = await gtaTunes.getVersion();

        const embed = new EmbedBuilder();

        embed
            .setTitle(`GTATunes`)
            .setURL('https://gtatunes.net')
            .setDescription(
                'A place to listen to all of the GTA radio stations in one place.'
            )
            .setColor('#a8201a')
            .setThumbnail('https://gtatunes.net/logo.png')
            .setFields([
                {
                    name: 'Website Version',
                    value: `[${version.formatted}](https://gtatunes.net/versions)`
                },
                {
                    name: 'Discord Bot Version',
                    value: 'v1.1.1'
                }
            ])
            .setAuthor({
                name: 'Command_String',
                url: 'https://cmdstr.dev',
                iconURL: 'https://cmdstr.dev/logo.png'
            })
            .setFooter({
                text: 'Established'
            })
            .setTimestamp(new Date(Date.UTC(2024, 6, 9, 5, 50, 0)));

        const actionRow = new ActionRowBuilder<ButtonBuilder>();
        const websiteButton = new ButtonBuilder()
            .setStyle(ButtonStyle.Link)
            .setLabel('Visit Website')
            .setURL(useEnv().GTATUNES_HOST);

        actionRow.addComponents(websiteButton);

        await interaction.reply({
            flags: MessageFlags.Ephemeral,
            embeds: [embed],
            components: [actionRow]
        });
    }
}
