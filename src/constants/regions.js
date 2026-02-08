// Regions and queues configuration

export const REGIONS = {
  kyiv: { name: 'Київ', code: 'kyiv' },
  'kyiv-region': { name: 'Київщина', code: 'kyiv-region' },
  dnipro: { name: 'Дніпропетровщина', code: 'dnipro' },
  odesa: { name: 'Одещина', code: 'odesa' },
};

// Map of region display names to codes
export const REGION_NAME_TO_CODE = {
  'Київ': 'kyiv',
  'Київщина': 'kyiv-region',
  'Дніпропетровщина': 'dnipro',
  'Одещина': 'odesa',
};

// Map of region codes to display names (for backward compatibility)
export const REGION_CODE_TO_NAME = {
  'kyiv': 'Київ',
  'kyiv-region': 'Київщина',
  'dnipro': 'Дніпропетровщина',
  'odesa': 'Одещина',
};

export const GROUPS = [1, 2, 3, 4, 5, 6];
export const SUBGROUPS = [1, 2];

// Generate all queue combinations: 1.1, 1.2, 2.1, 2.2, etc.
export const QUEUES = GROUPS.flatMap(group => 
  SUBGROUPS.map(subgroup => `${group}.${subgroup}`)
);

// Get region by code
export function getRegion(code) {
  return REGIONS[code] || null;
}

// Get region by name
export function getRegionByName(name) {
  const code = REGION_NAME_TO_CODE[name];
  return code ? REGIONS[code] : null;
}
