export const parseJson = <T>(obj: string, fallback: any): T => {
  try {
    return JSON.parse(obj);
  } catch (error) {
    return fallback;
  }
};
