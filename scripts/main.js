/**
 * Masquer les dossiers de journaux
 * Clic droit sur un dossier de l'onglet Journaux → « Masquer ce dossier ».
 * Chaque utilisateur a sa propre liste de dossiers masqués (drapeau sur l'utilisateur).
 * Foundry VTT v13 / v14.
 */

const ID = 'dossiers-caches';
const FLAG = 'hidden';

const t = (key, data) => data ? game.i18n.format(`DC.${key}`, data) : game.i18n.localize(`DC.${key}`);
const setting = (key) => game.settings.get(ID, key);
const isV14 = () => (game.release?.generation ?? 13) >= 14;

/* -------------------------------------------- */
/*  Réglages                                    */
/* -------------------------------------------- */

Hooks.once('init', () => {
  game.settings.register(ID, 'mode', {
    name: 'DC.Settings.Mode.Name',
    hint: 'DC.Settings.Mode.Hint',
    scope: 'client',
    config: true,
    type: String,
    choices: {
      hide: 'DC.Settings.Mode.Hide',
      dim: 'DC.Settings.Mode.Dim'
    },
    default: 'hide',
    onChange: refreshAll
  });

  game.settings.register(ID, 'allTabs', {
    name: 'DC.Settings.AllTabs.Name',
    hint: 'DC.Settings.AllTabs.Hint',
    scope: 'client',
    config: true,
    type: Boolean,
    default: false,
    requiresReload: true
  });

  // État du bouton « afficher les dossiers masqués » (non visible dans les réglages)
  game.settings.register(ID, 'reveal', {
    scope: 'client',
    config: false,
    type: Boolean,
    default: false,
    onChange: refreshAll
  });
});

/* -------------------------------------------- */
/*  Données : dossiers masqués de l'utilisateur */
/* -------------------------------------------- */

function hiddenIds() {
  const v = game.user?.getFlag(ID, FLAG);
  return Array.isArray(v) ? [...v] : [];
}

function isHidden(folderId) {
  return hiddenIds().includes(folderId);
}

/** Un tableau est toujours remplacé en entier par setFlag : pas besoin d'opérateur de suppression. */
async function saveIds(ids) {
  try {
    await game.user.setFlag(ID, FLAG, [...new Set(ids)]);
    return true;
  } catch (err) {
    console.error(`${ID} | Impossible d'enregistrer les dossiers masqués`, err);
    ui.notifications.error(t('Errors.Save'));
    return false;
  }
}

function setHidden(folderId, hidden) {
  const ids = hiddenIds().filter(id => id !== folderId);
  if (hidden) ids.push(folderId);
  return saveIds(ids);
}

function showAll(documentName) {
  // on retire les dossiers de ce type (et ceux qui n'existent plus)
  return saveIds(hiddenIds().filter(id => {
    const folder = game.folders.get(id);
    return folder && folder.type !== documentName;
  }));
}

/* -------------------------------------------- */
/*  Quels onglets sont concernés                */
/* -------------------------------------------- */

function appliesTo(app) {
  const docName = app?.documentName ?? app?.constructor?.documentName;
  if (!docName) return false;
  // Les compendiums ont leur propre fenêtre : on ne touche qu'aux onglets de la barre latérale
  const Compendium = foundry.documents?.collections?.CompendiumCollection;
  if (Compendium && app?.collection instanceof Compendium) return false;
  if (docName === 'JournalEntry') return true;
  return setting('allTabs');
}

/* -------------------------------------------- */
/*  Affichage                                   */
/* -------------------------------------------- */

function decorate(app, root) {
  if (!root) return;
  const docName = app.documentName;
  const ids = new Set(hiddenIds());
  const reveal = setting('reveal');
  const mode = setting('mode');

  let count = 0;
  for (const li of root.querySelectorAll('li.folder')) {
    const folderId = li.dataset.folderId ?? li.dataset.entryId ?? li.dataset.uuid?.split('.').pop();
    const hidden = !!(folderId && ids.has(folderId));
    if (hidden) count++;
    li.classList.toggle('dc-hidden', hidden);
    li.classList.toggle('dc-mode-hide', hidden && !reveal && mode === 'hide');
    li.classList.toggle('dc-mode-dim', hidden && !reveal && mode === 'dim');
    li.classList.toggle('dc-revealed', hidden && reveal);
  }

  // Bouton dans l'en-tête : afficher / cacher les dossiers masqués
  root.querySelector('.dc-toggle-hidden')?.remove();
  const total = [...ids].filter(id => game.folders.get(id)?.type === docName).length;
  if (!total && !reveal) return;

  const btn = document.createElement('button');
  btn.type = 'button';
  btn.classList.add('dc-toggle-hidden', 'icon');
  if (reveal) btn.classList.add('active');
  btn.dataset.tooltip = reveal ? t('Header.HideAgain') : t('Header.Reveal', { count: total });
  btn.setAttribute('aria-label', btn.dataset.tooltip);
  btn.innerHTML = `<i class="fa-solid ${reveal ? 'fa-eye' : 'fa-eye-slash'}" inert></i><span class="dc-count">${total}</span>`;
  btn.addEventListener('click', async (event) => {
    event.preventDefault();
    event.stopPropagation();
    await game.settings.set(ID, 'reveal', !setting('reveal'));
  });

  const header = root.querySelector('.directory-header');
  const actions = header?.querySelector('.header-actions') ?? header?.querySelector('.header-search') ?? header;
  if (actions) actions.append(btn);
}

function refreshAll() {
  for (const app of sidebarDirectories()) {
    try { decorate(app, app.element); } catch (err) { console.error(`${ID} |`, err); }
  }
}

function sidebarDirectories() {
  const apps = new Set();
  for (const tab of Object.values(ui.sidebar?.tabs ?? {})) if (appliesTo(tab)) apps.add(tab);
  for (const app of foundry.applications.instances?.values?.() ?? []) if (appliesTo(app)) apps.add(app);
  return apps;
}

Hooks.on('renderDocumentDirectory', (app, html) => {
  try {
    if (!appliesTo(app)) return;
    decorate(app, html instanceof HTMLElement ? html : html?.[0] ?? app.element);
  } catch (err) {
    console.error(`${ID} | Erreur à l'affichage des dossiers`, err);
  }
});

// Un autre appareil du même utilisateur a changé la liste : on rafraîchit
Hooks.on('updateUser', (user, changes) => {
  if (user.id !== game.user.id) return;
  if (changes?.flags && Object.keys(changes.flags).some(k => k.includes(ID))) refreshAll();
});

/* -------------------------------------------- */
/*  Menu contextuel des dossiers                */
/* -------------------------------------------- */

function folderFromTarget(target) {
  const el = target instanceof HTMLElement ? target : target?.[0];
  const li = el?.closest?.('li.folder') ?? el;
  const id = li?.dataset?.folderId ?? li?.dataset?.entryId ?? li?.dataset?.uuid?.split('.').pop();
  return id ? game.folders.get(id) : null;
}

/** Trouve l'élément du dossier parmi les arguments, quel que soit leur ordre.
 *  v14 : onClick(event, target) — v13 : callback(target). */
function pickTarget(args) {
  for (const a of args) {
    if (a instanceof HTMLElement) return a;
    if (a?.[0] instanceof HTMLElement) return a[0];
  }
  return args.find(a => a?.currentTarget instanceof HTMLElement)?.currentTarget ?? null;
}

function makeEntry({ label, icon, visible, onClick }) {
  const check = (...args) => visible(pickTarget(args));
  const run = (...args) => onClick(pickTarget(args));
  if (isV14()) return { label, icon: `fa-solid ${icon}`, visible: check, onClick: run };
  return { name: label, icon: `<i class="fa-solid ${icon}"></i>`, condition: check, callback: run };
}

Hooks.on('getFolderContextOptions', (app, menuItems) => {
  try {
    if (!appliesTo(app)) return;

    menuItems.push(makeEntry({
      label: t('Menu.Hide'),
      icon: 'fa-eye-slash',
      visible: (target) => {
        const folder = folderFromTarget(target);
        return !!folder && !isHidden(folder.id);
      },
      onClick: async (target) => {
        const folder = folderFromTarget(target);
        if (!folder) return;
        if (await setHidden(folder.id, true)) {
          ui.notifications.info(t('Notifications.Hidden', { name: folder.name }));
          refreshAll();
        }
      }
    }));

    menuItems.push(makeEntry({
      label: t('Menu.Show'),
      icon: 'fa-eye',
      visible: (target) => {
        const folder = folderFromTarget(target);
        return !!folder && isHidden(folder.id);
      },
      onClick: async (target) => {
        const folder = folderFromTarget(target);
        if (!folder) return;
        if (await setHidden(folder.id, false)) {
          ui.notifications.info(t('Notifications.Shown', { name: folder.name }));
          refreshAll();
        }
      }
    }));

    menuItems.push(makeEntry({
      label: t('Menu.ShowAll'),
      icon: 'fa-eye-low-vision',
      visible: (target) => {
        const folder = folderFromTarget(target);
        return !!folder && hiddenIds().some(id => game.folders.get(id)?.type === folder.type);
      },
      onClick: async (target) => {
        const folder = folderFromTarget(target);
        if (!folder) return;
        if (await showAll(folder.type)) {
          await game.settings.set(ID, 'reveal', false);
          ui.notifications.info(t('Notifications.AllShown'));
          refreshAll();
        }
      }
    }));
  } catch (err) {
    console.error(`${ID} | Erreur dans le menu contextuel`, err);
  }
});
