export const BASE_PATH = '/';

export const PATHS = {
  home: BASE_PATH,
  overview: `${BASE_PATH}overview`,
  projects: `${BASE_PATH}projects`,
  smartBuilding: `${BASE_PATH}:urbanSlug/:buildingSlug`,
} as const;
