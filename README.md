# DrAndiB.github.io
Personal website - andreasbraun.lu

`demos/tabletop-turbo/` is a published copy of the game. Its source, history and developer tools live in
[DrAndiB/TabletopTurbo](https://github.com/DrAndiB/TabletopTurbo); see its `_dev/README.md` for how to publish a new version here.

`demos/exploded/` holds the 3D exploded views. `exploded.js` and `exploded.css` are the shared viewer; each machine is one folder with a page and a definition file (`turbofan/`, `beam-engine/`). three.js and the fonts are self-hosted in `vendor/` and `fonts/`.

`demos/ai-gigafactory/` is the scroll-through AI gigafactory explainer: `index.html` (markup and styles), `gigafactory.js` (scene and choreography) and `land.js` (globe land points). three.js r170 with the few add-ons it needs and the fonts are self-hosted in its own `vendor/` and `fonts/`; it does not share the exploded-view copy of three.js. Add `?p=` (0 to 1.32) to jump to a scroll position and `?look=model` or `?look=blueprint` to fix the look.
