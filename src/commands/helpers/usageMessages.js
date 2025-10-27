const cloneHelpData = (help) => {
  if (!help) {
    return null;
  }
  return {
    ...help,
    usage: { ...(help.usage || {}) },
    examples: { ...(help.examples || {}) },
    notes: Array.isArray(help.notes) ? [...help.notes] : []
  };
};

const buildUsageHint = (help, type) => {
  if (!help) {
    return null;
  }
  const usage = help.usage?.[type];
  const example = help.examples?.[type];
  const lines = [];
  if (usage) {
    lines.push(`Usage: ${usage}`);
  }
  if (example) {
    lines.push(`Exemple: ${example}`);
  }
  return lines.length > 0 ? lines.join('\n') : null;
};

const buildUsageResponse = (baseMessage, help, type) => {
  const hint = buildUsageHint(help, type);
  if (!hint) {
    return baseMessage;
  }
  return `${baseMessage}\n${hint}`;
};

module.exports = {
  cloneHelpData,
  buildUsageHint,
  buildUsageResponse
};
