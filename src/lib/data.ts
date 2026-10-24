import { editionSchema, type Article, type Edition } from './schema';

const rawEditions = import.meta.glob('/data/daily/*.json', { eager: true, import: 'default' });

export function getEditions(): Edition[] {
  return Object.entries(rawEditions)
    .map(([path, raw]) => editionSchema.parse(raw, { path: [path] }))
    .sort((a, b) => b.date.localeCompare(a.date));
}

export function getLatestEdition(): Edition {
  const edition = getEditions()[0];
  if (!edition) throw new Error('ニュースデータがありません');
  return edition;
}

export function getAllArticles(): Article[] {
  return getEditions().flatMap((edition) => edition.articles);
}

export function getArticle(id: string): Article | undefined {
  return getAllArticles().find((article) => article.id === id);
}
