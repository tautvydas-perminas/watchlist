const grid = document.querySelector('#grid');
const search = document.querySelector('#search');
const brand = document.querySelector('#brand');
const style = document.querySelector('#style');
const labels = {Statement:'Išraiškingas',Modern:'Modernus',Vintage:'Retro',Dress:'Klasikinis',Outdoor:'Laisvalaikis',Chronograph:'Chronografas',Integrated:'Integruota apyrankė',Everyday:'Kasdienis',Mountains:'Kalnai',Diver:'Narų'};
let watches = [];
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
  const q = search.value.trim().toLocaleLowerCase('lt');
  const filtered = watches.filter(w => (!brand.value || w.brand === brand.value) &&
    (!style.value || w.style === style.value) &&
    [w.model,w.brand,w.collection,w.description,...Object.values(w.specs || {})].join(' ').toLocaleLowerCase('lt').includes(q));
  document.querySelector('#count').textContent = filtered.length + ' / ' + watches.length + ' laikrodžių';
  grid.replaceChildren();
  for (const w of filtered) {
    const card = el('article', 'card');
    const titleId = 'watch-' + w.id;
    card.setAttribute('aria-labelledby', titleId);
    const photo = link('', w.imageSearch, 'photo');
    photo.setAttribute('aria-label', w.brand + ' ' + w.model + ' nuotraukų paieška');
    const placeholder = el('span', 'missing', 'Rasti modelio nuotraukas ↗');
    if (w.image) {
      const img = el('img');
      img.src = w.image; img.alt = w.brand + ' ' + w.model;
      img.loading = 'lazy'; img.referrerPolicy = 'no-referrer';
      img.addEventListener('error', () => photo.replaceChildren(placeholder), {once:true});
      photo.append(img);
    } else photo.append(placeholder);
    const info = el('div', 'info');
    const top = el('div','card-top');
    top.append(el('span','meta',w.brand + ' / ' + (labels[w.style] || w.style)),el('span','pill','Norų sąrašas'));
    const title = el('h2','',w.collection); title.id = titleId;
    const heading = el('div', 'watch-heading');
    const identity = el('div', 'watch-identity');
    identity.append(title, el('p','ref',w.model));
    heading.append(identity);
    if (w.price && Number.isFinite(w.price.amount)) {
      const price = el('div', 'price-block');
      const amount = new Intl.NumberFormat('lt-LT', {style:'currency',currency:'EUR',maximumFractionDigits:0}).format(w.price.amount);
      price.append(el('span','price-label','ORIENTACINĖ KAINA'),el('strong','price-amount','≈ ' + amount));
      const sourceLink = link('Naujas · gamintojo kaina ↗',w.price.source,'price-source');
      sourceLink.title = w.price.basis;
      price.append(sourceLink,el('span','price-date','Tikrinta ' + w.price.checked));
      heading.append(price);
    }
    info.append(top,heading,el('p','desc',w.description));
    const specs = el('dl','specs');
    for (const [key,value] of Object.entries(w.specs || {})) {
      const pair = el('div','spec');
      pair.append(el('dt','',key),el('dd','',value === '—' ? 'Nenurodytas' : value));
      specs.append(pair);
    }
    info.append(specs);
    const verdict = el('div','verdict');
    verdict.append(assessment('Privalumai',w.pros,'pros'),assessment('Trūkumai',w.cons,'cons'));
    info.append(verdict);
    const bottom = el('div','bottom');
    bottom.append(link('Gamintojo specifikacijos ↗',w.source),el('span','checked','Tikrinta ' + w.specsChecked));
    info.append(bottom); card.append(photo,info); grid.append(card);
  }
  if (!filtered.length) grid.append(el('p','empty','Atitinkančių laikrodžių nerasta. Pakeiskite paiešką arba filtrus.'));
}
fetch('watches.json').then(r => {
  if (!r.ok) throw new Error('HTTP ' + r.status);
  return r.json();
}).then(data => {
  watches = data;
  for (const value of [...new Set(data.map(w => w.brand))].sort()) brand.add(new Option(value,value));
  for (const value of [...new Set(data.map(w => w.style))].sort((a,b) => (labels[a] || a).localeCompare(labels[b] || b,'lt'))) style.add(new Option(labels[value] || value,value));
  draw();
}).catch(() => {
  grid.replaceChildren(el('p','empty','Nepavyko įkelti laikrodžių. Atnaujinkite puslapį arba bandykite vėliau.'));
  document.querySelector('#count').textContent = 'Įkėlimo klaida';
});
for (const control of [search,brand,style]) control.addEventListener('input',draw);
document.querySelector('#reset').addEventListener('click',() => {search.value='';brand.value='';style.value='';draw();search.focus();});
