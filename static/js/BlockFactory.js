'use strict';

export function generateId() {
	return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

/**
 * BlockFactory – Erstellt neue Knoten für den Struktogramm-Baum.
 */
export class BlockFactory {
	static getDefaultText(type) {
		const defaults = {
			command:      'Do something',
			if_else:      'Bedingung',
			for_loop:     'i = 0 to 10',
			while_loop:   'while condition',
			repeat_loop:  'until condition',
			subprogram:   'Subprogram Name',
			case:         'switch',
			exit:         'Exit'
		};
		return defaults[type] || type;
	}

	static createNode(type, options = {}) {
		const id   = generateId();
		const text = options.text || this.getDefaultText(type);

		if (['for_loop', 'while_loop', 'repeat_loop'].includes(type)) {
			return { id, type, text, children: [] };
		}
		if (type === 'if_else') {
			return { id, type, text, branches: [{ label: 'Ja', children: [] }, { label: 'Nein', children: [] }] };
		}
		if (type === 'case') {
			return { id, type, text, branches: [{ label: '1', children: [] }, { label: '2', children: [] }, { label: 'Default', children: [] }] };
		}
		if (type === 'subprogram') {
			// subRef ist der Definitions-Schlüssel. Mehrere Blöcke können denselben subRef teilen.
			return { id, type, text, subRef: options.subRef || id };
		}
		return { id, type, text };
	}
}
