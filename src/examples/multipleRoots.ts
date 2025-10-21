import { createFilter } from '../core/index.js';

const filter = createFilter({
  defaultValues: { keyword: '', page: 1, pageSize: 20 },
});

const paginationRoot = filter.createHeadlessRoot({
  selector: (draft) => ({ page: draft.page, pageSize: draft.pageSize }),
  apply: (api, values) => {
    api.load(values, { mode: 'merge', decode: false });
  },
});

paginationRoot.subscribe((state) => {
  console.log('[pagination root]', state);
});

filter.getField('keyword').setValue('tablet');
filter.getField('page').setValue(2);

paginationRoot.setSnapshot({ page: 10, pageSize: 50 });
