import { WorkerEntrypoint } from 'cloudflare:workers';
import { app } from './hono/app';
import { initDatabase } from '@repo/data-ops/database';
import { QueueMessageSchema } from '@repo/data-ops/zod-schema/queue';
import { handleLinkClick } from './queue-handlers/link-clicks';

// workflows exports
export { DestinationEvaluationWorkflow } from '@/workflows/destination-evalutation-workflow';

// durable objects exports
export { EvaluationScheduler } from '@/durable-objects/evaluation-scheduler';
export { LinkClickTracker } from '@/durable-objects/link-click-tracker';

export default class DataService extends WorkerEntrypoint<Env> {
	constructor(ctx: ExecutionContext, env: Env) {
		super(ctx, env);
		initDatabase(env.DB);
	}

	fetch(request: Request) {
		return app.fetch(request, this.env, this.ctx);
	}
	async queue(batch: MessageBatch<unknown>) {
		// batch.queue === "smart-links-data-queue-stage"
		for (const message of batch.messages) {
			const parsedEvent = QueueMessageSchema.safeParse(message.body);
			if (!parsedEvent.success) {
				console.error('Invalid queue message', parsedEvent.error);
				return;
			}
			const event = parsedEvent.data;
			if (event.type === 'LINK_CLICK') {
				// throw new Error('TEST ERROR'); // to test the dead letter queue
				await handleLinkClick(this.env, event.data);
			}
		}
	}
}
