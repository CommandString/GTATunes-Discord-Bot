import type GTATunesSDK from './GTATunesSDK';

let sdk: GTATunesSDK | null = null;

export default function useGTATunesSDK(): GTATunesSDK {
    if (sdk === null) {
        throw new Error('GTATunes SDK has not been initialized yet.');
    }

    return sdk;
}

export function setGTATunesSDK(GTATunesSDK: GTATunesSDK): void {
    sdk = GTATunesSDK;
}
