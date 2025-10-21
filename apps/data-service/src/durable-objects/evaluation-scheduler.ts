import { DurableObject } from 'cloudflare:workers';
import moment from 'moment';

interface ClickData {
	accountId: string;
	linkId: string;
	destinationUrl: string;
	destinationCountryCode: string;
}

export class EvaluationScheduler extends DurableObject {
	clickData: ClickData | undefined;

	constructor(state: DurableObjectState, env: Env) {
		super(state, env);
		this.ctx.blockConcurrencyWhile(async () => {
			this.clickData = (await this.ctx.storage.get<ClickData>('clickData')) || this.clickData;
		});
	}

	async collectClickData(clickData: ClickData) {
		this.clickData = clickData;
		await this.ctx.storage.put('clickData', this.clickData);

    const alarm = await this.ctx.storage.getAlarm();

    if (!alarm) {
      const tenSecondsFromNow = moment().add(10, 'seconds').valueOf();
      await this.ctx.storage.setAlarm(tenSecondsFromNow);
    }
	}

	async alarm() {
		console.log('Evaluation scheduler alarm triggered');

		const clickData = this.clickData;

		if (!clickData) throw new Error('Click data not set');

		await this.env.DESTINATION_EVALUATION_WORKFLOW.create({
			params: {
				linkId: clickData.linkId,
				destinationUrl: clickData.destinationUrl,
				accountId: clickData.accountId,
			},
		});
	}
}
