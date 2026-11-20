// Catálogo y lector de artículos. El contenido de cada artículo vive en su propio archivo HTML.
(() => {
  const listView = document.getElementById('articleListView');
  const readerView = document.getElementById('articleReaderView');
  if (!listView || !readerView) return;

  const catalogUrl = './data/articles.json';
  let articles = [];

  const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[char]);

  function showList() {
    readerView.hidden = true;
    listView.hidden = false;
    readerView.innerHTML = '';
  }

  function renderList() {
    const sorted = [...articles].sort((a, b) => b.date.localeCompare(a.date));
    listView.innerHTML = sorted.length ? sorted.map(article => `
      <button class="article-list-card" type="button" data-article-id="${escapeHtml(article.id)}">
        <span class="article-list-category">${escapeHtml(article.category || 'Artículo')}</span>
        <strong>${escapeHtml(article.title)}</strong>
        <span class="article-list-meta">${escapeHtml(article.dateLabel || article.date)} · ${escapeHtml(article.author)}</span>
        <span class="article-list-open">Leer artículo <i class="fas fa-arrow-right" aria-hidden="true"></i></span>
      </button>`).join('') : '<p class="articles-empty">Próximamente compartiremos nuevos artículos.</p>';
  }

  async function openArticle(id) {
    const article = articles.find(item => item.id === id);
    if (!article) return;
    const url = new URL(article.file, document.baseURI);
    readerView.hidden = false;
    listView.hidden = true;
    readerView.innerHTML = '<p class="article-loading">Cargando artículo…</p>';
    try {
      const response = await fetch(url.href, { cache: 'no-cache' });
      if (!response.ok) throw new Error('No se pudo cargar el artículo');
      const articleMarkup = await response.text();
      const parsedArticle = new DOMParser().parseFromString(articleMarkup, 'text/html');
      parsedArticle.querySelectorAll('a').forEach(link => link.replaceWith(...link.childNodes));
      readerView.innerHTML = `
        <button class="article-back" type="button"><i class="fas fa-arrow-left" aria-hidden="true"></i> Todos los artículos</button>
        ${parsedArticle.body.innerHTML}`;
      readerView.querySelector('.article-back')?.addEventListener('click', showList);
    } catch (error) {
      readerView.innerHTML = '<button class="article-back" type="button"><i class="fas fa-arrow-left"></i> Todos los artículos</button><p class="article-error">No fue posible cargar este artículo. Inténtalo nuevamente.</p>';
      readerView.querySelector('.article-back')?.addEventListener('click', showList);
    }
  }

  listView.addEventListener('click', event => {
    const button = event.target.closest('[data-article-id]');
    if (button) openArticle(button.dataset.articleId);
  });

  fetch(catalogUrl)
    .then(response => {
      if (!response.ok) throw new Error('No se pudo cargar el catálogo');
      return response.json();
    })
    .then(data => {
      articles = Array.isArray(data.articles) ? data.articles : [];
      renderList();
    })
    .catch(() => {
      listView.innerHTML = '<p class="article-error">No fue posible cargar los artículos. Inténtalo nuevamente más tarde.</p>';
    });
})();
