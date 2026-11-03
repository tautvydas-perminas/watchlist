(() => {
  const toolbar = document.querySelector('#editor-toolbar');
  const status = document.querySelector('#editor-status');
  const editButton = document.querySelector('#editor-toggle');
  const saveButton = document.querySelector('#editor-save');
  const cancelButton = document.querySelector('#editor-cancel');
  const loginButton = document.querySelector('#editor-login');
  let editing = false;
  let sha = null;
  let initialIds = [];
  const api = () => (window.WATCHLIST_EDITOR_API || '').replace(/\/$/, '');
  const message = value => { status.textContent = value; };
  const controls = () => {
    saveButton.hidden = cancelButton.hidden = !editing;
    editButton.hidden = editing;
    document.querySelectorAll('.editor-actions').forEach(node => node.hidden = !editing);
  };
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
    button('↑', 'Aukštyn', () => move(watch.id, -1));
    button('↓', 'Žemyn', () => move(watch.id, 1));
    button('✕', 'Pašalinti', () => {
      if (!confirm('Pašalinti ' + watch.brand + ' ' + watch.model + '?')) return;
      watches = watches.filter(w => String(w.id) !== String(watch.id)); render();
    });
    card.draggable = true;
    card.addEventListener('dragstart', event => event.dataTransfer.setData('text/plain', String(watch.id)));
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
      headers: {'Content-Type': 'application/json'},
      ...(body ? {body: JSON.stringify(body)} : {})
    });
    if (!response.ok) throw new Error('HTTP ' + response.status + ': ' + (await response.text()).slice(0, 180));
    return response.json();
  };
  editButton.addEventListener('click', async () => {
    if (!api()) return message('Pirmiausia sukonfigūruokite Azure Function adresą.');
    try {
      const data = await request('GET');
      watches = data.items; sha = data.sha;
      initialIds = watches.map(w => String(w.id));
      editing = true;
      search.value = ''; brand.value = ''; style.value = '';
      render(); message('Redagavimas įjungtas. Pakeitimus išsaugokite.');
    } catch (error) { message('Nepavyko prisijungti: ' + error.message); }
  });
  saveButton.addEventListener('click', async () => {
    if (!watches.length) return message('Negalima pašalinti visų laikrodžių.');
    saveButton.disabled = true;
    try {
      await request('PUT', {sha, ids: watches.map(w => w.id)});
      editing = false; render(); message('Išsaugota GitHub. Palaukite, kol baigsis deploy.');
    } catch (error) { message('Nepavyko išsaugoti: ' + error.message); }
    finally { saveButton.disabled = false; }
  });
  cancelButton.addEventListener('click', () => {
    editing = false; loadCollection(activeList); message('Pakeitimai atšaukti.');
  });
  loginButton.addEventListener('click', () => {
    if (!api()) return message('Azure Function adresas dar nenustatytas.');
    window.open(api() + '/.auth/login/aad?post_login_redirect_uri=/', '_blank', 'noopener');
    message('Prisijunkite atsidariusiame lange, tada spauskite Redaguoti.');
  });
  window.watchlistEditorBeforeNavigation = () => {
    if (editing && !confirm('Neišsaugoti pakeitimai bus prarasti. Tęsti?')) return false;
    editing = false; controls(); return true;
  };
  toolbar.hidden = false;
  controls();
})();
