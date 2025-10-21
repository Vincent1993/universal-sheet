import { createFilter } from '../core/createFilter.js';
import { createHistoryPlugin } from '../plugins/historyPlugin.js';
import { createMemoryAdapter } from '../adapters/memoryAdapter.js';

async function demo() {
  const filter = createFilter({
    defaultValues: {
      search: '',
      minPrice: 0
    },
    plugins: [
      createHistoryPlugin({
        onHistoryChange: (history) => {
          const { draft } = history[history.length - 1];
          console.log('[history] latest draft', draft);
        }
      })
    ]
  });

  const memory = createMemoryAdapter(filter);

  filter.getField('search').setValue('camera');
  filter.getField('minPrice').setValue(1000);

  await filter.apply();

  console.log('[memory] snapshot', memory.getSnapshot());
}

void demo();
