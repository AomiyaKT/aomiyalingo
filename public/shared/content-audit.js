import { curriculumCatalog } from './curriculum.js';
import { sentenceFor, normalizeAnswer } from '../learning/exercises.js';

export function auditTeachingContent(config, exists = () => true) {
  const issues = [],
    profiles = [];
  for (const entry of Object.values(curriculumCatalog)) {
    const profile = entry.key ? config[entry.key] : config;
    if (!profile) continue;
    profiles.push({
      grade: entry.grade,
      unit: entry.unit,
      label: entry.label,
      words: profile.words.length,
    });
    const words = new Set(),
      meanings = new Map(),
      pictures = new Map();
    const add = (word, severity, code, detail) =>
      issues.push({
        grade: entry.grade,
        unit: entry.unit,
        label: entry.label,
        word: word.word,
        severity,
        code,
        detail,
      });
    for (const word of profile.words) {
      if (!word.enabled) continue;
      const normalized = normalizeAnswer(word.word);
      if (words.has(normalized)) add(word, 'error', 'duplicate-word', '同じ英語が重複しています。');
      words.add(normalized);
      const meaning = normalizeAnswer(word.meaning);
      if (meanings.has(meaning))
        add(
          word,
          'warning',
          'ambiguous-meaning',
          '同じ意味の単語があります：' + meanings.get(meaning),
        );
      meanings.set(meaning, word.word);
      const choices = [word.meaning, ...(word.distractors || [])].map(normalizeAnswer);
      if (new Set(choices).size !== choices.length)
        add(word, 'error', 'duplicate-choice', '正解と不正解の選択肢が重複しています。');
      for (const kind of ['image', 'audio']) {
        if (word[kind] && !exists(word[kind]))
          add(
            word,
            'error',
            'missing-' + kind,
            kind === 'image' ? '画像ファイルが見つかりません。' : '音声ファイルが見つかりません。',
          );
      }
      if (word.image && word.pictureEnabled !== false) {
        if (pictures.has(word.image))
          add(
            word,
            'warning',
            'shared-picture',
            '画像が同じ単語があります：' + pictures.get(word.image),
          );
        pictures.set(word.image, word.word);
      }
      if (!word.example?.trim())
        add(word, 'warning', 'missing-example', '例文がありません。文の問題では補助文を使います。');
      else if (sentenceFor(word).sentence !== word.example.trim())
        add(
          word,
          'warning',
          'example-fallback',
          '例文に対象の英語が見つからないか、対応していない記号があります。',
        );
      if (
        /\b(?:i (?:is|are)|you is|(?:he|she|it) (?:are|am)|(?:we|they) (?:is|am))\b/i.test(
          word.example || '',
        )
      )
        add(
          word,
          'warning',
          'basic-agreement',
          '例文の主語とbe動詞の組み合わせを確認してください。',
        );
      if (/\b(the|a|an|to|is|are)\s+\1\b/i.test(word.example || ''))
        add(word, 'warning', 'repeated-word', '例文に同じことばが続いています。');
      if ((word.example || '').length > 140)
        add(
          word,
          'warning',
          'long-example',
          '小学生向けの例文として長すぎないか確認してください。',
        );
    }
  }
  return {
    profiles,
    words: profiles.reduce((n, p) => n + p.words, 0),
    errors: issues.filter((i) => i.severity === 'error').length,
    warnings: issues.filter((i) => i.severity === 'warning').length,
    issues,
  };
}
