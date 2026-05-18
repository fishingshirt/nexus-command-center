const _globalRegistry = new Map();

export const widgetRegistry = {
  registerWidget(type, factoryFn) {
    _globalRegistry.set(type, factoryFn);
  }
};

// expose globally for app stubs that don't want to import
if (typeof window !== 'undefined') window.widgetRegistry = widgetRegistry;

export class WidgetGrid {
  constructor(containerEl, registry) {
    this.container = containerEl;
    this.registry = registry || new Map();
    this.widgets = [];
    this.intervals = [];
    this.listeners = [];
    this.editMode = false;
    this.dragSrc = null;
    this.storageKey = 'ncc-dashboard-widgets';
    this.drawerEl = null;
    this.drawerGridEl = null;
    this._drawerItems = [];
    this._boundKeydown = null;
    this._toolbarListeners = [];
    this.defaultLayout = [
      { type: 'weather', title: 'Weather', icon: '🌤️' },
      { type: 'calendar-today', title: 'Today', icon: '📅' },
      { type: 'todo-count', title: 'Tasks', icon: '✅' },
      { type: 'agent-stats', title: 'Agent', icon: '🤖' }
    ];
    this.allTypes = [
      { type: 'weather', title: 'Weather', icon: '🌤️' },
      { type: 'calendar-today', title: 'Today', icon: '📅' },
      { type: 'todo-count', title: 'Tasks', icon: '✅' },
      { type: 'agent-stats', title: 'Agent', icon: '🤖' }
    ];
    this.init();
  }

  init() {
    this.container.classList.add('widget-grid');
    this.renderLayout();
    this._initToolbar();
    this._initDrawer();
    this._startAutoRefresh();
  }

  registerWidget(type, factoryFn) {
    this.registry.set(type, factoryFn);
  }

  _loadLayout() {
    try {
      const raw = localStorage.getItem(this.storageKey);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length) return parsed;
      }
    } catch { /* ignore */ }
    return this.defaultLayout.map(w => ({ ...w, id: this._genId() }));
  }

  _saveLayout() {
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(this.widgets));
    } catch { /* quota */ }
  }

  _genId() {
    return 'w_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 6);
  }

  renderLayout() {
    const layout = this._loadLayout();
    this.widgets = layout;
    this.container.innerHTML = '';

    if (!layout.length) {
      this.container.appendChild(this._renderEmptyState());
      return;
    }

    layout.forEach((cfg, idx) => {
      const card = this._createCard(cfg, idx);
      this.container.appendChild(card);
    });
  }

  _renderEmptyState() {
    const wrapper = document.createElement('div');
    wrapper.className = 'widget-empty-state';
    wrapper.innerHTML = `
      <span class="widget-empty-state__icon">📂</span>
      <span class="widget-empty-state__text">No widgets added yet</span>
      <span class="widget-empty-state__hint">Tap <strong>+ Add</strong> to add your first widget</span>
    `;
    return wrapper;
  }

  _createCard(cfg, idx) {
    const card = document.createElement('div');
    card.className = 'widget-card';
    card.dataset.id = cfg.id;
    card.dataset.type = cfg.type;
    card.dataset.index = String(idx);
    card.setAttribute('role', 'region');
    card.setAttribute('aria-label', cfg.title || cfg.type);

    if (this.editMode) {
      card.classList.add('widget-card--editing');
      card.setAttribute('draggable', 'true');
    }

    const header = document.createElement('div');
    header.className = 'widget-card__header';

    const title = document.createElement('span');
    title.className = 'widget-card__title';
    title.textContent = cfg.title || cfg.type;

    const icon = document.createElement('span');
    icon.className = 'widget-card__icon';
    icon.textContent = cfg.icon || '◈';

    const editControls = document.createElement('div');
    editControls.className = 'widget-card__edit-controls';

    const dragHandle = document.createElement('button');
    dragHandle.className = 'widget-card__drag-handle';
    dragHandle.setAttribute('aria-label', 'Drag to reorder');
    dragHandle.setAttribute('title', 'Drag to reorder');
    dragHandle.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="8" y1="6" x2="16" y2="6"></line><line x1="8" y1="12" x2="16" y2="12"></line><line x1="8" y1="18" x2="16" y2="18"></line></svg>`;

    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'widget-card__delete-btn';
    deleteBtn.setAttribute('aria-label', 'Remove widget');
    deleteBtn.setAttribute('title', 'Remove widget');
    deleteBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>`;
    deleteBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.removeWidget(cfg.id);
    });

    editControls.appendChild(dragHandle);
    editControls.appendChild(deleteBtn);

    header.appendChild(title);
    header.appendChild(icon);
    card.appendChild(header);
    card.appendChild(editControls);

    const body = document.createElement('div');
    body.className = 'widget-card__body';
    card.appendChild(body);

    this._buildWidgetContent(card, cfg);
    this._attachDragEvents(card);
    return card;
  }

  _buildWidgetContent(card, cfg) {
    const body = card.querySelector('.widget-card__body');
    const factory = this.registry.get(cfg.type) || _globalRegistry.get(cfg.type);
    if (factory) {
      factory(body, cfg);
      return;
    }
    // Default built-in widget renderers
    switch (cfg.type) {
      case 'weather':
        this._renderWeatherWidget(body);
        break;
      case 'calendar-today':
        this._renderCalendarWidget(body);
        break;
      case 'todo-count':
        this._renderTodoWidget(body);
        break;
      case 'agent-stats':
        this._renderAgentWidget(body);
        break;
      default:
        body.innerHTML = '<span class="widget-placeholder">Widget</span>';
    }
  }

  _renderWeatherWidget(el) {
    el.innerHTML = '<span class="widget-placeholder">Loading weather…</span>';
    if (typeof NexusDB !== 'undefined') {
      NexusDB.list('weather_locations', { sort: 'sort_order', order: 'asc' }).then(res => {
        const locs = res.data || [];
        const loc = locs.find(l => l.is_home) || locs[0];
        if (loc && loc.current) {
          const t = Math.round(loc.current.temp ?? 0);
          const nameEl = document.createElement('div');
          nameEl.className = 'widget-metric';
          nameEl.innerHTML = `<span class="widget-metric__value">${t}°</span><span class="widget-metric__label"></span>`;
          nameEl.querySelector('.widget-metric__label').textContent = loc.name;
          el.innerHTML = '';
          el.appendChild(nameEl);
        } else {
          el.innerHTML = '<span class="widget-placeholder">No weather data</span>';
        }
      }).catch(() => {
        el.innerHTML = '<span class="widget-placeholder">No weather data</span>';
      });
    } else {
      el.innerHTML = '<span class="widget-placeholder">No weather data</span>';
    }
  }

  _renderCalendarWidget(el) {
    const today = new Date();
    const key = `ncc-calendar-${today.getFullYear()}-${today.getMonth()}`;
    const s = localStorage.getItem(key);
    let count = 0;
    if (s) {
      try {
        const events = JSON.parse(s);
        if (Array.isArray(events)) {
          const d = today.toISOString().split('T')[0];
          count = events.filter(e => e.date === d || (!e.date && e.start?.startsWith(d))).length;
        }
      } catch { /* ignore */ }
    }
    el.innerHTML = `<div class="widget-metric"><span class="widget-metric__value">${count}</span><span class="widget-metric__label">Events today</span></div>`;
  }

  _renderTodoWidget(el) {
    const s = localStorage.getItem('ncc-todo');
    let count = 0;
    if (s) {
      try {
        const data = JSON.parse(s);
        if (data && Array.isArray(data.todos)) {
          count = data.todos.filter(t => !t.done).length;
        }
      } catch { /* ignore */ }
    }
    el.innerHTML = `<div class="widget-metric"><span class="widget-metric__value">${count}</span><span class="widget-metric__label">Open tasks</span></div>`;
  }

  _renderAgentWidget(el) {
    el.innerHTML = '<div class="widget-metric"><span class="widget-metric__value">●</span><span class="widget-metric__label">Agent awake</span></div>';
  }

  addWidget(typeConfig) {
    const existing = this.widgets.find(w => w.type === typeConfig.type);
    if (existing) {
      if (window.toast) window.toast('Widget already added');
      return;
    }
    const cfg = { ...typeConfig, id: this._genId() };
    this.widgets.push(cfg);
    this._saveLayout();
    this.renderLayout();
    if (window.toast) window.toast(`${cfg.title || cfg.type} widget added`);
  }

  removeWidget(id) {
    this.widgets = this.widgets.filter(w => w.id !== id);
    this._saveLayout();
    this.renderLayout();
    if (window.toast) window.toast('Widget removed');
  }

  _initToolbar() {
    const addBtn = document.getElementById('widget-add-btn');
    const editBtn = document.getElementById('widget-edit-btn');
    if (addBtn) {
      const onAdd = () => this.openDrawer();
      addBtn.addEventListener('click', onAdd);
      this._toolbarListeners.push(() => addBtn.removeEventListener('click', onAdd));
    }
    if (editBtn) {
      const onEdit = () => {
        if (this.editMode) {
          this.exitEditMode();
          editBtn.classList.remove('widget-btn--active');
          editBtn.innerHTML = `
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"></path></svg>
            Edit
          `;
        } else {
          this.enterEditMode();
          editBtn.classList.add('widget-btn--active');
          editBtn.innerHTML = `
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"></polyline></svg>
            Done
          `;
        }
      };
      editBtn.addEventListener('click', onEdit);
      this._toolbarListeners.push(() => editBtn.removeEventListener('click', onEdit));
    }
  }

  _initDrawer() {
    this.drawerEl = document.getElementById('widget-drawer');
    this.drawerGridEl = document.getElementById('widget-drawer-grid');
    const closeBtn = document.getElementById('widget-drawer-close');
    const backdrop = document.getElementById('widget-drawer-backdrop');

    if (!this.drawerEl || !this.drawerGridEl) return;

    this._renderDrawerItems();

    const closeDrawer = () => this.closeDrawer();

    if (closeBtn) {
      closeBtn.addEventListener('click', closeDrawer);
      this.listeners.push(() => closeBtn.removeEventListener('click', closeDrawer));
    }
    if (backdrop) {
      backdrop.addEventListener('click', closeDrawer);
      this.listeners.push(() => backdrop.removeEventListener('click', closeDrawer));
    }

    this._boundKeydown = (e) => {
      if (e.key === 'Escape') this.closeDrawer();
    };
    document.addEventListener('keydown', this._boundKeydown);
  }

  _renderDrawerItems() {
    if (!this.drawerGridEl) return;
    this.drawerGridEl.innerHTML = '';
    this._drawerItems = [];
    this.allTypes.forEach(item => {
      const el = document.createElement('button');
      el.className = 'widget-drawer__item';
      el.setAttribute('type', 'button');
      el.innerHTML = `
        <span class="widget-drawer__item-icon">${item.icon}</span>
        <span class="widget-drawer__item-name">${item.title}</span>
      `;
      const onClick = () => {
        this.addWidget(item);
        this.closeDrawer();
      };
      el.addEventListener('click', onClick);
      this._drawerItems.push({ el, type: item.type, off: onClick });
      this.drawerGridEl.appendChild(el);
    });
  }

  openDrawer() {
    if (!this.drawerEl) return;
    this.drawerEl.classList.add('open');
    this.drawerEl.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
  }

  closeDrawer() {
    if (!this.drawerEl) return;
    this.drawerEl.classList.remove('open');
    this.drawerEl.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
  }

  enterEditMode() {
    if (this.editMode) return;
    this.editMode = true;
    this.renderLayout();
    const overlay = document.createElement('div');
    overlay.className = 'widget-grid__overlay';
    overlay.setAttribute(' aria-hidden', 'true');
    document.body.appendChild(overlay);
    this._overlay = overlay;
  }

  exitEditMode() {
    this.editMode = false;
    if (this._overlay) { this._overlay.remove(); this._overlay = null; }
    this.renderLayout();
  }

  _attachDragEvents(card) {
    if (!this.editMode) return;
    const dragStart = (e) => {
      this.dragSrc = card;
      e.dataTransfer.effectAllowed = 'move';
      card.classList.add('widget-card--dragging');
    };
    const dragEnd = () => {
      card.classList.remove('widget-card--dragging');
      this.dragSrc = null;
    };
    const dragOver = (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      return false;
    };
    const dragEnter = () => {
      card.classList.add('widget-card--over');
    };
    const dragLeave = () => {
      card.classList.remove('widget-card--over');
    };
    const drop = (e) => {
      e.stopPropagation();
      if (this.dragSrc && this.dragSrc !== card) {
        const srcIdx = Number(this.dragSrc.dataset.index);
        const tgtIdx = Number(card.dataset.index);
        if (!Number.isNaN(srcIdx) && !Number.isNaN(tgtIdx)) {
          const [moved] = this.widgets.splice(srcIdx, 1);
          this.widgets.splice(tgtIdx, 0, moved);
          this._saveLayout();
          this.renderLayout();
        }
      }
      card.classList.remove('widget-card--over');
      return false;
    };

    card.addEventListener('dragstart', dragStart);
    card.addEventListener('dragend', dragEnd);
    card.addEventListener('dragover', dragOver);
    card.addEventListener('dragenter', dragEnter);
    card.addEventListener('dragleave', dragLeave);
    card.addEventListener('drop', drop);

    this.listeners.push(
      () => card.removeEventListener('dragstart', dragStart),
      () => card.removeEventListener('dragend', dragEnd),
      () => card.removeEventListener('dragover', dragOver),
      () => card.removeEventListener('dragenter', dragEnter),
      () => card.removeEventListener('dragleave', dragLeave),
      () => card.removeEventListener('drop', drop)
    );
  }

  _startAutoRefresh() {
    const id = setInterval(() => this.renderLayout(), 60000);
    this.intervals.push(id);
  }

  destroy() {
    this.intervals.forEach(id => clearInterval(id));
    this.intervals = [];
    this.listeners.forEach(fn => { try { fn(); } catch { /* empty */ } });
    this.listeners = [];
    this._toolbarListeners.forEach(fn => { try { fn(); } catch {/* empty */} });
    this._toolbarListeners = [];
    if (this._boundKeydown) {
      document.removeEventListener('keydown', this._boundKeydown);
      this._boundKeydown = null;
    }
    this.closeDrawer();
    if (this._overlay) { this._overlay.remove(); this._overlay = null; }
    this.container.innerHTML = '';
    this.container.classList.remove('widget-grid');
  }
}
