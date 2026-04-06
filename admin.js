(function () {
  var STORAGE_KEY = 'mkua-admin-state-v1';
  var AUTH_KEY = 'mkua-admin-auth';
  var USERNAME = 'puntusyar';
  var PASSWORD = 'mkua2022';
  var state = loadState();
  var auth = sessionStorage.getItem(AUTH_KEY) === '1';
  var currentMode = null;
  var selectedElement = null;
  var launcher;
  var panel;
  var filePicker;
  var importPicker;

  document.addEventListener('DOMContentLoaded', init);

  function init() {
    assignKeys();
    applySavedState();
    buildUI();
    bindGlobalEvents();
  }

  function loadState() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    } catch (error) {
      return {};
    }
  }

  function saveState() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  function assignKeys() {
    tagElements(getTextCandidates(), 'text');
    tagElements(getImageCandidates(), 'image');
    tagElements(getBackgroundCandidates(), 'background');
    tagElements(getFormCandidates(), 'form');
  }

  function tagElements(elements, prefix) {
    elements.forEach(function (element, index) {
      if (!element.dataset.mkuaAdminKey) {
        element.dataset.mkuaAdminKey = prefix + '-' + index;
      }
    });
  }

  function buildUI() {
    launcher = document.createElement('button');
    launcher.type = 'button';
    launcher.className = 'mkua-admin-launcher';
    launcher.textContent = auth ? 'Админка' : 'Вход в админку';
    launcher.addEventListener('click', function () {
      if (auth) {
        togglePanel();
      } else {
        openLoginModal();
      }
    });
    document.body.appendChild(launcher);

    panel = document.createElement('aside');
    panel.className = 'mkua-admin-panel mkua-admin-hidden';
    panel.innerHTML = [
      '<header>',
      '  <div>',
      '    <h2>Админка MK UA</h2>',
      '    <p class="mkua-admin-note">Правки сохраняются локально в этом браузере.</p>',
      '  </div>',
      '  <button type="button" class="mkua-admin-btn" data-admin-close>Закрыть</button>',
      '</header>',
      '<div class="mkua-admin-body">',
      '  <div class="mkua-admin-grid">',
      '    <button type="button" class="mkua-admin-btn" data-mode="text">Тексты</button>',
      '    <button type="button" class="mkua-admin-btn" data-mode="image">Фото</button>',
      '    <button type="button" class="mkua-admin-btn" data-mode="background">Фоны</button>',
      '    <button type="button" class="mkua-admin-btn" data-mode="form">Формы</button>',
      '  </div>',
      '  <div class="mkua-admin-stack">',
      '    <button type="button" class="mkua-admin-btn" data-action="save">Сохранить</button>',
      '    <button type="button" class="mkua-admin-btn" data-action="export">Экспорт JSON</button>',
      '    <button type="button" class="mkua-admin-btn" data-action="import">Импорт JSON</button>',
      '    <button type="button" class="mkua-admin-btn is-danger" data-action="reset">Сбросить правки</button>',
      '    <button type="button" class="mkua-admin-btn" data-action="logout">Выйти</button>',
      '  </div>',
      '  <div class="mkua-admin-note">',
      '    Режим работы: выберите категорию и кликните по нужному элементу на странице.',
      '  </div>',
      '  <div class="mkua-admin-note" data-admin-status>Режим не выбран.</div>',
      '</div>'
    ].join('');
    document.body.appendChild(panel);

    filePicker = document.createElement('input');
    filePicker.type = 'file';
    filePicker.accept = 'image/*';
    filePicker.className = 'mkua-admin-hidden';
    document.body.appendChild(filePicker);

    importPicker = document.createElement('input');
    importPicker.type = 'file';
    importPicker.accept = 'application/json';
    importPicker.className = 'mkua-admin-hidden';
    document.body.appendChild(importPicker);

    panel.querySelector('[data-admin-close]').addEventListener('click', function () {
      panel.classList.add('mkua-admin-hidden');
      disableEditMode();
    });

    panel.querySelectorAll('[data-mode]').forEach(function (button) {
      button.addEventListener('click', function () {
        var mode = button.getAttribute('data-mode');
        if (currentMode === mode) {
          disableEditMode();
        } else {
          enableEditMode(mode);
        }
      });
    });

    panel.querySelector('[data-action="save"]').addEventListener('click', function () {
      saveState();
      flashStatus('Изменения сохранены в браузере.');
    });

    panel.querySelector('[data-action="export"]').addEventListener('click', exportState);
    panel.querySelector('[data-action="import"]').addEventListener('click', function () {
      importPicker.click();
    });
    panel.querySelector('[data-action="reset"]').addEventListener('click', resetState);
    panel.querySelector('[data-action="logout"]').addEventListener('click', logout);

    importPicker.addEventListener('change', function (event) {
      var file = event.target.files && event.target.files[0];
      if (!file) return;
      var reader = new FileReader();
      reader.onload = function () {
        try {
          state = JSON.parse(reader.result);
          saveState();
          applySavedState();
          flashStatus('Импорт завершен.');
        } catch (error) {
          flashStatus('Не удалось импортировать JSON.');
        }
      };
      reader.readAsText(file, 'utf-8');
      event.target.value = '';
    });
  }

  function bindGlobalEvents() {
    document.addEventListener('click', function (event) {
      if (!auth || !currentMode) return;
      if (event.target.closest('.mkua-admin-panel') || event.target.closest('.mkua-admin-launcher') || event.target.closest('.mkua-admin-overlay')) {
        return;
      }

      var candidate = findCandidate(event.target, currentMode);
      if (!candidate) return;

      event.preventDefault();
      event.stopPropagation();
      selectElement(candidate);
      openEditorFor(candidate, currentMode);
    }, true);
  }

  function getTextCandidates() {
    var selectors = '.tn-atom, .t-title, .t-descr, .t-text, .t-name, .t-uptitle, .t-menu__link-item, .t-btn, .tn-atom__button-text';
    return Array.prototype.slice.call(document.querySelectorAll(selectors)).filter(function (element) {
      if (element.closest('.mkua-admin-panel, .mkua-admin-overlay')) return false;
      if (element.querySelector('img, svg, input, textarea, select, form')) return false;
      return element.textContent && element.textContent.replace(/\s+/g, ' ').trim().length > 0;
    });
  }

  function getImageCandidates() {
    return Array.prototype.slice.call(document.querySelectorAll('img')).filter(function (element) {
      return !element.closest('.mkua-admin-panel, .mkua-admin-overlay, #tildacopy');
    });
  }

  function getBackgroundCandidates() {
    var selectors = '.t396__carrier, .t-bgimg, [style*="background-image"]';
    var seen = new Set();
    return Array.prototype.slice.call(document.querySelectorAll(selectors)).filter(function (element) {
      if (element.closest('.mkua-admin-panel, .mkua-admin-overlay')) return false;
      if (seen.has(element)) return false;
      var style = window.getComputedStyle(element).backgroundImage;
      if (!style || style === 'none') return false;
      seen.add(element);
      return true;
    });
  }

  function getFormCandidates() {
    var selectors = 'form, input, textarea, select, button';
    return Array.prototype.slice.call(document.querySelectorAll(selectors)).filter(function (element) {
      if (element.closest('.mkua-admin-panel, .mkua-admin-overlay')) return false;
      if (element.closest('#tildacopy')) return false;
      return true;
    });
  }

  function togglePanel() {
    panel.classList.toggle('mkua-admin-hidden');
    if (panel.classList.contains('mkua-admin-hidden')) {
      disableEditMode();
    }
  }

  function enableEditMode(mode) {
    currentMode = mode;
    document.body.classList.add('mkua-admin-mode');
    clearSelection();
    updateHighlights();
    updatePanelState();
    flashStatus(modeLabel(mode) + ': кликните по элементу на странице.');
  }

  function disableEditMode() {
    currentMode = null;
    clearSelection();
    document.body.classList.remove('mkua-admin-mode');
    removeHighlights();
    updatePanelState();
    flashStatus('Режим не выбран.');
  }

  function updatePanelState() {
    if (!panel) return;
    panel.querySelectorAll('[data-mode]').forEach(function (button) {
      button.classList.toggle('is-active', button.getAttribute('data-mode') === currentMode);
    });
  }

  function updateHighlights() {
    removeHighlights();
    getCandidatesForMode(currentMode).forEach(function (element) {
      element.classList.add('mkua-admin-highlight');
    });
  }

  function removeHighlights() {
    document.querySelectorAll('.mkua-admin-highlight').forEach(function (element) {
      element.classList.remove('mkua-admin-highlight');
    });
  }

  function clearSelection() {
    if (selectedElement) {
      selectedElement.classList.remove('mkua-admin-selected');
    }
    selectedElement = null;
  }

  function selectElement(element) {
    clearSelection();
    selectedElement = element;
    selectedElement.classList.add('mkua-admin-selected');
  }

  function findCandidate(target, mode) {
    var candidates = getCandidatesForMode(mode);
    return target.closest('[data-mkua-admin-key]') && candidates.indexOf(target.closest('[data-mkua-admin-key]')) > -1
      ? target.closest('[data-mkua-admin-key]')
      : candidates.find(function (element) { return element.contains(target); }) || null;
  }

  function getCandidatesForMode(mode) {
    if (mode === 'text') return getTextCandidates();
    if (mode === 'image') return getImageCandidates();
    if (mode === 'background') return getBackgroundCandidates();
    if (mode === 'form') return getFormCandidates();
    return [];
  }

  function openLoginModal() {
    var overlay = createModal('Вход в админку');
    overlay.body.innerHTML = [
      '<div class="mkua-admin-field">',
      '  <label class="mkua-admin-label">Логин</label>',
      '  <input class="mkua-admin-input" data-login-user autocomplete="username">',
      '</div>',
      '<div class="mkua-admin-field">',
      '  <label class="mkua-admin-label">Пароль</label>',
      '  <input class="mkua-admin-input" data-login-pass type="password" autocomplete="current-password">',
      '</div>',
      '<div class="mkua-admin-login-error" data-login-error></div>'
    ].join('');

    var loginButton = document.createElement('button');
    loginButton.type = 'button';
    loginButton.textContent = 'Войти';
    loginButton.addEventListener('click', function () {
      var user = overlay.body.querySelector('[data-login-user]').value.trim();
      var pass = overlay.body.querySelector('[data-login-pass]').value;
      if (user === USERNAME && pass === PASSWORD) {
        auth = true;
        sessionStorage.setItem(AUTH_KEY, '1');
        launcher.textContent = 'Админка';
        closeModal(overlay.root);
        panel.classList.remove('mkua-admin-hidden');
        flashStatus('Вход выполнен.');
      } else {
        overlay.body.querySelector('[data-login-error]').textContent = 'Неверный логин или пароль.';
      }
    });

    overlay.actions.appendChild(loginButton);
    document.body.appendChild(overlay.root);
  }

  function openEditorFor(element, mode) {
    if (mode === 'text') return openTextEditor(element);
    if (mode === 'image') return openImageEditor(element);
    if (mode === 'background') return openBackgroundEditor(element);
    if (mode === 'form') return openFormEditor(element);
  }

  function openTextEditor(element) {
    var overlay = createModal('Редактирование текста');
    var current = element.innerHTML;
    overlay.body.innerHTML = [
      '<div class="mkua-admin-field">',
      '  <label class="mkua-admin-label">HTML/текст элемента</label>',
      '  <textarea class="mkua-admin-textarea" data-text-editor></textarea>',
      '</div>'
    ].join('');
    overlay.body.querySelector('[data-text-editor]').value = current;

    var saveButton = document.createElement('button');
    saveButton.type = 'button';
    saveButton.textContent = 'Применить';
    saveButton.addEventListener('click', function () {
      var value = overlay.body.querySelector('[data-text-editor]').value;
      element.innerHTML = value;
      remember(element, { type: 'text', html: value });
      closeModal(overlay.root);
      flashStatus('Текст обновлен.');
    });
    overlay.actions.appendChild(saveButton);
    document.body.appendChild(overlay.root);
  }

  function openImageEditor(element) {
    var overlay = createModal('Редактирование изображения');
    overlay.body.innerHTML = [
      '<div class="mkua-admin-field">',
      '  <label class="mkua-admin-label">Ссылка на изображение</label>',
      '  <input class="mkua-admin-input" data-image-url>',
      '</div>',
      '<div class="mkua-admin-field">',
      '  <label class="mkua-admin-label">Alt текст</label>',
      '  <input class="mkua-admin-input" data-image-alt>',
      '</div>',
      '<div class="mkua-admin-row">',
      '  <button type="button" class="mkua-admin-btn" data-upload-image>Загрузить файл</button>',
      '  <button type="button" class="mkua-admin-btn" data-remove-image>Очистить src</button>',
      '</div>'
    ].join('');

    var urlInput = overlay.body.querySelector('[data-image-url]');
    var altInput = overlay.body.querySelector('[data-image-alt]');
    urlInput.value = element.getAttribute('src') || element.getAttribute('data-original') || '';
    altInput.value = element.getAttribute('alt') || '';

    overlay.body.querySelector('[data-upload-image]').addEventListener('click', function () {
      pickImage(function (dataUrl) {
        urlInput.value = dataUrl;
      });
    });

    overlay.body.querySelector('[data-remove-image]').addEventListener('click', function () {
      urlInput.value = '';
    });

    var saveButton = document.createElement('button');
    saveButton.type = 'button';
    saveButton.textContent = 'Применить';
    saveButton.addEventListener('click', function () {
      var src = urlInput.value.trim();
      var alt = altInput.value;
      setImageSource(element, src, alt);
      remember(element, { type: 'image', src: src, alt: alt });
      closeModal(overlay.root);
      flashStatus('Изображение обновлено.');
    });
    overlay.actions.appendChild(saveButton);
    document.body.appendChild(overlay.root);
  }

  function openBackgroundEditor(element) {
    var overlay = createModal('Редактирование фона');
    overlay.body.innerHTML = [
      '<div class="mkua-admin-field">',
      '  <label class="mkua-admin-label">Ссылка на фоновое изображение</label>',
      '  <input class="mkua-admin-input" data-bg-url>',
      '</div>',
      '<div class="mkua-admin-row">',
      '  <button type="button" class="mkua-admin-btn" data-upload-bg>Загрузить файл</button>',
      '  <button type="button" class="mkua-admin-btn" data-clear-bg>Убрать фон</button>',
      '</div>'
    ].join('');

    var urlInput = overlay.body.querySelector('[data-bg-url]');
    urlInput.value = getBackgroundUrl(element) || '';

    overlay.body.querySelector('[data-upload-bg]').addEventListener('click', function () {
      pickImage(function (dataUrl) {
        urlInput.value = dataUrl;
      });
    });

    overlay.body.querySelector('[data-clear-bg]').addEventListener('click', function () {
      urlInput.value = '';
    });

    var saveButton = document.createElement('button');
    saveButton.type = 'button';
    saveButton.textContent = 'Применить';
    saveButton.addEventListener('click', function () {
      var url = urlInput.value.trim();
      setBackground(element, url);
      remember(element, { type: 'background', url: url });
      closeModal(overlay.root);
      flashStatus('Фон обновлен.');
    });
    overlay.actions.appendChild(saveButton);
    document.body.appendChild(overlay.root);
  }

  function openFormEditor(element) {
    var overlay = createModal('Редактирование формы');
    var tag = element.tagName.toLowerCase();

    if (tag === 'form') {
      overlay.body.innerHTML = [
        '<div class="mkua-admin-field">',
        '  <label class="mkua-admin-label">Action</label>',
        '  <input class="mkua-admin-input" data-form-action>',
        '</div>',
        '<div class="mkua-admin-field">',
        '  <label class="mkua-admin-label">Method</label>',
        '  <input class="mkua-admin-input" data-form-method>',
        '</div>'
      ].join('');
      overlay.body.querySelector('[data-form-action]').value = element.getAttribute('action') || '';
      overlay.body.querySelector('[data-form-method]').value = element.getAttribute('method') || 'post';

      var saveFormButton = document.createElement('button');
      saveFormButton.type = 'button';
      saveFormButton.textContent = 'Применить';
      saveFormButton.addEventListener('click', function () {
        var action = overlay.body.querySelector('[data-form-action]').value.trim();
        var method = overlay.body.querySelector('[data-form-method]').value.trim() || 'post';
        if (action) {
          element.setAttribute('action', action);
        } else {
          element.removeAttribute('action');
        }
        element.setAttribute('method', method);
        remember(element, { type: 'form', action: action, method: method });
        closeModal(overlay.root);
        flashStatus('Параметры формы обновлены.');
      });
      overlay.actions.appendChild(saveFormButton);
    } else {
      overlay.body.innerHTML = [
        '<div class="mkua-admin-field">',
        '  <label class="mkua-admin-label">Текст / значение</label>',
        '  <input class="mkua-admin-input" data-field-value>',
        '</div>',
        '<div class="mkua-admin-field">',
        '  <label class="mkua-admin-label">Placeholder</label>',
        '  <input class="mkua-admin-input" data-field-placeholder>',
        '</div>',
        '<div class="mkua-admin-field">',
        '  <label class="mkua-admin-label">Name</label>',
        '  <input class="mkua-admin-input" data-field-name>',
        '</div>',
        '<div class="mkua-admin-row">',
        '  <button type="button" class="mkua-admin-btn" data-toggle-required></button>',
        '</div>'
      ].join('');

      var valueInput = overlay.body.querySelector('[data-field-value]');
      var placeholderInput = overlay.body.querySelector('[data-field-placeholder]');
      var nameInput = overlay.body.querySelector('[data-field-name]');
      var requiredButton = overlay.body.querySelector('[data-toggle-required]');
      var isRequired = element.hasAttribute('required');

      valueInput.value = tag === 'button' ? element.innerHTML : (element.value || element.textContent || '');
      placeholderInput.value = element.getAttribute('placeholder') || '';
      nameInput.value = element.getAttribute('name') || '';
      requiredButton.textContent = isRequired ? 'Поле обязательное' : 'Поле необязательное';
      requiredButton.classList.toggle('is-active', isRequired);
      requiredButton.addEventListener('click', function () {
        isRequired = !isRequired;
        requiredButton.textContent = isRequired ? 'Поле обязательное' : 'Поле необязательное';
        requiredButton.classList.toggle('is-active', isRequired);
      });

      var saveFieldButton = document.createElement('button');
      saveFieldButton.type = 'button';
      saveFieldButton.textContent = 'Применить';
      saveFieldButton.addEventListener('click', function () {
        var payload = {
          type: 'field',
          value: valueInput.value,
          placeholder: placeholderInput.value,
          name: nameInput.value,
          required: isRequired
        };
        applyFieldPayload(element, payload);
        remember(element, payload);
        closeModal(overlay.root);
        flashStatus('Элемент формы обновлен.');
      });
      overlay.actions.appendChild(saveFieldButton);
    }

    document.body.appendChild(overlay.root);
  }

  function applyFieldPayload(element, payload) {
    var tag = element.tagName.toLowerCase();
    if (tag === 'button') {
      element.innerHTML = payload.value;
    } else if ('value' in element) {
      element.value = payload.value;
    } else {
      element.textContent = payload.value;
    }

    if (payload.placeholder) {
      element.setAttribute('placeholder', payload.placeholder);
    } else {
      element.removeAttribute('placeholder');
    }

    if (payload.name) {
      element.setAttribute('name', payload.name);
    } else {
      element.removeAttribute('name');
    }

    if (payload.required) {
      element.setAttribute('required', 'required');
    } else {
      element.removeAttribute('required');
    }
  }

  function setImageSource(element, src, alt) {
    if (src) {
      element.setAttribute('src', src);
      if (element.hasAttribute('data-original')) {
        element.setAttribute('data-original', src);
      }
    } else {
      element.removeAttribute('src');
      element.removeAttribute('data-original');
    }
    element.setAttribute('alt', alt || '');
  }

  function getBackgroundUrl(element) {
    var inline = element.style.backgroundImage || '';
    var computed = window.getComputedStyle(element).backgroundImage || '';
    return extractUrl(inline) || extractUrl(computed) || '';
  }

  function setBackground(element, url) {
    element.style.backgroundImage = url ? 'url("' + url.replace(/"/g, '\\"') + '")' : 'none';
    if (element.hasAttribute('data-original')) {
      element.setAttribute('data-original', url);
    }
  }

  function extractUrl(backgroundImage) {
    var match = /url\(["']?(.*?)["']?\)/.exec(backgroundImage || '');
    return match ? match[1] : '';
  }

  function remember(element, payload) {
    state[element.dataset.mkuaAdminKey] = payload;
    saveState();
  }

  function applySavedState() {
    assignKeys();
    Object.keys(state).forEach(function (key) {
      var element = document.querySelector('[data-mkua-admin-key="' + key + '"]');
      var payload = state[key];
      if (!element || !payload) return;

      if (payload.type === 'text') {
        element.innerHTML = payload.html;
      } else if (payload.type === 'image') {
        setImageSource(element, payload.src || '', payload.alt || '');
      } else if (payload.type === 'background') {
        setBackground(element, payload.url || '');
      } else if (payload.type === 'form') {
        if (payload.action) element.setAttribute('action', payload.action);
        else element.removeAttribute('action');
        if (payload.method) element.setAttribute('method', payload.method);
      } else if (payload.type === 'field') {
        applyFieldPayload(element, payload);
      }
    });
  }

  function exportState() {
    var blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
    var link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'mkua-admin-export.json';
    document.body.appendChild(link);
    link.click();
    URL.revokeObjectURL(link.href);
    link.remove();
    flashStatus('JSON экспортирован.');
  }

  function resetState() {
    var confirmed = window.confirm('Удалить все локально сохраненные правки и перезагрузить страницу?');
    if (!confirmed) return;
    localStorage.removeItem(STORAGE_KEY);
    state = {};
    window.location.reload();
  }

  function logout() {
    auth = false;
    sessionStorage.removeItem(AUTH_KEY);
    panel.classList.add('mkua-admin-hidden');
    disableEditMode();
    launcher.textContent = 'Вход в админку';
    flashStatus('Вы вышли из админки.');
  }

  function pickImage(callback) {
    filePicker.onchange = function (event) {
      var file = event.target.files && event.target.files[0];
      if (!file) return;
      var reader = new FileReader();
      reader.onload = function () {
        callback(reader.result);
      };
      reader.readAsDataURL(file);
      event.target.value = '';
    };
    filePicker.click();
  }

  function modeLabel(mode) {
    if (mode === 'text') return 'Редактирование текстов';
    if (mode === 'image') return 'Редактирование фото';
    if (mode === 'background') return 'Редактирование фонов';
    if (mode === 'form') return 'Редактирование форм';
    return 'Режим не выбран';
  }

  function flashStatus(message) {
    var status = panel && panel.querySelector('[data-admin-status]');
    if (status) {
      status.textContent = message;
    }
  }

  function createModal(title) {
    var root = document.createElement('div');
    root.className = 'mkua-admin-overlay';
    root.innerHTML = [
      '<div class="mkua-admin-modal">',
      '  <header><h2>' + escapeHtml(title) + '</h2></header>',
      '  <div class="mkua-admin-modal-body"></div>',
      '  <div class="mkua-admin-modal-body">',
      '    <div class="mkua-admin-actions">',
      '      <button type="button" data-close-modal>Отмена</button>',
      '    </div>',
      '  </div>',
      '</div>'
    ].join('');

    var body = root.querySelector('.mkua-admin-modal-body');
    var actions = root.querySelector('.mkua-admin-actions');
    root.querySelector('[data-close-modal]').addEventListener('click', function () {
      closeModal(root);
    });
    root.addEventListener('click', function (event) {
      if (event.target === root) {
        closeModal(root);
      }
    });
    return { root: root, body: body, actions: actions };
  }

  function closeModal(root) {
    if (root && root.parentNode) {
      root.parentNode.removeChild(root);
    }
  }

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }
})();
