/* ===== RECIPE APP ===== */
import { notify } from '../notifications.js';

const STORAGE_KEY = 'ncc-recipes';
const PRESETS_KEY = 'ncc-recipe-presets-loaded';
import { storage } from '../lib/storage-adapter.js';

let recipes = [];
let editingId = null;

/* ─── Storage ─── */
function loadRecipes() {
  try { recipes = JSON.parse(localStorage.getItem(STORAGE_KEY)) || []; }
  catch { recipes = []; }
}
function saveRecipes() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(recipes));
  storage.write('recipes', recipes).catch(() => {});
}

/* ─── Helpers ─── */
function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 8); }
function escapeHtml(s) {
  if (typeof s !== 'string') return '';
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function recipeToCard(r) {
  const tags = [
    r.category,
    r.prepTime ? (`\u231a ${r.prepTime}`) : null,
    r.servings ? (`\U0001f37d ${r.servings}`) : null
  ].filter(Boolean).map(t => `<span class="recipe-tag">${escapeHtml(t)}</span>`).join('');
  const img = r.imageUrl
    ? `<img class="recipe-card-image" src="${escapeHtml(r.imageUrl)}" alt="${escapeHtml(r.name)}" loading="lazy">`
    : `<div class="recipe-card-image" style="background:var(--bg-body);display:flex;align-items:center;justify-content:center;font-size:3rem;">\ud83c\udf73</div>`;
  return `
<div class="recipe-card" data-id="${r.id}" tabindex="0" role="button" aria-label="Open ${escapeHtml(r.name)}">
  ${img}
  <div class="recipe-card-body">
    <div class="recipe-card-name">${escapeHtml(r.name)}</div>
    <div class="recipe-card-tags">${tags}</div>
    <div class="recipe-card-meta">${escapeHtml(r.source || 'My recipes')}</div>
  </div>
</div>`;
}

/* ─── Render ─── */
function renderRecipes() {
  const q = (document.getElementById('recipe-search')?.value || '').toLowerCase().trim();
  const cat = document.getElementById('recipe-filter')?.value || '';
  const sort = document.getElementById('recipe-sort')?.value || 'created-desc';

  let list = recipes.slice();
  if (cat) list = list.filter(r => r.category === cat);
  if (q) {
    list = list.filter(r =>
      (r.name || '').toLowerCase().includes(q) ||
      (r.source || '').toLowerCase().includes(q) ||
      (r.description || '').toLowerCase().includes(q) ||
      (r.ingredients || '').toLowerCase().includes(q) ||
      (r.tags || []).join(' ').toLowerCase().includes(q)
    );
  }
  list.sort((a, b) => {
    if (sort === 'created-desc') return (b.created || 0) - (a.created || 0);
    if (sort === 'created-asc') return (a.created || 0) - (b.created || 0);
    if (sort === 'name-asc') return (a.name || '').localeCompare(b.name || '');
    if (sort === 'name-desc') return (b.name || '').localeCompare(a.name || '');
    return 0;
  });

  const grid = document.getElementById('recipe-grid');
  const empty = document.getElementById('recipe-empty');
  const toolbar = document.getElementById('recipe-toolbar');
  if (!grid || !empty || !toolbar) return;

  toolbar.classList.toggle('active', recipes.length > 0);

  if (list.length === 0 && recipes.length === 0) {
    grid.style.display = 'none';
    empty.style.display = 'flex';
  } else if (list.length === 0) {
    grid.style.display = 'none';
    empty.style.display = 'flex';
    empty.innerHTML = `<div class="recipe-empty-icon">\u1f50d</div><p>No matches.</p><span>Try a different search.</span>`;
  } else {
    grid.style.display = 'grid';
    empty.style.display = 'none';
    grid.innerHTML = list.map(recipeToCard).join('');
    grid.querySelectorAll('.recipe-card').forEach(card => {
      card.addEventListener('click', () => openRecipeDetail(card.dataset.id));
      card.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openRecipeDetail(card.dataset.id); } });
    });
  }
}

/* ─── Detail Modal ─── */
function openRecipeDetail(id) {
  const r = recipes.find(x => x.id === id);
  if (!r) return;
  const panel = document.createElement('div');
  panel.className = 'recipe-modal active';
  panel.id = 'recipe-detail-modal';
  const img = r.imageUrl
    ? `<img class="recipe-detail-image" src="${escapeHtml(r.imageUrl)}" alt="${escapeHtml(r.name)}" loading="lazy">`
    : `<div class="recipe-detail-image">\ud83c\udf73</div>`;
  const ings = (r.ingredients || '').split('\n').filter(Boolean).map(s => `<li>${escapeHtml(s.trim())}</li>`).join('');
  const steps = (r.instructions || '').split('\n').filter(Boolean).map((s, i) => `<li><strong>Step ${i + 1}:</strong> ${escapeHtml(s.trim())}</li>`).join('');
  panel.innerHTML = `
<div class="recipe-modal-panel" role="dialog" aria-modal="true" aria-label="${escapeHtml(r.name)}">
  <div class="recipe-modal-header">
    <h3>${escapeHtml(r.name)}</h3>
    <button class="recipe-modal-close" id="rd-close" aria-label="Close">&times;</button>
  </div>
  <div class="recipe-modal-body">
    ${img}
    <div class="recipe-detail-meta">
      ${r.category   ? `<span>\ud83d\udcca ${escapeHtml(r.category)}</span>` : ''}
      ${r.prepTime  ? `<span>\u231a ${escapeHtml(r.prepTime)}</span>` : ''}
      ${r.servings  ? `<span>\U0001f37d ${escapeHtml(r.servings)}</span>` : ''}
    </div>
    ${r.description ? `<div class="recipe-detail-section"><p>${escapeHtml(r.description)}</p></div>` : ''}
    ${ings ? `<div class="recipe-detail-section"><h4>Ingredients</h4><ul>${ings}</ul></div>` : ''}
    ${steps ? `<div class="recipe-detail-section"><h4>Instructions</h4><ol>${steps}</ol></div>` : ''}
  </div>
  <div class="recipe-modal-actions">
    <button class="btn-secondary" id="rd-edit">Edit</button>
    <button class="btn-danger" id="rd-delete">Delete</button>
  </div>
</div>`;
  document.body.appendChild(panel);
  attachDetailListeners(panel, r.id);
}

function attachDetailListeners(panel, id) {
  const close = () => panel.remove();
  panel.addEventListener('click', e => { if (e.target === panel) close(); });
  panel.querySelector('#rd-close').addEventListener('click', close);
  panel.querySelector('#rd-edit').addEventListener('click', () => { close(); setTimeout(() => openRecipeForm(id), 10); });
  panel.querySelector('#rd-delete').addEventListener('click', () => {
    if (confirm('Delete this recipe?')) {
      recipes = recipes.filter(x => x.id !== id);
      saveRecipes();
      renderRecipes();
      close();
      toast('Recipe deleted');
    }
  });
}

/* ─── Add / Edit Modal ─── */
function openRecipeForm(id = null) {
  editingId = id;
  const r = id ? recipes.find(x => x.id === id) : {};
  const panel = document.createElement('div');
  panel.className = 'recipe-modal active';
  panel.id = 'recipe-form-modal';
  panel.innerHTML = `
<div class="recipe-modal-panel" role="dialog" aria-modal="true" aria-label="${id ? 'Edit' : 'Add'} recipe">
  <div class="recipe-modal-header">
    <h3>${id ? 'Edit Recipe' : 'Add Recipe'}</h3>
    <button class="recipe-modal-close" id="rf-close" aria-label="Close">&times;</button>
  </div>
  <div class="recipe-modal-body">
    <label>Name
      <input type="text" id="rf-name" value="${escapeHtml(r.name || '')}" placeholder="e.g. Avocado Toast" required>
    </label>
    <label>Category
      <select id="rf-category">
        <option value="Breakfast"   ${r.category==='Breakfast'?'selected':''}>Breakfast</option>
        <option value="Lunch"       ${r.category==='Lunch'    ?'selected':''}>Lunch</option>
        <option value="Dinner"      ${r.category==='Dinner'   ?'selected':''}>Dinner</option>
        <option value="Dessert"     ${r.category==='Dessert'  ?'selected':''}>Dessert</option>
        <option value="Snack"       ${r.category==='Snack'    ?'selected':''}>Snack</option>
        <option value="Beverage"    ${r.category==='Beverage' ?'selected':''}>Beverage</option>
      </select>
    </label>
    <label>Prep / Cook Time
      <input type="text" id="rf-prep" value="${escapeHtml(r.prepTime || '')}" placeholder="e.g. 20 min">
    </label>
    <label>Servings
      <input type="text" id="rf-servings" value="${escapeHtml(r.servings || '')}" placeholder="e.g. 2">
    </label>
    <label>Image URL
      <input type="url" id="rf-image" value="${escapeHtml(r.imageUrl || '')}" placeholder="https://...">
    </label>
    <label>Source / URL
      <input type="url" id="rf-source" value="${escapeHtml(r.source || '')}" placeholder="https://...">
    </label>
    <label>Description
      <textarea id="rf-desc" rows="2">${escapeHtml(r.description || '')}</textarea>
    </label>
    <label>Ingredients (one per line)
      <textarea id="rf-ingredients" rows="4" placeholder="1 ripe avocado\n2 slices sourdough...">${escapeHtml(r.ingredients || '')}</textarea>
    </label>
    <label>Instructions (one per line)
      <textarea id="rf-instructions" rows="4" placeholder="Toast the bread...">${escapeHtml(r.instructions || '')}</textarea>
    </label>
  </div>
  <div class="recipe-modal-actions">
    <button class="btn-secondary" id="rf-cancel">Cancel</button>
    <button class="btn-primary" id="rf-save">${id ? 'Save' : 'Add'}</button>
  </div>
</div>`;
  document.body.appendChild(panel);

  const close = () => panel.remove();
  panel.addEventListener('click', e => { if (e.target === panel) close(); });
  panel.querySelector('#rf-close').addEventListener('click', close);
  panel.querySelector('#rf-cancel').addEventListener('click', close);
  panel.querySelector('#rf-save').addEventListener('click', () => {
    const name = (panel.querySelector('#rf-name').value || '').trim();
    if (!name) { toast('Name is required'); return; }
    const payload = {
      id: id || uid(),
      name,
      category: panel.querySelector('#rf-category').value || 'Breakfast',
      prepTime: (panel.querySelector('#rf-prep').value || '').trim(),
      servings: (panel.querySelector('#rf-servings').value || '').trim(),
      imageUrl: (panel.querySelector('#rf-image').value || '').trim(),
      source: (panel.querySelector('#rf-source').value || '').trim(),
      description: (panel.querySelector('#rf-desc').value || '').trim(),
      ingredients: (panel.querySelector('#rf-ingredients').value || '').trim(),
      instructions: (panel.querySelector('#rf-instructions').value || '').trim(),
      created: r.created || Date.now()
    };
    if (id) {
      const idx = recipes.findIndex(x => x.id === id);
      if (idx !== -1) recipes[idx] = payload;
    } else {
      recipes.push(payload);
    }
    saveRecipes();
    renderRecipes();
    close();
    toast(id ? 'Recipe updated' : 'Recipe added');
  });
}

/* ─── Presets ─── */
function injectPresets() {
  if (localStorage.getItem(PRESETS_KEY)) return;
  const presets = [
    {
      id: uid(), name: 'Classic Pancakes', category: 'Breakfast',
      prepTime: '25 min', servings: '4',
      imageUrl: '', source: 'Built-in',
      description: 'Fluffy classic buttermilk pancakes.',
      ingredients: '2 cups flour\n2 eggs\n1 3/4 cups milk\n1/4 cup butter, melted\n2 tbsp sugar\n2 tsp baking powder\n1/2 tsp salt',
      instructions: 'Mix dry ingredients in a bowl.\nWhisk wet ingredients separately.\nCombine and fold gently.\nCook on medium heat until golden.',
      created: Date.now() - 86400000 * 3
    },
    {
      id: uid(), name: 'Grilled Chicken Salad', category: 'Lunch',
      prepTime: '20 min', servings: '2',
      imageUrl: '', source: 'Built-in',
      description: 'Simple, healthy mixed greens bowl.',
      ingredients: '2 chicken breasts\nMixed greens\nCherry tomatoes\nCucumber\nOlive oil\nLemon juice\nSalt & pepper',
      instructions: 'Season and grill chicken until internal temp 75C.\nSlice and set aside.\nToss greens and veg with olive oil and lemon.\nTop with sliced chicken.',
      created: Date.now() - 86400000 * 1
    },
    {
      id: uid(), name: 'Chocolate Lava Cake', category: 'Dessert',
      prepTime: '30 min', servings: '2',
      imageUrl: '', source: 'Built-in',
      description: 'Rich molten-centre chocolate cake.',
      ingredients: '100g dark chocolate\n100g butter\n2 eggs\n2 egg yolks\n50g sugar\n30g flour',
      instructions: 'Melt chocolate and butter together.\nWhisk eggs, yolks and sugar until pale.\nFold in melted chocolate and flour.\nBake in greased ramekins 220C for 10 min.',
      created: Date.now()
    }
  ];
  recipes = presets.concat(recipes);
  saveRecipes();
  localStorage.setItem(PRESETS_KEY, '1');
}

/* ─── Public ─── */
export function initRecipe() {
  loadRecipes();
  injectPresets();
  renderRecipes();
  (async()=>{try{const d=await storage.read('recipes');if(d&&Array.isArray(d)&&d.length&&!recipes.length){recipes=d;localStorage.setItem(STORAGE_KEY,JSON.stringify(recipes));renderRecipes()}}catch(e){}})();

  document.getElementById('recipe-add-btn')?.addEventListener('click', () => openRecipeForm());
  document.getElementById('recipe-search')?.addEventListener('input', renderRecipes);
  document.getElementById('recipe-filter')?.addEventListener('change', renderRecipes);
  document.getElementById('recipe-sort')?.addEventListener('change', renderRecipes);
}
