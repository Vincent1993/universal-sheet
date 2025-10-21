import { cloneDeep } from 'es-toolkit/clone-deep';
import type { DataPipeline, Draft, PipelineStage, TransformContext } from './types.js';

class Pipeline<TDraft> implements DataPipeline<TDraft> {
  constructor(private readonly stages: PipelineStage<TDraft>[]) {}

  encode(input: TDraft, ctx: TransformContext<TDraft>): any {
    let payload: any = cloneDeep(input) as any;
    for (const stage of this.stages) {
      if (stage.encode) {
        payload = stage.encode(payload, ctx);
      }
    }
    return payload;
  }

  decode(input: any, ctx: TransformContext<TDraft>): TDraft {
    let payload: any = cloneDeep(input);
    for (const stage of [...this.stages].reverse()) {
      if (stage.decode) {
        payload = stage.decode(payload, ctx);
      }
    }
    return payload as TDraft;
  }

  extend(stage: PipelineStage<TDraft>): DataPipeline<TDraft> {
    return new Pipeline<TDraft>([...this.stages, stage]);
  }
}

export function createDataPipeline<TDraft = Draft>(stages: PipelineStage<TDraft>[]): DataPipeline<TDraft> {
  return new Pipeline(stages);
}
