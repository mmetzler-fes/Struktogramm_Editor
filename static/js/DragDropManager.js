'use strict';

/**
 * DragDropManager – Verwaltet Drag & Drop vom Toolbox in den Canvas.
 */
export class DragDropManager {
	/**
	 * @param {import('./BlockManager.js').BlockManager}         blockManager
	 * @param {import('./Renderer.js').Renderer}                 renderer
	 * @param {import('./StructogramEditor.js').StructogramEditor} editor
	 */
	constructor(blockManager, renderer, editor) {
		this.blockManager = blockManager;
		this.renderer     = renderer;
		this.editor       = editor;
	}

	/** Richtet Drag-Start-Events für alle Toolbox-Elemente ein. */
	setupDraggables(draggables) {
		draggables.forEach(d => {
			d.addEventListener('dragstart', e => {
				e.dataTransfer.setData('type', d.dataset.type);
				e.dataTransfer.effectAllowed = 'copy';
			});
		});
	}

	/**
	 * Richtet Drop-Events für alle `.insertion-drop-zone`-Elemente ein.
	 * Muss nach jedem Re-Render erneut aufgerufen werden.
	 * Drops in Unterprogramm-Sektionen werden via editor.addBlockTo() gerouted.
	 */
	setupAllDropZones() {
		document.querySelectorAll('.insertion-drop-zone').forEach(zone => {
			// Clone entfernt alte Event-Listener
			const nz = zone.cloneNode(true);
			zone.parentNode.replaceChild(nz, zone);

			nz.addEventListener('dragover',  e => { e.preventDefault(); nz.classList.add('active'); });
			nz.addEventListener('dragleave', ()  => nz.classList.remove('active'));
			nz.addEventListener('drop',      e  => {
				e.preventDefault();
				e.stopPropagation();
				nz.classList.remove('active');
				const type = e.dataTransfer.getData('type');
				if (!type) return;
				const target     = this.renderer.decodeDropZone(nz);
				const subSection = nz.closest('[data-subprogram-id]');
				const subId      = subSection ? subSection.dataset.subprogramId : null;
				this.editor.addBlockTo(subId, type, target);
			});
		});
	}
}
