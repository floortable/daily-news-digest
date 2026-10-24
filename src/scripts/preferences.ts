const read = new Set<string>(JSON.parse(localStorage.getItem('dnd-read') || '[]'));
const legacySaved: string[] = JSON.parse(localStorage.getItem('dnd-saved') || '[]');
const favorites = new Set<string>(JSON.parse(localStorage.getItem('dnd-favorites') || JSON.stringify(legacySaved)));

function persist() {
  localStorage.setItem('dnd-read', JSON.stringify([...read]));
  localStorage.setItem('dnd-favorites', JSON.stringify([...favorites]));
  localStorage.removeItem('dnd-saved');
}

for (const card of document.querySelectorAll<HTMLElement>('[data-article-id]')) {
  const id = card.dataset.articleId!;
  const readButton = card.querySelector<HTMLButtonElement>('[data-action="read"]');
  const favoriteButton = card.querySelector<HTMLButtonElement>('[data-action="favorite"]');
  const deepDive = card.querySelector<HTMLElement>('[data-deep-dive]');
  const update = () => {
    const isFavorite = favorites.has(id);
    card.classList.toggle('is-read', read.has(id)); card.classList.toggle('is-favorite', isFavorite);
    readButton?.setAttribute('aria-pressed', String(read.has(id)));
    favoriteButton?.setAttribute('aria-pressed', String(isFavorite));
    if (favoriteButton) favoriteButton.innerHTML = isFavorite ? '<span aria-hidden="true">★</span> お気に入り済み' : '<span aria-hidden="true">☆</span> お気に入り';
    if (deepDive) deepDive.hidden = !isFavorite;
  };
  readButton?.addEventListener('click', () => { read.has(id) ? read.delete(id) : read.add(id); persist(); update(); });
  favoriteButton?.addEventListener('click', () => { favorites.has(id) ? favorites.delete(id) : favorites.add(id); persist(); update(); apply(); });
  update();
}

const filter = document.querySelector<HTMLSelectElement>('#article-filter');
const unread = document.querySelector<HTMLInputElement>('#unread-only');
const apply = () => {
  for (const card of document.querySelectorAll<HTMLElement>('[data-article-id]')) {
    const value = filter?.value || 'all';
    const match = value === 'all' || (value === 'favorites' && card.classList.contains('is-favorite')) || (value === 'top5' && card.dataset.top5 === 'true') || card.dataset.categories?.split('|').includes(value) || card.dataset.channels?.split('|').includes(value);
    card.hidden = !match || Boolean(unread?.checked && card.classList.contains('is-read'));
  }
};
filter?.addEventListener('change', apply); unread?.addEventListener('change', apply);
