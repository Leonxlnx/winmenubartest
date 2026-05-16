/* ============================================================
   WinMenuBar settings panel
   ============================================================ */

const SECTIONS = [
  {
    title: 'Position',
    fields: [
      { key: 'position', type: 'segmented', options: [
        { value: 'left', label: 'Left' },
        { value: 'center', label: 'Center' },
        { value: 'right', label: 'Right' }
      ]},
      { key: 'topOffset', type: 'range', label: 'Top offset', min: 0, max: 40, step: 1, unit: 'px' }
    ]
  },
  {
    title: 'Size',
    fields: [
      { key: 'width', type: 'range', label: 'Width', min: 360, max: 1400, step: 10, unit: 'px' },
      { key: 'height', type: 'range', label: 'Height', min: 28, max: 56, step: 1, unit: 'px' },
      { key: 'cornerRadius', type: 'range', label: 'Corner radius', min: 0, max: 28, step: 1, unit: 'px' },
      { key: 'fontSize', type: 'range', label: 'Font size', min: 11, max: 16, step: 1, unit: 'px' }
    ]
  },
  {
    title: 'Appearance',
    fields: [
      { key: 'theme', type: 'segmented', options: [
        { value: 'dark', label: 'Dark' },
        { value: 'light', label: 'Light' }
      ]},
      { key: 'opacity', type: 'range', label: 'Background opacity', min: 0.2, max: 1, step: 0.05, unit: '' },
      { key: 'accent', type: 'color', label: 'Accent color' }
    ]
  },
  {
    title: 'Widgets',
    fields: [
      { key: 'showApple', type: 'toggle', label: 'Logo' },
      { key: 'showAppName', type: 'toggle', label: 'App name' },
      { key: 'showMenus', type: 'toggle', label: 'File / Edit menus' },
      { key: 'showSpotlight', type: 'toggle', label: 'Spotlight' },
      { key: 'showControlCenter', type: 'toggle', label: 'Control Center' },
      { key: 'showBluetooth', type: 'toggle', label: 'Bluetooth' },
      { key: 'showBattery', type: 'toggle', label: 'Battery' },
      { key: 'showWifi', type: 'toggle', label: 'Wi-Fi' },
      { key: 'showVolume', type: 'toggle', label: 'Volume' },
      { key: 'showClock', type: 'toggle', label: 'Clock' }
    ]
  },
  {
    title: 'Clock & name',
    fields: [
      { key: 'clockFormat', type: 'segmented', options: [
        { value: '24h', label: '24h' },
        { value: '12h', label: '12h' }
      ]},
      { key: 'showSeconds', type: 'toggle', label: 'Show seconds' },
      { key: 'appName', type: 'text', label: 'App name', placeholder: 'WinBar' }
    ]
  }
];

function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') node.className = v;
    else if (k === 'style') node.style.cssText = v;
    else if (k.startsWith('on')) node.addEventListener(k.slice(2), v);
    else node.setAttribute(k, v);
  }
  for (const c of [].concat(children)) {
    if (c == null) continue;
    node.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
  }
  return node;
}

function renderField(field, settings, onChange) {
  const wrap = el('div', { class: 'sp-field' });
  if (field.label && field.type !== 'segmented') {
    wrap.appendChild(el('label', { class: 'sp-label' }, field.label));
  }
  let control;
  const current = settings[field.key];
  switch (field.type) {
    case 'toggle': {
      const id = `sp-${field.key}`;
      const checkbox = el('input', { type: 'checkbox', id, class: 'sp-toggle-input' });
      checkbox.checked = !!current;
      checkbox.addEventListener('change', () => onChange(field.key, checkbox.checked));
      const track = el('label', { for: id, class: 'sp-toggle-track' }, el('span', { class: 'sp-toggle-thumb' }));
      control = el('div', { class: 'sp-toggle' }, [checkbox, track]);
      wrap.appendChild(el('div', { class: 'sp-row' }, [
        el('span', { class: 'sp-label' }, field.label),
        control
      ]));
      return wrap;
    }
    case 'range': {
      const input = el('input', { type: 'range', min: field.min, max: field.max, step: field.step, class: 'sp-range' });
      input.value = current;
      const valueEl = el('span', { class: 'sp-value' }, `${current}${field.unit || ''}`);
      input.addEventListener('input', () => {
        valueEl.textContent = `${input.value}${field.unit || ''}`;
        onChange(field.key, parseFloat(input.value));
      });
      wrap.appendChild(el('div', { class: 'sp-row sp-row-range' }, [input, valueEl]));
      return wrap;
    }
    case 'segmented': {
      const group = el('div', { class: 'sp-segmented' });
      for (const opt of field.options) {
        const btn = el('button', { class: 'sp-seg' + (current === opt.value ? ' is-active' : '') }, opt.label);
        btn.addEventListener('click', () => {
          group.querySelectorAll('.sp-seg').forEach((b) => b.classList.remove('is-active'));
          btn.classList.add('is-active');
          onChange(field.key, opt.value);
        });
        group.appendChild(btn);
      }
      wrap.appendChild(group);
      return wrap;
    }
    case 'color': {
      const input = el('input', { type: 'color', class: 'sp-color' });
      input.value = current;
      input.addEventListener('input', () => onChange(field.key, input.value));
      const hex = el('span', { class: 'sp-value' }, current);
      input.addEventListener('input', () => { hex.textContent = input.value; });
      wrap.appendChild(el('div', { class: 'sp-row' }, [input, hex]));
      return wrap;
    }
    case 'text': {
      const input = el('input', { type: 'text', class: 'sp-text', placeholder: field.placeholder || '' });
      input.value = current || '';
      input.addEventListener('input', () => onChange(field.key, input.value));
      wrap.appendChild(input);
      return wrap;
    }
    default:
      return wrap;
  }
}

export function renderSettingsPanel(panelEl, settings, { onChange, onReset, onClose }) {
  panelEl.innerHTML = '';

  const header = el('div', { class: 'sp-header' }, [
    el('strong', {}, 'Customize WinBar'),
    el('button', { class: 'sp-close', onclick: onClose, 'aria-label': 'Close' }, '×')
  ]);
  panelEl.appendChild(header);

  for (const section of SECTIONS) {
    panelEl.appendChild(el('div', { class: 'sp-section-title' }, section.title));
    const body = el('div', { class: 'sp-section' });
    for (const field of section.fields) {
      body.appendChild(renderField(field, settings, onChange));
    }
    panelEl.appendChild(body);
  }

  panelEl.appendChild(el('div', { class: 'sp-footer' }, [
    el('button', { class: 'sp-btn sp-btn-secondary', onclick: onReset }, 'Reset all'),
    el('button', { class: 'sp-btn sp-btn-primary', onclick: onClose }, 'Done')
  ]));
}
