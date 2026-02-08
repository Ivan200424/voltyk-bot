const REGIONS = {
  kyiv: { name: 'Київ', code: 'kyiv' },
  'kyiv-region': { name: 'Київщина', code: 'kyiv-region' },
  dnipro: { name: 'Дніпропетровщина', code: 'dnipro' },
  odesa: { name: 'Одещина', code: 'odesa' },
};

const GROUPS = [1, 2, 3, 4, 5, 6];
const SUBGROUPS = [1, 2];

const QUEUES = [];
GROUPS.forEach(group => {
  SUBGROUPS.forEach(subgroup => {
    QUEUES.push(`${group}.${subgroup}`);
  });
});

// Додаткові черги тільки для Києва (7.1 - 60.1)
const KYIV_EXTRA_QUEUE_START = 7;
const KYIV_EXTRA_QUEUE_END = 60;
const KYIV_EXTRA_QUEUES = [];
for (let group = KYIV_EXTRA_QUEUE_START; group <= KYIV_EXTRA_QUEUE_END; group++) {
  KYIV_EXTRA_QUEUES.push(`${group}.1`);
}

const REGION_CODES = Object.keys(REGIONS);

module.exports = { REGIONS, REGION_CODES, GROUPS, SUBGROUPS, QUEUES, KYIV_EXTRA_QUEUES, KYIV_EXTRA_QUEUE_START, KYIV_EXTRA_QUEUE_END };
