(() => {
  const $ = id => document.getElementById(id);
  const client = window.supabase.createClient(window.PGR_SUPABASE_URL, window.PGR_SUPABASE_KEY);
  let currentUser = null, currentRole = null, articles = [], coverUrl = null, coverPath = null;
  const versions = {
    RVR1960: { id: '149', code: 'RVR1960', label: 'Reina-Valera 1960' },
    NVI: { id: '128', code: 'NVI', label: 'Nueva Versión Internacional' },
    NTV: { id: '127', code: 'NTV', label: 'Nueva Traducción Viviente' },
    NBLA: { id: '103', code: 'NBLA', label: 'Nueva Biblia de las Américas' }
  };
  const bookCodes = {
    'genesis':'GEN','exodo':'EXO','éxodo':'EXO','levitico':'LEV','levítico':'LEV','numeros':'NUM','números':'NUM','deuteronomio':'DEU',
    'josue':'JOS','josué':'JOS','jueces':'JDG','rut':'RUT','1 samuel':'1SA','2 samuel':'2SA','1 reyes':'1KI','2 reyes':'2KI',
    '1 cronicas':'1CH','1 crónicas':'1CH','2 cronicas':'2CH','2 crónicas':'2CH','esdras':'EZR','nehemias':'NEH','nehemías':'NEH',
    'ester':'EST','job':'JOB','salmos':'PSA','salmo':'PSA','proverbios':'PRO','eclesiastes':'ECC','eclesiastés':'ECC','cantares':'SNG',
    'isaias':'ISA','isaías':'ISA','jeremias':'JER','jeremías':'JER','lamentaciones':'LAM','ezequiel':'EZK','daniel':'DAN',
    'oseas':'HOS','joel':'JOL','amos':'AMO','abdias':'OBA','abdías':'OBA','jonas':'JON','jonás':'JON','miqueas':'MIC','nahum':'NAM',
    'habacuc':'HAB','sofonias':'ZEP','sofonías':'ZEP','hageo':'HAG','hageo':'HAG','zacarias':'ZEC','zacarías':'ZEC','malaquias':'MAL','malaquías':'MAL',
    'mateo':'MAT','marcos':'MRK','lucas':'LUK','juan':'JHN','hechos':'ACT','romanos':'ROM','1 corintios':'1CO','2 corintios':'2CO',
    'galatas':'GAL','gálatas':'GAL','efesios':'EPH','filipenses':'PHP','colosenses':'COL','1 tesalonicenses':'1TH','2 tesalonicenses':'2TH',
    '1 timoteo':'1TI','2 timoteo':'2TI','tito':'TIT','filemon':'PHM','filemón':'PHM','hebreos':'HEB','santiago':'JAS',
    '1 pedro':'1PE','2 pedro':'2PE','1 juan':'1JN','2 juan':'2JN','3 juan':'3JN','judas':'JUD','apocalipsis':'REV'
  };
  const slugify = value => value.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
  const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const localDate = () => { const d = new Date(); return new Date(d.getTime()-d.getTimezoneOffset()*60000).toISOString().slice(0,10); };
  const message = (text, error=false) => { $('editorMessage').textContent = text; $('editorMessage').style.color = error ? '#f0a0a0' : '#edc779'; };
  const statusText = status => status === 'published' ? 'Publicado' : 'Borrador';

  // Copia de seguridad local independiente de Supabase.
  let autosaveTimer = null, lastLocalFingerprint = '';
  const localKey = () => currentUser ? 'pgr-editor-recovery:' + currentUser.id + ':' + ($('articleId').value || 'new') : null;
  function readLocalBackup(key) {
    try { const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : null; }
    catch (_) { return null; }
  }
  function editorSnapshot() {
    return {
      articleId: $('articleId').value || '',
      title: $('articleTitle').value,
      author: $('articleAuthor').value,
      category: $('articleCategory').value,
      date: $('articleDate').value,
      excerpt: $('articleExcerpt').value,
      content: $('articleContent').innerHTML,
      coverUrl,
      coverAlt: $('coverAlt').value,
      savedAt: new Date().toISOString()
    };
  }
  function applySnapshot(data) {
    $('articleId').value = data.articleId || '';
    $('articleTitle').value = data.title || '';
    $('articleAuthor').value = data.author || '';
    $('articleCategory').value = data.category || '';
    $('articleDate').value = data.date || localDate();
    $('articleExcerpt').value = data.excerpt || '';
    $('articleContent').innerHTML = data.content || '';
    coverUrl = data.coverUrl || null;
    coverPath = null;
    $('coverPreview').src = coverUrl || '';
    $('coverPreview').hidden = !coverUrl;
    $('removeCoverBtn').hidden = !coverUrl;
    $('coverAlt').value = data.coverAlt || '';
  }
  function recoverLocalBackup(key) {
    const backup = readLocalBackup(key);
    if (!backup) return false;
    const when = new Date(backup.savedAt).toLocaleString('es-PR');
    if (!confirm('Encontré una copia local de este artículo guardada el ' + when + '. ¿Deseas recuperarla?')) {
      try { localStorage.removeItem(key); } catch (_) {}
      return false;
    }
    applySnapshot(backup);
    lastLocalFingerprint = JSON.stringify(editorSnapshot());
    $('saveStatus').textContent = 'Copia local recuperada · guarda el borrador en Supabase';
    message('Se recuperó la última copia local. Todavía debes guardar el borrador en Supabase.');
    return true;
  }
  function saveLocalBackup() {
    if (!currentUser || $('editorPanel').hidden || currentRole === 'publisher') return;
    const data = editorSnapshot();
    const meaningful = data.title.trim() || data.content.trim() || data.excerpt.trim();
    if (!meaningful) return;
    const fingerprint = JSON.stringify(data);
    if (fingerprint === lastLocalFingerprint) return;
    try {
      localStorage.setItem(localKey(), JSON.stringify(data));
      lastLocalFingerprint = fingerprint;
      $('saveStatus').textContent = 'Copia local guardada · ' + new Date().toLocaleTimeString('es-PR');
    } catch (_) {
      $('saveStatus').textContent = 'No se pudo guardar la copia local';
    }
  }
  function clearLocalBackup() {
    try { if (localKey()) localStorage.removeItem(localKey()); } catch (_) {}
    lastLocalFingerprint = JSON.stringify(editorSnapshot());
  }

  async function boot() {
    const { data: { session } } = await client.auth.getSession();
    if (session) await showEditor(session.user);
    $('loginForm').addEventListener('submit', async event => {
      event.preventDefault();
      $('loginMessage').textContent = 'Verificando acceso…';
      const { data, error } = await client.auth.signInWithPassword({ email: $('loginEmail').value.trim(), password: $('loginPassword').value });
      if (error) $('loginMessage').textContent = error.message;
      else { $('loginMessage').textContent = ''; await showEditor(data.user); }
    });
    $('signOutBtn').addEventListener('click', async () => { await client.auth.signOut(); location.reload(); });
    client.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_OUT') location.reload();
      if (event === 'SIGNED_IN' && session && !currentUser) await showEditor(session.user);
    });
    bindEditor();
  }

  async function showEditor(user) {
    currentUser = user;
    const { data: profile, error } = await client.from('profiles').select('role,email').eq('id', user.id).single();
    if (error || !profile) {
      $('loginMessage').textContent = 'Tu cuenta no tiene un perfil editorial. Contacta al administrador.';
      await client.auth.signOut();
      return;
    }
    currentRole = profile.role;
    $('sessionEmail').textContent = user.email + ' · ' + currentRole;
    $('loginPanel').hidden = true;
    $('editorPanel').hidden = false;
    $('signOutBtn').hidden = false;
    $('userManagement').hidden = currentRole !== 'admin';
    $('newArticleBtn').hidden = currentRole === 'publisher';
    await loadArticles();
    if (currentRole === 'admin') await loadUsers();
    resetForm();
    recoverLocalBackup(localKey());
    autosaveTimer = setInterval(saveLocalBackup, 5000);
  }

  async function loadArticles() {
    $('adminArticleList').innerHTML = '<p class="muted">Cargando…</p>';
    const { data, error } = await client.from('articles').select('id,title,status,article_date,author,updated_at').order('updated_at',{ascending:false});
    if (error) { $('adminArticleList').innerHTML = '<p class="muted">No se pudieron cargar los artículos.</p>'; return; }
    articles = data || [];
    $('adminArticleList').innerHTML = articles.length ? articles.map(a => `
      <button type="button" class="admin-article-item" data-id="${a.id}">
        <strong>${escapeHtml(a.title)}</strong>
        <span>${escapeHtml(statusText(a.status))} · ${escapeHtml(a.article_date || '')}</span>
      </button>`).join('') : '<p class="muted small">Todavía no hay artículos en Supabase.</p>';
    $('adminArticleList').querySelectorAll('[data-id]').forEach(button => button.addEventListener('click', () => loadArticle(button.dataset.id)));
  }

  async function loadArticle(id) {
    const { data, error } = await client.from('articles').select('*').eq('id',id).single();
    if (error || !data) { message('No fue posible abrir el artículo.',true); return; }
    const backupKey = 'pgr-editor-recovery:' + currentUser.id + ':' + data.id;
    const recovered = recoverLocalBackup(backupKey);
    if (recovered) { setReadOnly(currentRole === 'publisher' || (currentRole === 'editor' && data.status === 'published')); return; }
    $('articleId').value = data.id;
    $('articleTitle').value = data.title || '';
    $('articleAuthor').value = data.author || '';
    $('articleCategory').value = data.category || '';
    $('articleDate').value = data.article_date || localDate();
    $('articleExcerpt').value = data.excerpt || '';
    $('articleContent').innerHTML = data.content_html || '';
    coverUrl = data.cover_image_url || null;
    coverPath = null;
    $('coverPreview').src = coverUrl || '';
    $('coverPreview').hidden = !coverUrl;
    $('removeCoverBtn').hidden = !coverUrl;
    $('coverAlt').value = data.cover_image_alt || '';
    const readOnly = currentRole === 'publisher' || (currentRole === 'editor' && data.status === 'published');
    setReadOnly(readOnly);
    $('publishBtn').hidden = currentRole === 'editor' || data.status === 'published' && currentRole === 'publisher';
    $('saveDraftBtn').hidden = currentRole === 'publisher';
    $('saveStatus').textContent = statusText(data.status) + ' · ' + (data.updated_at ? new Date(data.updated_at).toLocaleString('es-PR') : '');
    document.querySelectorAll('.admin-article-item').forEach(b => b.classList.toggle('active',b.dataset.id===id));
    message('');
  }

  function setReadOnly(readOnly) {
    ['articleTitle','articleAuthor','articleCategory','articleDate','articleExcerpt','coverAlt'].forEach(id => $(id).disabled = readOnly);
    $('articleContent').contentEditable = readOnly ? 'false' : 'true';
    ['coverImageInput','insertImageBtn','insertBibleBtn','insertLinkBtn'].forEach(id => $(id).disabled = readOnly);
    document.querySelectorAll('.toolbar [data-command]').forEach(b => b.disabled = readOnly);
  }

  function resetForm() {
    $('articleForm').reset();
    $('articleId').value = '';
    $('articleAuthor').value = 'Antolín Maldonado Ríos';
    $('articleDate').value = localDate();
    $('articleContent').innerHTML = '';
    coverUrl = null; coverPath = null;
    $('coverPreview').hidden = true; $('removeCoverBtn').hidden = true;
    setReadOnly(currentRole === 'publisher');
    $('saveDraftBtn').hidden = currentRole === 'publisher';
    $('publishBtn').hidden = currentRole === 'editor';
    $('saveStatus').textContent = 'Nuevo artículo';
    document.querySelectorAll('.admin-article-item').forEach(b => b.classList.remove('active'));
    lastLocalFingerprint = JSON.stringify(editorSnapshot());
    message('');
  }

  async function uploadImage(file) {
    if (!file || !/^image\/(jpeg|png|webp)$/.test(file.type)) throw new Error('Utiliza una imagen JPG, PNG o WebP.');
    if (file.size > 5 * 1024 * 1024) throw new Error('La imagen no puede superar 5 MB.');
    const ext = file.type === 'image/jpeg' ? 'jpg' : file.type.split('/')[1];
    const path = currentUser.id + '/' + Date.now() + '-' + Math.random().toString(36).slice(2,8) + '.' + ext;
    const { error } = await client.storage.from('articles-images').upload(path,file,{cacheControl:'3600',upsert:false,contentType:file.type});
    if (error) throw error;
    const { data } = client.storage.from('articles-images').getPublicUrl(path);
    return { url:data.publicUrl,path };
  }

  async function handleCover(file) {
    try {
      $('saveStatus').textContent = 'Subiendo imagen…';
      const uploaded = await uploadImage(file);
      coverUrl = uploaded.url; coverPath = uploaded.path;
      $('coverPreview').src = coverUrl; $('coverPreview').hidden = false; $('removeCoverBtn').hidden = false;
      $('saveStatus').textContent = 'Imagen lista · guarda el artículo para conservar el cambio';
    } catch (error) { message(error.message || 'No se pudo subir la imagen.',true); }
  }

  async function saveDraft() {
    const previousBackupKey = localKey();
    if (currentRole === 'publisher') throw new Error('Tu rol permite publicar, pero no editar el contenido.');
    const title = $('articleTitle').value.trim();
    if (!title) throw new Error('Escribe el título del artículo.');
    const content = DOMPurify.sanitize($('articleContent').innerHTML,{USE_PROFILES:{html:true},ADD_ATTR:['target','rel']});
    if (!content.trim()) throw new Error('Escribe el contenido del artículo.');
    const payload = {
      title,
      slug: slugify(title) + ( $('articleId').value ? '-' + $('articleId').value.slice(0,8) : '-' + Date.now().toString().slice(-6) ),
      author: $('articleAuthor').value.trim(),
      category: $('articleCategory').value.trim() || null,
      article_date: $('articleDate').value || localDate(),
      excerpt: $('articleExcerpt').value.trim() || null,
      content_html: content,
      status: 'draft',
      cover_image_url: coverUrl,
      cover_image_alt: $('coverAlt').value.trim() || null,
      updated_at: new Date().toISOString()
    };
    $('saveStatus').textContent = 'Guardando…';
    let result;
    if ($('articleId').value) {
      result = await client.from('articles').update(payload).eq('id',$('articleId').value).select('id').single();
    } else {
      payload.created_by = currentUser.id;
      result = await client.from('articles').insert(payload).select('id').single();
    }
    if (result.error) throw result.error;
    $('articleId').value = result.data.id;
    try { if (previousBackupKey) localStorage.removeItem(previousBackupKey); } catch (_) {}
    $('saveStatus').textContent = 'Borrador guardado en Supabase';
    clearLocalBackup();
    message('Borrador guardado correctamente.');
    await loadArticles();
    return result.data.id;
  }

  async function publishArticle() {
    let id = $('articleId').value;
    if (!id) {
      if (currentRole === 'publisher') throw new Error('Selecciona primero un borrador para publicarlo.');
      id = await saveDraft();
    } else if (currentRole !== 'publisher') {
      id = await saveDraft();
    }
    const { error } = await client.rpc('publish_article',{article_id:id});
    if (error) throw error;
    $('saveStatus').textContent = 'Publicado';
    message('¡Artículo publicado! Ya puede aparecer en la sección Artículos de la PWA.');
    await loadArticles();
    await loadArticle(id);
  }

  async function loadUsers() {
    const { data, error } = await client.from('profiles').select('id,email,role').order('email');
    if (error) { $('adminUserList').innerHTML = '<p class="muted small">No se pudieron cargar los colaboradores.</p>'; return; }
    $('adminUserList').innerHTML = (data || []).map(user => `
      <div class="user-row"><span>${escapeHtml(user.email || user.id)}</span>
        <select data-user-role="${user.id}" aria-label="Rol de ${escapeHtml(user.email)}">
          <option value="admin" ${user.role==='admin'?'selected':''}>Administrador</option>
          <option value="editor" ${user.role==='editor'?'selected':''}>Editor</option>
          <option value="publisher" ${user.role==='publisher'?'selected':''}>Publicador</option>
        </select></div>`).join('');
    $('adminUserList').querySelectorAll('[data-user-role]').forEach(select => select.addEventListener('change', async () => {
      if (select.dataset.userRole === currentUser.id && select.value !== 'admin') {
        select.value = 'admin'; message('No puedes quitarte el rol de administrador desde tu propia sesión.',true); return;
      }
      const { error } = await client.from('profiles').update({role:select.value}).eq('id',select.dataset.userRole);
      if (error) { message('No se pudo cambiar el rol: '+error.message,true); await loadUsers(); }
      else message('Permiso actualizado correctamente.');
    }));
  }

  function insertAtCursor(html) {
    $('articleContent').focus();
    document.execCommand('insertHTML',false,html);
  }

  function insertBibleReference() {
    const reference = prompt('Escribe la referencia bíblica (por ejemplo, Juan 12:25):');
    if (!reference) return;
    const versionInput = (prompt('Versión bíblica: RVR1960, NVI, NTV o NBLA. La predeterminada es RVR1960.','RVR1960') || 'RVR1960').toUpperCase().replace(/[^A-Z0-9]/g,'');
    const version = versions[versionInput];
    if (!version) { message('Versión no reconocida. Usa RVR1960, NVI, NTV o NBLA.',true); return; }
    const match = reference.trim().match(/^(.+?)\s+(\d+)(?::(\d+)(?:-(\d+))?)?$/);
    if (!match) { message('Formato no reconocido. Ejemplo: Juan 12:25.',true); return; }
    const book = bookCodes[match[1].toLowerCase().trim()];
    if (!book) { message('No reconocí el libro bíblico. Escribe el nombre completo en español.',true); return; }
    const chapter = match[2], verse = match[3] || '1', end = match[4] ? '-' + match[4] : '';
    const url = 'https://www.bible.com/bible/' + version.id + '/' + book + '.' + chapter + '.' + verse + end + '.' + version.code;
    insertAtCursor('<a href="' + url + '" target="_blank" rel="noopener noreferrer">' + escapeHtml(reference.trim()) + '</a>');
  }

  function bindEditor() {
    $('newArticleBtn').addEventListener('click',()=>{ saveLocalBackup(); resetForm(); recoverLocalBackup(localKey()); });
    $('refreshArticlesBtn').addEventListener('click',loadArticles);
    $('coverImageInput').addEventListener('change',e=>{if(e.target.files[0])handleCover(e.target.files[0]);e.target.value='';});
    $('removeCoverBtn').addEventListener('click',()=>{coverUrl=null;coverPath=null;$('coverPreview').hidden=true;$('removeCoverBtn').hidden=true;});
    $('insertImageBtn').addEventListener('click',()=>$('inlineImageInput').click());
    $('inlineImageInput').addEventListener('change',async e=>{
      const file=e.target.files[0];e.target.value='';if(!file)return;
      try{const uploaded=await uploadImage(file);insertAtCursor('<p><img src="'+uploaded.url+'" alt="'+escapeHtml(file.name.replace(/\.[^.]+$/,''))+'"></p>');}
      catch(error){message(error.message||'No se pudo insertar la imagen.',true);}
    });
    document.querySelectorAll('.toolbar [data-command]').forEach(button=>button.addEventListener('click',()=>{
      $('articleContent').focus();
      document.execCommand(button.dataset.command,false,button.dataset.value||null);
    }));
    $('insertLinkBtn').addEventListener('click',()=>{
      const url=prompt('Introduce la dirección del enlace (https://…):');if(!url)return;
      if(!/^https?:\/\//i.test(url)){message('El enlace debe comenzar con https:// o http://',true);return;}
      $('articleContent').focus();document.execCommand('createLink',false,url);
    });
    $('insertBibleBtn').addEventListener('click',insertBibleReference);
    $('saveDraftBtn').addEventListener('click',async()=>{try{await saveDraft();}catch(e){message(e.message||'No se pudo guardar.',true);}});
    $('publishBtn').addEventListener('click',async()=>{try{await publishArticle();}catch(e){message(e.message||'No se pudo publicar.',true);}});
    $('previewBtn').addEventListener('click',()=>{
      const title=escapeHtml($('articleTitle').value||'Artículo sin título');
      const author=escapeHtml($('articleAuthor').value);
      const date=escapeHtml($('articleDate').value);
      const cover=coverUrl?'<img class="preview-cover" src="'+escapeHtml(coverUrl)+'" alt="'+escapeHtml($('coverAlt').value)+'">':'';
      $('previewArticle').innerHTML='<h1>'+title+'</h1><div class="preview-meta">Por '+author+' · '+date+'</div>'+cover+DOMPurify.sanitize($('articleContent').innerHTML,{USE_PROFILES:{html:true},ADD_ATTR:['target','rel']});
      $('previewDialog').showModal();
    });
    $('closePreviewBtn').addEventListener('click',()=>$('previewDialog').close());
    // El intervalo cubre el cierre accidental; estos eventos también actualizan el indicador.
    ['articleTitle','articleAuthor','articleCategory','articleDate','articleExcerpt','coverAlt'].forEach(id =>
      $(id).addEventListener('input',()=>{ $('saveStatus').textContent='Cambios pendientes de copia local…'; }));
    $('articleContent').addEventListener('input',()=>{ $('saveStatus').textContent='Cambios pendientes de copia local…'; });
    window.addEventListener('pagehide',saveLocalBackup);
    window.addEventListener('beforeunload',saveLocalBackup);
  }

  boot();
})();
