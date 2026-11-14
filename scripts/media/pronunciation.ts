import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { z } from 'zod';

const dictionarySchema = z.record(z.string().min(1), z.string().min(1));

export async function readPronunciations() {
  const dictionary = dictionarySchema.parse(JSON.parse(await readFile(resolve('config/pronunciations.json'), 'utf8')));
  assertPronunciationContinuity(dictionary);
  return dictionary;
}

export function assertPronunciationContinuity(dictionary: Record<string, string>) {
  const interrupted = Object.entries(dictionary)
    .filter(([surface, reading]) => /[A-Za-z]/.test(surface) && /[・、]/.test(reading))
    .map(([surface]) => surface);
  if (interrupted.length) {
    throw new Error(
      `読みの途中にVOICEVOXが間を置く中黒または読点が含まれています: ${interrupted.join(', ')}。`
      + '一つの固有名詞や略語は「ユーアールエル」のようにつなげて登録してください。',
    );
  }
}

export function applyPronunciations(text: string, dictionary: Record<string, string>) {
  const keys = Object.keys(dictionary).sort((a, b) => b.length - a.length);
  if (!keys.length) return text;
  const pattern = new RegExp(keys.map(escapeRegExp).join('|'), 'g');
  return text.replace(pattern, (surface) => dictionary[surface]);
}

export function findUnpronouncedLatinTerms(text: string, dictionary: Record<string, string>) {
  const spokenText = applyPronunciations(text, dictionary);
  return [...new Set(spokenText.match(/[A-Za-z][A-Za-z0-9]*(?:[.+#/_-][A-Za-z0-9]+)*/g) ?? [])];
}

export function assertLatinPronunciations(texts: string[], dictionary: Record<string, string>) {
  const terms = [...new Set(texts.flatMap((text) => findUnpronouncedLatinTerms(text, dictionary)))];
  if (terms.length) {
    throw new Error(
      `英語の製品名・ライブラリ名などに確認済みの読みがありません: ${terms.join(', ')}。`
      + '公式サイト、公式の日本語表記、開発元の発音案内などで読みを確認し、config/pronunciations.jsonへ追加してください。',
    );
  }
}

export function findUnpronouncedLatinCompoundTerms(text: string, dictionary: Record<string, string>) {
  const latinWord = '[A-Za-z]+(?:[.+#/_-][A-Za-z]+)*';
  const registeredCompounds = Object.keys(dictionary).filter((surface) => /[A-Za-z].* [A-Za-z]/.test(surface));
  const registeredRanges = registeredCompounds.flatMap((surface) => [...findLiteralRanges(text, surface)]);
  const terms = [...text.matchAll(new RegExp(`(?<![A-Za-z0-9])${latinWord}(?: +${latinWord})+`, 'g'))]
    .filter((match) => {
      const [surface] = match;
      const start = match.index!;
      const end = start + surface.length;
      return surface.split(/ +/).every((word) => dictionary[word])
        && !dictionary[surface]
        && !text.slice(end).match(/^ +\d/)
        && !registeredRanges.some((range) => range.start < end && start < range.end);
    })
    .map((match) => match[0]);
  return [...new Set(terms)];
}

export function assertLatinCompoundPronunciations(texts: string[], dictionary: Record<string, string>) {
  const terms = [...new Set(texts.flatMap((text) => findUnpronouncedLatinCompoundTerms(text, dictionary)))];
  if (terms.length) {
    throw new Error(
      `スペースで続く英字固有名詞に確認済みの連続した読みがありません: ${terms.join(', ')}。`
      + '全体の複合形をconfig/pronunciations.jsonへ一語として登録してください。',
    );
  }
}

export function findUnpronouncedLatinNumberTerms(text: string, dictionary: Record<string, string>) {
  const spokenText = applyPronunciations(text, dictionary);
  const latinTerm = '[A-Za-z][A-Za-z0-9]*(?:[.+#/_-][A-Za-z0-9]+)*';
  const number = '\\d+(?:[.,]\\d+)*';
  const latinTerms = [...spokenText.matchAll(new RegExp(`(?<![A-Za-z0-9])${latinTerm} +${number}`, 'g'))]
    .map((match) => match[0]);
  const readings = [...new Set(Object.entries(dictionary)
    .filter(([surface, reading]) => /[A-Za-z]/.test(surface) && /^[ァ-ヶー]+$/.test(reading))
    .map(([, reading]) => reading))]
    .sort((a, b) => b.length - a.length);
  const katakanaTerms = readings.length
    ? [...spokenText.matchAll(new RegExp(`(?<![ァ-ヶー])(?:${readings.map(escapeRegExp).join('|')}) +${number}`, 'g'))]
      .map((match) => match[0])
    : [];
  return [...new Set([...latinTerms, ...katakanaTerms])];
}

export function assertLatinNumberPronunciations(texts: string[], dictionary: Record<string, string>) {
  const terms = [...new Set(texts.flatMap((text) => findUnpronouncedLatinNumberTerms(text, dictionary)))];
  if (terms.length) {
    throw new Error(
      `番号付きの英字固有名詞に確認済みの連続した読みがありません: ${terms.join(', ')}。`
      + '数字まで含む複合形をconfig/pronunciations.jsonへ登録してください。',
    );
  }
}

export function findKatakanaNumberTerms(text: string) {
  // Exclude common counter and currency suffixes so, for example, 「トークン8ドル」
  // remains ordinary prose rather than a product-name false positive.
  const katakanaNumber = /(?<![ァ-ヶー])(?:[ァ-ヶー]+・)*[ァ-ヶー]+\d+(?![\d年月日時分秒回個台本枚件人円ドル%％])/g;
  return [...new Set([...text.matchAll(katakanaNumber)].map((match) => match[0]))];
}

export function assertKatakanaNumberPronunciations(texts: string[]) {
  const terms = [...new Set(texts.flatMap((text) => findKatakanaNumberTerms(text)))];
  if (terms.length) {
    throw new Error(
      `カタカナで手書きされた番号付き固有名詞があります: ${terms.join(', ')}。`
      + '台本では固有名詞と数字を原表記のまま書き、config/pronunciations.jsonの読みを使ってください。',
    );
  }
}

export function findSeparatedKatakanaPronunciationTerms(text: string, dictionary: Record<string, string>) {
  const registeredReadings = new Set(
    Object.values(dictionary).filter((reading) => /^[ァ-ヶー]+$/.test(reading)),
  );
  const separatedKatakana = /(?<![ァ-ヶー])(?:[ァ-ヶー]+・)+[ァ-ヶー]+(?![ァ-ヶー])/g;
  return [...new Set(
    [...text.matchAll(separatedKatakana)]
      .map((match) => match[0])
      .filter((term) => registeredReadings.has(term.replaceAll('・', ''))),
  )];
}

export function assertSeparatedKatakanaPronunciations(texts: string[], dictionary: Record<string, string>) {
  const terms = [...new Set(texts.flatMap((text) => findSeparatedKatakanaPronunciationTerms(text, dictionary)))];
  if (terms.length) {
    throw new Error(
      `辞書の読みを中黒で分けて手書きした固有名詞があります: ${terms.join(', ')}。`
      + '台本では固有名詞を原表記のまま書き、config/pronunciations.jsonの読みを使ってください。',
    );
  }
}

function* findLiteralRanges(text: string, value: string) {
  let start = text.indexOf(value);
  while (start !== -1) {
    yield { start, end: start + value.length };
    start = text.indexOf(value, start + value.length);
  }
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
