const REGIONS = {
  kyiv: { name: 'Київ', code: 'kyiv' },
  'kyiv-region': { name: 'Київщина', code: 'kyiv-region' },
  dnipro: { name: 'Дніпропетровщина', code: 'dnipro' },
  odesa: { name: 'Одещина', code: 'odesa' },
  lviv: { name: 'Львівщина', code: 'lviv' },
  kharkiv: { name: 'Харківщина', code: 'kharkiv' },
  donetsk: { name: 'Донеччина', code: 'donetsk' },
  zaporizhzhia: { name: 'Запорізька область', code: 'zaporizhzhia' },
  vinnytsia: { name: 'Вінницька область', code: 'vinnytsia' },
  zhytomyr: { name: 'Житомирська область', code: 'zhytomyr' },
  'ivano-frankivsk': { name: 'Івано-Франківська область', code: 'ivano-frankivsk' },
  kirovohrad: { name: 'Кіровоградська область', code: 'kirovohrad' },
  luhansk: { name: 'Луганська область', code: 'luhansk' },
  mykolaiv: { name: 'Миколаївська область', code: 'mykolaiv' },
  poltava: { name: 'Полтавська область', code: 'poltava' },
  rivne: { name: 'Рівненська область', code: 'rivne' },
  sumy: { name: 'Сумська область', code: 'sumy' },
  ternopil: { name: 'Тернопільська область', code: 'ternopil' },
  kherson: { name: 'Херсонська область', code: 'kherson' },
  khmelnytskyi: { name: 'Хмельницька область', code: 'khmelnytskyi' },
  cherkasy: { name: 'Черкаська область', code: 'cherkasy' },
  chernivtsi: { name: 'Чернівецька область', code: 'chernivtsi' },
  chernihiv: { name: 'Чернігівська область', code: 'chernihiv' },
};

const GROUPS = [1, 2, 3, 4, 5, 6];
const SUBGROUPS = [1, 2];

// Черги 1-6 мають підчерги .1 та .2
// Черги 7-60 мають тільки підчергу .1
const QUEUES = [];

// Основні черги (1-6) з двома підчергами
for (let group = 1; group <= 6; group++) {
  QUEUES.push(`${group}.1`);
  QUEUES.push(`${group}.2`);
}

// Додаткові черги (7-60) тільки з підчергою .1
for (let group = 7; group <= 60; group++) {
  QUEUES.push(`${group}.1`);
}

// Основні черги для першої сторінки (1.1 - 6.2)
const QUEUES_MAIN = QUEUES.filter(q => {
  const group = parseInt(q.split('.')[0]);
  return group <= 6;
});

// Додаткові черги для другої сторінки (7.1 - 60.1)
const QUEUES_EXTRA = QUEUES.filter(q => {
  const group = parseInt(q.split('.')[0]);
  return group > 6;
});

const REGION_CODES = Object.keys(REGIONS);

module.exports = { REGIONS, REGION_CODES, GROUPS, SUBGROUPS, QUEUES, QUEUES_MAIN, QUEUES_EXTRA };
