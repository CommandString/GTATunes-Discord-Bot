import { parse } from 'dotenv';
import { readFileSync } from 'fs';
import path from 'path';

type Env = {
    TOKEN: string;
    ID: string;
    GTATUNES_HOST: string;
    DEV: string;
};

let env: Env | null = null;

export default function useEnv(): Env {
    if (env === null) {
        try {
            const envPath = path.resolve('.env');
            const envFile = readFileSync(envPath, 'utf8');
            env = parse(envFile) as Env;
        } catch (error) {
            console.error('Failed to parse .env file', error);
            process.exit(1);
        }
    }

    return env;
}
