/**
 * Numérotation des sanctions par membre (1 = première sanction du membre sur le serveur).
 */
const sortSanctionsAsc = (sanctions) =>
  [...sanctions].sort((a, b) => a.created_at - b.created_at);

const buildMemberSanctionIndexMap = (sanctionsAsc) => {
  const map = new Map();
  sanctionsAsc.forEach((sanction, index) => {
    map.set(sanction.id, index + 1);
  });
  return map;
};

const getMemberSanctionIndex = (indexMap, sanctionId) => indexMap.get(sanctionId) ?? null;

const resolveSanctionByMemberIndex = (sanctionsAsc, memberIndex) => {
  const index = Number(memberIndex);
  if (!Number.isInteger(index) || index < 1 || index > sanctionsAsc.length) {
    return null;
  }
  return sanctionsAsc[index - 1];
};

module.exports = {
  sortSanctionsAsc,
  buildMemberSanctionIndexMap,
  getMemberSanctionIndex,
  resolveSanctionByMemberIndex
};
