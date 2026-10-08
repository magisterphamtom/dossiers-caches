# État du module — Masquer les dossiers de journaux

## Fait (v1.0.0)
- Menu contextuel des dossiers (hook `getFolderContextOptions`, format v14 label/icon/visible/onClick, format v13 name/icon/condition/callback selon `game.release.generation`) : Masquer / Réafficher / Réafficher tous.
- Liste par utilisateur : tableau d'IDs dans `game.user.flags["dossiers-caches"].hidden`.
- Rendu via `renderDocumentDirectory` (sans jQuery) ; classes CSS `dc-hidden`, `dc-mode-hide`, `dc-mode-dim`, `dc-revealed`.
- Bouton œil dans l'en-tête de l'onglet (affiché seulement s'il y a des dossiers masqués) pour révéler temporairement.
- Réglages client : mode (masquer / griser), aussi dans les autres onglets (requiresReload).
- Compendiums exclus (fenêtres séparées).
- Basé sur le brouillon de Stéphane (id et titre repris) ; brouillon non compatible v13+ (jQuery, renderSidebarTab, réglage dans ready).

## À tester dans Foundry 14.368
- Clic droit sur un dossier de journaux : les entrées apparaissent (icônes correctes).
- Masquer un dossier contenant des sous-dossiers.
- Bouton œil dans l'en-tête : position, bascule.
- Côté joueur.
- Réglage « Aussi dans les autres onglets ».

## Points incertains
- Emplacement exact du bouton dans l'en-tête (`.header-actions`) selon la version.
- La recherche de l'onglet ne montre pas les journaux des dossiers masqués (comportement voulu ?).
