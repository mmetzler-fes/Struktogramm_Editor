'use strict';

import { TreeState }         from './TreeState.js';
import { BlockFactory }      from './BlockFactory.js';
import { BlockManager }      from './BlockManager.js';
import { Renderer }          from './Renderer.js';
import { DragDropManager }   from './DragDropManager.js';
import { SubprogramManager } from './SubprogramManager.js';
import { MermaidGenerator }  from './MermaidGenerator.js';
import { ExportManager }     from './ExportManager.js';

/**
 * StructogramEditor – Haupt-Controller der Anwendung.
 *
 * Alle Unterprogramme werden direkt unterhalb des Hauptprogramms
 * im Canvas gerendert und sind dort inline bearbeitbar.
 * Mehrere Blöcke können dasselbe Unterprogramm referenzieren (via subRef).
 */
export class StructogramEditor {
	constructor() {
		this.canvas = document.getElementById('canvas');

		// Zustands-Modelle
		this.mainTreeState     = new TreeState();
		this.subprogramManager = new SubprogramManager();

		// Komponenten
		this.renderer         = new Renderer(this.mainTreeState);
		this.blockManager     = new BlockManager(this.mainTreeState, this.renderer);
		this.dragDropManager  = new DragDropManager(this.blockManager, this.renderer, this);
		this.mermaidGenerator = new MermaidGenerator(this);
		this.exportManager    = new ExportManager(this);

		// Renderer-Callbacks
		this.renderer.onAfterRender    = () => this._onAfterRender();
		this.renderer.onEditSubprogram = null;
		this.renderer.onNodeTextChanged = (node) => {
			if (node.subRef) this._propagateSubRefText(node.subRef, node.text);
		};

		// Container-Referenzen für Multi-Sektion-Rendering
		this._mainDiv  = null;
		this._subDivs  = {};
	}

	/** Initialisiert die Anwendung (Event-Listener, erster Render). */
	init() {
		this._setupDraggables();
		this._setupContextMenu();
		this._setupToolbar();
		this._setupKeyboard();
		this._initSubprogramDialog();
		this.renderDiagram();
	}

	// ── Rendering ─────────────────────────────────────────────

	/** Baut den gesamten Canvas-Inhalt auf (Hauptprogramm + alle Unterprogramme). */
	renderDiagram() {
		this.canvas.innerHTML = '';
		this._subDivs = {};

		// Hauptprogramm
		this._mainDiv = document.createElement('div');
		this._mainDiv.className = 'nsd-main-section';
		this.canvas.appendChild(this._mainDiv);
		this.renderer.treeState        = this.mainTreeState;
		this.renderer.onEditSubprogram = null;
		this.renderer.renderInto(this._mainDiv);

		// Unterprogramme unterhalb (dedupliziert nach subRef)
		for (const { node, subRef } of this._collectSubprogramNodes(this.mainTreeState.root)) {
			const subState = this.subprogramManager.getOrCreate(subRef);
			this.canvas.appendChild(this._buildSubprogramSection(node, subRef, subState));
		}
	}

	/**
	 * Sammelt rekursiv alle eindeutigen Subprogram-Knoten aus einer Sequenz.
	 * Dedupliziert nach subRef, damit ein mehrfach gerufenes Unterprogramm
	 * nur eine Sektion erhält.
	 * @param {Array} seq
	 * @returns {Array<{node, subRef}>}
	 */
	_collectSubprogramNodes(seq) {
		const result   = [];
		const seenRefs = new Set();
		const collect  = (s) => {
			for (const node of s) {
				if (node.type === 'subprogram') {
					const ref = node.subRef || node.id;
					if (!seenRefs.has(ref)) {
						seenRefs.add(ref);
						result.push({ node, subRef: ref });
						// Auch den Baum dieses Unterprogramms rekursiv durchsuchen
						const subState = this.subprogramManager.get(ref);
						if (subState) collect(subState.root);
					}
				}
				if (node.children) collect(node.children);
				if (node.branches) for (const b of node.branches) collect(b.children || []);
			}
		};
		collect(seq);
		return result;
	}

	/**
	 * Erstellt eine Sektion für ein Unterprogramm mit vollem NSD-Inhalt.
	 * @param {object} node    – repräsentativer Knoten (für den Namen)
	 * @param {string} subRef  – Definitions-Schlüssel
	 * @param {TreeState} state
	 */
	_buildSubprogramSection(node, subRef, state) {
		const section = document.createElement('div');
		section.className = 'nsd-subprogram-section';
		section.dataset.subprogramId = subRef;

		const header = document.createElement('div');
		header.className = 'nsd-subprogram-section-header';
		const label = document.createElement('span');
		label.className = 'nsd-subprogram-label';
		label.textContent = `Unterprogramm: ${node.text}`;
		header.appendChild(label);
		section.appendChild(header);

		const nsdDiv = document.createElement('div');
		nsdDiv.className = 'nsd-subprogram-diagram';
		section.appendChild(nsdDiv);

		this._subDivs[subRef] = nsdDiv;

		// Render des Unterprogramm-NSD (ohne Cascade-Callback)
		const savedTreeState     = this.renderer.treeState;
		const savedOnAfterRender = this.renderer.onAfterRender;
		this.renderer.treeState     = state;
		this.renderer.onAfterRender = () => {}; // Verhindert Rendering-Kaskade
		this.renderer.renderInto(nsdDiv);
		this.renderer.treeState     = savedTreeState;
		this.renderer.onAfterRender = savedOnAfterRender;

		return section;
	}

	// ── Block-Operationen (kontext-bewusst) ───────────────────

	/**
	 * Fügt einen Block in die richtige TreeState ein.
	 * Für Typ 'subprogram': zeigt erst einen Auswahl-Dialog.
	 * @param {string|null} subId   – subRef der Ziel-Sektion (null = Hauptprogramm)
	 * @param {string}      type
	 * @param {object}      target
	 */
	addBlockTo(subId, type, target) {
		if (type === 'subprogram') {
			this._showSubprogramDialog()
				.then(({ text, subRef: existingRef }) => {
					const node = BlockFactory.createNode('subprogram', {
						text,
						subRef: existingRef || undefined
					});
					this._insertBlock(subId, node, target);
				})
				.catch(() => { /* Dialog abgebrochen */ });
			return;
		}
		this._insertBlock(subId, BlockFactory.createNode(type), target);
	}

	/** Interne Block-Einfügung mit Kontext-Wechsel. */
	_insertBlock(subId, node, target) {
		const [treeState, container] = this._resolveContext(subId);
		this.blockManager.treeState = treeState;
		this.renderer.treeState     = treeState;
		this.renderer.lastContainer = container;
		treeState.insertNode(node, target.containerId, target.branchIndex, target.insertIndex);
		this.renderer.renderInto(container);
		this.renderer.treeState     = this.mainTreeState;
		this.blockManager.treeState = this.mainTreeState;
	}

	/**
	 * Liefert [treeState, containerDiv] für einen subRef (oder null für Main).
	 */
	_resolveContext(subId) {
		if (subId) {
			return [this.subprogramManager.get(subId), this._subDivs[subId]];
		}
		return [this.mainTreeState, this._mainDiv];
	}

	// ── Dialog für Unterprogramm-Auswahl ──────────────────────

	_initSubprogramDialog() {
		const overlay = document.createElement('div');
		overlay.id = 'sub-dialog-overlay';
		overlay.style.cssText = [
			'display:none;position:fixed;inset:0;z-index:3000;',
			'background:rgba(0,0,0,0.4);justify-content:center;align-items:center;'
		].join('');
		overlay.innerHTML = `
			<div style="background:#fff;border-radius:10px;padding:24px;min-width:340px;max-width:460px;
				box-shadow:0 8px 32px rgba(0,0,0,0.22);font-family:inherit;">
				<h3 style="margin:0 0 18px;font-size:1.05em;color:#1e293b;">Unterprogramm einfügen</h3>
				<div id="sub-dlg-existing" style="display:none;margin-bottom:14px;">
					<p style="margin:0 0 8px;font-size:0.85em;font-weight:600;color:#475569;
						text-transform:uppercase;letter-spacing:.04em;">Vorhandenes verwenden</p>
					<div id="sub-dlg-list" style="display:flex;flex-direction:column;gap:4px;
						max-height:180px;overflow-y:auto;padding:6px;border:1px solid #e2e8f0;
						border-radius:6px;margin-bottom:14px;"></div>
					<hr style="border:none;border-top:1px solid #e2e8f0;margin:0 0 14px;">
				</div>
				<div id="sub-dlg-new-wrap">
					<p id="sub-dlg-new-label" style="margin:0 0 6px;font-size:0.85em;font-weight:600;
						color:#475569;text-transform:uppercase;letter-spacing:.04em;">Neues Unterprogramm</p>
					<input id="sub-dlg-name" type="text" value="Subprogramm"
						style="width:100%;box-sizing:border-box;padding:8px 10px;border:1px solid #e2e8f0;
						border-radius:6px;font-size:1em;outline:none;font-family:inherit;">
				</div>
				<div style="display:flex;gap:10px;justify-content:flex-end;margin-top:20px;">
					<button id="sub-dlg-cancel"
						style="padding:8px 18px;border:1px solid #e2e8f0;background:#fff;border-radius:6px;
						cursor:pointer;font-size:0.95em;">Abbrechen</button>
					<button id="sub-dlg-ok"
						style="padding:8px 18px;background:#3b82f6;color:#fff;border:none;border-radius:6px;
						cursor:pointer;font-weight:600;font-size:0.95em;">Hinzufügen</button>
				</div>
			</div>`;
		document.body.appendChild(overlay);
		this._subDialog = overlay;
	}

	/**
	 * Zeigt den Unterprogramm-Dialog.
	 * @returns {Promise<{text:string, subRef:string|null}>}
	 *   subRef=null  → neues Unterprogramm erstellen
	 *   subRef=id    → vorhandenes Unterprogramm referenzieren
	 */
	_showSubprogramDialog() {
		return new Promise((resolve, reject) => {
			const existing = this._collectSubprogramNodes(this.mainTreeState.root);
			const overlay  = this._subDialog;

			const existingSection = overlay.querySelector('#sub-dlg-existing');
			const list            = overlay.querySelector('#sub-dlg-list');
			const nameInput       = overlay.querySelector('#sub-dlg-name');
			const newLabel        = overlay.querySelector('#sub-dlg-new-label');
			const newWrap         = overlay.querySelector('#sub-dlg-new-wrap');

			// Zustand zurücksetzen
			list.innerHTML       = '';
			nameInput.value      = 'Subprogramm';
			nameInput.disabled   = false;
			nameInput.style.opacity = '1';
			newWrap.style.opacity   = '1';

			let selectedSubRef = null; // null → neues UP

			if (existing.length > 0) {
				existingSection.style.display = 'block';

				// Radio: "Neu"
				const newOpt = this._dialogRadio('__new__', '+ Neues Unterprogramm erstellen', true, true);
				newOpt.addEventListener('change', () => {
					selectedSubRef = null;
					nameInput.disabled     = false;
					nameInput.style.opacity = '1';
					newWrap.style.opacity   = '1';
				});
				list.appendChild(newOpt);

				// Radios: vorhandene UPs
				for (const { node, subRef } of existing) {
					const opt = this._dialogRadio(subRef, node.text, false, false);
					opt.addEventListener('change', () => {
						selectedSubRef = subRef;
						nameInput.disabled     = true;
						nameInput.style.opacity = '0.4';
						newWrap.style.opacity   = '0.4';
					});
					list.appendChild(opt);
				}
			} else {
				existingSection.style.display = 'none';
			}

			overlay.style.display = 'flex';
			nameInput.focus();
			nameInput.select();

			const cleanup = (result) => {
				overlay.style.display = 'none';
				btnOk.removeEventListener('click', onOk);
				btnCancel.removeEventListener('click', onCancel);
				overlay.removeEventListener('click', onOverlay);
				if (result) resolve(result);
				else reject();
			};

			const onOk = () => {
				if (selectedSubRef) {
					const found = existing.find(e => e.subRef === selectedSubRef);
					cleanup({ text: found ? found.node.text : selectedSubRef, subRef: selectedSubRef });
				} else {
					cleanup({ text: nameInput.value.trim() || 'Subprogramm', subRef: null });
				}
			};
			const onCancel  = () => cleanup(null);
			const onOverlay = (e) => { if (e.target === overlay) cleanup(null); };

			const btnOk     = overlay.querySelector('#sub-dlg-ok');
			const btnCancel = overlay.querySelector('#sub-dlg-cancel');
			btnOk.addEventListener('click', onOk);
			btnCancel.addEventListener('click', onCancel);
			overlay.addEventListener('click', onOverlay);
			nameInput.addEventListener('keydown', e => {
				if (e.key === 'Enter')  onOk();
				if (e.key === 'Escape') onCancel();
			});
		});
	}

	/** Hilfsmethode: erstellt eine Radio-Label-Zeile für den Dialog. */
	_dialogRadio(value, labelText, checked, bold) {
		const lbl = document.createElement('label');
		lbl.style.cssText = [
			'display:flex;align-items:center;gap:8px;cursor:pointer;',
			'padding:5px 8px;border-radius:5px;font-size:0.95em;',
			bold ? 'font-weight:600;color:#1e293b;' : 'color:#334155;'
		].join('');
		const radio = document.createElement('input');
		radio.type    = 'radio';
		radio.name    = 'sub-existing';
		radio.value   = value;
		radio.checked = checked;
		lbl.appendChild(radio);
		lbl.appendChild(document.createTextNode(labelText));
		lbl.addEventListener('mouseenter', () => lbl.style.background = '#f1f5f9');
		lbl.addEventListener('mouseleave', () => lbl.style.background = '');
		return lbl;
	}

	// ── Synchronisation der Unterprogramm-Sektionen ───────────

	/**
	 * Fügt fehlende Sektionen hinzu, entfernt veraltete, aktualisiert Labels.
	 * Wird von _onAfterRender aufgerufen.
	 */
	_syncSubprogramSections() {
		const subEntries = this._collectSubprogramNodes(this.mainTreeState.root);
		const subRefSet  = new Set(subEntries.map(e => e.subRef));

		for (const { node, subRef } of subEntries) {
			const section = this.canvas.querySelector(`[data-subprogram-id="${subRef}"]`);
			if (section) {
				// Label aktualisieren (falls Block umbenannt)
				const label = section.querySelector('.nsd-subprogram-label');
				if (label) label.textContent = `Unterprogramm: ${node.text}`;
			} else {
				// Neue Sektion hinzufügen
				const subState = this.subprogramManager.getOrCreate(subRef);
				this.canvas.appendChild(this._buildSubprogramSection(node, subRef, subState));
			}
		}

		// Veraltete Sektionen entfernen und Zustand bereinigen
		for (const id of Object.keys(this._subDivs)) {
			if (!subRefSet.has(id)) {
				this.canvas.querySelector(`[data-subprogram-id="${id}"]`)?.remove();
				delete this._subDivs[id];
				this.subprogramManager.delete(id);
			}
		}
	}

	// ── Interne Callbacks ─────────────────────────────────────

	/**
	 * Setzt node.text für alle Knoten mit demselben subRef in allen Bäumen.
	 * Wird aufgerufen bevor onAfterRender den Canvas neu zeichnet.
	 */
	_propagateSubRefText(subRef, text) {
		const update = (seq) => {
			for (const n of seq) {
				if (n.type === 'subprogram' && (n.subRef || n.id) === subRef) n.text = text;
				if (n.children) update(n.children);
				if (n.branches) for (const b of n.branches) update(b.children || []);
			}
		};
		update(this.mainTreeState.root);
		for (const [, state] of this.subprogramManager.entries()) update(state.root);
	}

	_onAfterRender() {
		this.mermaidGenerator.update();
		this.renderer.updateAllIfElseBlocks();
		this._syncSubprogramSections();
		this.dragDropManager.setupAllDropZones();
	}

	// ── Event-Setup ───────────────────────────────────────────

	_setupDraggables() {
		const draggables = document.querySelectorAll('.draggable-item');
		this.dragDropManager.setupDraggables(draggables);
	}

	_setupToolbar() {
		document.getElementById('save-btn').addEventListener('click',        () => this.exportManager.saveJSON());
		document.getElementById('load-btn').addEventListener('click',        () => document.getElementById('load-file-input').click());
		document.getElementById('save-mermaid-btn').addEventListener('click',() => this.exportManager.saveMermaid());
		document.getElementById('export-btn').addEventListener('click',      () => this.exportManager.copyMermaid());
		document.getElementById('export-nsd-btn').addEventListener('click',  () => this.exportManager.exportNSD());
		document.getElementById('export-pap-btn').addEventListener('click',  () => this.exportManager.exportPAP());
		document.getElementById('close-export-btn').addEventListener('click',() => {
			document.getElementById('export-modal').style.display = 'none';
		});

		document.getElementById('load-file-input').addEventListener('change', event => {
			const file = event.target.files[0];
			if (!file) return;
			const reader = new FileReader();
			reader.onload = e => {
				try {
					const data = JSON.parse(e.target.result);
					this.exportManager.loadJSON(data);
					alert('Diagramm geladen!');
				} catch (err) {
					alert('Fehler beim Laden: ' + err.message);
				}
			};
			reader.readAsText(file);
			event.target.value = '';
		});
	}

	_setupContextMenu() {
		const contextMenu = document.createElement('div');
		contextMenu.className = 'context-menu';
		contextMenu.style.cssText = 'display:none;position:absolute;background:white;border:1px solid #ccc;padding:5px;z-index:1000;box-shadow:2px 2px 5px rgba(0,0,0,0.2)';
		contextMenu.innerHTML = `
			<div class="menu-item" id="cm-add-case" style="display:none;cursor:pointer;padding:5px 10px;">Add Case</div>
			<div class="menu-item" id="cm-del-case" style="display:none;cursor:pointer;padding:5px 10px;color:#c0392b;">Delete Case</div>
			<div class="menu-item" id="cm-move"     style="cursor:pointer;padding:5px 10px;">&#x2B0C; Move Block</div>
			<div class="menu-item" id="cm-delete"   style="cursor:pointer;padding:5px 10px;color:#c0392b;">&#x1F5D1; Delete Block</div>
		`;
		document.body.appendChild(contextMenu);

		let currentBlockId         = null;
		let currentCaseBranchIndex = null;
		let currentSubId           = null; // null = Hauptprogramm

		document.addEventListener('contextmenu', e => {
			const block = e.target.closest('.nsd-block');
			if (!block) { contextMenu.style.display = 'none'; return; }
			e.preventDefault();
			currentBlockId = block.dataset.id;

			const subSection = e.target.closest('[data-subprogram-id]');
			currentSubId     = subSection ? subSection.dataset.subprogramId : null;

			const caseBranch = e.target.closest('.block-case-branch');
			if (caseBranch) {
				const parts = caseBranch.dataset.caseId.split('_branch_');
				currentCaseBranchIndex = parts.length === 2 ? parseInt(parts[1], 10) : null;
			} else {
				currentCaseBranchIndex = null;
			}

			const [treeState] = this._resolveContext(currentSubId);
			const found       = treeState.findNode(currentBlockId);
			const isCase      = found && found.node.type === 'case';
			document.getElementById('cm-add-case').style.display = isCase ? 'block' : 'none';
			document.getElementById('cm-del-case').style.display = (isCase && currentCaseBranchIndex !== null) ? 'block' : 'none';
			contextMenu.style.left = e.pageX + 'px';
			contextMenu.style.top  = e.pageY + 'px';
			contextMenu.style.display = 'block';
		});

		document.addEventListener('click', e => {
			contextMenu.style.display = 'none';
			if (this.blockManager.moveSourceId) {
				const zone = e.target.closest('.insertion-drop-zone');
				if (zone && zone.dataset.containerId) {
					e.stopPropagation();
					const srcSubId = this._moveSourceSubId;
					const dstSection = zone.closest('[data-subprogram-id]');
					const dstSubId = dstSection ? dstSection.dataset.subprogramId : null;

					if (srcSubId === dstSubId) {
						// Gleicher Kontext – normaler Move
						this.blockManager.moveBlock(this.blockManager.moveSourceId, this.renderer.decodeDropZone(zone));
					} else {
						// Kontext-übergreifender Move
						const [srcTree, srcContainer] = this._resolveContext(srcSubId);
						const [dstTree, dstContainer] = this._resolveContext(dstSubId);
						const node = srcTree.removeNode(this.blockManager.moveSourceId);
						if (node) {
							const target = this.renderer.decodeDropZone(zone);
							dstTree.insertNode(node, target.containerId, target.branchIndex, target.insertIndex);
							this.renderer.treeState = srcTree;
							this.renderer.renderInto(srcContainer);
							this.renderer.treeState = dstTree;
							this.renderer.renderInto(dstContainer);
						}
						this.blockManager.exitMoveMode();
					}
					this._moveSourceSubId = null;
					this.renderer.treeState     = this.mainTreeState;
					this.blockManager.treeState = this.mainTreeState;
				} else {
					this.blockManager.exitMoveMode();
					this._moveSourceSubId = null;
				}
			}
		});

		document.getElementById('cm-delete').addEventListener('click', e => {
			e.stopPropagation();
			if (currentBlockId) {
				this._withContext(currentSubId, () => this.blockManager.deleteBlock(currentBlockId));
				contextMenu.style.display = 'none';
			}
		});
		document.getElementById('cm-add-case').addEventListener('click', e => {
			e.stopPropagation();
			if (currentBlockId) {
				this._withContext(currentSubId, () => this.blockManager.addCaseOption(currentBlockId));
				contextMenu.style.display = 'none';
			}
		});
		document.getElementById('cm-del-case').addEventListener('click', e => {
			e.stopPropagation();
			if (currentBlockId !== null && currentCaseBranchIndex !== null) {
				this._withContext(currentSubId, () => this.blockManager.deleteCaseOption(currentBlockId, currentCaseBranchIndex));
				contextMenu.style.display = 'none';
			}
		});
		document.getElementById('cm-move').addEventListener('click', e => {
			if (currentBlockId) {
				e.stopPropagation();
				contextMenu.style.display = 'none';
				this._moveSourceSubId = currentSubId; // Quell-Kontext merken
				const [treeState, container] = this._resolveContext(currentSubId);
				this.blockManager.treeState = treeState;
				this.renderer.treeState     = treeState;
				this.renderer.lastContainer = container;
				this.blockManager.enterMoveMode(currentBlockId);
			}
		});
	}

	/**
	 * Führt eine Block-Operation im richtigen Kontext aus und stellt danach
	 * den Hauptzustand wieder her.
	 */
	_withContext(subId, operation) {
		const [treeState, container] = this._resolveContext(subId);
		this.blockManager.treeState = treeState;
		this.renderer.treeState     = treeState;
		this.renderer.lastContainer = container;
		operation();
		this.renderer.treeState     = this.mainTreeState;
		this.blockManager.treeState = this.mainTreeState;
	}

	_setupKeyboard() {
		document.addEventListener('keydown', e => {
			if (e.key === 'Escape' && this.blockManager.moveSourceId) {
				this.blockManager.exitMoveMode();
				this._moveSourceSubId = null;
				this.renderer.treeState     = this.mainTreeState;
				this.blockManager.treeState = this.mainTreeState;
			}
		});
	}
}
