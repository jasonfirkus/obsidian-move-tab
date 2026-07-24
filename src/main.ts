import { Plugin, WorkspaceLeaf, WorkspaceSplit, WorkspaceTabs } from 'obsidian';

type TabGroup = WorkspaceTabs & {
	children: WorkspaceLeaf[];
	removeChild(leaf: WorkspaceLeaf): void;
	insertChild(index: number, leaf: WorkspaceLeaf): void;
	selectTab(leaf: WorkspaceLeaf): void;
};

type TabGroupParent = WorkspaceSplit & {
	children: unknown[];
};

export default class MoveTab extends Plugin {
	async onload() {
		this.addCommand({
			id: 'left',
			name: 'Left',
			callback: () => this.moveTab(-1),
			hotkeys: [{ modifiers: ['Mod', 'Shift'], key: 'PageUp' }],
		});

		this.addCommand({
			id: 'right',
			name: 'Right',
			callback: () => this.moveTab(1),
			hotkeys: [{ modifiers: ['Mod', 'Shift'], key: 'PageDown' }],
		});
	}

	async moveTab(direction: -1 | 1) {
		const leaf = this.app.workspace.getMostRecentLeaf(
			this.app.workspace.rootSplit,
		);
		if (!leaf) return;

		if (!(leaf.parent instanceof WorkspaceTabs)) return;
		const group = leaf.parent as TabGroup;
		if (!Array.isArray(group.children)) return;

		const index = group.children.indexOf(leaf);
		if (index === -1) return;

		const target = group.children[index + direction];
		if (!target) {
			this.moveTabToAdjacentGroup(leaf, group, direction);
			return;
		}

		// avoid flashing due to race conditions
		const sourceState = { ...leaf.getViewState(), active: false };
		const targetState = { ...target.getViewState(), active: false };

		await target.setViewState(sourceState);
		this.app.workspace.setActiveLeaf(target, { focus: true });
		await leaf.setViewState(targetState);
	}

	moveTabToAdjacentGroup(
		leaf: WorkspaceLeaf,
		sourceGroup: TabGroup,
		direction: -1 | 1,
	) {
		const parent = sourceGroup.parent as TabGroupParent;
		if (!Array.isArray(parent.children)) return;

		const groupIndex = parent.children.indexOf(sourceGroup);
		const adjacentGroup = parent.children[groupIndex + direction];
		if (!(adjacentGroup instanceof WorkspaceTabs)) return;

		const targetGroup = adjacentGroup as TabGroup;
		if (
			!Array.isArray(targetGroup.children) ||
			typeof sourceGroup.removeChild !== 'function' ||
			typeof targetGroup.insertChild !== 'function'
		)
			return;

		sourceGroup.removeChild(leaf);
		targetGroup.insertChild(
			direction === -1 ? targetGroup.children.length : 0,
			leaf,
		);
		targetGroup.selectTab(leaf);
		this.app.workspace.setActiveLeaf(leaf, { focus: true });
		(
			this.app.workspace as typeof this.app.workspace & {
				requestResize?: () => void;
			}
		).requestResize?.();
	}
}
