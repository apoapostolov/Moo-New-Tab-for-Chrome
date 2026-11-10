export const KNOWLEDGE_LANGUAGES = [
  'en',
  'bg',
  'de',
  'es',
  'fr',
  'it',
  'pt',
  'ja',
  'nl',
  'pl',
  'uk',
];
export const KNOWLEDGE_SOURCES = ['wikipedia', 'commons', 'both'];
export const KNOWLEDGE_MODES = ['reload', 'daily', 'hours'];
export function knowledgeSubjects(value) {
  return [
    ...new Set(
      String(value || '')
        .split(',')
        .map((text) => text.trim().replace(/\s+/g, ' '))
        .filter(Boolean),
    ),
  ]
    .slice(0, 20)
    .map((text) => text.slice(0, 100));
}
export function readKnowledgeSettings() {
  const read = (key, list, fallback) =>
    list.includes(localStorage.getItem(key)) ? localStorage.getItem(key) : fallback;
  const hours = Number(localStorage.getItem('knowledgeHours'));
  return {
    source: read('knowledgeSource', KNOWLEDGE_SOURCES, 'wikipedia'),
    language: read('knowledgeLanguage', KNOWLEDGE_LANGUAGES, 'en'),
    mode: read('knowledgeMode', KNOWLEDGE_MODES, 'hours'),
    hours: Number.isInteger(hours) && hours >= 1 && hours <= 168 ? hours : 8,
    subjects: knowledgeSubjects(localStorage.getItem('knowledgeSubjects')),
  };
}
export const knowledgeKey = (settings) =>
  JSON.stringify([
    settings.source,
    settings.language,
    settings.mode,
    settings.mode === 'hours' ? settings.hours : null,
    settings.subjects,
  ]);
export function knowledgeExpiry(settings, createdAt) {
  if (settings.mode === 'reload') return Infinity;
  if (settings.mode === 'hours') return createdAt + settings.hours * 3600000;
  const midnight = new Date(createdAt);
  midnight.setHours(24, 0, 0, 0);
  return midnight.getTime();
}

export function validKnowledgePreference(key, value) {
  const choices = {
    knowledgeSource: KNOWLEDGE_SOURCES,
    knowledgeLanguage: KNOWLEDGE_LANGUAGES,
    knowledgeMode: KNOWLEDGE_MODES,
  };
  if (Object.hasOwn(choices, key)) return choices[key].includes(value);
  if (key === 'knowledgeHours')
    return (
      value !== '' && Number.isInteger(Number(value)) && Number(value) >= 1 && Number(value) <= 168
    );
  if (key === 'knowledgeSubjects')
    return (
      value.length <= 2000 &&
      value.split(',').filter((item) => item.trim()).length <= 20 &&
      value.split(',').every((item) => item.trim().length <= 100)
    );
  return true;
}
