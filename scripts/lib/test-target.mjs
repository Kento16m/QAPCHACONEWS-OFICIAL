// These projects hold real data. Tests create and delete rows, so they never run there.
const REAL_PROJECTS = ["nkkgwjvmdxggvyzehlzp", "ooswoucakxnymtdblrzd"];

export const assertTestTarget = (refOrUrl) => {
  if (REAL_PROJECTS.some((ref) => refOrUrl.includes(ref))) {
    throw new Error(`Este proyecto tiene datos reales: ${refOrUrl}. Usá el proyecto de pruebas.`);
  }
};
