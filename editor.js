(() => {
  const toolbar = document.querySelector('#editor-toolbar');
  const status = document.querySelector('#editor-status');
  const editButton = document.querySelector('#editor-toggle');
  const saveButton = document.querySelector('#editor-save');
  const cancelButton = document.querySelector('#editor-cancel');
  const loginButton = document.querySelector('#editor-login');
  let editing = false;
  let sha = null;
  let authenticated = false;
  let checkVersion = 0;
  const api = () => (window.WATCHLIST_EDITOR_API || '').replace(/\/$/, '');
  const message = value => { status.textContent = value; };
  const controls = () => {
    saveButton.hidden = cancelButton.hidden = !editing;
    editButton.hidden = editing || !authenticated;
    loginButton.hidden = authenticated;
    document.querySelectorAll('.editor-actions').forEach(node => node.hidden = !editing);
  };
  window.watchlistEditorIsEditing = () => editing;
  const render = () => { draw(); controls(); };
  const move = (id, delta) => {
    const i = watches.findIndex(w => String(w.id) === String(id));
    const j = i + delta;
    if (i < 0 || j < 0 || j >= watches.length) return;
    [watches[i], watches[j]] = [watches[j], watches[i]];
    render();
  };
  window.watchlistEditorActions = (card, watch) => {
    if (!editing) return;
    const actions = document.createElement('div');
    actions.className = 'editor-actions';
    const button = (text, title, action) => {
      const node = document.createElement('button');
      node.type = 'button'; node.textContent = text; node.title = title;
      node.addEventListener('click', action); actions.append(node);
    };
    button('↑', 'Move up', () => move(watch.id, -1));
    button('↓', 'Move down', () => move(watch.id, 1));
    button('✕', 'Remove', () => {
      if (!confirm('Remove ' + watch.brand + ' ' + watch.model + '?')) return;
      watches = watches.filter(w => String(w.id) !== String(watch.id)); render();
    });
    const section = document.createElement('div');
    section.className = 'watch-comment-editor';
    const label = document.createElement('label');
    label.textContent = 'My comment';
    const textarea = document.createElement('textarea');
    textarea.rows = 3;
    textarea.maxLength = 3000;
    textarea.placeholder = 'Notes about this watch…';
    textarea.value = watch.comment || '';
    textarea.addEventListener('input', () => { watch.comment = textarea.value; });
    textarea.addEventListener('dragstart', event => event.stopPropagation());
    label.append(textarea);
    section.append(label);
    card.querySelector('.info').append(section);
    // Dragging is initiated only from the dedicated handle, so text remains selectable.
    const handle = document.createElement('button');
    handle.type = 'button';
    handle.className = 'drag-handle';
    handle.textContent = '⠿';
    handle.title = 'Drag to reorder';
    handle.setAttribute('aria-label', 'Drag to reorder ' + watch.model);
    handle.draggable = true;
    handle.addEventListener('dragstart', event => {
      event.stopPropagation();
      event.dataTransfer.effectAllowed = 'move';
      event.dataTransfer.setData('text/plain', String(watch.id));
    });
    actions.prepend(handle);
    card.addEventListener('dragover', event => event.preventDefault());
    card.addEventListener('drop', event => {
      event.preventDefault();
      const from = watches.findIndex(w => String(w.id) === event.dataTransfer.getData('text/plain'));
      const to = watches.findIndex(w => String(w.id) === String(watch.id));
      if (from < 0 || to < 0 || from === to) return;
      const [item] = watches.splice(from, 1); watches.splice(to, 0, item); render();
    });
    card.querySelector('.card-top').append(actions);
  };
  const request = async (method, body) => {
    const response = await fetch(api() + '/api/watchlist/' + activeList, {
      method, credentials: 'include',
      ...(body ? {headers: {'Content-Type': 'application/json'}, body: JSON.stringify(body)} : {})
    });
    if (!response.ok) throw new Error('HTTP ' + response.status + ': ' + (await response.text()).slice(0, 180));
    return response.json();
  };
  const enterEditing = async () => {
    if (!api()) return message('Configure the Azure Function URL first.');
    const version = ++checkVersion;
    const collection = activeList;
    try {
      const data = await request('GET');
      if (version !== checkVersion || collection !== activeList) return;
      authenticated = true;
      watches = data.items; sha = data.sha;
      editing = true;
      search.value = ''; brand.value = ''; style.value = '';
      render(); message('Edit mode enabled.');
    } catch (error) {
      if (version !== checkVersion) return;
      authenticated = false; editing = false; controls();
      if (!String(error.message).includes('HTTP 403') && !String(error.message).includes('HTTP 401'))
        message('Could not verify sign-in: ' + error.message);
    }
  };
  editButton.addEventListener('click', enterEditing);
  window.addEventListener('watchlist:loaded', enterEditing);
  saveButton.addEventListener('click', async () => {
    if (!watches.length) return message('You cannot remove all watches.');
    saveButton.disabled = true;
    try {
      const result = await request('PUT', {sha, ids: watches.map(w => w.id), comments: Object.fromEntries(watches.map(w => [String(w.id), w.comment || '']))});
      sha = result.sha;
      render(); message('Saved to GitHub. You can keep editing.');
    } catch (error) { message('Could not save: ' + error.message); }
    finally { saveButton.disabled = false; }
  });
  cancelButton.addEventListener('click', () => {
    editing = false; controls(); loadCollection(activeList); message('Changes discarded.');
  });
  loginButton.addEventListener('click', () => {
    if (!api()) return message('Azure Function URL is not configured.');
    const returnPath = '/api/auth-return?list=' + encodeURIComponent(activeList);
    window.location.assign(api() + '/.auth/login/aad?post_login_redirect_uri=' + encodeURIComponent(returnPath));
  });
  window.watchlistEditorBeforeNavigation = () => {
    if (editing && !confirm('Unsaved changes will be lost. Continue?')) return false;
    ++checkVersion;
    editing = false; controls(); return true;
  };
  toolbar.hidden = false;
  controls();
})();
