// Catálogo público: combina los artículos publicados en Supabase con el catálogo estático histórico.
(() => {
  const listView = document.getElementById('articleListView');
  const readerView = document.getElementById('articleReaderView');
  if (!listView || !readerView) return;

  const staticCatalogUrl = './data/articles.json';
  let articles = [];

  const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[char]);

  function dateLabel(date) {
    if (!date) return '';
    return new Date(date + 'T12:00:00').toLocaleDateString('es-PR',{day:'numeric',month:'long',year:'numeric'});
  }

  function articleUrl(article) {
    const url = new URL(window.location.href);
    url.searchParams.set('articulo', article.slug || article.id);
    return url.href;
  }

  function updateArticleUrl(article, method = 'pushState') {
    const url = new URL(window.location.href);
    if (article) url.searchParams.set('articulo', article.slug || article.id);
    else url.searchParams.delete('articulo');
    window.history[method]({ article: article ? (article.slug || article.id) : null }, '', url);
  }

  function showList(updateUrl = true) {
    readerView.hidden = true;
    listView.hidden = false;
    readerView.innerHTML = '';
    if (updateUrl && new URL(window.location.href).searchParams.has('articulo')) {
      updateArticleUrl(null, 'replaceState');
    }
  }

  function shareControl() {
    return '<button class="article-share" type="button"><i class="fas fa-share-nodes" aria-hidden="true"></i> Compartir artículo</button>';
  }

  async function copyText(text) {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return;
    }
    const field = document.createElement('textarea');
    field.value = text;
    field.setAttribute('readonly', '');
    field.style.position = 'fixed';
    field.style.opacity = '0';
    document.body.appendChild(field);
    field.select();
    const copied = document.execCommand('copy');
    field.remove();
    if (!copied) throw new Error('No fue posible copiar el enlace');
  }

  async function shareArticle(article) {
    const url = articleUrl(article);
    const shareData = { title: article.title, text: 'Te comparto este artículo de Pura Gracia Radio.', url };
    try {
      if (navigator.share) {
        await navigator.share(shareData);
      } else {
        await copyText(url);
        showShareCopied();
      }
    } catch (error) {
      if (error?.name === 'AbortError') return;
      try {
        await copyText(url);
        showShareCopied();
      } catch (_) {
        window.alert('No fue posible compartir automáticamente. Puedes copiar este enlace: ' + url);
      }
    }
  }

  function showShareCopied() {
    const button = readerView.querySelector('.article-share');
    if (button) button.innerHTML = '<i class="fas fa-check" aria-hidden="true"></i> Enlace copiado';
  }

  function attachReaderControls(article) {
    readerView.querySelector('.article-back')?.addEventListener('click', () => showList());
    readerView.querySelector('.article-share')?.addEventListener('click', () => shareArticle(article));
  }

  // Índice editorial compacto: título, autor y fecha. La portada y el resumen
  // se reservan para la vista de lectura para evitar repetir contenido.
  function renderList() {
    const sorted = [...articles].sort((a,b) => String(b.date || '').localeCompare(String(a.date || '')));
    listView.innerHTML = sorted.length ? sorted.map(article => `
      <button class="article-list-card" type="button" data-article-id="${escapeHtml(article.id)}" aria-label="Leer: ${escapeHtml(article.title)}">
        <strong>${escapeHtml(article.title)}</strong>
        <span class="article-list-meta">${escapeHtml(article.author)}${article.author && (article.dateLabel || article.date) ? ' · ' : ''}${escapeHtml(article.dateLabel || dateLabel(article.date))}</span>
        <span class="article-list-open">Leer artículo <i class="fas fa-arrow-right" aria-hidden="true"></i></span>
      </button>`).join('') : '<p class="articles-empty">Próximamente compartiremos nuevos artículos.</p>';
  }

  function renderDatabaseArticle(article) {
    const cover = article.cover ? '<img class="article-cover" src="'+escapeHtml(article.cover)+'" alt="'+escapeHtml(article.coverAlt || '')+'">' : '';
    return `
      <button class="article-back" type="button"><i class="fas fa-arrow-left" aria-hidden="true"></i> Todos los artículos</button>
      ${shareControl()}
      <article class="article-full">
        <header class="article-full-header">
          <span class="article-category">${escapeHtml(article.category || 'ARTÍCULO')}</span>
          <h2>${escapeHtml(article.title)}</h2>
          <div class="article-byline"><time datetime="${escapeHtml(article.date)}">${escapeHtml(article.dateLabel || dateLabel(article.date))}</time><span>Por ${escapeHtml(article.author)}</span></div>
        </header>
        ${cover}
        ${article.excerpt ? '<p class="article-excerpt">'+escapeHtml(article.excerpt)+'</p>' : ''}
        <div class="article-body">${DOMPurify.sanitize(article.content || '',{USE_PROFILES:{html:true},ADD_ATTR:['target','rel']})}</div>
      </article>`;
  }

  async function openArticle(id, updateUrl = true) {
    const article = articles.find(item => item.id === id || item.slug === id);
    if (!article) return;
    if (updateUrl) updateArticleUrl(article);
    readerView.hidden = false;
    listView.hidden = true;
    readerView.innerHTML = '<p class="article-loading">Cargando artículo…</p>';
    try {
      if (article.content !== undefined) {
        readerView.innerHTML = renderDatabaseArticle(article);
      } else {
        const response = await fetch(new URL(article.file,document.baseURI).href,{cache:'no-cache'});
        if (!response.ok) throw new Error('No se pudo cargar el artículo');
        const markup = await response.text();
        const parsed = new DOMParser().parseFromString(markup,'text/html');
        readerView.innerHTML = '<button class="article-back" type="button"><i class="fas fa-arrow-left" aria-hidden="true"></i> Todos los artículos</button>' +
          shareControl() + DOMPurify.sanitize(parsed.body.innerHTML,{USE_PROFILES:{html:true},ADD_ATTR:['target','rel']});
      }
      attachReaderControls(article);
    } catch (error) {
      readerView.innerHTML = '<button class="article-back" type="button"><i class="fas fa-arrow-left"></i> Todos los artículos</button><p class="article-error">No fue posible cargar este artículo. Inténtalo nuevamente.</p>';
      attachReaderControls(article);
    }
  }

  listView.addEventListener('click',event => {
    const button = event.target.closest('[data-article-id]');
    if (button) openArticle(button.dataset.articleId);
  });

  window.addEventListener('popstate', () => {
    const id = new URL(window.location.href).searchParams.get('articulo');
    if (id) openArticle(id, false);
    else showList(false);
  });

  async function loadArticles() {
    let databaseArticles = [];
    if (window.supabase && window.PGR_SUPABASE_URL && window.PGR_SUPABASE_KEY) {
      try {
        const client = window.supabase.createClient(window.PGR_SUPABASE_URL,window.PGR_SUPABASE_KEY);
        const {data,error} = await client.from('articles')
          .select('id,slug,title,author,category,article_date,excerpt,content_html,cover_image_url,cover_image_alt')
          .eq('status','published').order('article_date',{ascending:false});
        if (error) throw error;
        databaseArticles = (data || []).map(row => ({
          id:row.id,slug:row.slug,title:row.title,author:row.author,date:row.article_date,
          dateLabel:dateLabel(row.article_date),category:row.category,excerpt:row.excerpt,
          content:row.content_html,cover:row.cover_image_url,coverAlt:row.cover_image_alt
        }));
      } catch (error) {
        console.warn('No fue posible consultar Supabase; se mostrará el catálogo histórico disponible.',error);
      }
    }

    let staticArticles = [];
    try {
      const response = await fetch(staticCatalogUrl,{cache:'no-cache'});
      if (response.ok) {
        const data = await response.json();
        staticArticles = Array.isArray(data.articles) ? data.articles : [];
      }
    } catch (_) {}

    const databaseSlugs = new Set(databaseArticles.map(a => a.slug).filter(Boolean));
    const staticFallback = staticArticles.filter(a => !databaseSlugs.has(a.id)).map(a => ({...a,dateLabel:a.dateLabel}));
    articles = [...databaseArticles,...staticFallback];
    renderList();
    const requestedArticle = new URL(window.location.href).searchParams.get('articulo');
    if (requestedArticle) openArticle(requestedArticle, false);
  }

  loadArticles();
})();
