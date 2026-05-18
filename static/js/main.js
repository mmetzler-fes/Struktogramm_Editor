'use strict';

import { StructogramEditor } from './StructogramEditor.js';

document.addEventListener('DOMContentLoaded', () => {
	const editor = new StructogramEditor();
	editor.init();
	// Globale Referenz für Debug-Zwecke
	window.editor = editor;
});
