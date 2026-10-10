export const ProjectType = {
  Hotspot360: 1,
  Tour360: 2,
  Model3D: 3,
} as const;

export const IsPublicProject = {
  Creating: 0,
  Active: 1,
  Inactive: 2,
  Generating: 3,
  Failed: 4,

  All: 100,
  NotFailed: 101,
  Running: 102,
  Finished: 103,
} as const;

export type ProjectType = (typeof ProjectType)[keyof typeof ProjectType];
export type IsPublicProject =
  (typeof IsPublicProject)[keyof typeof IsPublicProject];
