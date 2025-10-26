import p from 'picocolors';
import path from 'node:path';
import moment from 'moment';
import { resolveProjectFile, runningInDevMode } from './functions';
import fs from 'node:fs';
import figlet, { FigletOptions } from 'figlet';
import stripAnsi from 'strip-ansi';

export function gtaTunesLog(level: LoggerLevel, ...messages: any[]): void {
    const message = messages.map(stringify).join(' ');
    const formattedLevel = levels[level] ?? level;

    console.log(
        `[${centerText(formattedLevel, 20)}] [${dim(moment().format(!runningInDevMode() ? 'MM/DD/YY hh:mm A' : 'hh:mm A'))}] ${message}`
    );
}

export function logLines(level: LoggerLevel, ...lines: any[][]): void {
    for (const line of lines) {
        gtaTunesLog(level, line);
    }
}

const { bold, cyan, dim, blue, magenta, red, yellow, redBright } = p;

const levels = {
    INFO: blue('INFO'),
    WARN: yellow('WARN'),
    FAIL: red('FAIL'),
    CRIT: red('CRITICAL'),
    DISCORD: `${magenta('D.JS')}`,
    PLAYER: cyan('PLAYER'),
    GTAT: redBright('GTAT API')
};

export type LoggerLevel = keyof typeof levels;

export type LevelFormatter = (name: string) => string;

export function breakLine() {
    console.log('');
}

export function stringify(value: any): string {
    if (value === null || value === undefined) {
        return String(value);
    }

    if (typeof value === 'string') {
        return value;
    }

    if (value instanceof Error) {
        return formatErrorStack(value);
    }

    if (typeof value.stringify === 'function') {
        return value.stringify();
    }

    return JSON.stringify(value, null, 2);
}

export function fileUrl(
    filePath: string,
    name?: string,
    line?: number
): string {
    if (!fs.existsSync(filePath)) {
        return '';
    }

    name ??= path.basename(filePath);
    let url = `file:///${filePath.replace(/\\/g, '/')}`;

    if (line !== undefined) {
        url += `:${line}`;
    }

    return `\x1B]8;;${url}\x1B\\${name}\x1B]8;;\x1B\\`;
}

export function centerText(
    text: string,
    width: number,
    paddingCharacter = ' '
): string {
    const paddingLength = Math.floor((width - 10 - stripAnsi(text).length) / 2);

    const padding = paddingCharacter.repeat(paddingLength);
    let centeredText = padding + text + padding;

    if (centeredText.length !== width) {
        centeredText += paddingCharacter;
    }

    return centeredText;
}

//########################//
//   FORMAT ERROR STACK   //
//########################//
export function formatErrorStack(error: Error): string {
    let message = `${error.name}: ${error.message}\n`;

    let stack = error.stack;
    const traces = stack!.split('\n').slice(1);

    for (let k: number = 0; k <= traces.length; k++) {
        let trace = traces[k] ?? null;

        if (!trace) {
            continue;
        }

        trace = trace.trim();
        const SERVER_SRC = resolveProjectFile('./src').toLowerCase();
        const pathPos = trace.toLowerCase().indexOf(SERVER_SRC);

        if (trace.startsWith('at') && pathPos !== -1) {
            const devPath = trace.slice(pathPos, trace.length - 2);
            const devPathParts = devPath.split(path.sep);
            const directoryPath = devPathParts
                .slice(0, devPathParts.length - 1)
                .join(path.sep);
            const devFileName = devPathParts[devPathParts.length - 1];
            const [line] = devFileName
                .split(':')
                .slice(1)
                .map(v => parseInt(v));
            const fileName = devFileName.split(':')[0];
            const filePath = resolveProjectFile(directoryPath, fileName);

            const fileContent = fs.readFileSync(filePath, 'utf-8');
            const lines = fileContent.split('\n');
            const CONTEXT_LINE_COUNT = 10;
            const startLine = Math.max(
                0,
                line - Math.ceil(CONTEXT_LINE_COUNT / 2)
            );
            const endLine = Math.min(
                lines.length,
                line + Math.floor(CONTEXT_LINE_COUNT / 2)
            );
            const contextLines = lines.slice(startLine, endLine);

            let tabStrip: number | null = null;
            for (const l of contextLines) {
                const lineTabCount = l.search(/\S/) ?? 0;

                if (lineTabCount === -1) {
                    continue;
                }

                if (tabStrip === null) {
                    tabStrip = lineTabCount;
                }

                if (
                    lineTabCount < tabStrip &&
                    l.trim().length > 0 &&
                    lineTabCount !== -1
                ) {
                    tabStrip = lineTabCount;
                }
            }
            tabStrip ??= 0;

            const context = contextLines.map((l, i) => {
                const lineNumber = i + startLine + 1;
                const lineNumberLink = fileUrl(
                    filePath,
                    lineNumber.toString(),
                    lineNumber
                );
                const lineContent = l.slice(tabStrip);

                if (lineNumber === line) {
                    l = `${lineNumberLink}: ${red(lineContent)}`;
                } else {
                    l = `${lineNumberLink}: ${lineContent}`;
                }

                return l;
            });

            if (startLine !== 0) {
                context.unshift(`${startLine}: ${dim(`// ...`)} `);
            }

            if (endLine !== lines.length) {
                context.push(`${endLine + 1}: ${dim(`// ...`)}`);
            } else {
                context[context.length - 1] =
                    `${endLine}: ${dim('// end of file')}`;
            }

            const contextHeader = centerText(
                ` ${bold(fileName)} `,
                fileName.length + 30,
                '-'
            );

            context.unshift(contextHeader);
            context.push(
                centerText(' END OF CONTEXT ', fileName.length + 20, '-')
            );

            traces[k] =
                `${trace.replace(devPath, path.resolve(devPath))}\n${context.join('\n')}`;
        }
    }

    stack = traces.map(v => v.trim()).join('\n');
    message += stack;

    return message;
}

export function figletText(
    text: string,
    options: FigletOptions = {}
): Promise<string> {
    return figlet.text(text, options);
}
