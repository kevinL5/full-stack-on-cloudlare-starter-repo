import { DurableObject } from 'cloudflare:workers';
import { drizzle, DrizzleSqliteDODatabase } from 'drizzle-orm/durable-sqlite';
import { migrate } from 'drizzle-orm/durable-sqlite/migrator';
import migrations from '../../drizzle/migrations';
import { geoLinkClicksTable } from '../db/schema';
import moment from 'moment';
import { deleteOldClicks, getRecentClicks } from '@/helpers/durable-queries';

export class LinkClickTracker extends DurableObject {
	storage: DurableObjectStorage;
	db: DrizzleSqliteDODatabase<any>;

	constructor(ctx: DurableObjectState, env: Env) {
		super(ctx, env);
		this.storage = ctx.storage;
		this.db = drizzle(this.storage, { logger: false });

		// Make sure all migrations complete before accepting queries.
		// Otherwise you will need to run `this.migrate()` in any function
		// that accesses the Drizzle database `this.db`.
		ctx.blockConcurrencyWhile(async () => {
			await this._migrate();
		});
	}

	async _migrate() {
		migrate(this.db, migrations);
	}

	async addClick(latitude: number, longitude: number, country: string, time: number) {
		await this.db.insert(geoLinkClicksTable).values({
			latitude,
			longitude,
			country,
			time,
		});

		const alarm = await this.ctx.storage.getAlarm();
		if (!alarm) {
			const tenSecondsFromNow = moment().add(10, 'seconds').valueOf();
			await this.ctx.storage.setAlarm(tenSecondsFromNow);
		}
	}

	async alarm() {
		console.log('alarm');
		const clicks = await getRecentClicks(this.db);

		const sockets = this.ctx.getWebSockets();
		for (const socket of sockets) {
			socket.send(JSON.stringify(clicks));
		}

		await deleteOldClicks(this.db);
	}

	async fetch(_: Request) {
		const webSocketPair = new WebSocketPair();
		const [client, server] = Object.values(webSocketPair);
		this.ctx.acceptWebSocket(server);
		return new Response(null, {
			status: 101,
			webSocket: client,
		});
	}

	webSocketMessage(ws: WebSocket, message: string): void | Promise<void> {
		console.log('client message', message);
	}

	webSocketError(ws: WebSocket, error: unknown): void | Promise<void> {
		console.log('client error', error);
	}

	webSocketClose(ws: WebSocket, code: number, reason: string, wasClean: boolean): void | Promise<void> {
		console.log('client closed');
	}
}
