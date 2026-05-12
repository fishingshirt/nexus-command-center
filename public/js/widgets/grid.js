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
    this.defaultLayout = [
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

    layout.forEach((cfg, idx) => {
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
      header.appendChild(title);
      header.appendChild(icon);
      card.appendChild(header);

      const body = document.createElement('div');
      body.className = 'widget-card__body';
      card.appendChild(body);

      this._buildWidgetContent(card, cfg);
      this._attachDragEvents(card);
      this.container.appendChild(card);
    });
  }

  _buildWidgetContent(card, cfg) {
    const body = card.querySelector('.widget-card__body');
    const factory = this.registry.get(cfg.type);
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
    const s = localStorage.getItem('ncc-weather-data');
    let html = '<span class="widget-placeholder">No data</span>';
    if (s) {
      try {
        const data = JSON.parse(s);
        html = `<div class="widget-metric"><span class="widget-metric__value">${data.temp ?? '--'}°</span><span class="widget-metric__label">${data.city ?? 'Local'}</span></div>`;
      } catch { /* ignore */ }
    }
    el.innerHTML = html;
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
    if (this._overlay) { this._overlay.remove(); this._overlay = null; }
    this.container.innerHTML = '';
    this.container.classList.remove('widget-grid');
  }
}
