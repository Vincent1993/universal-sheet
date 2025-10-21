import { createDataPipeline, createFilter } from '../core/index.js';

const pipeline = createDataPipeline([
  {
    name: 'decode-backend',
    decode: (payload: any) => ({
      keyword: payload?.filters?.keyword ?? '',
      status: payload?.filters?.status ?? 'all',
    }),
  },
  {
    name: 'encode-backend',
    encode: (payload: any) => ({
      filters: {
        keyword: payload.keyword,
        status: payload.status,
      },
    }),
  },
]);

async function run() {
  const filter = createFilter({
    defaultValues: { keyword: '', status: 'all' },
    pipeline,
  });

  filter.load({ filters: { keyword: 'camera', status: 'draft' } }, { decode: true });

  await filter.apply();
}

void run();
