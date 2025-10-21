import { geoLinkClicksTable } from '@/db/schema';
import { desc, sql, lt, count } from 'drizzle-orm';
import { DrizzleSqliteDODatabase } from 'drizzle-orm/durable-sqlite';

const MAX_CLICKS = 100;


export function getRecentClicks(db: DrizzleSqliteDODatabase<any>) {
	return db.select().from(geoLinkClicksTable).orderBy(desc(geoLinkClicksTable.time)).limit(MAX_CLICKS).all();
}


export async function deleteOldClicks(db: DrizzleSqliteDODatabase<any>) {
	// Delete old clicks if there are more than 100, keeping only the 100 most recent
	// First, get the count
	const countResult = await db.select({ count: count() }).from(geoLinkClicksTable);
	const totalClicks = countResult[0]?.count ?? 0;

	if (totalClicks <= MAX_CLICKS) {
		return; // Nothing to delete
	}

	// Get the time threshold (the time of the 100th most recent click)
	const threshold = db
		.select({ time: geoLinkClicksTable.time })
		.from(geoLinkClicksTable)
		.orderBy(desc(geoLinkClicksTable.time))
		.limit(1)
		.offset(MAX_CLICKS - 1)
		.get();

	if (!threshold) {
		return;
	}

	// Delete all clicks older than the threshold
	db.delete(geoLinkClicksTable).where(lt(geoLinkClicksTable.time, threshold.time)).run();
}