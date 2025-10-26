export type GenericEventMap = Record<string, (...args: any[]) => any>;

export default class EventEmitter<EventMap extends GenericEventMap> {
    private eventListeners: {
        [K in keyof EventMap]?: (
            | EventMap[K]
            | ((...args: Parameters<EventMap[K]>[]) => ReturnType<EventMap[K]>)
        )[];
    } = {};

    public on<K extends keyof EventMap>(
        event: K,
        listener: EventMap[K]
    ): EventHandler<EventMap, K> {
        if (!this.eventListeners[event]) {
            this.eventListeners[event] = [];
        }

        this.eventListeners[event]!.push(listener);

        return [event, listener];
    }

    public once<K extends keyof EventMap>(
        event: K,
        listener: EventMap[K]
    ): EventHandler<EventMap, K> {
        if (!this.eventListeners[event]) {
            this.eventListeners[event] = [];
        }

        this.eventListeners[event]!.push(
            (...args: Parameters<EventMap[K]>[]): ReturnType<EventMap[K]> => {
                this.removeListener([event, listener]);
                return listener(...args) as ReturnType<EventMap[K]>;
            }
        );

        return [event, listener];
    }

    public removeListener<K extends keyof EventMap>(
        ...eventHandlers: [K, EventMap[K]][]
    ): void {
        for (const eventHandler of eventHandlers) {
            const [event, listener] = eventHandler;
            this.eventListeners[event] = this.eventListeners[event]?.filter(
                l => l !== listener
            );
        }
    }

    protected async emit<K extends keyof EventMap>(
        event: K,
        ...args: Parameters<EventMap[K]>
    ): Promise<ReturnType<EventMap[K]>[]> {
        const listeners = this.eventListeners[event] ?? [];
        return listeners.map(listener => listener(...args)) as ReturnType<
            EventMap[K]
        >[];
    }
}

export class PublicEventEmitter<
    EventMap extends GenericEventMap
> extends EventEmitter<EventMap> {
    public async emit<K extends keyof EventMap>(
        event: K,
        ...args: Parameters<EventMap[K]>
    ): Promise<ReturnType<EventMap[K]>[]> {
        return super.emit<K>(event, ...args);
    }
}

export type EventHandler<
    EventMap extends GenericEventMap,
    Event extends keyof EventMap
> = [Event, EventMap[Event]];
