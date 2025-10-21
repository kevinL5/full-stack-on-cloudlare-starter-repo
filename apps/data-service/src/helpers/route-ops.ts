import { getLink } from "@repo/data-ops/queries/links";
import { linkSchema, LinkSchemaType } from "@repo/data-ops/zod-schema/links";
import { LinkClickMessageType } from "@repo/data-ops/zod-schema/queue";
import moment from "moment";

async function getLinkInfoFromKv(env: Env, id: string) {
  const linkInfo = await env.CACHE.get(id)
  if (!linkInfo) {
    return null
  }
  try {
    const parsedLinkInfo = JSON.parse(linkInfo)
    return linkSchema.parse(parsedLinkInfo)
  } catch (error) {
    return null
  }
}

const TTL_TIME = 60 * 60 * 24 // 1 day

async function saveLinkInfoToKv(env: Env, id: string, linkInfo: LinkSchemaType) {
	try {
		await env.CACHE.put(id, JSON.stringify(linkInfo),
        {
            expirationTtl: TTL_TIME,
        }
    );
	} catch (error) {
		console.error('Error saving link info to KV:', error);
	}
}

export async function getRoutingDestinations(env: Env, id: string, ctx: ExecutionContext) {
  const linkInfo = await getLinkInfoFromKv(env, id);
  console.log('linkInfo from KV:', linkInfo)
  if (linkInfo) return linkInfo;
  const linkInfoFromDb = await getLink(id);
  if (!linkInfoFromDb) return null;
  console.log('linkInfo from DB:', linkInfoFromDb)
  ctx.waitUntil(saveLinkInfoToKv(env, id, linkInfoFromDb));
  return linkInfoFromDb
}


export function getDestinationForCountry(linkInfo: LinkSchemaType, countryCode?: string) {
	// Check if the country code exists and is present in destinations
	if (countryCode && linkInfo.destinations[countryCode]) {
		return linkInfo.destinations[countryCode];
	}

	// Fallback to default
	return linkInfo.destinations.default;
}

export async function scheduleEvalWorkflow(env: Env, data: LinkClickMessageType["data"]) {
  const doId = env.EVALUATION_SCHEDULER.idFromName(`${data.id}:${data.destination}`);
  const stub = env.EVALUATION_SCHEDULER.get(doId);

  await stub.collectClickData({
    accountId: data.accountId,
    linkId: data.id,
    destinationUrl: data.destination,
    destinationCountryCode: data.country || "UNKNOWN",
  });
}

export async function captureLinkClickInBackground(env: Env, event: LinkClickMessageType) {
  await env.QUEUE.send(event);
  
  const doId = env.LINK_CLICK_TRACKER.idFromName(event.data.accountId);
  const stub = env.LINK_CLICK_TRACKER.get(doId);

	if (!event.data.latitude || !event.data.longitude || !event.data.country) return

  await stub.addClick(event.data.latitude, event.data.longitude, event.data.country, moment().valueOf());
}
