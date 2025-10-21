import { getLink } from '@repo/data-ops/queries/links';
import { Hono } from 'hono';
import { cloudflareInfoSchema } from '@repo/data-ops/zod-schema/links';
import { captureLinkClickInBackground, getDestinationForCountry, getRoutingDestinations } from '@/helpers/route-ops';
import { QueueMessageSchema } from '@repo/data-ops/zod-schema/queue';

export const app = new Hono<{ Bindings: Env }>();

app.get('/click-socket', async (ctx) => {
	const upgradeHeader = ctx.req.header('Upgrade');
	if (!upgradeHeader || upgradeHeader !== 'websocket') {
		return ctx.text('Expected Upgrade: websocket', 426);
	}

	const accountId = ctx.req.header('account-id');
	if (!accountId) return ctx.text('No Headers', 404);

	const doId = ctx.env.LINK_CLICK_TRACKER.idFromName(accountId);
	const stub = ctx.env.LINK_CLICK_TRACKER.get(doId);

	return await stub.fetch(ctx.req.raw);
});

app.get('/:id', async (c) => {
	// console.log(JSON.stringify(c.req.raw.cf))
	// const cf = c.req.raw.cf as IncomingRequestCfProperties
	// const country = cf.country
	// const lat = cf.latitude
	// const long = cf.longitude
	const id = c.req.param('id');
	const link = await getRoutingDestinations(c.env, id, c.executionCtx);

	// console.log(link);

	// Obtenir l'adresse IP du client
	// const clientIP = c.req.header('CF-Connecting-IP');

	if (!link) {
		return c.text('Destination not found', 404);
	}

	const parsedCf = cloudflareInfoSchema.safeParse(c.req.raw.cf);

	if (!parsedCf.success) {
		return c.text('Invalid Cloudflare headers', 400);
	}

	const headers = parsedCf.data;
	const destination = getDestinationForCountry(link, headers.country);

	const queueMessage = {
		type: 'LINK_CLICK',
		data: {
			id,
			country: headers.country,
			destination,
			accountId: link.accountId,
			latitude: headers.latitude,
			longitude: headers.longitude,
			timestamp: new Date().toISOString(),
		},
	};

	const parsedQueueMessage = QueueMessageSchema.safeParse(queueMessage);

	if (!parsedQueueMessage.success) {
		return c.text('Invalid queue message', 400);
	}

	c.executionCtx.waitUntil(captureLinkClickInBackground(c.env, parsedQueueMessage.data));

	return c.redirect(destination);
});
