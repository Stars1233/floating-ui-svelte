import type { FloatingContext } from "./use-floating.svelte.js";
import { useId } from "./use-id.js";
import type {
	ElementProps,
	ExtendedUserProps,
} from "./use-interactions.svelte.js";

type AriaRole =
	| "tooltip"
	| "dialog"
	| "alertdialog"
	| "menu"
	| "listbox"
	| "grid"
	| "tree";

type ComponentRole = "select" | "label" | "combobox";

interface UseRoleOptions {
	/**
	 * Whether the Hook is enabled, including all internal Effects and event
	 * handlers.
	 * @default true
	 */
	enabled?: boolean;
	/**
	 * The role of the floating element.
	 * @default 'dialog'
	 */
	role?: AriaRole | ComponentRole;
}

const componentRoleToAriaRoleMap = new Map<
	AriaRole | ComponentRole,
	AriaRole | false
>([
	["select", "listbox"],
	["combobox", "listbox"],
	["label", false],
]);

function useRole(
	context: FloatingContext,
	options: UseRoleOptions = {},
): ElementProps {
	const { open, floatingId } = $derived(context);

	const { enabled = true, role = "dialog" } = $derived(options);

	const ariaRole = $derived(
		(componentRoleToAriaRoleMap.get(role) ?? role) as
			| AriaRole
			| false
			| undefined,
	);

	// FIXME: Uncomment the commented code once useId and useFloatingParentNodeId are implemented.
	const referenceId = useId();
	const parentId = undefined;
	// const parentId = useFloatingParentNodeId();

	const isNested = parentId != null;

	const floatingProps = $derived({
		id: floatingId,
		...(ariaRole && { role: ariaRole }),
	});

	return {
		// @ts-expect-error - variable prop is not specific enough
		get reference() {
			if (!enabled) {
				return {};
			}
			if (ariaRole === "tooltip" || role === "label") {
				return {
					[`aria-${role === "label" ? "labelledby" : "describedby"}` as const]:
						open ? floatingId : undefined,
				};
			}
			return {
				"aria-expanded": open ? "true" : "false",
				"aria-haspopup": ariaRole === "alertdialog" ? "dialog" : ariaRole,
				"aria-controls": open ? floatingId : undefined,
				...(ariaRole === "listbox" && { role: "combobox" }),
				...(ariaRole === "menu" && { id: referenceId }),
				...(ariaRole === "menu" && isNested && { role: "menuitem" }),
				...(role === "select" && { "aria-autocomplete": "none" }),
				...(role === "combobox" && { "aria-autocomplete": "list" }),
			};
		},
		get floating() {
			if (!enabled) {
				return {};
			}
			if (ariaRole === "tooltip" || role === "label") {
				return floatingProps;
			}
			return {
				...floatingProps,
				...(ariaRole === "menu" && { "aria-labelledby": referenceId }),
			};
		},
		get item() {
			if (!enabled) {
				return {};
			}
			return ({ active, selected }: ExtendedUserProps) => {
				const commonProps = {
					role: "option",
					...(active && { id: `${context.floatingId}-option` }),
				};

				// For `menu`, we are unable to tell if the item is a `menuitemradio`
				// or `menuitemcheckbox`. For backwards-compatibility reasons, also
				// avoid defaulting to `menuitem` as it may overwrite custom role props.
				switch (role) {
					case "select":
						return {
							...commonProps,
							"aria-selected": active && selected,
						};
					case "combobox": {
						return {
							...commonProps,
							...(active && { "aria-selected": true }),
						};
					}
				}

				return {};
			};
		},
	};
}

export type { UseRoleOptions };
export { useRole };
