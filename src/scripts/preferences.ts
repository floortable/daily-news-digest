const read = new Set<string>(JSON.parse(localStorage.getItem('dnd-read') || '[]'));
const saved = new Set<string>(JSON.parse(localStorage.getItem('dnd-saved') || '[]'));

function persist() {
  localStorage.setItem('dnd-read', JSON.stringify([...read]));
  localStorage.setItem('dnd-saved', JSON.stringify([...saved]));
}

for (const card of document.querySelectorAll<HTMLElement>('[data-article-id]')) {
  const id = card.dataset.articleId!;
  const readButton = card.querySelector<HTMLButtonElement>('[data-action="read"]');
  const saveButton = card.querySelector<HTMLButtonElement>('[data-action="save"]');
  const update = () => {
    card.classList.toggle('is-read', read.has(id)); card.classList.toggle('is-saved', saved.has(id));
    readButton?.setAttribute('aria-pressed', String(read.has(id))); saveButton?.setAttribute('aria-pressed', String(saved.has(id)));
  };
  readButton?.addEventListener('click', () => { read.has(id) ? read.delete(id) : read.add(id); persist(); update(); });
  saveButton?.addEventListener('click', () => { saved.has(id) ? saved.delete(id) : saved.add(id); persist(); update(); });
  update();
}

const filter = document.querySelector<HTMLSelectElement>('#article-filter');
const unread = document.querySelector<HTMLInputElement>('#unread-only');
const apply = () => {
  for (const card of document.querySelectorAll<HTMLElement>('[data-article-id]')) {
    const value = filter?.value || 'all';
    const match = value === 'all' || (value === 'top5' && card.dataset.top5 === 'true') || card.dataset.categories?.split('|').includes(value) || card.dataset.channels?.split('|').includes(value);
    card.hidden = !match || Boolean(unread?.checked && card.classList.contains('is-read'));
  }
};
filter?.addEventListener('change', apply); unread?.addEventListener('change', apply);
