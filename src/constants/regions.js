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

const QUEUES = [];
GROUPS.forEach(group => {
  SUBGROUPS.forEach(subgroup => {
    QUEUES.push(`${group}.${subgroup}`);
  });
});

// Додаткові черги тільки для Києва (7.1 - 60.1)
const KYIV_EXTRA_QUEUES = [];
for (let group = 7; group <= 60; group++) {
  KYIV_EXTRA_QUEUES.push(`${group}.1`);
}

const REGION_CODES = Object.keys(REGIONS);

module.exports = { REGIONS, REGION_CODES, GROUPS, SUBGROUPS, QUEUES, KYIV_EXTRA_QUEUES };
