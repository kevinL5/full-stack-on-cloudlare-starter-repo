import { getLink } from '@repo/data-ops/queries/links';
import { Hono } from 'hono';
import { cloudflareInfoSchema } from '@repo/data-ops/zod-schema/links';
import { getDestinationForCountry, getRoutingDestinations } from '@/helpers/route-ops';
import { LinkClickMessageType, QueueMessageSchema } from '@repo/data-ops/zod-schema/queue';

export const app = new Hono<{ Bindings: Env }>();

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

  c.executionCtx.waitUntil(c.env.QUEUE.send(parsedQueueMessage.data, {
    "delaySeconds": 1, // wait 1 second before processing the message just for example
  }));

	return c.redirect(destination);
});
