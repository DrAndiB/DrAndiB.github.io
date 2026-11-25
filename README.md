# DrAndiB.github.io
Personal website - andreasbraun.lu

`demos/tabletop-turbo/` is a published copy of the game. Its source, history and developer tools live in
[DrAndiB/TabletopTurbo](https://github.com/DrAndiB/TabletopTurbo); see its `_dev/README.md` for how to publish a new version here.

`demos/exploded/` holds the 3D exploded views. `exploded.js` and `exploded.css` are the shared viewer; each machine is one folder with a page and a definition file (`turbofan/`, `beam-engine/`). three.js and the fonts are self-hosted in `vendor/` and `fonts/`.

`demos/ai-gigafactory/` is the scroll-through AI gigafactory explainer: `index.html` (markup and styles), `gigafactory.js` (scene and choreography) and `land.js` (globe land points). three.js r170 with the few add-ons it needs and the fonts are self-hosted in its own `vendor/` and `fonts/`; it does not share the exploded-view copy of three.js. Add `?p=` (0 to 1.32) to jump to a scroll position and `?look=model` or `?look=blueprint` to fix the look.

All of its text lives in `demos/ai-gigafactory/copy.json` (`*italic*`, `[link](url)`, `{placeholders}` filled in by the page). Open the page with `#edit` at the end of the address to edit texts in place or in the "All texts" panel; "Copy changes" copies the edited texts as JSON. To apply such changes, update `copy.json`, then run `python _dev/sync-copy.py demos/ai-gigafactory` so the static HTML matches. The editor is `copy-edit.js` in the same folder.

`demos/quantum-computer/` is the scroll-through quantum computer explainer, built the same way: `index.html` (markup and styles), `quantum.js` (scene and choreography), `copy.json` (all text) and its own copy of `copy-edit.js`. It loads three.js and the fonts from `demos/ai-gigafactory/vendor/` and `demos/ai-gigafactory/fonts/`, so keep those when changing the gigafactory demo. Add `?p=` (0 to 1.44) to jump to a scroll position, `?look=model` or `?look=blueprint` to fix the look and `?d=3`, `5` or `7` for the code distance. Texts are edited as above: `#edit` on the page, then `python _dev/sync-copy.py demos/quantum-computer`.

`demos/overscored/` is the sheet-music demo: four scores with a player whose score follows the music. `index.html` (markup), `overscored.css`, `overscored.js` (piece switcher, player, score following) and `copy.json` (all text) with its own copy of `copy-edit.js`; texts are edited as above (`#edit` on the page, then `python _dev/sync-copy.py demos/overscored`). Each piece has `audio/<piece>.mp3`, `scores/<piece>/<piece>.pdf` with one `page-NN.svg` per page, and `data/<piece>.json` holding, for every bar, its start time in the recording and its box on the page as fractions of the page. Add `?piece=waterspout`, `omnibus`, `lunaison` or `ring` to open a piece directly. The scores were engraved with LilyPond and the audio rendered with FluidSynth (FluidR3 GM sound set); the sources are not in this repository.
