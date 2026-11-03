const grid = document.querySelector('#grid');
const search = document.querySelector('#search');
const brand = document.querySelector('#brand');
const style = document.querySelector('#style');
const labels = {Statement:'Statement',Modern:'Modern',Vintage:'Vintage',Dress:'Dress',Outdoor:'Outdoor',Chronograph:'Chronograph',Integrated:'Integrated bracelet',Everyday:'Everyday',Mountains:'Mountains',Diver:'Diver'};
let watches = [];
const collections = {original:'watches.json',limited:'watches-limited.json'};
let activeList = 'original';
let loadController;
function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}
function link(text, href, className) {
  const node = el('a', className, text);
  node.href = href; node.target = '_blank'; node.rel = 'noopener noreferrer';
  return node;
}
function assessment(title, items, className) {
  const section = el('section', className);
  section.append(el('h3', '', title));
  const list = el('ul');
  for (const item of items || []) list.append(el('li', '', item));
  section.append(list);
  return section;
}
function draw() {
  const q = search.value.trim().toLocaleLowerCase('en');
  const filtered = watches.filter(w => (!brand.value || w.brand === brand.value) &&
    (!style.value || w.style === style.value) &&
    [w.model,w.brand,w.collection,w.description,w.availability?.label,...Object.values(w.specs || {})].join(' ').toLocaleLowerCase('en').includes(q));
  document.querySelector('#count').textContent = filtered.length + ' / ' + watches.length + ' watches';
  grid.replaceChildren();
  for (const w of filtered) {
    const card = el('article', 'card');
    const titleId = 'watch-' + w.id;
    card.setAttribute('aria-labelledby', titleId);
    const photo = link('', w.imageSearch, 'photo');
    photo.setAttribute('aria-label', w.brand + ' ' + w.model + ' image search');
    const placeholder = el('span', 'missing', 'Find model images ↗');
    if (w.image) {
      const img = el('img');
      img.src = w.image; img.alt = w.brand + ' ' + w.model;
      img.loading = 'lazy'; img.referrerPolicy = 'no-referrer';
      img.addEventListener('error', () => photo.replaceChildren(placeholder), {once:true});
      photo.append(img);
    } else photo.append(placeholder);
    const info = el('div', 'info');
    const top = el('div','card-top');
    const number = el('span', 'watch-number', String(watches.indexOf(w) + 1).padStart(2, '0'));
    number.setAttribute('aria-label', 'Position in list: ' + (watches.indexOf(w) + 1));
    top.append(number);
    const editionLabel = w.limitedEdition ? (Number.isFinite(w.limitedEdition.quantity) ? new Intl.NumberFormat('en-GB').format(w.limitedEdition.quantity) + ' pieces worldwide' : 'Limited edition · quantity unverified') : 'Wishlist';
    top.append(el('span','meta',w.brand + ' / ' + (labels[w.style] || w.style)),el('span','pill',editionLabel));
    const title = el('h2','',w.collection); title.id = titleId;
    const heading = el('div', 'watch-heading');
    const identity = el('div', 'watch-identity');
    identity.append(title, el('p','ref',w.model));
    heading.append(identity);
    if (w.price && Number.isFinite(w.price.amount)) {
      const price = el('div', 'price-block');
      const amount = new Intl.NumberFormat('en-IE', {style:'currency',currency:w.price.currency || 'EUR',maximumFractionDigits:0}).format(w.price.amount);
      price.append(el('span','price-label',w.price.heading || 'REFERENCE PRICE'),el('strong','price-amount','≈ ' + amount));
      const sourceLink = link(w.price.label || 'New · manufacturer price ↗',w.price.source,'price-source');
      sourceLink.title = w.price.basis;
      price.append(sourceLink,el('span','price-date','Checked ' + w.price.checked));
      heading.append(price);
    } else if (w.limitedEdition) {
      heading.append(el('div','price-block price-unverified','EUR price unverified'));
    }
    info.append(top,heading,el('p','desc',w.description));
    if (w.status === 'Einamasis Limited Edition') info.append(el('p','availability','Current limited edition · Release: ' + (w.releaseDate || w.releaseDateStatus || 'unconfirmed')));
    if (w.availability) info.append(el('p','availability',w.availability.label + ' · Checked ' + w.availability.checked));
    const specs = el('dl','specs');
    for (const [key,value] of Object.entries(w.specs || {})) {
      const pair = el('div','spec');
      pair.append(el('dt','',key),el('dd','',value === '—' ? 'Not specified' : value));
      specs.append(pair);
    }
    info.append(specs);
    const verdict = el('div','verdict');
    verdict.append(assessment('Pros',w.pros,'pros'),assessment('Cons',w.cons,'cons'));
    info.append(verdict);
    const bottom = el('div','bottom');
    bottom.append(link('Manufacturer specifications ↗',w.source),el('span','checked','Checked ' + w.specsChecked));
    if (w.limitedEdition) bottom.append(link('Edition source ↗',w.limitedEdition.source));
    info.append(bottom);
    if (w.comment && !window.watchlistEditorIsEditing?.()) {
      const note = el('div','watch-comment');
      note.append(el('strong','','My comment'),el('p','',w.comment));
      info.append(note);
    }
    card.append(photo,info); if (window.watchlistEditorActions) window.watchlistEditorActions(card,w); grid.append(card);
  }
  if (!filtered.length) grid.append(el('p','empty','Atitinkančių watches nerasta. Pakeiskite paiešką arba filtrus.'));
}
function listFromUrl() {
  return new URLSearchParams(location.search).get('list') === 'limited' ? 'limited' : 'original';
}
async function loadCollection(key) {
  loadController?.abort();
  const controller = new AbortController();
  loadController = controller;
  activeList = key;
  watches = [];
  search.value = '';
  brand.replaceChildren(new Option('All brands',''));
  style.replaceChildren(new Option('All styles',''));
  draw();
  grid.replaceChildren(el('p','empty','Loading…'));
  document.querySelector('#count').textContent = 'Loading…';
  document.querySelector('#collection-summary').textContent = 'Loading…';
  document.querySelector('#collection-note').hidden = key !== 'limited';
  document.querySelector('.list-heading h2').textContent = key === 'limited' ? 'Limited edition models' : 'Watch overview';
  for (const tab of document.querySelectorAll('[data-list]')) {
    if (tab.dataset.list === key) tab.setAttribute('aria-current','page');
    else tab.removeAttribute('aria-current');
  }
  try {
    const response = await fetch(collections[key],{signal:controller.signal});
    if (!response.ok) throw new Error('HTTP ' + response.status);
    const data = await response.json();
    if (!Array.isArray(data)) throw new Error('Invalid collection');
    if (controller.signal.aborted) return;
    watches = data;
    for (const value of [...new Set(data.map(w => w.brand))].sort()) brand.add(new Option(value,value));
    for (const value of [...new Set(data.map(w => w.style))].sort((a,b) => (labels[a] || a).localeCompare(labels[b] || b,'lt'))) style.add(new Option(labels[value] || value,value));
    document.querySelector('#collection-summary').textContent = data.length + ' models · ' + (key === 'limited' ? 'Limited edition collection' : 'Main collection');
    draw();
    window.dispatchEvent(new Event('watchlist:loaded'));
  } catch (error) {
    if (controller.signal.aborted) return;
    grid.replaceChildren(el('p','empty','Nepavyko įkelti watches. Atnaujinkite puslapį arba bandykite vėliau.'));
    document.querySelector('#count').textContent = 'Loading error';
    document.querySelector('#collection-summary').textContent = 'Loading error';
  }
}
for (const tab of document.querySelectorAll('[data-list]')) tab.addEventListener('click',event => {
  if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
  if (window.watchlistEditorBeforeNavigation && !window.watchlistEditorBeforeNavigation()) return;
  event.preventDefault();
  const url = new URL(location.href);
  url.searchParams.set('list',tab.dataset.list);
  history.pushState({},'',url);
  loadCollection(tab.dataset.list);
});
window.addEventListener('popstate',() => loadCollection(listFromUrl()));
loadCollection(listFromUrl());
for (const control of [search,brand,style]) control.addEventListener('input',draw);
document.querySelector('#reset').addEventListener('click',() => {search.value='';brand.value='';style.value='';draw();search.focus();});
